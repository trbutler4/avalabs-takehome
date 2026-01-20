import { isValidEvmAddress } from "@repo/shared/validation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { fetchNetworks, fetchTokens } from "./api";

function useDebouncedValue<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState(value);

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedValue(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);

	return debouncedValue;
}

function formatBalance(
	balance: string | undefined,
	decimals: number | undefined,
): string {
	if (!balance) return "-";

	try {
		// Convert hex to bigint if needed (EVM balances are hex)
		const value = balance.startsWith("0x") ? BigInt(balance) : BigInt(balance);
		if (value === 0n) return "0";

		const dec = decimals ?? 18;
		const divisor = 10n ** BigInt(dec);
		const whole = value / divisor;
		const remainder = value % divisor;

		// Format with up to 6 decimal places
		const remainderStr = remainder.toString().padStart(dec, "0");
		const decimalsToShow = remainderStr.slice(0, 6).replace(/0+$/, "");

		if (decimalsToShow) {
			return `${whole.toLocaleString()}.${decimalsToShow}`;
		}
		return whole.toLocaleString();
	} catch {
		return balance;
	}
}

export default function App() {
	const [selectedNetwork, setSelectedNetwork] = useState<string>("all");
	const [search, setSearch] = useState("");
	const [wallet, setWallet] = useState("");
	const [page, setPage] = useState(1);

	const debouncedSearch = useDebouncedValue(search, 200);
	const walletIsValid = !wallet || isValidEvmAddress(wallet);

	const { data: networks, isError: networksError } = useQuery({
		queryKey: ["networks"],
		queryFn: fetchNetworks,
	});

	const {
		data: tokensData,
		isLoading,
		isError: tokensError,
	} = useQuery({
		queryKey: ["tokens", selectedNetwork, debouncedSearch, wallet, page],
		queryFn: () =>
			fetchTokens({
				network_id: selectedNetwork === "all" ? undefined : selectedNetwork,
				search: debouncedSearch || undefined,
				wallet: wallet || undefined,
				page,
				limit: 50,
			}),
		enabled: walletIsValid, // Don't fetch if wallet is invalid
	});

	const hasError = networksError || tokensError;

	return (
		<div className="min-h-screen bg-muted/30">
			<header className="bg-primary text-primary-foreground py-4 px-6 mb-6">
				<h1 className="text-2xl font-bold w-3/4 max-w-6xl mx-auto">
					Asset Registry
				</h1>
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
										setSelectedNetwork(value);
										setPage(1);
									}}
								>
									<SelectTrigger className="w-[200px]">
										<SelectValue placeholder="All Networks" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Networks</SelectItem>
										{networks?.map((n) => (
											<SelectItem key={n.id} value={n.id}>
												{n.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								<Input
									type="text"
									placeholder="Search tokens..."
									className="flex-1"
									value={search}
									onChange={(e) => {
										setSearch(e.target.value);
										setPage(1);
									}}
								/>
							</div>

							<div className="flex flex-col gap-1">
								<Input
									type="text"
									placeholder="Wallet address (0x...)"
									value={wallet}
									onChange={(e) => {
										setWallet(e.target.value);
										setPage(1);
									}}
									aria-invalid={!walletIsValid}
									aria-describedby={!walletIsValid ? "wallet-error" : undefined}
								/>
								{!walletIsValid && (
									<p id="wallet-error" className="text-sm text-destructive">
										Invalid address. Enter a valid EVM address (0x + 40 hex
										characters).
									</p>
								)}
							</div>
						</div>
					</CardHeader>
					<CardContent>
						{hasError ? (
							<div
								className="text-center py-8"
								role="alert"
								aria-live="assertive"
							>
								<p className="text-destructive font-medium">
									Failed to load data
								</p>
								<p className="text-sm text-muted-foreground mt-1">
									Please try again later
								</p>
							</div>
						) : isLoading ? (
							<p className="text-muted-foreground" aria-live="polite">
								Loading...
							</p>
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
													<TableCell className="font-mono font-medium">
														{token.symbol}
													</TableCell>
													<TableCell>{token.name}</TableCell>
													<TableCell className="text-muted-foreground">
														{token.network_id}
													</TableCell>
													<TableCell className="font-mono text-xs text-muted-foreground">
														{token.contract_address?.slice(0, 10)}...
													</TableCell>
													{wallet && (
														<TableCell className="font-mono">
															{formatBalance(token.balance, token.decimals)}
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
										onClick={() => setPage((p) => p - 1)}
									>
										Previous
									</Button>
									<span className="text-sm text-muted-foreground">
										Page {page}
									</span>
									<Button
										disabled={(tokensData?.tokens.length ?? 0) < 50}
										onClick={() => setPage((p) => p + 1)}
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
	);
}
