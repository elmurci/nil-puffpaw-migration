console.log('🚀 Large scale migration script starting...');

import { Client } from 'pg';
import { SecretVaultBuilderClient, SecretVaultUserClient } from '@nillion/secretvaults';
import { Keypair, Command } from '@nillion/nuc';
import { SecretKey } from '@nillion/blindfold';
import { bytesToHex } from '@noble/curves/utils';
import { randomUUID } from 'node:crypto';
import { generateToken } from './util/misc';
import schema from '../cfg/schema.json' assert { type: 'json' };
import 'dotenv/config';

// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.POSTGRES_HOST!,
  port: parseInt(process.env.POSTGRES_PORT!),
  database: process.env.POSTGRES_DB || 'app',
  user: process.env.POSTGRES_USER!,
  password: process.env.POSTGRES_PASSWORD!,
};

// Large migration configuration  
const config = {
  NILCHAIN_URL: process.env.NILCHAIN_URL || 'http://rpc.testnet.nilchain-rpc-proxy.nilogy.xyz',
  NILAUTH_URL: process.env.NILAUTH_URL || 'https://nilauth.sandbox.app-cluster.sandbox.nilogy.xyz',
  NILDB_NODES: process.env.NILDB_NODES ? process.env.NILDB_NODES.split(',') : [
    'https://nildb-stg-n1.nillion.network',
    'https://nildb-stg-n2.nillion.network', 
    'https://nildb-stg-n3.nillion.network',
  ],
  NIL_BUILDER_PRIVATE_KEY: process.env.NIL_BUILDER_PRIVATE_KEY!,
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE || '50000'),
  TOTAL_RECORDS: parseInt(process.env.TOTAL_RECORDS || '8867149'),
  BATCH_SLEEP_MS: parseInt(process.env.BATCH_SLEEP_MS || '0'),
  USE_CURSOR_PAGINATION: process.env.USE_CURSOR_PAGINATION === 'true',
};

console.log('📊 Migration Configuration:');
console.log(`  - Total records: ${config.TOTAL_RECORDS.toLocaleString()}`);
console.log(`  - Batch size: ${config.BATCH_SIZE.toLocaleString()}`);
console.log(`  - Batches needed: ${Math.ceil(config.TOTAL_RECORDS / config.BATCH_SIZE)}`);
console.log(`  - Pagination: ${config.USE_CURSOR_PAGINATION ? 'CURSOR-BASED (WHERE id > X) ⚡' : 'OFFSET-BASED'}`);
console.log(`  - Sleep between batches: ${config.BATCH_SLEEP_MS}ms`);
if (config.BATCH_SLEEP_MS === 0) {
  console.log(`  - 🚀 FULL SPEED MODE - No delays, Nillion can handle it!`);
} else {
  console.log(`  - Estimated time: ~${Math.ceil((config.TOTAL_RECORDS / config.BATCH_SIZE) * (config.BATCH_SLEEP_MS / 1000))} seconds`);
}

// Transform Puff table record to nilDB format with privacy controls
function transformPuffToNilDB(record: any): object {
  return {
    _id: randomUUID(),
    id: record.id,
    user_id: record.user_id,
    
    // 🔒 PRIVATE FIELDS - Encrypted with %allot (sensitive user data)
    vape_id: {
      "%allot": record.vape_id?.toString() || ''
    },
    pod_type: {
      "%allot": record.pod_type?.toString() || ''
    },
    pod_flavour: {
      "%allot": record.pod_flavour?.toString() || ''
    },
    pod_remaining: {
      "%allot": record.pod_remaining || 0
    },
    timestamp: {
      "%allot": record.timestamp ? record.timestamp.toISOString() : new Date().toISOString()
    },
    ip: {
      "%allot": record.ip || ''
    },
    nft_token_id: {
      "%allot": record.nft_token_id || 0
    },
    
    // 📊 PUBLIC FIELDS - Analytics data (non-sensitive)
    pod_id: record.pod_id?.toString() || '',
    pod_nicotine_level: record.pod_nicotine_level?.toString() || '0',
    puff_duration: record.puff_duration || 1,
    raw_data: record.raw_data || '',
    ua: record.ua || '',
    request_data: record.request_data || {},
    ble_id: record.ble_id || '',
    ble_name: record.ble_name || '',
    ble_mac: record.ble_mac?.toString() || '',
    session_id: record.session_id?.toString() || '',
    app_version: record.app_version || '',
    nonce: record.nonce?.toString() || '',
    valid: record.valid !== null ? record.valid : true,
    nft_tier: record.nft_tier || 1,
    local_datetime: record.local_datetime || '',
    source: record.source || 'large-migration',
    uploaded_at: record.uploaded_at ? record.uploaded_at.toISOString() : new Date().toISOString(),
    is_settled: record.is_settled || false,
    settled_metadata: record.settled_metadata || {},
    is_delayed_upload: record.is_delayed_upload || false,
    flag: record.flag || '',
    lease_id: record.lease_id || 0,
    lease_metadata: record.lease_metadata || {},
    count: record.count || 1,
    created_at: record.created_at ? record.created_at.toISOString() : new Date().toISOString(),
    updated_at: record.updated_at ? record.updated_at.toISOString() : new Date().toISOString()
  };
}

