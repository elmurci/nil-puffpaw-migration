import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import { SecretVaultUserClient } from '@nillion/secretvaults';
import { Keypair } from '@nillion/nuc';

const pgConfig = {
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'app',
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};

const NILDB_NODES = process.env.NILDB_NODES
  ? process.env.NILDB_NODES.split(',')
  : [
      'https://nildb-stg-n1.nillion.network',
      'https://nildb-stg-n2.nillion.network',
      'https://nildb-stg-n3.nillion.network',
    ];

const NILCHAIN_URL = process.env.NILCHAIN_URL || 'http://rpc.testnet.nilchain-rpc-proxy.nilogy.xyz';
const NILAUTH_URL = process.env.NILAUTH_URL || 'https://nilauth.sandbox.app-cluster.sandbox.nilogy.xyz';

export async function POST(request: NextRequest) {
  const client = new Client(pgConfig);

  try {
    const { userId, collectionId, source = 'postgres' } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    await client.connect();

    // Get user's Nillion key
    const keyResult = await client.query(
      `SELECT user_id, nillion_key, nillion_did FROM nillion_login WHERE user_id = $1`,
      [userId]
    );

    if (keyResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found or no Nillion key' },
        { status: 404 }
      );
    }

    const userData = keyResult.rows[0];

    // If requesting nilDB data
    if (source === 'nildb' && collectionId) {
      try {
        const userKeypair = Keypair.from(userData.nillion_key);
        const userClient = await SecretVaultUserClient.from({
          keypair: userKeypair,
          urls: {
            chain: NILCHAIN_URL,
            auth: NILAUTH_URL,
            dbs: NILDB_NODES,
          },
          blindfold: {
            operation: 'retrieve',
            useClusterKey: true  // 🔑 Read from all nodes
          },
        });

        const queryResult = await userClient.queryData({
          collection: collectionId,
          filter: {},
          limit: 100,
        });

        return NextResponse.json({
          success: true,
          source: 'nildb',
          userId: userId,
          nillionDid: userData.nillion_did,
          totalRecords: queryResult.data.length,
          data: queryResult.data,
        });

      } catch (error: any) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to query nilDB: ' + error.message,
            source: 'nildb'
          },
          { status: 500 }
        );
      }
    }

    // Default: Get data from PostgreSQL
    const puffResult = await client.query(
      `SELECT 
        id, user_id, vape_id, pod_id, pod_type, pod_flavour, 
        pod_remaining, pod_nicotine_level, puff_duration,
        timestamp, ip, nft_token_id, valid, created_at
      FROM "Puff"
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      source: 'postgres',
      userId: userId,
      nillionDid: userData.nillion_did,
      totalRecords: puffResult.rows.length,
      data: puffResult.rows,
    });

  } catch (error: any) {
    console.error('Error getting user data:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    await client.end();
  }
}

