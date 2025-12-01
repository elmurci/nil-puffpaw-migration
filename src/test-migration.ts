console.log('🚀 Test migration script starting...');

import { Client } from 'pg';
import { SecretVaultBuilderClient, SecretVaultUserClient } from '@nillion/secretvaults';
import { Signer, NilauthClient } from "@nillion/nuc";
import 'dotenv/config';

console.warn = () => {};

(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};

console.log('🔧 Setting up configuration...');

const handleError = (error: string) => {
  console.error(error);
  process.exit(1);
}

if (!process.env.NIL_COLLECTION_ID) {
  handleError("Please set the NIL_COLLECTION_ID env variable")
}

// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.POSTGRES_HOST!,
  port: parseInt(process.env.POSTGRES_PORT!),
  database: process.env.POSTGRES_DB || 'app',
  user: process.env.POSTGRES_USER!,
  password: process.env.POSTGRES_PASSWORD!,
};

console.log('✅ pgConfig created:', {
  host: pgConfig.host,
  port: pgConfig.port,
  database: pgConfig.database,
  user: pgConfig.user,
  hasPassword: !!pgConfig.password
});

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
  TEST_MODE: process.env.TEST_MODE === 'true',
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE || '100'),
  COLLECTION_ID: process.env.NIL_COLLECTION_ID!,
};

const builderSigner = await Signer.fromPrivateKey(config.NIL_BUILDER_PRIVATE_KEY, "nil");
const builderDid = await builderSigner.getDid();
const nilauthClient = await NilauthClient.create({ baseUrl: config.NILAUTH_URL });

async function testPuffMigration() {
  try {
    console.log('🧪 Starting TEST migration of Puff table to nilDB...');
  console.log(`📊 Test mode: ${config.TEST_MODE ? 'ON' : 'OFF'} | Batch size: ${config.BATCH_SIZE}`);

  // Connect to PostgreSQL
  const pgClient = new Client(pgConfig);
  
  try {
    await pgClient.connect();
    console.log('✅ Connected to PostgreSQL at', pgConfig.host);

    console.log('\n🔍 Analyzing nillion_login table structure...');
    const tableInfo = await pgClient.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'nillion_login' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 nillion_login table columns:');
    tableInfo.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'required'})`);
    });

    // Get total count
    const countResult = await pgClient.query('SELECT COUNT(*) FROM "nillion_login"');
    const totalRecords = parseInt(countResult.rows[0].count);
    console.log(`\n📊 Total records in Nillion Login table: ${totalRecords.toLocaleString()}`);

    // Setup Nillion builder client
    console.log('\n🔗 Builder...', builderDid.didString);

    const builderClient = await SecretVaultBuilderClient.from({
      signer: builderSigner,
      nilauthClient,
      dbs: config.NILDB_NODES,
      blindfold: { operation: "store" },
    });

    await builderClient.refreshRootToken();
    console.log('✅ Connected to Nillion');

    console.log(`\n📦 Fetching ${Math.floor(totalRecords * 0.30).toLocaleString()} random test records from nillion_login table...`);
    
    const result = await pgClient.query(`
      SELECT * FROM "nillion_login" 
      ORDER BY RANDOM()
      LIMIT $1
    `, [Math.floor(totalRecords * 0.30)]);

    if (result.rows.length === 0) {
      console.log('❌ No records found in nillion_login table');
      return;
    }

    console.log(`\n🔄 Processing ${result.rows.length} records...`);

    for (const record of result.rows) {
      try {
        console.log(`\n🔗 User ${record.user_id} (${record.id} - ${record.nillion_did})`);
        const userSigner = Signer.fromPrivateKey(record.nillion_key, record.nillion_did.indexOf(":nil:") > -1 ? "nil" : "key");
        const userClient = await SecretVaultUserClient.from({
          signer: userSigner,
          baseUrls: config.NILDB_NODES,
          blindfold: { operation: "store" },
        });

        const documents = await userClient.listDataReferences();
        await userClient.readData(
          {
            collection: config.COLLECTION_ID,
            document: documents.data[0]!.document!
          }
        )
        console.log(`Testing record 1 out of ${documents.data.length} (${documents.data[0]!.document}) ✓`);
        
      } catch (error) {
        handleError(`❌ Failed to test record ${record.id}: ${JSON.stringify(error)}`)
      }
    }

    // console.log(`\n🎉 Test migration completed!`);
    // console.log(`📊 Results:`);
    // console.log(`  - Records processed: ${processed}/${result.rows.length}`);
    // console.log(`  - Unique users: ${uniqueUsers.size}`);
    // console.log(`  - User vaults created: ${userClients.size}`);
    // console.log(`  - Collection ID: ${collectionId}`);
    
    // console.log(`\n💡 Next steps:`);
    // console.log(`  1. Verify data in nilDB`);
    // console.log(`  2. Test querying the migrated data`);
    // console.log(`  3. Run full migration if test looks good`);

  } catch (error) {
    handleError(`❌ Test migration failed: ${error}`);
  } finally {
    if (pgClient) {
      await pgClient.end();
      console.log('✅ Disconnected from PostgreSQL');
    }
  }
  } catch (outerError) {
    handleError(`❌ Outer error: ${outerError}`);
  }
}

testPuffMigration().catch(error => {
    handleError(`❌ Caught error in main: ${error}`);
});

export { testPuffMigration };
