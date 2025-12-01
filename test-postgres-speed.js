import { Client } from 'pg';
import 'dotenv/config';

// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB || 'app',
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};

async function testPostgresPerformance() {
  console.log('🏃‍♂️ Testing PostgreSQL Query Performance...');
  console.log(`📡 Connecting to: ${pgConfig.host}:${pgConfig.port}`);
  
  const client = new Client(pgConfig);
  
  try {
    // Connect
    const connectStart = Date.now();
    await client.connect();
    const connectTime = Date.now() - connectStart;
    console.log(`✅ Connected in ${connectTime}ms`);

    // Test different batch sizes
    const testSizes = [1000, 5000, 10000, 25000, 50000];
    
    for (const batchSize of testSizes) {
      console.log(`\n📦 Testing ${batchSize.toLocaleString()} records...`);
      
      // Test 1: Simple SELECT with LIMIT
      const simpleStart = Date.now();
      const simpleResult = await client.query(`
        SELECT * FROM "Puff" 
        ORDER BY id 
        LIMIT $1
      `, [batchSize]);
      const simpleTime = Date.now() - simpleStart;
      
      console.log(`  📥 Simple query: ${simpleTime}ms (${Math.round(batchSize / (simpleTime / 1000))} records/sec)`);
      
      // Test 2: With OFFSET (simulating batch processing)
      const offsetStart = Date.now();
      const offsetResult = await client.query(`
        SELECT * FROM "Puff" 
        ORDER BY id 
        LIMIT $1 OFFSET $2
      `, [batchSize, 10000]); // Start from record 10,000
      const offsetTime = Date.now() - offsetStart;
      
      console.log(`  📥 With offset: ${offsetTime}ms (${Math.round(batchSize / (offsetTime / 1000))} records/sec)`);
      
      // Test 3: Count records (fastest)
      const countStart = Date.now();
      const countResult = await client.query('SELECT COUNT(*) FROM "Puff"');
      const countTime = Date.now() - countStart;
      
      console.log(`  📊 Count query: ${countTime}ms (${countResult.rows[0].count.toLocaleString()} total records)`);
      
      // Memory usage check
      const memUsage = process.memoryUsage();
      console.log(`  🧠 Memory: ${Math.round(memUsage.rss / 1024 / 1024)}MB RSS, ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB Heap`);
    }

    // Test large offset performance (simulating later batches)
    console.log(`\n🔍 Testing large offset performance (simulating batch 50+)...`);
    
    const largeOffsets = [100000, 500000, 1000000];
    for (const offset of largeOffsets) {
      const offsetTestStart = Date.now();
      const result = await client.query(`
        SELECT * FROM "Puff" 
        ORDER BY id 
        LIMIT 10000 OFFSET $1
      `, [offset]);
      const offsetTestTime = Date.now() - offsetTestStart;
      
      console.log(`  📥 10k records at offset ${offset.toLocaleString()}: ${offsetTestTime}ms (${Math.round(10000 / (offsetTestTime / 1000))} records/sec)`);
    }

    // Test specific columns only (lighter query)
    console.log(`\n🎯 Testing selective column queries...`);
    
    const selectiveStart = Date.now();
    const selectiveResult = await client.query(`
      SELECT id, user_id, vape_id, pod_type, timestamp, ip 
      FROM "Puff" 
      ORDER BY id 
      LIMIT 10000
    `);
    const selectiveTime = Date.now() - selectiveStart;
    
    console.log(`  📥 6 columns only: ${selectiveTime}ms (${Math.round(10000 / (selectiveTime / 1000))} records/sec)`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Disconnected from PostgreSQL');
    
    console.log('\n📊 Summary:');
    console.log('  - Higher record counts may be slower due to data transfer');
    console.log('  - Large offsets get progressively slower (PostgreSQL limitation)');
    console.log('  - Selective columns are faster than SELECT *');
    console.log('  - Network latency affects all queries');
  }
}

// Run the performance test
testPostgresPerformance().catch(console.error);
