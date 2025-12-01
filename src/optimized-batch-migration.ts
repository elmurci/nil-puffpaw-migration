console.log('🚀 Optimized Batch Migration (200 docs/user) - Starting...');

import { Client } from 'pg';
import { SecretVaultBuilderClient, SecretVaultUserClient } from '@nillion/secretvaults';
import { Keypair, Command } from '@nillion/nuc';
import { bytesToHex } from '@noble/curves/utils';
import { randomUUID } from 'node:crypto';
import { generateToken } from './util/misc';
import schema from '../cfg/schema.json' assert { type: 'json' };
import 'dotenv/config';
import crypto from 'node:crypto';

// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.POSTGRES_HOST!,
  port: parseInt(process.env.POSTGRES_PORT!),
  database: process.env.POSTGRES_DB || 'app',
  user: process.env.POSTGRES_USER!,
  password: process.env.POSTGRES_PASSWORD!,
};

// Optimized migration configuration based on Nillion team guidance
const config = {
  NILCHAIN_URL: process.env.NILCHAIN_URL || 'http://rpc.testnet.nilchain-rpc-proxy.nilogy.xyz',
  NILAUTH_URL: process.env.NILAUTH_URL || 'https://nilauth.sandbox.app-cluster.sandbox.nilogy.xyz',
  NILDB_NODES: process.env.NILDB_NODES ? process.env.NILDB_NODES.split(',') : [
    'https://nildb-stg-n1.nillion.network',
    'https://nildb-stg-n2.nillion.network', 
    'https://nildb-stg-n3.nillion.network',
  ],
  NIL_BUILDER_PRIVATE_KEY: process.env.NIL_BUILDER_PRIVATE_KEY!,
  DOCUMENTS_PER_BATCH: 200, // Javi's recommendation: 200 documents per request
};

console.log('📊 Optimized Migration Configuration:');
console.log(`  - Documents per batch: ${config.DOCUMENTS_PER_BATCH} (per user)`);
console.log(`  - Strategy: Group documents by user_id, batch 200 at a time`);

// Transform Puff table record to nilDB format with ENHANCED privacy controls
function transformPuffToNilDB(record: any): object {
  return {
    _id: randomUUID(),
    id: record.id,
    user_id: record.user_id,
    
    // 🔒 PRIVATE FIELDS - Encrypted with %allot
    vape_id: { "%allot": record.vape_id?.toString() || '' },
    pod_type: { "%allot": record.pod_type?.toString() || '' },
    pod_flavour: { "%allot": record.pod_flavour?.toString() || '' },
    pod_remaining: { "%allot": record.pod_remaining || 0 },
    pod_nicotine_level: { "%allot": record.pod_nicotine_level?.toString() || '0' },
    puff_duration: { "%allot": record.puff_duration || 1 },
    timestamp: { "%allot": record.timestamp ? record.timestamp.toISOString() : new Date().toISOString() },
    ip: { "%allot": record.ip || '' },
    nft_token_id: { "%allot": record.nft_token_id || 0 },
    
    // 📊 PUBLIC FIELDS - Non-identifiable analytics
    ble_name: record.ble_name || '',
    app_version: record.app_version || '',
    valid: record.valid !== null ? record.valid : true,
    nft_tier: record.nft_tier || 1,
    local_datetime: record.local_datetime || '',
    source: record.source || 'optimized-migration',
    uploaded_at: record.uploaded_at ? record.uploaded_at.toISOString() : new Date().toISOString(),
    is_settled: record.is_settled || false,
    settled_metadata: record.settled_metadata || {},
    is_delayed_upload: record.is_delayed_upload || false,
    flag: record.flag || '',
    lease_id: record.lease_id || 0,
    count: record.count || 1,
    created_at: record.created_at ? record.created_at.toISOString() : new Date().toISOString(),
    updated_at: record.updated_at ? record.updated_at.toISOString() : new Date().toISOString()
  };
}

// Create and cache user clients
const userClients = new Map<number, any>();

