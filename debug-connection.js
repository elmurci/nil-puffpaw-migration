import { Client } from 'pg';

// Test PostgreSQL connection
const pgConfig = {
  host: '5.223.54.44',
  port: 32079,
  database: 'app',
  user: 'root',
  password: '1aj263QT9BOktn8gl45AKHcrpq7ud0LJ',
};

console.log('🔍 Testing PostgreSQL connection...');
console.log('Host:', pgConfig.host);
console.log('Port:', pgConfig.port);
console.log('Database:', pgConfig.database);
console.log('User:', pgConfig.user);

async function testConnection() {
  const client = new Client(pgConfig);
  
  try {
    console.log('\n📞 Connecting...');
    await client.connect();
    console.log('✅ Connected successfully!');

    // Test basic query
    console.log('\n📋 Listing tables...');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('Tables found:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Check Puff table specifically
    console.log('\n🎯 Checking Puff table...');
    const puffCount = await client.query('SELECT COUNT(*) FROM "Puff"');
    console.log(`Puff table records: ${puffCount.rows[0].count}`);

    // Show sample data
    console.log('\n📝 Sample Puff records:');
    const sampleData = await client.query('SELECT * FROM "Puff" LIMIT 3');
    sampleData.rows.forEach((row, index) => {
      console.log(`\nRecord ${index + 1}:`);
      Object.keys(row).forEach(key => {
        console.log(`  ${key}: ${row[key]}`);
      });
    });

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Disconnected');
  }
}

testConnection();
