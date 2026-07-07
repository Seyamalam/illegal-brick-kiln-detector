import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
	return (
		<main className="flex min-h-full flex-1 bg-background">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
				<header className="flex flex-col gap-2">
					<Skeleton className="h-8 w-72" />
					<Skeleton className="h-4 w-48" />
				</header>
				<Card>
					<CardHeader className="gap-3 sm:grid-cols-[1fr_auto]">
						<div className="flex flex-col gap-2">
							<Skeleton className="h-5 w-40" />
							<Skeleton className="h-4 w-56" />
						</div>
						<Skeleton className="h-8 w-full sm:w-64" />
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
						</div>
						<Skeleton className="h-72 w-full" />
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
