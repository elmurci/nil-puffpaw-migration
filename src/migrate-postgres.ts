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
  host: process.env.POSTGRES_HOST || '5.223.54.44',
  port: parseInt(process.env.POSTGRES_PORT || '32079'),
  database: process.env.POSTGRES_DB || 'app',
  user: process.env.POSTGRES_USER || 'readonly_user_puffs',
  password: process.env.POSTGRES_PASSWORD || 'y.Uk~)gD>CZ2!Pf[./r6/%*~+s[a',
};

// Nillion configuration
const config = {
  NILCHAIN_URL: process.env.NILCHAIN_URL || 'http://rpc.testnet.nilchain-rpc-proxy.nilogy.xyz',
  NILAUTH_URL: process.env.NILAUTH_URL || 'https://nilauth.sandbox.app-cluster.sandbox.nilogy.xyz',
  NILDB_NODES: process.env.NILDB_NODES ? process.env.NILDB_NODES.split(',') : [
    'https://nildb-stg-n1.nillion.network',
    'https://nildb-stg-n2.nillion.network',
    'https://nildb-stg-n3.nillion.network',
  ],
  NIL_BUILDER_PRIVATE_KEY: process.env.NIL_BUILDER_PRIVATE_KEY!,
  NIL_BUILDER_COLLECTION_ID: process.env.NIL_BUILDER_COLLECTION_ID || null,
};

interface PostgresVapeRecord {
  id: number;
  user_id: number;
  vape_id: string;
  pod_id: string;
  pod_type: string;
  pod_flavour: string;
  pod_remaining: number;
  pod_nicotine_level: string;
  puff_duration: number;
  raw_data: string;
  timestamp: Date;
  ip: string;
  ua: string;
  request_data: object;
  ble_id: string;
  ble_name: string;
  ble_mac: string;
  session_id: string;
  app_version: string;
  nonce: string;
  valid: boolean;
  nft_token_id: number;
  nft_tier: number;
  local_datetime: string;
  source: string;
  uploaded_at: Date;
  is_settled: boolean;
  settled_metadata: object;
  is_delayed_upload: boolean;
  flag: string;
  lease_id: number;
  lease_metadata: object;
  count: number;
  created_at: Date;
  updated_at: Date;
}

// Transform PostgreSQL record to nilDB format with privacy controls
function transformToNilDBFormat(record: PostgresVapeRecord): object {
  return {
    _id: randomUUID(),
    id: record.id,
    user_id: record.user_id,
    
    // 🔒 PRIVATE FIELDS - Encrypted with %allot
    vape_id: {
      "%allot": record.vape_id
    },
    pod_type: {
      "%allot": record.pod_type
    },
    pod_flavour: {
      "%allot": record.pod_flavour
    },
    pod_remaining: {
      "%allot": record.pod_remaining
    },
    timestamp: {
      "%allot": record.timestamp.toISOString()
    },
    ip: {
      "%allot": record.ip
    },
    nft_token_id: {
      "%allot": record.nft_token_id
    },
    
    // 📊 PUBLIC FIELDS - Analytics data
    pod_id: record.pod_id,
    pod_nicotine_level: record.pod_nicotine_level,
    puff_duration: record.puff_duration,
    raw_data: record.raw_data,
    ua: record.ua,
    request_data: record.request_data,
    ble_id: record.ble_id,
    ble_name: record.ble_name,
    ble_mac: record.ble_mac,
    session_id: record.session_id,
    app_version: record.app_version,
    nonce: record.nonce,
    valid: record.valid,
    nft_tier: record.nft_tier,
    local_datetime: record.local_datetime,
    source: record.source,
    uploaded_at: record.uploaded_at.toISOString(),
    is_settled: record.is_settled,
    settled_metadata: record.settled_metadata,
    is_delayed_upload: record.is_delayed_upload,
    flag: record.flag,
    lease_id: record.lease_id,
    lease_metadata: record.lease_metadata,
    count: record.count,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString()
  };
}

// Create user client for each unique user_id
const userClients = new Map<number, any>();

async function createUserForId(userId: number): Promise<any> {
  if (userClients.has(userId)) {
    return userClients.get(userId);
  }

  console.log(`Creating user client for user_id: ${userId}`);
  
  const secretKey = await SecretKey.generate(
    {"nodes": config.NILDB_NODES.map(url => ({ url }))}, 
    {"store": true}
  );
  
  const userKeypair = Keypair.from(bytesToHex(secretKey.material as Uint8Array));
  
  const userClient = await SecretVaultUserClient.from({
    keypair: userKeypair,
    baseUrls: config.NILDB_NODES,
    blindfold: {
      operation: "store",
    }
  });

  userClients.set(userId, userClient);
  return userClient;
}

async function migratePostgresToNilDB() {
  console.log('🚀 Starting PostgreSQL to nilDB migration...');

  // Connect to PostgreSQL
  const pgClient = new Client(pgConfig);
  await pgClient.connect();
  console.log('✅ Connected to PostgreSQL');

  // Setup Nillion builder client
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

  // Create or use existing collection
  let collectionId = config.NIL_BUILDER_COLLECTION_ID;
  if (!collectionId) {
    collectionId = randomUUID();
    
    const collection = {
      _id: collectionId,
      type: "owned",
      name: "PuffPaw Migration Collection",
      schema,
    };

    await builderClient.createCollection(collection);
    console.log(`✅ Created collection: ${collectionId}`);
    console.log(`💡 Add this to your .env: NIL_BUILDER_COLLECTION_ID=${collectionId}`);
  }

  try {
    // Get total count for progress tracking
    const countResult = await pgClient.query('SELECT COUNT(*) FROM vape_sessions');
    const totalRecords = parseInt(countResult.rows[0].count);
    console.log(`📊 Found ${totalRecords} records to migrate`);

    // Fetch records in batches
    const batchSize = 100;
    let processed = 0;
    let offset = 0;

    while (offset < totalRecords) {
      console.log(`\n📦 Processing batch ${Math.floor(offset/batchSize) + 1}/${Math.ceil(totalRecords/batchSize)}`);
      
      // Fetch batch from PostgreSQL
      const result = await pgClient.query(`
        SELECT * FROM vape_sessions 
        ORDER BY created_at 
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);

      // Process each record in the batch
      for (const record of result.rows) {
        try {
          // Transform to nilDB format
          const nilDBData = transformToNilDBFormat(record);
          
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

          processed++;
          
          if (processed % 10 === 0) {
            console.log(`  ✅ Migrated ${processed}/${totalRecords} records (${Math.round(processed/totalRecords*100)}%)`);
          }

        } catch (error) {
          console.error(`❌ Failed to migrate record ${record.id}:`, error);
          // Continue with next record
        }
      }

      offset += batchSize;
    }

    console.log(`\n🎉 Migration completed! Processed ${processed}/${totalRecords} records`);
    console.log(`👥 Created ${userClients.size} unique user vaults`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pgClient.end();
    console.log('✅ Disconnected from PostgreSQL');
  }
}

// Migration script entry point
migratePostgresToNilDB().catch(console.error);

export { migratePostgresToNilDB, transformToNilDBFormat };

