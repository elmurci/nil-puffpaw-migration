# 🔑 Nillion Keys Storage - Critical Information

## 📊 Where Are the Keys Stored?

### **PostgreSQL Table: `nillion_login`**

The migration automatically creates and populates this table:

```sql
CREATE TABLE IF NOT EXISTS nillion_login (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  nillion_key TEXT NOT NULL,
  nillion_did TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔍 What Gets Stored

### **For Each User:**

| Column | Description | Example |
|--------|-------------|---------|
| `user_id` | PuffPaw platform user ID | `8` |
| `nillion_key` | Hex-encoded encryption key | `1a2b3c4d5e6f...` (128 chars) |
| `nillion_did` | Nillion decentralized ID | `did:nil:024f144a4f265027...` |
| `created_at` | When key was generated | `2025-10-20 14:30:45` |

---

## ✅ How It Works

### **During Migration:**

1. **User vault created** for each unique `user_id`
2. **Nillion keypair generated** using blind computation
3. **Key stored in memory** (`userKeys Map`)
4. **After all records processed:**
   - Table `nillion_login` created (if not exists)
   - All keys inserted into PostgreSQL
   - Progress logged every 100 keys

### **Key Storage Code:**
```typescript
// Line 133 in large-migration.ts
userKeys.set(userId, keyHex); // Save key in memory

// Lines 334-405 in large-migration.ts
// After migration completes:
// - Create nillion_login table
// - Insert all keys with ON CONFLICT handling
// - Backup to file if PostgreSQL fails
```

---

## 🔐 Security Features

### **Backup System:**
If PostgreSQL storage fails, keys are automatically exported to:
```
nillion_keys_backup.json
```

**Format:**
```json
[
  {
    "user_id": 8,
    "nillion_key": "1a2b3c4d5e6f...",
    "nillion_did": "did:nil:024f14..."
  }
]
```

### **ON CONFLICT Handling:**
```sql
ON CONFLICT (user_id) DO UPDATE 
SET nillion_key = EXCLUDED.nillion_key,
    nillion_did = EXCLUDED.nillion_did
```
**Result:** Re-running migration updates keys instead of failing

---

## 📋 Verify Keys Stored

### **Check Total Keys:**
```sql
SELECT COUNT(*) FROM nillion_login;
```

### **View Sample Keys:**
```sql
SELECT user_id, 
       LEFT(nillion_key, 30) as key_preview,
       LEFT(nillion_did, 30) as did_preview,
       created_at
FROM nillion_login
LIMIT 5;
```

### **Find Specific User:**
```sql
SELECT * FROM nillion_login WHERE user_id = 8;
```

---

## 🌐 How Web App Uses Keys

### **User Login Flow:**

1. **User connects wallet** (MetaMask)
2. **User enters their User ID**
3. **Signs message** to prove ownership
4. **Backend queries:**
   ```sql
   SELECT nillion_key, nillion_did 
   FROM nillion_login 
   WHERE user_id = ?
   ```
5. **Returns key** to frontend
6. **Frontend uses key** to access encrypted Nillion data

### **API Endpoint:**
```
POST /api/get-nillion-key
```

**Request:**
```json
{
  "userId": 8,
  "walletAddress": "0x123...",
  "signature": "0xabc..."
}
```

**Response:**
```json
{
  "success": true,
  "nillionKey": "1a2b3c4d5e6f...",
  "nillionDid": "did:nil:024f14..."
}
```

---

## 🚨 Critical Points

### **Keys Are Required For:**
- ✅ Users to access their encrypted data
- ✅ Users to view their vaping records
- ✅ Any decryption of private fields
- ✅ User authentication in web app

### **Without Keys:**
- ❌ Data is permanently encrypted
- ❌ Users cannot access their records
- ❌ No way to decrypt private fields

### **Key Generation:**
- 🔒 Keys generated using Nillion's SecretKey.generate()
- 🔒 Distributed across 3 nilDB nodes
- 🔒 Uses blind computation (MPC)
- 🔒 Each user gets unique encryption key

---

## 📊 Migration Output

When migration completes, you'll see:

```
🎉 Large migration completed!
📊 Final Results:
  - Records processed: 10,615,828/10,615,828
  - User vaults created: 1,901
  - Collection ID: ef71e760-118f-423c-97fd-31b971a5ec37

🔑 Storing Nillion login keys in PostgreSQL...
  ✅ Table 'nillion_login' created/verified
  📝 Stored 100/1901 keys...
  📝 Stored 200/1901 keys...
  ...
  ✅ Keys stored: 1,901/1,901

  📋 Sample stored keys (first 3):
    User 1: 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o...
    User 2: 9i8h7g6f5e4d3c2b1a0b9c8d7e6f5...
    User 8: 7e6f5g4h3i2j1k0l9m8n7o6p5q4r3...

💡 Next steps:
  1. ✅ User keys stored in 'nillion_login' table
  2. Query and verify the migrated data
  3. Build web app for users to access their data
```

---

## 🔧 Troubleshooting

### **Problem: Keys not stored**
```bash
# Check if table exists
psql -h 5.223.54.44 -p 32079 -U root -d app \
  -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'nillion_login');"

# If false, migration didn't complete or failed
# Check for backup file:
ls -la nillion_keys_backup.json
```

### **Problem: Can't find user's key**
```sql
-- Check if user exists
SELECT * FROM nillion_login WHERE user_id = 8;

-- If empty, that user_id wasn't in migration
-- Check original Puff table
SELECT DISTINCT user_id FROM "Puff" WHERE user_id = 8;
```

### **Problem: Need to restore from backup**
```bash
# If you have nillion_keys_backup.json
node -e "
const keys = require('./nillion_keys_backup.json');
const { Client } = require('pg');
// Insert keys from backup file
"
```

---

## 📝 Important Notes

1. **Keys are generated ONCE** during migration
2. **Same key used** for all records of a user
3. **Keys stored in plaintext** in PostgreSQL (consider encryption at rest)
4. **Backup file** created if PostgreSQL storage fails
5. **ON CONFLICT** allows re-running migration safely

---

## 🔐 Production Security Recommendations

### **Encrypt Keys at Rest:**
```sql
-- Use PostgreSQL pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE nillion_login 
ADD COLUMN nillion_key_encrypted BYTEA;

UPDATE nillion_login 
SET nillion_key_encrypted = pgp_sym_encrypt(nillion_key, 'your-encryption-key');
```

### **Access Control:**
```sql
-- Restrict access to nillion_login table
REVOKE ALL ON nillion_login FROM PUBLIC;
GRANT SELECT ON nillion_login TO web_app_user;
```

### **Audit Logging:**
```sql
-- Track who accesses keys
CREATE TABLE nillion_login_audit (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  accessed_by TEXT,
  accessed_at TIMESTAMP DEFAULT NOW()
);
```

---

**Status:** ✅ **Keys are being stored automatically during migration!**

When your migration completes, all 1,901 user keys will be in the `nillion_login` table, ready for the web app to use.

