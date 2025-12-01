# 🔄 PostgreSQL to nilDB Migration Guide

## 📋 Overview

This guide helps you migrate your existing PostgreSQL vape data into Nillion's privacy-preserving nilDB storage.

---

## 🎯 **Current vs. Target Architecture**

### **Before (PostgreSQL):**
```
Smart Vapes → PostgreSQL Database → Your Analytics
                    ↑
              All data in one place
              No privacy controls
              You own everything
```

### **After (nilDB):**
```
Smart Vapes → User's Private Vaults → Selective Analytics
                       ↑                      ↑
              Users own their data    You get permitted insights
              Granular privacy       Better user trust
```

---

## 🛠️ **Setup Migration Environment**

### 1. **Add PostgreSQL Configuration to .env**
```bash
# Add these to your .env file:

# PostgreSQL Database Connection
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=puffpaw
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

# Optional: Set existing collection ID (leave empty for new)
NIL_BUILDER_COLLECTION_ID=
```

### 2. **Install Dependencies**
```bash
npm install pg @types/pg
```

---

## 📊 **Data Transformation**

### **PostgreSQL Record** → **nilDB Format**

Your existing PostgreSQL data will be transformed like this:

#### **🔒 Private Fields (Encrypted with %allot):**
```sql
-- PostgreSQL columns that become PRIVATE:
vape_id          → { "%allot": "1188337089977745" }
pod_type         → { "%allot": "A" }
pod_flavour      → { "%allot": "2" }
pod_remaining    → { "%allot": 992 }
timestamp        → { "%allot": "2025-05-05 04:54:37" }
ip               → { "%allot": "52.78.45.72" }
nft_token_id     → { "%allot": 423 }
```

#### **📊 Public Fields (Analytics Data):**
```sql
-- PostgreSQL columns that stay PUBLIC:
user_id, pod_id, pod_nicotine_level, puff_duration,
raw_data, ua, ble_id, ble_name, session_id, etc.
```

---

## 🔄 **Migration Process**

### **What the Migration Script Does:**

1. **📥 Connects to your PostgreSQL database**
2. **👥 Creates individual user vaults** for each unique `user_id`
3. **🔒 Transforms sensitive fields** to encrypted format
4. **📦 Uploads data in batches** (100 records at a time)
5. **🎛️ Sets proper access controls** (users own data, you get read access)

### **User Ownership Model:**
```typescript
// Each user gets their own encrypted vault
user_id: 8  → Creates user vault with unique keys
user_id: 15 → Creates separate user vault with different keys
user_id: 23 → Creates another separate user vault
```

---

## 🚀 **Running the Migration**

### **Option 1: Full Migration (Recommended)**
```bash
# Run the complete migration script
npm run migrate

# Or directly:
npx tsx src/migrate-postgres.ts
```

### **Option 2: Test with Sample Data First**
```bash
# Test with just 10 records
BATCH_SIZE=10 npx tsx src/migrate-postgres.ts
```

---

## 📈 **Migration Progress**

You'll see output like this:

```
🚀 Starting PostgreSQL to nilDB migration...
✅ Connected to PostgreSQL
✅ Connected to Nillion
✅ Created collection: 6fd3f246-3300-4146-a8d3-fcd93e275007
💡 Add this to your .env: NIL_BUILDER_COLLECTION_ID=6fd3f246-3300-4146-a8d3-fcd93e275007

📊 Found 50,000 records to migrate

📦 Processing batch 1/500
  ✅ Migrated 10/50,000 records (0%)
  ✅ Migrated 20/50,000 records (0%)
  ...

📦 Processing batch 500/500
  ✅ Migrated 50,000/50,000 records (100%)

🎉 Migration completed! Processed 50,000/50,000 records
👥 Created 1,250 unique user vaults
✅ Disconnected from PostgreSQL
```

---

## 🔍 **What Happens to Your Data**

### **Before Migration:**
- All vape data in PostgreSQL
- You control everything
- Users have no privacy

### **After Migration:**
- **User-Owned Vaults**: Each user has their own encrypted storage
- **Privacy Controls**: Sensitive data (vape_id, timestamps, IPs) encrypted
- **Your Access**: You can still read data for analytics (but users control it)
- **Analytics**: Aggregate insights without accessing individual private details

---

## 🛡️ **Privacy Benefits**

### **For Users:**
- 🔐 **Private by Default**: Sensitive data encrypted and secret-shared
- 👑 **Data Ownership**: Users own their vaping records
- 🎛️ **Access Control**: Can revoke your access anytime
- 💰 **Earn Rewards**: Get paid for sharing data insights

### **For You (PuffPaw):**
- 📊 **Better Analytics**: Users more willing to share when they control privacy
- ⚖️ **Regulatory Compliance**: Meets GDPR, CCPA automatically
- 🤝 **User Trust**: Privacy-first approach builds loyalty
- 🔬 **Research Value**: Aggregate insights for product development

---

## 🎛️ **Access Control After Migration**

Each migrated record has these permissions:

```typescript
{
  owner: "user_vault_id",           // User owns this record
  acl: {
    grantee: "puffpaw_builder_id",  // You (PuffPaw) get access
    read: true,                     // You can read for analytics
    write: false,                   // You CANNOT modify user data
    execute: true                   // You can run aggregate queries
  }
}
```

---

## 🔧 **Customizing the Migration**

### **Modify Private vs Public Fields:**

Edit `src/migrate-postgres.ts` to change which fields are private:

```typescript
// Add more private fields:
sensitive_field: {
  "%allot": record.sensitive_field
},

// Remove from private (make public):
pod_type: record.pod_type  // Remove %allot wrapper
```

### **Batch Size:**
```typescript
const batchSize = 100;  // Adjust for your database size
```

### **PostgreSQL Query:**
```typescript
// Modify the query to filter specific data
const result = await pgClient.query(`
  SELECT * FROM vape_sessions 
  WHERE created_at > '2024-01-01'  -- Only recent data
  ORDER BY created_at 
  LIMIT $1 OFFSET $2
`, [batchSize, offset]);
```

---

## 🚨 **Important Notes**

### **⚠️ Before Migration:**
1. **Backup your PostgreSQL database**
2. **Test with a small dataset first**
3. **Ensure your Nillion credentials are working**
4. **Have sufficient storage/compute for the migration**

### **💾 After Migration:**
1. **Save the collection ID** (add to .env)
2. **Update your app** to read from nilDB instead of PostgreSQL
3. **Implement user consent flows** for data access
4. **Set up analytics queries** on the encrypted data

---

## 🎯 **Next Steps After Migration**

1. **Update your app** to use nilDB instead of PostgreSQL for new data
2. **Build user dashboards** so users can see their own data
3. **Implement reward systems** for users who share data
4. **Create aggregate analytics** that respect privacy
5. **Add consent management** for different types of data access

This migration transforms your platform from "company-owned data" to "user-owned data with selective sharing" - the future of privacy-compliant IoT platforms!

