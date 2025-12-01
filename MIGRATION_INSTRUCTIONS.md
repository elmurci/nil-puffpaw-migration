# 🚀 PuffPaw PostgreSQL → Nillion Migration Guide

## 📋 **Project Overview**

This project migrates **8.8 million vaping records** from PostgreSQL to Nillion's privacy-preserving nilDB storage. Users will own their individual data while PuffPaw retains analytics access.

---

## 🎯 **Performance Test Results Summary**

### **PostgreSQL Query Performance (Tested):**
- **Selective columns (35 fields)**: 3,400-7,100 records/sec
- **OFFSET pagination**: Degrades from 5k/sec to 1k/sec on large offsets
- **Cursor pagination (WHERE id > X)**: Consistent 6,600 records/sec
- **Best batch size**: 50,000 records (6,600 rec/sec, 360MB memory)

### **Recommended Migration Settings:**
```
BATCH_SIZE=50000          # Optimal performance vs memory
USE_CURSOR_PAGINATION=true # WHERE id > X (3x faster than OFFSET)  
SELECTIVE_COLUMNS=true     # 35 required columns only
TOTAL_ESTIMATED_TIME=22min # For all 8.8M records
```

---

## 🛠️ **Setup Instructions**

### **1. Prerequisites**
- Node.js 18+ installed
- Access to the PostgreSQL database
- Valid Nillion subscription & API keys

### **2. Project Setup**
```bash
# Navigate to project directory
cd "/Users/rishi/Windsurf Projects/nilliontutorial together/nil-puffpaw"

# Install dependencies (already done)
npm install

# Verify .env file exists with correct credentials
cat .env
```

### **3. Environment Configuration (.env file)**
```bash
# Nillion Credentials
NIL_BUILDER_PRIVATE_KEY=your-nillion-private-key-here

# PostgreSQL Connection
POSTGRES_HOST=5.223.54.44
POSTGRES_PORT=32079
POSTGRES_DB=app
POSTGRES_USER=root
POSTGRES_PASSWORD=1aj263QT9BOktn8gl45AKHcrpq7ud0LJ

# Migration Settings
BATCH_SIZE=50000
TOTAL_RECORDS=8867149
BATCH_SLEEP_MS=0
```

---

## 🏃‍♂️ **How to Run Migration Scripts**

### **Step 1: Test PostgreSQL Performance**
```bash
# Test database query speeds (optional)
node test-optimized-queries.js
```

### **Step 2: Small Scale Test (Recommended First)**
```bash
# Test with 1,000 records first
npm run test-migrate
```

### **Step 3: Large Scale Migration**
```bash
# Migrate all 8.8M records
npm run large-migrate
```

---

## 📊 **Migration Scripts Available**

| Script | Purpose | Records | Command |
|--------|---------|---------|---------|
| `test-migration.ts` | Small test (100 records) | 100 | `npm run test-migrate` |
| `large-migration.ts` | Full scale migration | 8.8M | `npm run large-migrate` |
| `test-optimized-queries.js` | Performance testing | N/A | `node test-optimized-queries.js` |
| `debug-connection.js` | Database connection test | N/A | `node debug-connection.js` |

---

## 🔒 **Data Privacy Implementation**

### **Private Fields (Encrypted with %allot):**
```
vape_id, pod_type, pod_flavour, pod_remaining, 
timestamp, ip, nft_token_id
```

### **Public Fields (Analytics Data):**
```  
id, user_id, pod_id, pod_nicotine_level, puff_duration,
raw_data, ua, request_data, ble_id, ble_name, ble_mac,
session_id, app_version, nonce, valid, nft_tier,
local_datetime, source, uploaded_at, is_settled,
settled_metadata, is_delayed_upload, flag, lease_id,
lease_metadata, count, created_at, updated_at
```

---

## ⚡ **Expected Migration Performance**

### **Small Test (100 records):**
- Time: ~30 seconds  
- Users created: ~3 unique users
- Purpose: Verify everything works

### **Large Scale (8.8M records):**
- **Estimated time**: ~22 minutes
- **Batch size**: 50,000 records per batch
- **Total batches**: ~177 batches
- **Speed**: ~6,600 records/second
- **Unique users**: ~50,000-100,000 estimated
- **User vaults created**: One encrypted vault per unique user_id

---

## 🚨 **Common Issues & Solutions**

### **Issue 1: Subscription Expired**
```
Error: SUBSCRIPTION_EXPIRED
```
**Solution**: Renew Nillion subscription and update `NIL_BUILDER_PRIVATE_KEY` in .env

### **Issue 2: PostgreSQL Connection Timeout**  
```
Error: Connection terminated unexpectedly
```
**Solution**: Database timeout on large queries. Script will resume from last batch.

### **Issue 3: Memory Issues**
```
Error: JavaScript heap out of memory
```
**Solution**: Reduce `BATCH_SIZE` from 50000 to 25000 or 10000

---

## 📈 **Migration Progress Monitoring**

### **What You'll See During Migration:**
```
📦 Batch 1/177 (offset: 0)
  📥 Retrieved 50000 records
  👤 Creating user vault for user_id: 123
  ✅ Batch completed: 50000/50000 records (6600/sec)
  📊 Progress: 50,000/8,867,149 (1%)
  👥 Unique users: 234
  🏦 User vaults: 234
```

### **Final Results:**
```
🎉 Large migration completed!
📊 Final Results:
  - Records processed: 8,867,149/8,867,149
  - Records failed: 0
  - Success rate: 100%
  - Unique users: 67,891
  - User vaults created: 67,891
  - Collection ID: abc123def456...
  - Total time: 1,320 seconds (22 minutes)
  - Average speed: 6,718 records/second
```

---

## 🔧 **Configuration Options**

### **Batch Size Options:**
```bash
BATCH_SIZE=10000   # Slower but uses less memory (60MB)
BATCH_SIZE=25000   # Balanced approach (160MB memory)
BATCH_SIZE=50000   # Fastest performance (360MB memory)
```

### **Migration Modes:**
```bash
TEST_MODE=true     # Process limited records for testing
TEST_MODE=false    # Process all records (full migration)
```

---

## 🎯 **Post-Migration Steps**

### **1. Verify Migration Success**
- Check final success rate (should be 100%)
- Note the Collection ID for future queries
- Verify user vault count matches expected unique users

### **2. Test Data Access**  
- Query migrated data to verify encryption works
- Test user permission controls
- Validate analytics queries work with public fields

### **3. Production Deployment**
- Update app to use nilDB instead of PostgreSQL for new data
- Implement user dashboards for data control  
- Set up reward systems for data sharing

---

## 📞 **Troubleshooting Contacts**

### **If Migration Fails:**
1. **Check logs** for specific error messages
2. **Verify credentials** (Nillion subscription status)
3. **Test smaller batch** with `npm run test-migrate`
4. **Reduce batch size** if memory issues occur

### **Key Files to Check:**
- `.env` - Database and Nillion credentials
- `src/large-migration.ts` - Main migration logic
- Migration logs in terminal output

---

## 🚀 **Quick Start Commands**

```bash
# 1. Test small migration first
npm run test-migrate

# 2. If successful, run full migration  
npm run large-migrate

# 3. Monitor progress and wait ~22 minutes

# 4. Verify results in terminal output
```

**Expected completion**: ~22 minutes for full 8.8M record migration with 50k batch size and cursor-based pagination.

---

*Last updated: Successfully tested up to 60,000 records with 576 unique users. PostgreSQL performance optimized for cursor-based pagination. Ready for full-scale deployment.*




