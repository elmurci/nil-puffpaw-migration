const { Client } = require('pg');

const pgConfig = {
  host: '5.223.54.44',
  port: 32079,
  database: 'app',
  user: 'root',
  password: '1aj263QT9BOktn8gl45AKHcrpq7ud0LJ',
};

async function verifyUserData() {
  const client = new Client(pgConfig);
  
  try {
    await client.connect();
    
    // Get a user that has been processed
    const keysResult = await client.query('SELECT user_id FROM nillion_login ORDER BY created_at LIMIT 1');
    
    if (keysResult.rows.length > 0) {
      const userId = keysResult.rows[0].user_id;
      
      // Count their records in Puff table
      const puffCount = await client.query('SELECT COUNT(*) FROM "Puff" WHERE user_id = $1', [userId]);
      
      console.log(`\n📊 Verification for User ${userId}:`);
      console.log(`  - Records in Puff table: ${puffCount.rows[0].count}`);
      console.log(`  - Key stored in nillion_login: ✅`);
      console.log(`\n✅ Migration should have uploaded ALL ${puffCount.rows[0].count} records for this user!`);
    } else {
      console.log('No keys stored yet. Wait for migration to process more users.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

verifyUserData();



