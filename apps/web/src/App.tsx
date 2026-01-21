import type { Token } from "@repo/shared";
import { isValidEvmAddress } from "@repo/shared/validation";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, CopyIcon } from "lucide-react";
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

// Hoisted static array to avoid recreation on each render
const SKELETON_ROWS = [1, 2, 3, 4, 5, 6, 7, 8];

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
								{SKELETON_ROWS.map((n) => (
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
									<Table className="min-w-[500px] table-fixed">
										<TableHeader>
											<TableRow className="bg-muted/50">
												<TableHead className="w-1/5">Symbol</TableHead>
												<TableHead className="w-1/5">Name</TableHead>
												<TableHead className="w-1/5">Network</TableHead>
												<TableHead className="w-1/5">Contract</TableHead>
												{wallet && (
													<TableHead className="w-1/5">Balance</TableHead>
												)}
											</TableRow>
										</TableHeader>
										<TableBody>
											{tokensData?.tokens.length === 0 ? (
												<TableRow>
													<TableCell
														colSpan={wallet ? 5 : 4}
														className="text-center text-muted-foreground py-8"
													>
														No tokens found
													</TableCell>
												</TableRow>
											) : (
												tokensData?.tokens.map((token) => (
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
															<span
																className="block truncate"
																title={token.name}
															>
																{token.name}
															</span>
														</TableCell>
														<TableCell className="text-muted-foreground">
															{token.network_id}
														</TableCell>
														<TableCell className="font-mono text-xs text-muted-foreground overflow-hidden">
															{(() => {
																const addr = token.contract_address;
																if (!addr)
																	return <span className="italic">Native</span>;
																return (
																	<button
																		type="button"
																		onClick={() => copyToClipboard(addr)}
																		className="inline-flex items-center gap-1.5 group cursor-pointer max-w-full"
																		title={`Copy ${addr}`}
																	>
																		<span className="truncate">{addr}</span>
																		{copiedAddress === addr ? (
																			<CheckIcon
																				aria-hidden="true"
																				className="size-3.5 text-primary transition-opacity"
																			/>
																		) : (
																			<CopyIcon
																				aria-hidden="true"
																				className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary"
																			/>
																		)}
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
												))
											)}
										</TableBody>
									</Table>
								</div>

								<div className="flex mt-4 items-center justify-between">
									<Button
										variant="outline"
										size="sm"
										disabled={page === 1}
										onClick={() => setPage((p) => p - 1)}
									>
										Previous
									</Button>
									<div className="flex items-center gap-1">
										{(() => {
											const total = tokensData?.total ?? 0;
											const totalPages = Math.ceil(total / PAGE_SIZE);
											if (totalPages <= 1) {
												return (
													<span className="text-sm text-muted-foreground px-2">
														Page 1 of 1
													</span>
												);
											}

											const showEllipsisStart = page > 4;
											const showEllipsisEnd = page < totalPages - 3;

											const items: React.ReactNode[] = [];

											// Always show first page
											items.push(
												<Button
													key={1}
													variant={1 === page ? "default" : "ghost"}
													size="sm"
													onClick={() => setPage(1)}
													className="w-9 h-9"
												>
													1
												</Button>,
											);

											if (showEllipsisStart) {
												items.push(
													<span
														key="ellipsis-start"
														className="px-1 text-muted-foreground"
													>
														...
													</span>,
												);
											}

											// Pages around current
											for (
												let i = Math.max(2, page - 2);
												i <= Math.min(totalPages - 1, page + 2);
												i++
											) {
												items.push(
													<Button
														key={i}
														variant={i === page ? "default" : "ghost"}
														size="sm"
														onClick={() => setPage(i)}
														className="w-9 h-9"
													>
														{i}
													</Button>,
												);
											}

											if (showEllipsisEnd) {
												items.push(
													<span
														key="ellipsis-end"
														className="px-1 text-muted-foreground"
													>
														...
													</span>,
												);
											}

											// Always show last page
											if (totalPages > 1) {
												items.push(
													<Button
														key={totalPages}
														variant={totalPages === page ? "default" : "ghost"}
														size="sm"
														onClick={() => setPage(totalPages)}
														className="w-9 h-9"
													>
														{totalPages}
													</Button>,
												);
											}

											return items;
										})()}
									</div>
									<Button
										size="sm"
										disabled={(tokensData?.tokens.length ?? 0) < PAGE_SIZE}
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
