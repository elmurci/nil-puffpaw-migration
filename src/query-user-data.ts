import { Client } from 'pg';
import { SecretVaultUserClient } from '@nillion/secretvaults';
import { Keypair } from '@nillion/nuc';
import 'dotenv/config';

// PostgreSQL connection
const pgConfig = {
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB || 'app',
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
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
};

async function queryUserData(userId, collectionId) {
  console.log(`\n🔍 Querying data for User ${userId}...`);
  console.log('─'.repeat(60));

  const pgClient = new Client(pgConfig);

  try {
    // Step 1: Connect to PostgreSQL
    console.log('\n📊 Step 1: Connecting to PostgreSQL...');
    await pgClient.connect();
    console.log('✅ Connected to PostgreSQL');

    // Step 2: Get user's Nillion key from database
    console.log(`\n🔑 Step 2: Fetching User ${userId}'s Nillion key from database...`);
    const keyResult = await pgClient.query(`
      SELECT user_id, nillion_key, nillion_did, wallet_address, created_at 
      FROM nillion_login 
      WHERE user_id = $1
    `, [userId]);

    if (keyResult.rows.length === 0) {
      console.error(`❌ No Nillion key found for user ${userId}`);
      console.log('\n💡 Tip: This user might not have a Nillion key yet.');
      return;
    }

    const userKeyData = keyResult.rows[0];
    console.log('✅ Found user key in database:');
    console.log(`   User ID: ${userKeyData.user_id}`);
    console.log(`   DID: ${userKeyData.nillion_did}`);
    console.log(`   Wallet: ${userKeyData.wallet_address || 'N/A'}`);
    console.log(`   Created: ${userKeyData.created_at}`);

    // Step 3: Create UserClient with THEIR key (not builder's)
    console.log(`\n👤 Step 3: Creating UserClient with user's key...`);
    const userKeypair = Keypair.from(userKeyData.nillion_key);
    
    const userClient = await SecretVaultUserClient.from({
      keypair: userKeypair,
      urls: {
        chain: config.NILCHAIN_URL,
        auth: config.NILAUTH_URL,
        dbs: config.NILDB_NODES,
      },
      blindfold: {
        operation: 'retrieve',
        useClusterKey: true  // 🔑 Read from all nodes
      }
    });
    
    console.log('✅ UserClient created');
    console.log(`   Using DID: ${userKeypair.toDid().toString()}`);

    // Step 4: Query user's data from the collection
    console.log(`\n📋 Step 4: Querying user's data from nilDB...`);
    
    if (!collectionId) {
      console.error('❌ No collection ID provided. Use --collectionId=<id>');
      return;
    }

    const queryResult = await userClient.queryData({
      collection: collectionId,
      filter: {},
      limit: 100
    });
    
    console.log(`✅ Found ${queryResult.data.length} data records for user ${userId}`);

    if (queryResult.data.length === 0) {
      console.log('\n⚠️  User has no data records in this collection yet.');
      return;
    }

    // Step 5: Display sample records
    console.log(`\n📖 Step 5: Displaying sample puff records (first 3)...`);
    console.log('─'.repeat(60));

    const samplesToShow = Math.min(3, queryResult.data.length);
    
    for (let i = 0; i < samplesToShow; i++) {
      const record = queryResult.data[i];
      
      console.log(`\n📄 Record ${i + 1}/${samplesToShow}:`);
      
      console.log('\n   🔓 PRIVATE DATA (Decrypted with user\'s key):');
      console.log(`   ├─ vape_id: ${record.vape_id}`);
      console.log(`   ├─ pod_type: ${record.pod_type}`);
      console.log(`   ├─ pod_flavour: ${record.pod_flavour}`);
      console.log(`   ├─ pod_remaining: ${record.pod_remaining}`);
      console.log(`   ├─ timestamp: ${record.timestamp}`);
      console.log(`   ├─ ip: ${record.ip}`);
      console.log(`   └─ nft_token_id: ${record.nft_token_id}`);

      console.log('\n   📊 PUBLIC DATA (Analytics):');
      console.log(`   ├─ user_id: ${record.user_id}`);
      console.log(`   ├─ pod_id: ${record.pod_id}`);
      console.log(`   ├─ puff_duration: ${record.puff_duration}`);
      console.log(`   ├─ pod_nicotine_level: ${record.pod_nicotine_level}`);
      console.log(`   └─ valid: ${record.valid}`);
    }

    // Summary
    console.log('\n' + '─'.repeat(60));
    console.log('\n✅ Query completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - User: ${userId}`);
    console.log(`   - Total records in nilDB: ${queryResult.data.length}`);
    console.log(`   - Records displayed: ${samplesToShow}`);
    console.log(`   - Key source: PostgreSQL database`);
    console.log(`   - Access method: User's own key (NOT builder permissions)`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pgClient.end();
    console.log('\n✅ Disconnected from PostgreSQL\n');
  }
}

// List available users
async function listUsers() {
  console.log('\n👥 Fetching available users from database...');
  console.log('─'.repeat(60));

  const pgClient = new Client(pgConfig);

  try {
    await pgClient.connect();
    
    const result = await pgClient.query(`
      SELECT user_id, nillion_did, wallet_address, created_at 
      FROM nillion_login 
      ORDER BY user_id 
      LIMIT 20
    `);

    if (result.rows.length === 0) {
      console.log('❌ No users found in database.');
      console.log('💡 No users have Nillion keys yet.');
      return;
    }

    console.log(`\n✅ Found ${result.rows.length} users with Nillion keys:\n`);
    
    result.rows.forEach(row => {
      console.log(`   User ${row.user_id}`);
      console.log(`   ├─ DID: ${row.nillion_did}`);
      console.log(`   ├─ Wallet: ${row.wallet_address || 'N/A'}`);
      console.log(`   └─ Created: ${row.created_at}\n`);
    });

    console.log('─'.repeat(60));
    console.log('\n💡 To query a user\'s data, run:');
    console.log(`   npm run query-user -- --userId=1`);
    console.log(`   npm run query-user -- --userId=8\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pgClient.end();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const userIdArg = args.find(arg => arg.startsWith('--userId='));
const collectionIdArg = args.find(arg => arg.startsWith('--collectionId='));
const listArg = args.find(arg => arg === '--list');

if (listArg) {
  // List available users
  listUsers().catch(console.error);
} else if (userIdArg) {
  // Query specific user
  const userId = parseInt(userIdArg.split('=')[1]);
  const collectionId = collectionIdArg ? collectionIdArg.split('=')[1] : null;
  
  queryUserData(userId, collectionId).catch(console.error);
} else {
  // Show usage
  console.log('\n📖 PuffPaw User Data Query Tool\n');
  console.log('Usage:');
  console.log('  npm run query-user -- --list');
  console.log('  npm run query-user -- --userId=8');
  console.log('  npm run query-user -- --userId=8 --collectionId=abc123...\n');
  console.log('Examples:');
  console.log('  npm run query-user -- --list                    # List all users');
  console.log('  npm run query-user -- --userId=8                # Query user 8\'s data');
  console.log('  npm run query-user -- --userId=11               # Query user 11\'s data\n');
}
