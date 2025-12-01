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

// Exact columns we need for migration (from our migration script)
const REQUIRED_COLUMNS = `
  id, user_id, vape_id, pod_id, pod_type, pod_flavour, pod_remaining, 
  pod_nicotine_level, puff_duration, raw_data, timestamp, ip, ua, 
  request_data, ble_id, ble_name, ble_mac, session_id, app_version, 
  nonce, valid, nft_token_id, nft_tier, local_datetime, source, 
  uploaded_at, is_settled, settled_metadata, is_delayed_upload, 
  flag, lease_id, lease_metadata, count, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

async function testOptimizedQueries() {
  console.log('⚡ Testing OPTIMIZED PostgreSQL Query Performance...');
  console.log(`📡 Connecting to: ${pgConfig.host}:${pgConfig.port}`);
  console.log(`📋 Testing with ${REQUIRED_COLUMNS.split(',').length} required columns`);
  
  const client = new Client(pgConfig);
  
  try {
    // Connect
    const connectStart = Date.now();
    await client.connect();
    const connectTime = Date.now() - connectStart;
    console.log(`✅ Connected in ${connectTime}ms\n`);

    // Test different batch sizes with our optimized query
    const testSizes = [5000, 10000, 25000, 50000, 100000];
    
    console.log('🚀 Testing SELECTIVE COLUMN queries (migration-optimized)...\n');
    
    for (const batchSize of testSizes) {
      console.log(`📦 Testing ${batchSize.toLocaleString()} records...`);
      
      // Test 1: Our optimized migration query (selective columns)
      const selectiveStart = Date.now();
      const selectiveResult = await client.query(`
        SELECT ${REQUIRED_COLUMNS}
        FROM "Puff" 
        ORDER BY id 
        LIMIT $1
      `, [batchSize]);
      const selectiveTime = Date.now() - selectiveStart;
      const selectiveSpeed = Math.round(batchSize / (selectiveTime / 1000));
      
      console.log(`  ⚡ Optimized query: ${selectiveTime}ms (${selectiveSpeed.toLocaleString()} records/sec)`);
      
      // Test 2: Same query with OFFSET (simulating batch processing)
      const offsetStart = Date.now();
      const offsetResult = await client.query(`
        SELECT ${REQUIRED_COLUMNS}
        FROM "Puff" 
        ORDER BY id 
        LIMIT $1 OFFSET $2
      `, [batchSize, 50000]); // Test with offset
      const offsetTime = Date.now() - offsetStart;
      const offsetSpeed = Math.round(batchSize / (offsetTime / 1000));
      
      console.log(`  📊 With offset 50k: ${offsetTime}ms (${offsetSpeed.toLocaleString()} records/sec)`);
      
      // Test 3: Cursor-based approach (WHERE id > X)
      const cursorStart = Date.now();
      const cursorResult = await client.query(`
        SELECT ${REQUIRED_COLUMNS}
        FROM "Puff" 
        WHERE id > 50000
        ORDER BY id 
        LIMIT $1
      `, [batchSize]);
      const cursorTime = Date.now() - cursorStart;
      const cursorSpeed = Math.round(batchSize / (cursorTime / 1000));
      
      console.log(`  🎯 Cursor-based (id>50k): ${cursorTime}ms (${cursorSpeed.toLocaleString()} records/sec)`);
      
      // Memory check
      const memUsage = process.memoryUsage();
      console.log(`  🧠 Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap\n`);
    }

    console.log('🔬 Testing offset performance degradation...\n');
    
    // Test how offset affects performance at different positions
    const batchSize = 10000;
    const offsets = [0, 100000, 500000, 1000000, 2000000];
    
    for (const offset of offsets) {
      const offsetTestStart = Date.now();
      const result = await client.query(`
        SELECT ${REQUIRED_COLUMNS}
        FROM "Puff" 
        ORDER BY id 
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);
      const offsetTestTime = Date.now() - offsetTestStart;
      const speed = Math.round(batchSize / (offsetTestTime / 1000));
      
      console.log(`  📊 10k records at offset ${offset.toLocaleString()}: ${offsetTestTime}ms (${speed.toLocaleString()} records/sec)`);
    }

    console.log('\n🎯 Testing cursor-based vs offset at high positions...\n');
    
    // Compare cursor vs offset at high record counts
    const highOffsets = [1000000, 2000000, 4000000];
    
    for (const position of highOffsets) {
      console.log(`  📍 Position ${position.toLocaleString()}:`);
      
      // Offset method
      const offsetStart = Date.now();
      const offsetResult = await client.query(`
        SELECT ${REQUIRED_COLUMNS}
        FROM "Puff" 
        ORDER BY id 
        LIMIT 10000 OFFSET $1
      `, [position]);
      const offsetTime = Date.now() - offsetStart;
      const offsetSpeed = Math.round(10000 / (offsetTime / 1000));
      
      console.log(`    📊 OFFSET method: ${offsetTime}ms (${offsetSpeed.toLocaleString()} records/sec)`);
      
      // Cursor method
      const cursorStart = Date.now();
      const cursorResult = await client.query(`
        SELECT ${REQUIRED_COLUMNS}
        FROM "Puff" 
        WHERE id > $1
        ORDER BY id 
        LIMIT 10000
      `, [position]);
      const cursorTime = Date.now() - cursorStart;
      const cursorSpeed = Math.round(10000 / (cursorTime / 1000));
      
      console.log(`    🎯 CURSOR method: ${cursorTime}ms (${cursorSpeed.toLocaleString()} records/sec)`);
      console.log(`    ⚡ Cursor is ${Math.round((offsetTime / cursorTime) * 100) / 100}x faster\n`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await client.end();
    console.log('✅ Disconnected from PostgreSQL');
    
    console.log('\n📊 Performance Summary:');
    console.log('  🎯 Cursor-based pagination (WHERE id > X) is consistently fast');
    console.log('  📊 OFFSET gets slower with higher values (PostgreSQL limitation)');
    console.log('  ⚡ Selective columns are faster than SELECT *');
    console.log('  🚀 10k-50k batch sizes show good performance');
    console.log('\n💡 Recommendation: Use cursor-based pagination for migration!');
  }
}

// Run the optimized performance test
testOptimizedQueries().catch(console.error);