async function createUserForId(userId: number, pgClient: Client): Promise<any> {
  if (userClients.has(userId)) {
    return userClients.get(userId);
  }

  // Simple key generation without SecretKey.generate
  const keyHex = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const userKeypair = Keypair.from(keyHex);
  
  const userClient = await SecretVaultUserClient.from({
    keypair: userKeypair,
    urls: {
      chain: config.NILCHAIN_URL,
      auth: config.NILAUTH_URL,
      dbs: config.NILDB_NODES,
    },
    blindfold: { 
      operation: "store",
      useClusterKey: true  // 🔑 Replicate to all nodes
    }
  });

  userClients.set(userId, userClient);
  
  // 🔑 STORE KEY IMMEDIATELY IN POSTGRESQL!
  console.log(`  💾 Attempting to store key for user ${userId}...`);
  try {
    const result = await pgClient.query(`
      INSERT INTO nillion_login (user_id, nillion_key, nillion_did)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE 
      SET nillion_key = EXCLUDED.nillion_key,
          nillion_did = EXCLUDED.nillion_did,
          updated_at = NOW()
      RETURNING *
    `, [userId, keyHex, userClient.keypair.toDid().toString()]);
    console.log(`  ✅ Key stored successfully for user ${userId}`);
  } catch (err) {
    console.error(`  ❌ FAILED to store key for user ${userId}:`, err);
  }
  
  return userClient;
}

// Optimized function to write up to 200 documents per user per request
const writeUserOwnedData = async (
  userClient: SecretVaultUserClient,
  collectionId: string,
  documents: Array<Record<string, unknown>>,
  delegation: string,
  builderDid: string,
) => {
  return await userClient.createData(delegation, {
    owner: userClient.keypair.toDid().toString(),
    acl: {
      grantee: builderDid,
      read: true,
      write: false,
      execute: true,
    },
    collection: collectionId,
    data: documents, // Array of up to 200 documents
  });
};

