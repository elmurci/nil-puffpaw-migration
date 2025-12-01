# 🎯 Admin Dashboard - Quick Start

> **New Feature**: Simple admin dashboard with user dropdown (no wallet needed!)  
> **For original migration guide**, see [QUICK_START.md](./QUICK_START.md)

---

## ✅ What You Have Now

A complete **admin dashboard** to demonstrate user data ownership:

- 👥 **37 users** with Nillion keys ready
- 📊 **~2.5M puff records** in PostgreSQL
- 🎨 **Beautiful web UI** with dropdown selection
- 🔒 **Privacy demonstration** - uses each user's own key

---

## 🚀 Start the Dashboard (2 minutes)

### 1. Set Environment Variables

Create `web-app/.env.local`:

```bash
POSTGRES_HOST=5.223.54.44
POSTGRES_PORT=32079
POSTGRES_DB=app
POSTGRES_USER=root
POSTGRES_PASSWORD=YOUR_PASSWORD_HERE

NILDB_NODES=https://nildb-stg-n1.nillion.network,https://nildb-stg-n2.nillion.network,https://nildb-stg-n3.nillion.network
```

### 2. Start the Server

```bash
cd web-app
npm run dev
```

### 3. Open Dashboard

```
http://localhost:3000/admin
```

---

## 🎮 Try It Now - PostgreSQL Source

**Test with existing data** (no migration needed):

1. **Select "User 8"** from dropdown
2. **Choose "PostgreSQL"** as data source  
3. **Click "Load User Data"**
4. ✅ **See 5 puff records!**

**What you'll see:**
```
📊 User Data
User 8 - 5 records from PostgreSQL

Record 1:
  🔒 Vape ID: 1225531506761105
  🔒 Pod Type: A
  🔒 Flavour: 2
  🔒 Remaining: 992
  🔒 NFT Token: 2323
  📊 Duration: 1s
  📊 Nicotine: 2
```

---

## 🔐 Try It Later - nilDB Source

**Test with encrypted data** (requires migration):

### 1. Run Migration

```bash
cd ..  # Back to root
npm run large-migrate
```

### 2. Copy Collection ID

From migration output:
```
✅ Collection created: ef71e760-118f-423c-97fd-31b971a5ec37
```

### 3. Use in Dashboard

- Select a user
- Choose **"nilDB"** as source
- Paste the collection ID
- Click "Load User Data"
- ✅ See encrypted data decrypted!

---

## 🎯 What Makes This Special

### Traditional Dashboard:
```
Admin → Database → User Data
(Platform can see everything)
```

### This Dashboard:
```
Admin → User's Key → Encrypted Data
(Platform needs user's key to decrypt)
```

**The difference:** This proves **users own their data**. The platform uses THEIR key, not the builder's key.

---

## 🛠️ Other Tools Available

### CLI Tool (for developers)

```bash
# List all users with keys
npm run query-user -- --list

# Query specific user (needs collection ID)
npm run query-user -- --userId=8 --collectionId=<ID>
```

---

## 📊 Available Users

**Users with keys and data:**
- User 1, 2, 3, 5, 6, 7, 8, 9, 11, 13, 15, 16, 21, 22, 24, 25, 26, 28, 30, 31...

**User with most puffs:**
- User 1878: 163,234 puffs 🏆

---

## 🎓 Demo Script (2 minutes)

Perfect for showing stakeholders:

1. **Open dashboard** → "This shows user data ownership"
2. **Select User 8** → "Let's view their data"
3. **PostgreSQL source** → "Here's unencrypted legacy data"
4. **Point to 🔒 icons** → "These would be encrypted in nilDB"
5. **Explain** → "We use THEIR key to decrypt, not ours"
6. **Key point** → "The platform can't read encrypted data without user permission"

---

## 🔄 Comparison: 2 Dashboards

### 1. User Portal (`/`)
- **Requires**: MetaMask wallet
- **For**: End users accessing their own data
- **Auth**: Wallet signature
- **Use case**: Production user interface

### 2. Admin Dashboard (`/admin`) ← NEW!
- **Requires**: Just database credentials
- **For**: Demos, testing, admin view
- **Auth**: None (demo only)
- **Use case**: Demonstrations, development

---

## 📁 Related Documentation

- **[DASHBOARD_GUIDE.md](./DASHBOARD_GUIDE.md)** - Complete technical details
- **[COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md)** - High-level overview
- **[DASHBOARD_README.md](./DASHBOARD_README.md)** - Documentation index
- **[QUICK_START.md](./QUICK_START.md)** - Original migration guide

---

## ✨ Quick Win

**Want to impress someone right now?**

```bash
cd web-app
npm run dev
# Open http://localhost:3000/admin
# Select User 8, choose PostgreSQL, click Load
# Done! ✅
```

**That's it!** You have a working demo of user data ownership.

---

**Status:** ✅ **Ready to demo!**

The dashboard works with existing PostgreSQL data. Run migration later to test nilDB encrypted source.


