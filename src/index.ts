import inquirer from 'inquirer';
import { SecretVaultBuilderClient, SecretVaultUserClient, Uuid } from '@nillion/secretvaults';
import { logger } from './logger';
import pc from 'picocolors';
import { randomUUID } from 'node:crypto';
import { Keypair } from '@nillion/nuc';
import { bytesToHex } from '@noble/curves/utils';
import schema from '../cfg/schema.json' assert { type: 'json' };
import testRecord from '../cfg/test_record.json' assert { type: 'json' };
import {
    Command,
    Keypair,
    Did,
} from '@nillion/nuc';
import {
    SecretKey,
} from '@nillion/blindfold';
import 'dotenv/config';
import { generateToken } from './util/misc';

const { green, blue } = pc;

export type AppConfig = {
    NILCHAIN_URL: string;
    NILAUTH_URL: string;
    NILDB_NODES: string[];
    NIL_PAYER_PRIVATE_KEY: string;
    NIL_BUILDER_PRIVATE_KEY: string;
    NIL_BUILDER_COLLECTION_ID: string;
};

const config: AppConfig = {
    NILCHAIN_URL:
        process.env.NILCHAIN_URL ||
        'http://rpc.testnet.nilchain-rpc-proxy.nilogy.xyz',
    NILAUTH_URL:
        process.env.NILAUTH_URL ||
        'https://nilauth.sandbox.app-cluster.sandbox.nilogy.xyz',
    NILDB_NODES: process.env.NILDB_NODES
        ? process.env.NILDB_NODES.split(',')
        : [
                'https://nildb-stg-n1.nillion.network',
                'https://nildb-stg-n2.nillion.network',
                'https://nildb-stg-n3.nillion.network',
          ],
    NIL_BUILDER_PRIVATE_KEY: process.env.NIL_BUILDER_PRIVATE_KEY!,
    NIL_BUILDER_COLLECTION_ID: null
};

const init = async () => {
  try {

    let collectionId = config.NIL_BUILDER_COLLECTION_ID;

    // Create builder client (this is PuffPaw's app)
    const builderKeypair = Keypair.from(config.NIL_BUILDER_PRIVATE_KEY);
    const builderClient = await SecretVaultBuilderClient.from({
        keypair: builderKeypair,
        urls: {
            chain: config.NILCHAIN_URL,
            auth: config.NILAUTH_URL,
            dbs: config.NILDB_NODES,
        },
        blindfold: {
          operation: "store",
          useClusterKey: true
        }
    });

    await builderClient.refreshRootToken();

    const builderProfile = await builderClient.readProfile();

    // If the collection is not created,do it
    // That is, if config.NIL_BUILDER_COLLECTION_ID is not set.
    if (!collectionId) {
      collectionId = randomUUID();
      const collection: {
          _id: string
          type: "owned"
          name: string
          schema: Record<string, unknown>
        } = {
          _id: collectionId,
          type: "owned",
          name: "Puffpaw Schema",
          schema,
        };

      await builderClient.createCollection(collection);

    }

    console.log("Collection Id:", collectionId);

    // Create User (represents the user of the Vape)
    const userClient = await createUser();

    // Builder (Puffpaw) grants write access to user so they can start pushing data
    const delegation = await grantWriteAccessToUser(builderClient, userClient.keypair.toDid());

    // Here we are uploading a sample record
    // It should be adapted to convert the Postgres records to this formar
    const userData = testRecord;

    // User can start writing data
    const data = await writeUserOwnedData(userClient, collectionId, userData, delegation, builderClient.did.toString());

    console.log("data", data);
    
  } catch (error: any) {
    console.log(error)
    logger.error('⚠️ Error:', JSON.stringify(error, null, 2));
  }

}

const createUser = async () => {
  const secretKey = await SecretKey.generate({"nodes": config.NILDB_NODES.map(url => ({ url }))}, {"store": true});
  const userKeypair = Keypair.from(bytesToHex(secretKey.material as Uint8Array));
  const userClient = await SecretVaultUserClient.from({
      baseUrls: config.NILDB_NODES,
      keypair: userKeypair,
      blindfold: {
        operation: "store"
      }
  });

  return userClient;

}

const grantWriteAccessToUser = async (builderClient: SecretVaultBuilderClient, audience: Did) => {
  return generateToken(
    builderClient.rootToken,
    new Command(['nil', 'db', 'data', 'create']),
    audience,
    3600, // 1 hour
    builderClient.keypair.privateKey()
  );
};

const writeUserOwnedData = async (
  userClient: SecretVaultUserClient,
  collectionId: string,
  data: Record<string, unknown>,
  delegation: string,
  builderDid: string,
) => {
  // User's owned data - Let Nillion auto-generate _id
  // Don't manually set _id, Nillion handles it!
  const userOwnedData = {
      ...data,
  };

  const result = await userClient.createData(delegation, {
      owner: userClient.keypair.toDid().toString(),
      acl: {
          grantee: builderDid, // Grant access to the builder
          read: true, // Builder can read the data
          write: false, // Builder cannot modify the data
          execute: true, // Builder can run queries on the data
      },
      collection: collectionId,
      data: [userOwnedData],
  });

  return result;
};

init();