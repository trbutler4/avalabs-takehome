import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
		console.error("Uncaught error:", error, errorInfo.componentStack);
	}

	handleReset = (): void => {
		this.setState({ hasError: false, error: null });
	};

	render(): ReactNode {
		if (this.state.hasError) {
			return (
				<div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
					<Card className="max-w-md w-full">
						<CardHeader>
							<CardTitle className="text-destructive">
								Something went wrong
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-muted-foreground">
								An unexpected error occurred. Please try again.
							</p>
							{this.state.error && (
								<pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
									{this.state.error.message}
								</pre>
							)}
							<Button onClick={this.handleReset}>Try Again</Button>
						</CardContent>
					</Card>
				</div>
			);
		}

		return this.props.children;
	}
}
