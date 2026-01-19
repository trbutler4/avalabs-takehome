import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
      network_id: selectedNetwork || undefined,
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
          <Select
            value={selectedNetwork || undefined}
            onValueChange={(value) => {
              setSelectedNetwork(value === 'all' ? '' : value)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Networks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Networks</SelectItem>
              {networks?.map((n) => (
                <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="text"
            placeholder="Search tokens..."
            className="flex-1"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <Input
          type="text"
          placeholder="Wallet address (0x...)"
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
          <p className="text-sm text-muted-foreground mb-4">
            {tokensData?.total ?? 0} tokens found
          </p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Contract</TableHead>
                {wallet && <TableHead>Balance</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokensData?.tokens.map((token) => (
                <TableRow key={`${token.id}-${token.network_id}`}>
                  <TableCell className="font-mono">{token.symbol}</TableCell>
                  <TableCell>{token.name}</TableCell>
                  <TableCell>{token.network_id}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {token.contract_address?.slice(0, 10)}...
                  </TableCell>
                  {wallet && (
                    <TableCell className="font-mono">
                      {token.balance ?? '-'}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <span className="px-4 py-2">Page {page}</span>
            <Button
              variant="outline"
              disabled={(tokensData?.tokens.length ?? 0) < 50}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </main>
  )
}