async function optimizedBatchMigration() {
  let pgClient: Client | null = null;
  
  try {
    console.log('\n🏭 Starting OPTIMIZED batch migration (200 docs per user)...');
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

    // 🔑 CREATE NILLION_LOGIN TABLE AT THE BEGINNING
    console.log('🔑 Creating nillion_login table...');
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS nillion_login (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE,
        wallet_address TEXT,
        nillion_key TEXT NOT NULL,
        nillion_did TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Table nillion_login ready');

    // Create collection for migration
    const collectionId = randomUUID();
    const collection = {
      _id: collectionId,
      type: "owned",
      name: "PuffPaw Optimized Migration (Enhanced Privacy)",
      schema,
    };

    await builderClient.createCollection(collection);
    console.log(`✅ Created collection: ${collectionId}`);
    
    // Get actual total count
    const countResult = await pgClient.query('SELECT COUNT(*) FROM "Puff"');
    const actualTotalRecords = parseInt(countResult.rows[0].count);
    console.log(`📊 Database contains ${actualTotalRecords.toLocaleString()} total records`);

    // Get all unique users
    const usersResult = await pgClient.query('SELECT DISTINCT user_id FROM "Puff" ORDER BY user_id');
    const uniqueUserIds = usersResult.rows.map(row => row.user_id);
    console.log(`👥 Found ${uniqueUserIds.length.toLocaleString()} unique users`);

    // Migration statistics
    let totalProcessed = 0;
    let totalFailed = 0;
    let usersProcessed = 0;

    console.log(`\n🔄 Starting user-by-user migration (${config.DOCUMENTS_PER_BATCH} docs per batch)...`);

    // Process each user's data
    for (const userId of uniqueUserIds) {
      try {
        usersProcessed++;
        
        // Only log every 10 users to reduce spam
        if (usersProcessed % 10 === 0 || usersProcessed === 1) {
          console.log(`\n👤 Users processed: ${usersProcessed}/${uniqueUserIds.length} (${Math.round(usersProcessed/uniqueUserIds.length*100)}%)`);
        }

        // Get count of records for this user
        const userCountResult = await pgClient.query(
          'SELECT COUNT(*) FROM "Puff" WHERE user_id = $1',
          [userId]
        );
        const userRecordCount = parseInt(userCountResult.rows[0].count);

        // Create user client (stores key immediately!)
        const userClient = await createUserForId(userId, pgClient);
        
        if (!userClient || !userClient.keypair) {
          throw new Error(`Failed to create user client for user ${userId}`);
        }

        // Generate delegation token
        const delegation = await generateToken(
          builderClient.rootToken,
          new Command(['nil', 'db', 'data', 'create']),
          userClient.keypair.toDid(),
          3600,
          builderClient.keypair.privateKey()
        );

        // Process user's records in batches of 200
        let userProcessed = 0;
        let lastProcessedId = 0;

        while (userProcessed < userRecordCount) {
          // Fetch next batch for this user
          const result = await pgClient.query(`
            SELECT * FROM "Puff" 
            WHERE user_id = $1 AND id > $2
            ORDER BY id 
            LIMIT $3
          `, [userId, lastProcessedId, config.DOCUMENTS_PER_BATCH]);

          if (result.rows.length === 0) break;

          // Transform all records in this batch
          const batchDocuments = result.rows.map(record => {
            lastProcessedId = Math.max(lastProcessedId, record.id);
            return transformPuffToNilDB(record);
          });

          // Upload entire batch in one request (200 docs at once!)
          await writeUserOwnedData(
            userClient,
            collectionId,
            batchDocuments,
            delegation,
            builderClient.did.toString()
          );

          userProcessed += result.rows.length;
          totalProcessed += result.rows.length;
        }

        // Log progress every 100 users
        if (usersProcessed % 100 === 0) {
          console.log(`  📈 Progress: ${totalProcessed.toLocaleString()}/${actualTotalRecords.toLocaleString()} records (${Math.round(totalProcessed/actualTotalRecords*100)}%)`);
          console.log(`  🔑 Keys stored: ${userClients.size.toLocaleString()} users`);
        }

      } catch (userError) {
        console.error(`  ❌ User ${userId} failed:`, userError.message);
        totalFailed++;
      }
    }

    const totalTime = Math.round((Date.now() - startTime) / 1000);
    const averagePerSecond = Math.round(totalProcessed / totalTime);

    console.log(`\n🎉 Optimized migration completed!`);
    console.log(`📊 Final Results:`);
    console.log(`  - Records processed: ${totalProcessed.toLocaleString()}/${actualTotalRecords.toLocaleString()}`);
    console.log(`  - Users processed: ${usersProcessed}/${uniqueUserIds.length}`);
    console.log(`  - Records failed: ${totalFailed.toLocaleString()}`);
    console.log(`  - Success rate: ${Math.round((totalProcessed/(totalProcessed+totalFailed))*100)}%`);
    console.log(`  - User vaults created: ${userClients.size.toLocaleString()}`);
    console.log(`  - Collection ID: ${collectionId}`);
    console.log(`  - Total time: ${totalTime} seconds (${Math.round(totalTime/60)} minutes)`);
    console.log(`  - Average speed: ${averagePerSecond} records/second`);
    
    // Verify keys stored
    console.log(`\n🔑 Verifying stored keys...`);
    const keyCountResult = await pgClient.query('SELECT COUNT(*) FROM nillion_login');
    const keysStored = parseInt(keyCountResult.rows[0].count);
    console.log(`  ✅ Total keys in database: ${keysStored.toLocaleString()}`);

    console.log(`\n💡 Next steps:`);
    console.log(`  1. ✅ User keys stored in 'nillion_login' table`);
    console.log(`  2. Build web app for users to access their data`);
    console.log(`  3. Users log in → retrieve their nillion_key → access encrypted data`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
  } finally {
    if (pgClient) {
      try {
        await pgClient.end();
        console.log('✅ Disconnected from PostgreSQL');
      } catch (err) {
        console.log('⚠️ Error disconnecting:', err.message);
      }
    }
  }
}

// Run optimized migration
optimizedBatchMigration().catch(error => {
  console.error('❌ Caught error in main:', error);
});

