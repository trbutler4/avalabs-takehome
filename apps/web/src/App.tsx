import { useState, useEffect } from 'react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchNetworks, fetchTokens } from './api'

// Wallet address validation
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

function isValidWalletAddress(address: string): boolean {
  if (!address) return true // Empty is valid (no filter)
  return EVM_ADDRESS_REGEX.test(address) || SOLANA_ADDRESS_REGEX.test(address)
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

export default function App() {
  const [selectedNetwork, setSelectedNetwork] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [wallet, setWallet] = useState('')
  const [page, setPage] = useState(1)

  const debouncedSearch = useDebouncedValue(search, 200)
  const walletIsValid = isValidWalletAddress(wallet)

  const { data: networks, isError: networksError } = useQuery({
    queryKey: ['networks'],
    queryFn: fetchNetworks,
  })

  const { data: tokensData, isLoading, isError: tokensError } = useQuery({
    queryKey: ['tokens', selectedNetwork, debouncedSearch, wallet, page],
    queryFn: () => fetchTokens({
      network_id: selectedNetwork === 'all' ? undefined : selectedNetwork,
      search: debouncedSearch || undefined,
      wallet: wallet || undefined,
      page,
      limit: 50,
    }),
    enabled: walletIsValid, // Don't fetch if wallet is invalid
  })

  const hasError = networksError || tokensError

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-primary text-primary-foreground py-4 px-6 mb-6">
        <h1 className="text-2xl font-bold w-3/4 max-w-6xl mx-auto">Asset Registry</h1>
      </header>
      <main className="px-6 pb-6 w-3/4 max-w-6xl mx-auto">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Token Explorer</CardTitle>
            <div className="flex flex-col gap-4 pt-2">
              <div className="flex gap-4">
                <Select
                  value={selectedNetwork}
                  onValueChange={(value) => {
                    setSelectedNetwork(value)
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

              <div className="flex flex-col gap-1">
                <Input
                  type="text"
                  placeholder="Wallet address (EVM: 0x... or Solana)"
                  value={wallet}
                  onChange={(e) => {
                    setWallet(e.target.value)
                    setPage(1)
                  }}
                  aria-invalid={!walletIsValid}
                />
                {!walletIsValid && (
                  <p className="text-sm text-destructive">
                    Invalid wallet address. Enter a valid EVM (0x...) or Solana address.
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {hasError ? (
              <div className="text-center py-8">
                <p className="text-destructive font-medium">Failed to load data</p>
                <p className="text-sm text-muted-foreground mt-1">Please try again later</p>
              </div>
            ) : isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  {tokensData?.total ?? 0} tokens found
                </p>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
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
                          <TableCell className="font-mono font-medium">{token.symbol}</TableCell>
                          <TableCell>{token.name}</TableCell>
                          <TableCell className="text-muted-foreground">{token.network_id}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
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
                </div>

                <div className="flex gap-2 mt-4 items-center justify-between">
                  <Button
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {page}</span>
                  <Button
                    disabled={(tokensData?.tokens.length ?? 0) < 50}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
