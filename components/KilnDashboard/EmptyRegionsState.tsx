import { RiMapPinLine } from "@remixicon/react";

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";

export function EmptyRegionsState() {
	return (
		<main className="flex min-h-full flex-1 bg-background">
			<div className="mx-auto flex w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
				<Empty className="min-h-96">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<RiMapPinLine />
						</EmptyMedia>
						<EmptyTitle>No seeded regions found.</EmptyTitle>
						<EmptyDescription>
							Seed the five supported districts before testing the dashboard.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			</div>
		</main>
	);
}