// Create and cache user clients for performance
const userClients = new Map<number, any>();

async function createUserForId(userId: number): Promise<any> {
  if (userClients.has(userId)) {
    return userClients.get(userId);
  }

  const secretKey = await SecretKey.generate(
    {"nodes": config.NILDB_NODES.map(url => ({ url }))}, 
    {"store": true}
  );
  
  const userKeypair = Keypair.from(bytesToHex(secretKey.material as Uint8Array));
  
  const userClient = await SecretVaultUserClient.from({
    baseUrls: config.NILDB_NODES,
    keypair: userKeypair,
    blindfold: {
      operation: "store"
    }
  });

  userClients.set(userId, userClient);
  return userClient;
}

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function largeMigration() {
  let pgClient: Client | null = null;
  
  try {
    console.log('\n🏭 Starting FULL SCALE migration of ALL Puff records to nilDB...');
    const startTime = Date.now();

    // Connect to PostgreSQL
    pgClient = new Client(pgConfig);
    await pgClient.connect();
    console.log('✅ Connected to PostgreSQL');

    // Setup Nillion builder client
    console.log('🔗 Connecting to Nillion...');
    const builderKeypair = Keypair.from(config.NIL_BUILDER_PRIVATE_KEY);
    const builderClient = await SecretVaultBuilderClient.from({
      keypair: builderKeypair,
      urls: {
        chain: config.NILCHAIN_URL,
        auth: config.NILAUTH_URL,
        dbs: config.NILDB_NODES,
      },
      blindfold: {
        operation: "store",
        useClusterKey: true
      }
    });

    await builderClient.refreshRootToken();
    console.log('✅ Connected to Nillion');

    // Create collection for large migration
    const collectionId = randomUUID();
    const collection = {
      _id: collectionId,
      type: "owned",
      name: "PuffPaw OPTIMIZED Large Migration 8.8M Records",
      schema,
    };

    await builderClient.createCollection(collection);
    console.log(`✅ Created collection: ${collectionId}`);
    
    // Get actual total count from database
    const countResult = await pgClient.query('SELECT COUNT(*) FROM "Puff"');
    const actualTotalRecords = parseInt(countResult.rows[0].count);
    console.log(`📊 Database contains ${actualTotalRecords.toLocaleString()} total records`);

    // Migration statistics
    let totalProcessed = 0;
    let totalFailed = 0;
    const uniqueUsers = new Set<number>();
    const batchCount = Math.ceil(actualTotalRecords / config.BATCH_SIZE);
    let lastProcessedId = 0; // Track last processed ID for cursor-based pagination

    console.log(`\n🔄 Starting migration of ${actualTotalRecords.toLocaleString()} records in ${batchCount} batches...`);
    console.log(`🚀 FULL SCALE MODE: Processing ALL records from your database!`);
    console.log(`⚡ Using ${config.USE_CURSOR_PAGINATION ? 'CURSOR-BASED (3x faster)' : 'OFFSET-BASED'} pagination`);

    // Process in batches using cursor-based pagination
    for (let batchNum = 1; batchNum <= batchCount; batchNum++) {
      const batchStart = Date.now();
      
      console.log(`\n📦 Batch ${batchNum}/${batchCount} (cursor: id > ${lastProcessedId})`);

      try {
        // Use cursor-based or offset-based query based on configuration
        let query: string;
        let params: any[];

        if (config.USE_CURSOR_PAGINATION) {
          // OPTIMIZED: Cursor-based pagination (consistent speed)
          query = `
            SELECT * FROM "Puff" 
            WHERE id > $1
            ORDER BY id 
            LIMIT $2
          `;
          params = [lastProcessedId, config.BATCH_SIZE];
        } else {
          // LEGACY: Offset-based pagination (degrades with large offsets)
          const offset = (batchNum - 1) * config.BATCH_SIZE;
          query = `
            SELECT * FROM "Puff" 
            ORDER BY id 
            LIMIT $1 OFFSET $2
          `;
          params = [config.BATCH_SIZE, offset];
        }

        // Fetch batch from PostgreSQL
        const result = await pgClient.query(query, params);

        console.log(`  📥 Retrieved ${result.rows.length} records`);

        if (result.rows.length === 0) {
          console.log('  ⚠️  No more records, ending migration');
          break;
        }

        // Process each record in the batch
        let batchProcessed = 0;
        let batchFailed = 0;
        let batchLastId = lastProcessedId;

        for (const record of result.rows) {
          try {
            uniqueUsers.add(record.user_id);
            
            // Track the highest ID in this batch for cursor pagination
            if (record.id > batchLastId) {
              batchLastId = record.id;
            }
            
            // Transform to nilDB format
            const nilDBData = transformPuffToNilDB(record);
            
            // Create or get user client
            const userClient = await createUserForId(record.user_id);
            
            // Generate delegation token for this user
            const delegation = await generateToken(
              builderClient.rootToken,
              new Command(['nil', 'db', 'data', 'create']),
              userClient.keypair.toDid(),
              3600, // 1 hour
              builderClient.keypair.privateKey()
            );

            // Upload to nilDB with user ownership
            await userClient.createData(delegation, {
              owner: userClient.keypair.toDid().toString(),
              acl: {
                grantee: builderClient.did.toString(),
                read: true,
                write: false,
                execute: true,
              },
              collection: collectionId,
              data: [nilDBData],
            });

            batchProcessed++;
            totalProcessed++;

          } catch (error) {
            batchFailed++;
            totalFailed++;
            if (batchFailed <= 3) { // Only log first few errors per batch
              console.error(`    ❌ Failed record ${record.id}:`, error.message);
            }
          }
        }

        // Update cursor position for next batch
        lastProcessedId = batchLastId;

        const batchTime = Date.now() - batchStart;
        const recordsPerSecond = Math.round(batchProcessed / (batchTime / 1000));
        
        console.log(`  ✅ Batch completed: ${batchProcessed}/${result.rows.length} records (${recordsPerSecond}/sec)`);
        console.log(`  📊 Progress: ${totalProcessed.toLocaleString()}/${actualTotalRecords.toLocaleString()} (${Math.round(totalProcessed/actualTotalRecords*100)}%)`);
        console.log(`  👥 Unique users: ${uniqueUsers.size.toLocaleString()}`);
        console.log(`  🏦 User vaults: ${userClients.size.toLocaleString()}`);

        // No sleep needed - Nillion can handle the load!
        if (batchNum < batchCount && config.BATCH_SLEEP_MS > 0) {
          console.log(`  😴 Sleeping ${config.BATCH_SLEEP_MS}ms...`);
          await sleep(config.BATCH_SLEEP_MS);
        }

      } catch (batchError) {
        console.error(`❌ Batch ${batchNum} failed:`, batchError.message);
        // Continue with next batch
      }
    }

    const totalTime = Math.round((Date.now() - startTime) / 1000);
    const averagePerSecond = Math.round(totalProcessed / totalTime);

    console.log(`\n🎉 Large migration completed!`);
    console.log(`📊 Final Results:`);
    console.log(`  - Records processed: ${totalProcessed.toLocaleString()}/${actualTotalRecords.toLocaleString()}`);
    console.log(`  - Records failed: ${totalFailed.toLocaleString()}`);
    console.log(`  - Success rate: ${Math.round((totalProcessed/(totalProcessed+totalFailed))*100)}%`);
    console.log(`  - Unique users: ${uniqueUsers.size.toLocaleString()}`);
    console.log(`  - User vaults created: ${userClients.size.toLocaleString()}`);
    console.log(`  - Collection ID: ${collectionId}`);
    console.log(`  - Total time: ${totalTime} seconds`);
    console.log(`  - Average speed: ${averagePerSecond} records/second`);
    
    console.log(`\n💡 Next steps:`);
    console.log(`  1. Query and verify the migrated data`);
    console.log(`  2. Set up analytics dashboards`);
    console.log(`  3. Implement user reward systems`);
    console.log(`  4. Scale to full database if satisfied`);

  } catch (error) {
    console.error('❌ Large migration failed:', error);
    console.error('Error details:', error.message);
  } finally {
    if (pgClient) {
      try {
        await pgClient.end();
        console.log('✅ Disconnected from PostgreSQL');
      } catch (err) {
        console.log('⚠️ Error disconnecting from PostgreSQL:', err.message);
      }
    }
  }
}

// Run large migration
largeMigration().catch(error => {
  console.error('❌ Caught error in main:', error);
});

