import { NextRequest, NextResponse } from 'next/server';
import { SecretVaultUserClient } from '@nillion/secretvaults';
import { Keypair } from '@nillion/nuc';

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
  try {
    const { nillionKey, collectionId, limit = 100 } = await request.json();

    if (!nillionKey || !collectionId) {
      return NextResponse.json(
        { error: 'Missing nillionKey or collectionId' },
        { status: 400 }
      );
    }

    // Create user client from their stored key
    const userKeypair = Keypair.from(nillionKey);
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

    // Query user's own data (they own it, so they can access it)
    const queryResult = await userClient.queryData({
      collection: collectionId,
      filter: {
        // Optional: filter by specific criteria
      },
      limit: limit,
    });

    // Decrypt and return the data
    const decryptedData = queryResult.data.map((record: any) => {
      // The SDK automatically decrypts %allot fields for the owner
      return record;
    });

    return NextResponse.json({
      success: true,
      totalRecords: decryptedData.length,
      data: decryptedData,
    });

  } catch (error) {
    console.error('Error querying Nillion data:', error);
    return NextResponse.json(
      { error: 'Failed to query your data', details: error.message },
      { status: 500 }
    );
  }
}


