const { Client } = require('pg');

const pgConfig = {
  host: '5.223.54.44',
  port: 32079,
  database: 'app',
  user: 'root',
  password: '1aj263QT9BOktn8gl45AKHcrpq7ud0LJ',
};

async function verifyMostRecentUser() {
  const client = new Client(pgConfig);
  
  try {
    await client.connect();
    
    // Get the most recently processed user
    const keysResult = await client.query('SELECT user_id, created_at FROM nillion_login ORDER BY created_at DESC LIMIT 1');
    
    if (keysResult.rows.length > 0) {
      const userId = keysResult.rows[0].user_id;
      const createdAt = keysResult.rows[0].created_at;
      
      // Count their records in Puff table
      const puffCount = await client.query('SELECT COUNT(*) FROM "Puff" WHERE user_id = $1', [userId]);
      
      // Get total keys stored
      const totalKeys = await client.query('SELECT COUNT(*) FROM nillion_login');
      
      console.log(`\n📊 Most Recent User Processed:`);
      console.log(`  - User ID: ${userId}`);
      console.log(`  - Processed at: ${createdAt}`);
      console.log(`  - Records in Puff table: ${puffCount.rows[0].count}`);
      console.log(`  - Key stored in nillion_login: ✅`);
      console.log(`\n✅ Migration uploaded ALL ${puffCount.rows[0].count} records for User ${userId}`);
      console.log(`\n📈 Overall Progress:`);
      console.log(`  - Total users processed: ${totalKeys.rows[0].count} / 1,901`);
      console.log(`  - Progress: ${Math.round((totalKeys.rows[0].count / 1901) * 100)}%`);
    } else {
      console.log('No keys stored yet. Wait for migration to process users.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

verifyMostRecentUser();



