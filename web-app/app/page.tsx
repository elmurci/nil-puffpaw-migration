'use client';

import { useState } from 'react';
import { BrowserProvider } from 'ethers';

export default function Home() {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [nillionKey, setNillionKey] = useState<string>('');
  const [collectionId, setCollectionId] = useState<string>('');
  const [myData, setMyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Connect MetaMask wallet
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setError('Please install MetaMask!');
        return;
      }

      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      setWalletAddress(accounts[0]);
      setError('');
    } catch (err: any) {
      setError('Failed to connect wallet: ' + err.message);
    }
  };

  // Retrieve Nillion key from PostgreSQL
  const retrieveNillionKey = async () => {
    if (!userId || !walletAddress) {
      setError('Please enter your User ID and connect wallet');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Sign a message to prove wallet ownership
      const message = `I am user ${userId} accessing my PuffPaw data`;
      const signature = await signer.signMessage(message);

      // Get Nillion key from backend
      const response = await fetch('/api/get-nillion-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: parseInt(userId),
          walletAddress,
          signature,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setNillionKey(data.nillionKey);
        alert('✅ Nillion key retrieved! You can now access your encrypted data.');
      } else {
        setError(data.error || 'Failed to retrieve Nillion key');
      }
    } catch (err: any) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Query user's encrypted data from Nillion
  const queryMyData = async () => {
    if (!nillionKey || !collectionId) {
      setError('Please retrieve your Nillion key and enter Collection ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/query-my-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nillionKey,
          collectionId,
          limit: 100,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMyData(result.data);
      } else {
        setError(result.error || 'Failed to query your data');
      }
    } catch (err: any) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-purple-900 via-blue-900 to-black text-white">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">🔒 PuffPaw User Portal</h1>
        <p className="text-gray-300 mb-8">
          Access your encrypted vaping data with privacy-first technology
        </p>

        {/* Wallet Connection */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">1. Connect Wallet</h2>
          {!walletAddress ? (
            <button
              onClick={connectWallet}
              className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition"
            >
              🔗 Connect MetaMask
            </button>
          ) : (
            <div className="bg-green-500/20 border border-green-500 rounded-lg p-4">
              <p className="font-semibold">✅ Wallet Connected</p>
              <p className="text-sm text-gray-300 mt-1">
                {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
              </p>
            </div>
          )}
        </div>

        {/* Retrieve Nillion Key */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">2. Retrieve Your Nillion Key</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-2">Your User ID</label>
              <input
                type="number"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. 8"
                className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white placeholder-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                This is your PuffPaw platform user ID
              </p>
            </div>
            <button
              onClick={retrieveNillionKey}
              disabled={loading || !walletAddress || !userId}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-cyan-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Loading...' : '🔑 Retrieve My Key'}
            </button>
            {nillionKey && (
              <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 mt-4">
                <p className="font-semibold">✅ Key Retrieved</p>
                <p className="text-xs text-gray-300 mt-1 font-mono break-all">
                  {nillionKey.substring(0, 40)}...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Query Data */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">3. Access Your Encrypted Data</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-2">Collection ID</label>
              <input
                type="text"
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                placeholder="e.g. ef71e760-118f-423c-97fd-31b971a5ec37"
                className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white placeholder-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                From migration output - the UUID of your data collection
              </p>
            </div>
            <button
              onClick={queryMyData}
              disabled={loading || !nillionKey || !collectionId}
              className="bg-gradient-to-r from-cyan-600 to-teal-600 px-6 py-3 rounded-lg font-semibold hover:from-cyan-700 hover:to-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Querying...' : '📊 View My Data'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
            <p className="font-semibold">❌ Error</p>
            <p className="text-sm text-gray-300 mt-1">{error}</p>
          </div>
        )}

        {/* Data Display */}
        {myData.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">📊 Your Encrypted Data</h2>
            <p className="text-gray-300 mb-4">
              Found {myData.length} records. Private fields are automatically decrypted for you.
            </p>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {myData.map((record, index) => (
                <div
                  key={index}
                  className="bg-black/30 rounded-lg p-4 border border-white/20"
                >
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-400">ID:</span> {record.id}
                    </div>
                    <div>
                      <span className="text-gray-400">NFT Tier:</span>{' '}
                      {record.nft_tier}
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400">🔒 Vape ID:</span>{' '}
                      <span className="text-purple-300">{record.vape_id}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">🔒 Pod Type:</span>{' '}
                      <span className="text-purple-300">{record.pod_type}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">🔒 Flavour:</span>{' '}
                      <span className="text-purple-300">{record.pod_flavour}</span>
                    </div>
                    <div className="col-span-2 text-xs text-gray-500">
                      {new Date(record.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-blue-500/20 border border-blue-500 rounded-lg p-4">
          <p className="text-sm">
            <strong>🔒 Privacy Note:</strong> Your encrypted data (vape_id, pod_type, flavour, nicotine level, puff duration, etc.) is stored on Nillion's privacy-preserving network. Only YOU can decrypt it with your Nillion key.
          </p>
        </div>
      </div>
    </main>
  );
}

declare global {
  interface Window {
    ethereum?: any;
  }
}


