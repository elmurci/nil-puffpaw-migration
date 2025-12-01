# 🔑 Where Are Nillion Keys Stored? - Quick Answer

## ✅ Answer: PostgreSQL Table `nillion_login`

---

## 📊 Table Structure

```sql
CREATE TABLE nillion_login (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  nillion_key TEXT NOT NULL,
  nillion_did TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔄 When Are Keys Stored?

**During migration, AFTER all records are processed:**

1. ✅ Migration processes all 10.6M records
2. ✅ Creates 1,901 user vaults
3. ✅ Creates `nillion_login` table
4. ✅ Inserts all keys (1,901 rows)
5. ✅ Shows summary with sample keys

---

## 🔍 Check If Keys Are Stored

```bash
# Connect to PostgreSQL
psql -h 5.223.54.44 -p 32079 -U root -d app

# Check table exists
\dt nillion_login

# Count keys
SELECT COUNT(*) FROM nillion_login;
# Expected: 1,901

# View samples
SELECT user_id, LEFT(nillion_key, 20) as preview 
FROM nillion_login 
LIMIT 5;
```

---

## 🌐 How Web App Uses These Keys

```
1. User logs in → enters User ID
2. Web app queries: SELECT nillion_key FROM nillion_login WHERE user_id = ?
3. Uses key to access encrypted Nillion data
4. User sees their vaping records
```

---

## 🚨 Important

- **Keys stored automatically** - no manual action needed
- **One key per user** - used for all their records
- **Keys required** - without them, data is permanently encrypted
- **Backup created** - if PostgreSQL fails, keys saved to `nillion_keys_backup.json`

---

## 📝 Migration Output (Expected)

When your migration finishes, you'll see:

```
🔑 Storing Nillion login keys in PostgreSQL...
  ✅ Table 'nillion_login' created/verified
  ✅ Keys stored: 1,901/1,901
  
  📋 Sample stored keys (first 3):
    User 1: 1a2b3c4d5e6f7g8h9i0j1k2l3m...
    User 2: 9i8h7g6f5e4d3c2b1a0b9c8d7...
    User 8: 7e6f5g4h3i2j1k0l9m8n7o6p5...
```

---

**Status:** ✅ Your migration will store all keys automatically in `nillion_login` table!

