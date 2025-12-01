console.log('🚀 Large scale migration script starting...');

import { Client } from 'pg';
import { NucCmd, SecretVaultBuilderClient, SecretVaultUserClient } from '@nillion/secretvaults';
import { bytesToHex } from '@noble/curves/utils';
import { randomUUID } from 'node:crypto';
import { generateDelegationToken } from './util/misc';
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { Signer, NilauthClient, Command } from "@nillion/nuc";
import schema from '../cfg/schema.json' assert { type: 'json' };
import 'dotenv/config';
import fs from 'fs';

console.warn = () => {};

const handleError = (error: string, critical: boolean = false) => {
  console.error(error);
  if (critical) process.exit(1);
}

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
  BATCH_SLEEP_MS: parseInt(process.env.BATCH_SLEEP_MS || '1000'),
  USE_CURSOR_PAGINATION: process.env.USE_CURSOR_PAGINATION === 'true',
  LAST_PROCESSED: process.env.LAST_PROCESSED || 0,
  MAX_PROCESSED:  process.env.MAX_PROCESSED || 0,
  NIL_COLLECTION_ID: process.env.NIL_COLLECTION_ID,
};

const builderSigner = await Signer.fromPrivateKey(config.NIL_BUILDER_PRIVATE_KEY, "nil");
const builderDid = await builderSigner.getDid();
const nilauthClient = await NilauthClient.create({ baseUrl: config.NILAUTH_URL });

