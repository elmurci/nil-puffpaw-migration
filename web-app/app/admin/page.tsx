'use client';

import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState<'postgres' | 'nildb'>('postgres');
  const [collectionId, setCollectionId] = useState('');

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/list-users');
      const result = await response.json();
      
      if (result.success) {
        setUsers(result.users);
      } else {
        setError('Failed to load users');
      }
    } catch (err: any) {
      setError('Error loading users: ' + err.message);
    }
  };

  const loadUserData = async () => {
    if (!selectedUserId) {
      setError('Please select a user');
      return;
    }

    if (dataSource === 'nildb' && !collectionId) {
      setError('Please enter Collection ID for nilDB data');
      return;
    }

    setLoading(true);
    setError('');
    setUserData(null);

    try {
      const response = await fetch('/api/get-user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: parseInt(selectedUserId),
          collectionId: dataSource === 'nildb' ? collectionId : undefined,
          source: dataSource,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setUserData(result);
      } else {
        setError(result.error || 'Failed to load user data');
      }
    } catch (err: any) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            👤 PuffPaw Admin Dashboard
          </h1>
          <p className="text-gray-300 text-lg">
            View user data with their stored Nillion keys - demonstrating true user data ownership
          </p>
        </div>

        {/* User Selection */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 border border-white/20">
          <h2 className="text-2xl font-bold mb-4">1️⃣ Select User</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-2 text-gray-300">
                Choose a user to view their data
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white"
              >
                <option value="">-- Select a user --</option>
                {users.map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.wallet_address 
                      ? `${user.wallet_address.substring(0, 6)}...${user.wallet_address.substring(38)} (${user.puff_count} puffs)`
                      : `User ${user.user_id} (${user.puff_count} puffs)`
                    }
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-2">
                📊 Showing {users.length} users with Nillion keys and puff data
              </p>
            </div>
          </div>
        </div>

        {/* Data Source Selection */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 border border-white/20">
          <h2 className="text-2xl font-bold mb-4">2️⃣ Choose Data Source</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <button
                onClick={() => setDataSource('postgres')}
                className={`flex-1 px-6 py-4 rounded-lg font-semibold transition border-2 ${
                  dataSource === 'postgres'
                    ? 'bg-blue-600 border-blue-400'
                    : 'bg-white/10 border-white/30 hover:bg-white/20'
                }`}
              >
                <div className="text-lg">🐘 PostgreSQL</div>
                <div className="text-xs text-gray-300 mt-1">Legacy database (unencrypted)</div>
              </button>
              <button
                onClick={() => setDataSource('nildb')}
                className={`flex-1 px-6 py-4 rounded-lg font-semibold transition border-2 ${
                  dataSource === 'nildb'
                    ? 'bg-purple-600 border-purple-400'
                    : 'bg-white/10 border-white/30 hover:bg-white/20'
                }`}
              >
                <div className="text-lg">🔒 nilDB</div>
                <div className="text-xs text-gray-300 mt-1">
                  Encrypted with user's key
                </div>
              </button>
            </div>

            {dataSource === 'nildb' && (
              <div>
                <label className="block text-sm mb-2 text-gray-300">
                  Collection ID (from migration)
                </label>
                <input
                  type="text"
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  placeholder="e.g. ef71e760-118f-423c-97fd-31b971a5ec37"
                  className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400"
                />
              </div>
            )}

            <button
              onClick={loadUserData}
              disabled={loading || !selectedUserId}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 rounded-lg font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Loading...' : '📊 Load User Data'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-4 mb-6">
            <p className="font-semibold">❌ Error</p>
            <p className="text-sm text-gray-300 mt-1">{error}</p>
          </div>
        )}

        {/* Data Display */}
        {userData && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-3xl font-bold">📊 User Data</h2>
                <p className="text-gray-300 mt-1">
                  User {userData.userId} - {userData.totalRecords} records from {' '}
                  <span className="font-semibold text-purple-400">
                    {userData.source === 'postgres' ? 'PostgreSQL' : 'nilDB'}
                  </span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  DID: {userData.nillionDid}
                </p>
              </div>
              {userData.source === 'nildb' && (
                <div className="bg-green-500/20 border border-green-500 rounded-lg px-4 py-2">
                  <p className="text-sm font-semibold">🔓 Decrypted with user's key</p>
                </div>
              )}
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {userData.data.slice(0, 20).map((record: any, index: number) => (
                <div
                  key={index}
                  className="bg-black/40 rounded-lg p-4 border border-white/10 hover:border-purple-500/50 transition"
                >
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="col-span-3 border-b border-white/10 pb-2 mb-2">
                      <span className="text-gray-400">Puff ID:</span>{' '}
                      <span className="font-semibold text-white">{record.id}</span>
                      <span className="text-gray-500 ml-4 text-xs">
                        {new Date(record.created_at || record.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-purple-300">🔒 Vape ID</span>
                      <div className="font-mono text-xs mt-1">{record.vape_id}</div>
                    </div>

                    <div>
                      <span className="text-purple-300">🔒 Pod Type</span>
                      <div className="font-semibold mt-1">{record.pod_type}</div>
                    </div>

                    <div>
                      <span className="text-purple-300">🔒 Flavour</span>
                      <div className="font-semibold mt-1">{record.pod_flavour}</div>
                    </div>

                    <div>
                      <span className="text-gray-400">Pod ID</span>
                      <div className="mt-1">{record.pod_id}</div>
                    </div>

                    <div>
                      <span className="text-purple-300">🔒 Remaining</span>
                      <div className="mt-1">{record.pod_remaining}</div>
                    </div>

                    <div>
                      <span className="text-gray-400">Nicotine</span>
                      <div className="mt-1">{record.pod_nicotine_level}</div>
                    </div>

                    <div>
                      <span className="text-gray-400">Duration</span>
                      <div className="mt-1">{record.puff_duration}s</div>
                    </div>

                    <div>
                      <span className="text-purple-300">🔒 NFT Token</span>
                      <div className="mt-1">{record.nft_token_id}</div>
                    </div>

                    <div>
                      <span className="text-gray-400">Valid</span>
                      <div className="mt-1">{record.valid ? '✅' : '❌'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {userData.totalRecords > 20 && (
              <div className="mt-4 text-center text-gray-400 text-sm">
                Showing 20 of {userData.totalRecords} records
              </div>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-2 border-purple-500/50 rounded-xl p-6">
          <h3 className="font-bold text-lg mb-2">🔐 How This Works</h3>
          <ul className="text-sm space-y-2 text-gray-300">
            <li>• Each user has their own Nillion key stored in PostgreSQL</li>
            <li>• This dashboard uses THAT USER'S key to decrypt their data (not the builder's key)</li>
            <li>• This proves true user data ownership - only the user (or someone with their key) can access their private data</li>
            <li>• Fields marked with 🔒 are encrypted in nilDB and only visible to the data owner</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

