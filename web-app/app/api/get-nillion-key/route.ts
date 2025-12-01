import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

// PostgreSQL connection (use environment variables in production)
const pgConfig = {
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'app',
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};

export async function POST(request: NextRequest) {
  let pgClient: Client | null = null;
  
  try {
    const { userId, walletAddress, signature } = await request.json();

    if (!userId || !walletAddress || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // TODO: Verify wallet signature here
    // For now, we'll trust the user_id
    // In production, verify: ethers.verifyMessage(message, signature) === walletAddress

    // Connect to PostgreSQL
    pgClient = new Client(pgConfig);
    await pgClient.connect();

    // Fetch user's Nillion key from nillion_login table
    const result = await pgClient.query(
      'SELECT nillion_key, nillion_did FROM nillion_login WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'No Nillion key found for this user. Please ensure migration completed successfully.' },
        { status: 404 }
      );
    }

    const { nillion_key, nillion_did } = result.rows[0];

    return NextResponse.json({
      success: true,
      nillionKey: nillion_key,
      nillionDid: nillion_did,
    });

  } catch (error) {
    console.error('Error fetching Nillion key:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Nillion key' },
      { status: 500 }
    );
  } finally {
    if (pgClient) {
      await pgClient.end();
    }
  }
}