// Transform Puff table record to nilDB format with privacy controls
// Based on Nillion team guidance - removed identifiable fields and made user habits private
function transformPuffToNilDB(record: any): object {
  return {
    _id: randomUUID(),
    id: record.id,
    user_id: record.user_id,
    
    // 🔒 PRIVATE FIELDS - Encrypted with %allot (sensitive user data & habits)
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
    pod_nicotine_level: {
      "%allot": record.pod_nicotine_level?.toString() || '0'  // ✅ NOW PRIVATE - user preference
    },
    puff_duration: {
      "%allot": record.puff_duration || 1  // ✅ NOW PRIVATE - user habit
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
    
    // 📊 PUBLIC FIELDS - Non-identifiable analytics data
    // ❌ REMOVED: pod_id, raw_data, ua, nonce, ble_mac, session_id, ble_id, lease_metadata
    ble_name: record.ble_name || '',
    app_version: record.app_version || '',
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
    count: record.count || 1,
    created_at: record.created_at ? record.created_at.toISOString() : new Date().toISOString(),
    updated_at: record.updated_at ? record.updated_at.toISOString() : new Date().toISOString()
  };
}

// Create and cache user clients for performance
const userClients = new Map<number, any>();

async function createUserForId(userId: number, pgClient: Client): Promise<any> {
  if (userClients.has(userId)) {
    // console.log(`               User ${userId} (${(await userClients.get(userId).signer.getDid()).didString}) already existed, returning its client`)
    return userClients.get(userId);
  }

  const userPk = bytesToHex(secp256k1.utils.randomSecretKey());
  const userSigner = Signer.fromPrivateKey(userPk);
  const userDid = await userSigner.getDid();
  const userClient = await SecretVaultUserClient.from({
    signer: userSigner,
    baseUrls: config.NILDB_NODES,
    blindfold: { operation: "store" },
  });

  userClients.set(userId, userClient);
  
  try {
    await pgClient.query(`
      INSERT INTO nillion_login (user_id, nillion_key, nillion_did)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE 
      SET nillion_key = EXCLUDED.nillion_key,
          nillion_did = EXCLUDED.nillion_did,
          updated_at = NOW()
    `, [userId, userPk, userDid.didString.toString()]);
    // Only log occasionally to avoid spam
    if (userClients.size % 50 === 0) {
      console.log(`  🔑 ${userClients.size} user keys stored so far...`);
    }
  } catch (err) {
    handleError(`  ⚠️ Failed to store key for user ${userId}: ${err}`, true);
  }
  
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

    let collectionId = config.NIL_COLLECTION_ID;

    // Connect to PostgreSQL
    pgClient = new Client(pgConfig);
    await pgClient.connect();
    console.log('✅ Connected to PostgreSQL');

    // Setup Nillion builder client
    console.log('🔗 Connecting to Nillion...', builderDid.didString);
    const builderSigner = Signer.fromPrivateKey(config.NIL_BUILDER_PRIVATE_KEY, "nil");
    const builderClient = await SecretVaultBuilderClient.from({
          signer: builderSigner,
          nilauthClient,
          dbs: config.NILDB_NODES,
          blindfold: { operation: "store" },
    });

    await builderClient.refreshRootToken();
    console.log('✅ Connected to Nillion');

    // console.log('🔑 Creating nillion_login table...');
    // await pgClient.query(`
    //   CREATE TABLE IF NOT EXISTS nillion_login (
    //     id SERIAL PRIMARY KEY,
    //     user_id INTEGER NOT NULL UNIQUE,
    //     wallet_address TEXT,
    //     nillion_key TEXT NOT NULL,
    //     nillion_did TEXT NOT NULL,
    //     created_at TIMESTAMP DEFAULT NOW(),
    //     updated_at TIMESTAMP DEFAULT NOW()
    //   );
    // `);
    // console.log('✅ Table nillion_login ready');

    if (!collectionId) {
      // Create collection for large migration
      collectionId = randomUUID();
      const collection = {
        _id: collectionId,
        type: "owned",
        name: "PuffPaw OPTIMIZED Large Migration",
        schema,
      };

      await builderClient.createCollection(collection);
      console.log(`✅ Created collection: ${collectionId}`);
    } else {
      console.log('Using existing collection id', collectionId);
    }
    
    // Get actual total count from database
    let lastProcessedId = config.LAST_PROCESSED; // Track last processed ID for cursor-based pagination
    const countResultTotal = await pgClient.query('SELECT COUNT(*) FROM "Puff"');
    const countResult =  await pgClient.query(
      `
        SELECT COUNT(*) FROM "Puff" 
        WHERE id > $1 ${config.MAX_PROCESSED ? 'AND id < $2' : ''}
      `,
      config.MAX_PROCESSED 
          ? [lastProcessedId, config.MAX_PROCESSED]
          : [lastProcessedId]
    );

    const actualTotalRecords = parseInt(countResultTotal.rows[0].count);
    const actualCountRecords = parseInt(countResult.rows[0].count);
    console.log(`📊 Database contains ${actualTotalRecords.toLocaleString()} total records, we will be processing ${actualCountRecords.toLocaleString()}`);

    console.log('📊 Migration Configuration:');
    console.log(`  - From/to records: ${config.LAST_PROCESSED} - ${config.MAX_PROCESSED} (${countResult.rows[0].count} records)`);
    console.log(`  - Batch size: ${config.BATCH_SIZE.toLocaleString()}`);
    console.log(`  - Batches needed: ${Math.ceil(actualCountRecords / config.BATCH_SIZE).toLocaleString()}`);
    console.log(`  - Pagination: ${config.USE_CURSOR_PAGINATION ? 'CURSOR-BASED (WHERE id > X) ⚡' : 'OFFSET-BASED'}`);
    console.log(`  - Sleep between batches: ${config.BATCH_SLEEP_MS}ms`);
    
    // Migration statistics
    let totalProcessed = 0;
    let totalFailed = 0;
    const uniqueUsers = new Set<number>();
    const batchCount = Math.ceil(actualCountRecords / config.BATCH_SIZE);

    console.log(`\n🔄 Starting migration of ${actualCountRecords.toLocaleString()} records in ${batchCount} batches...`);
    console.log(`⚡ Using ${config.USE_CURSOR_PAGINATION ? 'CURSOR-BASED (3x faster)' : 'OFFSET-BASED'} pagination`);

    // Process in batches using cursor-based pagination
    for (let batchNum = 1; batchNum <= batchCount; batchNum++) {
      const batchStart = Date.now();
      
      console.log(`\n📦 Batch ${batchNum}/${batchCount} (cursor: id > ${lastProcessedId})`);

      // Create a log file for this batch
      const logFileName = `migration_log/batch_${batchNum}_log.txt`;

      try {
      // Use cursor-based or offset-based query based on configuration
      let query: string;
      let params: any[];

      query = `
        SELECT * FROM "Puff" 
        WHERE id > $1 ${config.MAX_PROCESSED ? 'AND id < $3' : ''}
        ORDER BY id 
        LIMIT $2
        `;
        params = config.MAX_PROCESSED 
          ? [lastProcessedId, config.BATCH_SIZE, config.MAX_PROCESSED]
          : [lastProcessedId, config.BATCH_SIZE];
      const result = await pgClient.query(query, params);
      console.log(`  📥 Retrieved ${result.rows.length} records`);

      if (result.rows.length === 0) {
        console.log('  ⚠️  No more records, ending migration');
        break;
      }

      let batchProcessed = 0;
      let batchFailed = 0;
      let batchLastId = lastProcessedId;

      // Open log file stream
      const logStream = fs.createWriteStream(logFileName, {flags: 'w'});

      for (const record of result.rows) {
        try {
        uniqueUsers.add(record.user_id);
        
        if (record.id > batchLastId) {
          batchLastId = record.id;
        }
        
        const nilDBData = transformPuffToNilDB(record);
        const userClient = await createUserForId(record.user_id, pgClient);
        const userDid = await userClient.signer.getDid();
        const delegation = await generateDelegationToken(
          builderClient.rootToken,
          NucCmd.nil.db.data.create as Command,
          userDid.didString,
          3600,
          builderSigner
        );
        const createRequest = await userClient.createData(
          {
          owner: userDid.didString,
          acl: {
            grantee: builderDid.didString,
            read: true,
            write: false,
            execute: true,
          },
          collection: collectionId,
          data: [nilDBData],
          },
          { auth: { delegation } },
        );
        console.log(`        ${record.id}/${result.rows.length} (${totalProcessed}) - ${Object.values(createRequest)[0].data.errors.length === 0 ? `✓ ${Object.values(createRequest)[0].data.created}`: '❌'}`);
        
        // Log user_id to file
        logStream.write(`${record.user_id}, ${userDid.didString}, ${collectionId}, ${Object.values(createRequest)[0].data.created}: \n`);

        batchProcessed++;
        totalProcessed++;

        } catch (error) {
          console.log(error);
          handleError(`❌ Failed record ${record.id}: ${JSON.stringify(error)} - Batch ${batchFailed}`)
          // Retry
        }
      }

      // Close log stream
      logStream.end();
      lastProcessedId = batchLastId;

      const batchTime = Date.now() - batchStart;
      const recordsPerSecond = Math.round(batchProcessed / (batchTime / 1000));
      
      console.log(`  ✅ Batch completed: ${batchProcessed}/${result.rows.length} records (${recordsPerSecond}/sec)`);
      console.log(`  📊 Progress: ${totalProcessed.toLocaleString()}/${actualTotalRecords.toLocaleString()} (${Math.round(totalProcessed/actualTotalRecords*100)}%)`);
      console.log(`  👥 Unique users: ${uniqueUsers.size.toLocaleString()}`);
      console.log(`  🏦 User vaults: ${userClients.size.toLocaleString()}`);
      console.log(`  📝 Log file created: ${logFileName}`);

      if (batchNum < batchCount && config.BATCH_SLEEP_MS > 0) {
        console.log(`  😴 Sleeping ${config.BATCH_SLEEP_MS}ms...`);
        await sleep(config.BATCH_SLEEP_MS);
      }

      } catch (batchError) {
        handleError(`❌ Batch ${batchNum} failed: ${batchError}`)
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
    
    // 🔑 VERIFY KEYS STORED
    console.log(`\n🔑 Verifying stored keys...`);
    const keyCountResult = await pgClient.query('SELECT COUNT(*) FROM nillion_login');
    const keysStored = parseInt(keyCountResult.rows[0].count);
    console.log(`  ✅ Total keys in database: ${keysStored.toLocaleString()}`);
    console.log(`  ✅ Keys stored progressively during migration!`);
    
    console.log(`\n💡 Next steps:`);
    console.log(`  1. ✅ User keys stored in 'nillion_login' table`);
    console.log(`  2. Query and verify the migrated data`);
    console.log(`  3. Build web app for users to access their data`);
    console.log(`  4. Set up analytics dashboards`);

  } catch (error) {
    handleError(`❌ Large migration failed: ${JSON.stringify(error, null, 2)}`)
  } finally {
    if (pgClient) {
      try {
        await pgClient.end();
        console.log('✅ Disconnected from PostgreSQL');
      } catch (err) {
        handleError(`⚠️ Error disconnecting from PostgreSQL: ${err}`);
      }
    }
  }
}

// Run large migration
largeMigration().catch(error => {
  handleError(`❌ Caught error in main: ${error}`);
});
