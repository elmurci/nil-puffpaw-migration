# PuffPaw Admin Dashboard

A demonstration dashboard showing **true user data ownership** with Nillion's privacy-preserving storage.

## Key Features

🔐 **User Data Ownership** - Each user has their own Nillion encryption key  
🎯 **Admin View** - Select any user and view their data using THEIR key (not the builder's)  
📊 **Dual Source** - Compare data from PostgreSQL vs nilDB  
🔒 **Privacy-First** - Sensitive fields are encrypted and only accessible with the user's key  

## How It Works

1. **User Selection**: Choose a user from a dropdown (no wallet connection needed)
2. **Data Source**: Select either PostgreSQL (legacy) or nilDB (encrypted)
3. **View Data**: The dashboard fetches the user's Nillion key from the database and uses it to decrypt their private data

This demonstrates that **only the user (or someone with their key) can access their encrypted data** - the builder/platform cannot read it without the user's permission.

## Setup

### 1. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 2. Configure Environment Variables

Copy the required environment variables to \`.env.local\`:

\`\`\`bash
# PostgreSQL Database
POSTGRES_HOST=5.223.54.44
POSTGRES_PORT=32079
POSTGRES_DB=app
POSTGRES_USER=root
POSTGRES_PASSWORD=your_password_here

# Nillion nilDB Nodes (for reading encrypted data)
NILDB_NODES=https://nildb-stg-n1.nillion.network,https://nildb-stg-n2.nillion.network,https://nildb-stg-n3.nillion.network
\`\`\`

### 3. Run the Dashboard

\`\`\`bash
npm run dev
\`\`\`

Then navigate to:
- **Admin Dashboard**: [http://localhost:3000/admin](http://localhost:3000/admin) (New! Simple dropdown interface)
- **User Portal**: [http://localhost:3000](http://localhost:3000) (Original wallet-based interface)

## Admin Dashboard Usage

1. **Open** [http://localhost:3000/admin](http://localhost:3000/admin)

2. **Select a User** from the dropdown  
   - Shows users who have Nillion keys and puff data  
   - Displays their user ID, puff count, and Nillion DID

3. **Choose Data Source**:
   - **PostgreSQL**: View unencrypted data from the legacy database
   - **nilDB**: View encrypted data (requires Collection ID from migration)

4. **Load Data** - The dashboard:
   - Fetches the user's Nillion key from PostgreSQL
   - Creates a UserClient with THAT USER'S key
   - Queries and decrypts the data using the user's key
   - Displays the private fields (marked with 🔒)

## API Endpoints

### `GET /api/list-users`
Lists all users who have Nillion keys and puff data.

### `POST /api/get-user-data`
Fetches a specific user's data from either PostgreSQL or nilDB.

**Body:**
\`\`\`json
{
  "userId": 8,
  "source": "postgres",  // or "nildb"
  "collectionId": "uuid" // required for nildb
}
\`\`\`

## Private vs Public Fields

### 🔒 Private (Encrypted in nilDB)
- vape_id
- pod_type
- pod_flavour
- pod_remaining
- timestamp
- ip
- nft_token_id

### 📊 Public (Analytics)
- user_id
- pod_id
- puff_duration
- pod_nicotine_level
- valid status

## Architecture

\`\`\`
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│   Next.js API Routes    │
│  /api/list-users        │
│  /api/get-user-data     │
└──────┬──────────────────┘
       │
       ├─────────────────────┐
       │                     │
       ▼                     ▼
┌─────────────┐      ┌─────────────┐
│ PostgreSQL  │      │   nilDB     │
│  (keys +    │      │ (encrypted  │
│   metadata) │      │    data)    │
└─────────────┘      └─────────────┘
\`\`\`

## Next Steps

1. **Run Migration**: Use `npm run large-migrate` in the parent directory to push data from PostgreSQL to nilDB
2. **Get Collection ID**: Copy the collection ID from the migration output
3. **Test nilDB Source**: Use the collection ID in the dashboard to view encrypted data

## Security Note

⚠️ **This is a demo dashboard** - In production, you would:
- Add authentication/authorization for admin access
- Implement audit logging for data access
- Use secure key storage (not directly in PostgreSQL)
- Add rate limiting and access controls


