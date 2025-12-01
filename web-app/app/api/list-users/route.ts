import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

const pgConfig = {
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'app',
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};

export async function GET() {
  const client = new Client(pgConfig);

  try {
    await client.connect();

    // Get users who have Nillion keys and puff data, with wallet info
    const result = await client.query(`
      SELECT 
        nl.user_id,
        nl.wallet_address,
        nl.nillion_did,
        nl.created_at as key_created_at,
        u.name as user_name,
        COUNT(p.id) as puff_count
      FROM nillion_login nl
      LEFT JOIN "User" u ON nl.user_id = u.id
      LEFT JOIN "Puff" p ON nl.user_id = p.user_id
      GROUP BY nl.user_id, nl.wallet_address, nl.nillion_did, nl.created_at, u.name
      HAVING COUNT(p.id) > 0
      ORDER BY nl.user_id
      LIMIT 50
    `);

    return NextResponse.json({
      success: true,
      users: result.rows,
    });

  } catch (error: any) {
    console.error('Error listing users:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    await client.end();
  }
}

