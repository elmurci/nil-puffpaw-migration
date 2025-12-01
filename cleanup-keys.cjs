const { Client } = require('pg');

const pgConfig = {
  host: '5.223.54.44',
  port: 32079,
  database: 'app',
  user: 'root',
  password: '1aj263QT9BOktn8gl45AKHcrpq7ud0LJ',
};

async function cleanupOldKeys() {
  const client = new Client(pgConfig);
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');

    // Check current keys
    const beforeCount = await client.query('SELECT COUNT(*) FROM nillion_login');
    console.log(`📊 Keys before cleanup: ${beforeCount.rows[0].count}`);
    
    // Delete all old keys
    console.log('🗑️  Deleting all old keys...');
    await client.query('DELETE FROM nillion_login');
    
    // Verify deletion
    const afterCount = await client.query('SELECT COUNT(*) FROM nillion_login');
    console.log(`✅ Keys after cleanup: ${afterCount.rows[0].count}`);
    console.log('\n🔄 Table is now clean. New optimized script will generate fresh keys!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('✅ Disconnected');
  }
}

cleanupOldKeys();



