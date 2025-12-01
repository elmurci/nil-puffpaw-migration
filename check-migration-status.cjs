const { Client } = require('pg');

const pgConfig = {
  host: '5.223.54.44',
  port: 32079,
  database: 'app',
  user: 'root',
  password: '1aj263QT9BOktn8gl45AKHcrpq7ud0LJ',
};

async function checkStatus() {
  const client = new Client(pgConfig);
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');

    // Check if nillion_login table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'nillion_login'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ nillion_login table exists');
      
      // Count keys
      const keyCount = await client.query('SELECT COUNT(*) FROM nillion_login');
      console.log(`📊 Keys stored: ${keyCount.rows[0].count}`);
      
      // Show sample keys
      const samples = await client.query(`
        SELECT user_id, 
               LEFT(nillion_key, 30) as key_preview,
               created_at
        FROM nillion_login 
        ORDER BY created_at DESC
        LIMIT 5
      `);
      
      console.log('\n📋 Sample keys (most recent):');
      samples.rows.forEach(row => {
        console.log(`  User ${row.user_id}: ${row.key_preview}... (${row.created_at})`);
      });
      
    } else {
      console.log('❌ nillion_login table does NOT exist');
      console.log('   Migration has not completed or was interrupted');
    }
    
    // Check total records in Puff table
    const puffCount = await client.query('SELECT COUNT(*) FROM "Puff"');
    console.log(`\n📊 Total Puff records in database: ${parseInt(puffCount.rows[0].count).toLocaleString()}`);
    
    // Check unique users
    const userCount = await client.query('SELECT COUNT(DISTINCT user_id) FROM "Puff"');
    console.log(`👥 Unique users to migrate: ${parseInt(userCount.rows[0].count).toLocaleString()}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Disconnected');
  }
}

checkStatus();

