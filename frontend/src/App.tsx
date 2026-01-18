import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchNetworks, fetchTokens } from './api'

export default function App() {
  const [selectedNetwork, setSelectedNetwork] = useState<string>('')
  const [search, setSearch] = useState('')
  const [wallet, setWallet] = useState('')
  const [page, setPage] = useState(1)

  const { data: networks } = useQuery({
    queryKey: ['networks'],
    queryFn: fetchNetworks,
  })

  const { data: tokensData, isLoading } = useQuery({
    queryKey: ['tokens', selectedNetwork, search, wallet, page],
    queryFn: () => fetchTokens({
      networkId: selectedNetwork || undefined,
      search: search || undefined,
      wallet: wallet || undefined,
      page,
      limit: 50,
    }),
  })

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Asset Registry</h1>

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex gap-4">
          <select
            className="border rounded px-3 py-2"
            value={selectedNetwork}
            onChange={(e) => {
              setSelectedNetwork(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All Networks</option>
            {networks?.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search tokens..."
            className="border rounded px-3 py-2 flex-1"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <input
          type="text"
          placeholder="Wallet address (0x...)"
          className="border rounded px-3 py-2"
          value={wallet}
          onChange={(e) => {
            setWallet(e.target.value)
            setPage(1)
          }}
        />
      </div>

      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <>
          <p className="text-sm text-gray-600 mb-4">
            {tokensData?.total ?? 0} tokens found
          </p>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Symbol</th>
                <th className="text-left py-2">Name</th>
                <th className="text-left py-2">Network</th>
                <th className="text-left py-2">Contract</th>
                {wallet && <th className="text-left py-2">Balance</th>}
              </tr>
            </thead>
            <tbody>
              {tokensData?.tokens.map((token) => (
                <tr key={`${token.id}-${token.network_id}`} className="border-b">
                  <td className="py-2 font-mono">{token.symbol}</td>
                  <td className="py-2">{token.name}</td>
                  <td className="py-2">{token.network_id}</td>
                  <td className="py-2 font-mono text-xs">
                    {token.contract_address?.slice(0, 10)}...
                  </td>
                  {wallet && (
                    <td className="py-2 font-mono">
                      {token.balance ?? '-'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex gap-2 mt-4">
            <button
              className="px-4 py-2 border rounded disabled:opacity-50"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </button>
            <span className="px-4 py-2">Page {page}</span>
            <button
              className="px-4 py-2 border rounded disabled:opacity-50"
              disabled={(tokensData?.tokens.length ?? 0) < 50}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </main>
  )
}
