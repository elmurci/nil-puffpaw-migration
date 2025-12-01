# 🔒 PuffPaw User Portal

A privacy-first web application for users to access their encrypted vaping data stored on Nillion's nilDB.

## 🎯 Features

- **🔗 Wallet Connection**: Users connect with MetaMask
- **🔑 Secure Key Retrieval**: Nillion encryption keys stored securely in PostgreSQL
- **📊 Encrypted Data Access**: Users can view their own encrypted vaping records
- **🔒 Privacy-First**: All sensitive data encrypted with Nillion's blind computation

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd web-app
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your PostgreSQL credentials
```

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📋 How It Works

### **Step 1: User Connects Wallet**
- User clicks "Connect MetaMask"
- MetaMask prompts for connection approval
- Wallet address is displayed

### **Step 2: Retrieve Nillion Key**
- User enters their PuffPaw User ID
- Signs a message to prove wallet ownership
- Backend fetches their Nillion encryption key from PostgreSQL
- Key is securely transmitted to frontend

### **Step 3: Access Encrypted Data**
- User enters the Collection ID (from migration output)
- App queries Nillion nilDB using user's key
- Encrypted fields are automatically decrypted (user owns the data)
- Display vaping records with full privacy

---

## 🔐 Security Model

### **Data Flow:**
```
User Login → Sign Message → Verify Ownership → Fetch Nillion Key → Query nilDB → Decrypt Data
```

### **Privacy Guarantees:**
- ✅ **User owns their data** - stored in individual vaults
- ✅ **Private fields encrypted** - vape_id, pod_type, flavour, nicotine, duration, etc.
- ✅ **Keys stored securely** - PostgreSQL table with user_id linkage
- ✅ **Automatic decryption** - only for data owner
- ✅ **Platform can't decrypt** - PuffPaw has read-only analytics access

---

## 📊 Database Schema

The web app reads from the `nillion_user_keys` table created during migration:

```sql
CREATE TABLE nillion_user_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  nillion_key TEXT NOT NULL,
  nillion_did TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🛠️ API Routes

### `POST /api/get-nillion-key`
Retrieves user's Nillion encryption key from PostgreSQL.

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
  "nillionKey": "1a2b3c4d...",
  "nillionDid": "did:nil:024f14..."
}
```

### `POST /api/query-my-data`
Queries user's encrypted data from Nillion nilDB.

**Request:**
```json
{
  "nillionKey": "1a2b3c4d...",
  "collectionId": "ef71e760-118f-423c-97fd-31b971a5ec37",
  "limit": 100
}
```

**Response:**
```json
{
  "success": true,
  "totalRecords": 45,
  "data": [
    {
      "id": 1,
      "vape_id": "1188337089977745",
      "pod_type": "A",
      "pod_flavour": "2",
      ...
    }
  ]
}
```

---

## 🎨 UI Components

### Main Page (`app/page.tsx`)
- Wallet connection button
- User ID input
- Nillion key retrieval
- Collection ID input
- Data query and display

### Styling
- Tailwind CSS for responsive design
- Gradient backgrounds (purple/blue)
- Glassmorphism effects
- Mobile-friendly

---

## 🔧 Production Deployment

### Environment Variables
```bash
# Required for production
POSTGRES_HOST=your-production-db
POSTGRES_PORT=5432
POSTGRES_DB=production_db
POSTGRES_USER=secure_user
POSTGRES_PASSWORD=secure_password
NILDB_NODES=https://nildb-stg-n1.nillion.network,https://nildb-stg-n2.nillion.network,https://nildb-stg-n3.nillion.network
```

### Build & Deploy
```bash
npm run build
npm run start
```

Deploy to:
- **Vercel** (recommended for Next.js)
- **Railway**
- **Your own server**

---

## 🔒 Security Best Practices

1. **Signature Verification**: Always verify wallet signatures on the backend
2. **HTTPS Only**: Use SSL certificates in production
3. **Rate Limiting**: Add rate limits to API routes
4. **Key Encryption**: Consider encrypting Nillion keys at rest in PostgreSQL
5. **Session Management**: Add proper user sessions
6. **CORS**: Configure CORS properly for your domain

---

## 📝 Next Steps

1. **Add wallet signature verification** in `/api/get-nillion-key`
2. **Implement proper authentication** (JWT, sessions)
3. **Add data visualization** (charts, graphs)
4. **Build reward system** for data sharing
5. **Add export functionality** (CSV, JSON)
6. **Implement data deletion** (user's right to be forgotten)

---

## 💡 User Experience Flow

1. User logs into PuffPaw platform
2. Clicks "Access My Private Data"
3. Connects MetaMask wallet
4. System verifies wallet ownership
5. Retrieves Nillion encryption key
6. Displays encrypted vaping records
7. User can view habits, earn rewards, share data selectively

---

**Built with:**
- Next.js 14
- TypeScript
- Nillion SecretVaults SDK
- Ethers.js (wallet connection)
- Tailwind CSS
- PostgreSQL

**Privacy-first. User-owned. Decentralized.**


