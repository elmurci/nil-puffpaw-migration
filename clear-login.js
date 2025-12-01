const { Client } = require('pg');
require('dotenv/config');

async function clearLoginTable() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DB || 'app',
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    
    const result = await client.query('DELETE FROM nillion_login');
    console.log(`🗑️  Deleted ${result.rowCount} old records from nillion_login`);
    
    await client.end();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

clearLoginTable();
