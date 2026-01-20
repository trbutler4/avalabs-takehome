import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Retry failed requests up to 2 times with exponential backoff
			retry: 2,
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
			// Data is fresh for 30 seconds before refetching
			staleTime: 30 * 1000,
			// Keep unused data in cache for 5 minutes
			gcTime: 5 * 60 * 1000,
			// Refetch on window focus for fresh data
			refetchOnWindowFocus: true,
			// Don't refetch on reconnect (stale time handles freshness)
			refetchOnReconnect: false,
		},
	},
});

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Root element not found");
}

createRoot(rootElement).render(
	<StrictMode>
		<ErrorBoundary>
			<QueryClientProvider client={queryClient}>
				<App />
			</QueryClientProvider>
		</ErrorBoundary>
	</StrictMode>,
);
