import type { Token } from "@repo/shared";
import { isValidEvmAddress } from "@repo/shared/validation";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { fetchAllTokens, fetchNetworks, fetchTokens } from "./api";

// Balance formatting constants
const DEFAULT_DECIMALS = 18; // Standard for EVM native tokens and most ERC-20s
const DISPLAY_DECIMALS = 6; // Max decimal places to show in UI
const MIN_DISPLAY_THRESHOLD = "<0.00001"; // Shown when balance is non-zero but too small
const PAGE_SIZE = 50;

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
		// BigInt handles both hex (0x...) and decimal strings
		const value = BigInt(balance);
		if (value === 0n) return "0";

		const dec = decimals ?? DEFAULT_DECIMALS;
		const divisor = 10n ** BigInt(dec);
		const whole = value / divisor;
		const remainder = value % divisor;

		const remainderStr = remainder.toString().padStart(dec, "0");
		const decimalsToShow = remainderStr
			.slice(0, DISPLAY_DECIMALS)
			.replace(/0+$/, "");

		if (decimalsToShow) {
			return `${whole.toLocaleString()}.${decimalsToShow}`;
		}

		// Non-zero but too small to display
		if (whole === 0n && remainder > 0n) {
			return MIN_DISPLAY_THRESHOLD;
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
	const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

	const copyToClipboard = useCallback(async (address: string) => {
		await navigator.clipboard.writeText(address);
		setCopiedAddress(address);
		setTimeout(() => setCopiedAddress(null), 2000);
	}, []);

	const debouncedSearch = useDebouncedValue(search, 200);
	const walletIsValid = !wallet || isValidEvmAddress(wallet);

	const {
		data: networks,
		isError: networksError,
		refetch: refetchNetworks,
	} = useQuery({
		queryKey: ["networks"],
		queryFn: fetchNetworks,
	});

	// Wallet query: fetch all pages, filter/paginate client-side
	const {
		data: walletTokens,
		isLoading: walletLoading,
		isError: walletError,
		refetch: refetchWalletTokens,
	} = useQuery({
		queryKey: ["tokens", "wallet", selectedNetwork, wallet],
		queryFn: () =>
			fetchAllTokens({
				network_id: selectedNetwork === "all" ? undefined : selectedNetwork,
				wallet: wallet || undefined,
			}),
		enabled: walletIsValid && !!wallet,
	});

	// Browse query: server handles filtering/pagination
	const {
		data: browseTokensData,
		isLoading: browseLoading,
		isError: browseError,
		refetch: refetchBrowseTokens,
	} = useQuery({
		queryKey: ["tokens", "browse", selectedNetwork, debouncedSearch, page],
		queryFn: () =>
			fetchTokens({
				network_id: selectedNetwork === "all" ? undefined : selectedNetwork,
				search: debouncedSearch || undefined,
				page,
				limit: PAGE_SIZE,
			}),
		enabled: !wallet,
	});

	// Client-side filtering for wallet tokens
	const filteredWalletTokens = useMemo(() => {
		if (!walletTokens) return [];

		const term = debouncedSearch.toLowerCase();
		if (!term) return walletTokens;

		// Filter by search term
		const filtered = walletTokens.filter(
			(t) =>
				t.symbol.toLowerCase().includes(term) ||
				t.name.toLowerCase().includes(term) ||
				t.contract_address?.toLowerCase().includes(term),
		);

		// Sort by relevance
		const relevance = (t: Token) => {
			const sym = t.symbol.toLowerCase();
			const name = t.name.toLowerCase();
			if (sym === term) return 0;
			if (name === term) return 1;
			if (sym.startsWith(term)) return 2;
			if (name.startsWith(term)) return 3;
			return 4;
		};

		return filtered.toSorted(
			(a, b) => relevance(a) - relevance(b) || a.name.localeCompare(b.name),
		);
	}, [walletTokens, debouncedSearch]);

	// Client-side pagination for wallet tokens
	const paginatedWalletTokens = useMemo(() => {
		const start = (page - 1) * PAGE_SIZE;
		return filteredWalletTokens.slice(start, start + PAGE_SIZE);
	}, [filteredWalletTokens, page]);

	// Unified data for rendering
	const tokensData = wallet
		? { tokens: paginatedWalletTokens, total: filteredWalletTokens.length }
		: browseTokensData;
	const isLoading = wallet ? walletLoading : browseLoading;
	const tokensError = wallet ? walletError : browseError;

	const hasError = networksError || tokensError;

	return (
		<div className="min-h-screen bg-muted/30">
			<header className="bg-primary text-primary-foreground py-4 px-4 sm:px-6 mb-4 sm:mb-6">
				<h1 className="text-xl sm:text-2xl font-bold max-w-6xl mx-auto">
					Asset Registry
				</h1>
			</header>
			<main className="px-4 sm:px-6 pb-6 max-w-6xl mx-auto">
				<Card className="py-4 sm:py-6">
					<CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
						<CardTitle className="text-base sm:text-lg">
							Token Explorer
						</CardTitle>
						<div className="flex flex-col gap-3 sm:gap-4 pt-2">
							<div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
								<Select
									value={selectedNetwork}
									onValueChange={(value) => {
										setSelectedNetwork(value);
										setPage(1);
									}}
								>
									<SelectTrigger className="w-full sm:w-[200px]">
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
					<CardContent className="px-4 sm:px-6">
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
								<Button
									variant="outline"
									className="mt-4"
									onClick={() => {
										if (networksError) refetchNetworks();
										if (wallet && walletError) refetchWalletTokens();
										if (!wallet && browseError) refetchBrowseTokens();
									}}
								>
									Retry
								</Button>
							</div>
						) : isLoading ? (
							<output className="block space-y-3" aria-label="Loading tokens">
								{[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
									<div
										key={n}
										className="h-10 bg-muted animate-pulse rounded"
									/>
								))}
							</output>
						) : (
							<>
								<p className="text-sm text-muted-foreground mb-4">
									{tokensData?.total ?? 0} tokens found
								</p>

								<div className="rounded-md border overflow-x-auto">
									<Table className="min-w-[500px]">
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
													<TableCell className="font-mono font-medium max-w-[100px] uppercase">
														<span
															className="block truncate"
															title={token.symbol}
														>
															{token.symbol}
														</span>
													</TableCell>
													<TableCell className="max-w-[150px]">
														<span className="block truncate" title={token.name}>
															{token.name}
														</span>
													</TableCell>
													<TableCell className="text-muted-foreground">
														{token.network_id}
													</TableCell>
													<TableCell className="font-mono text-xs text-muted-foreground">
														{(() => {
															const addr = token.contract_address;
															if (!addr)
																return <span className="italic">Native</span>;
															return (
																<button
																	type="button"
																	onClick={() => copyToClipboard(addr)}
																	className="inline-flex items-center gap-1.5 group cursor-pointer"
																	title={`Copy ${addr}`}
																>
																	<span>
																		{copiedAddress === addr
																			? "Copied!"
																			: `${addr.slice(0, 10)}...${addr.slice(-8)}`}
																	</span>
																	<svg
																		xmlns="http://www.w3.org/2000/svg"
																		viewBox="0 0 20 20"
																		fill="currentColor"
																		aria-hidden="true"
																		className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary"
																	>
																		<path
																			fillRule="evenodd"
																			d="M15.988 3.012A2.25 2.25 0 0 1 18 5.25v6.5A2.25 2.25 0 0 1 15.75 14H13.5v-3.75a3.75 3.75 0 0 0-3.75-3.75H6V5.25a2.25 2.25 0 0 1 2.25-2.25h7.738Zm-2.54 9.012a2.25 2.25 0 0 0-2.199-1.774H6V13.5a2.25 2.25 0 0 0 2.25 2.25h4.5a2.25 2.25 0 0 0 2.25-2.25v-.476h-1.552Z"
																			clipRule="evenodd"
																		/>
																		<path d="M2.25 7.5A2.25 2.25 0 0 1 4.5 5.25h5.25a2.25 2.25 0 0 1 2.25 2.25v6.75a2.25 2.25 0 0 1-2.25 2.25H4.5a2.25 2.25 0 0 1-2.25-2.25V7.5Z" />
																	</svg>
																</button>
															);
														})()}
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
										size="sm"
										disabled={page === 1}
										onClick={() => setPage((p) => p - 1)}
									>
										Previous
									</Button>
									<span className="text-xs sm:text-sm text-muted-foreground">
										Page {page}
									</span>
									<Button
										size="sm"
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
