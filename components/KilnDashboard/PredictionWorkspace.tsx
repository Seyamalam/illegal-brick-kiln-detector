import { RiPlayLine, RiRefreshLine } from "@remixicon/react";

import type { Doc } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PredictionList } from "./PredictionList";
import { PredictionSummary } from "./PredictionSummary";
import { DetectionDetailSheet } from "./DetectionDetailSheet";
import { usePredictionWorkspace } from "./use-prediction-workspace";

type PredictionWorkspaceProps = {
	region: Doc<"regions">;
};

export function PredictionWorkspace({ region }: PredictionWorkspaceProps) {
	const workspace = usePredictionWorkspace(region);
	const predictions = workspace.response?.predictions ?? [];
	const hasPredictions = predictions.length > 0;
	const isLoading = workspace.status === "loading";

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Prediction evidence</CardTitle>
					<CardDescription>
						Live model response for {region.name}
					</CardDescription>
					<CardAction>
						<Button onClick={workspace.runPrediction} disabled={isLoading}>
							{isLoading ? (
								<RiRefreshLine data-icon="inline-start" />
							) : (
								<RiPlayLine data-icon="inline-start" />
							)}
							{workspace.response ? "Refresh" : "Run prediction"}
						</Button>
					</CardAction>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{workspace.response ? (
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="outline">{workspace.response.region}</Badge>
							<p className="text-sm text-muted-foreground">
								Generated {new Date(workspace.response.generatedAt).toLocaleString()}
							</p>
						</div>
					) : null}

					{isLoading ? <PredictionLoadingState /> : null}
					{workspace.status === "error" ? (
						<PredictionErrorState message={workspace.errorMessage} />
					) : null}
					{workspace.status === "idle" ? <PredictionIdleState /> : null}
					{workspace.status === "success" && !hasPredictions ? (
						<PredictionEmptyState />
					) : null}
					{hasPredictions ? (
						<div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
							<PredictionSummary summary={workspace.summary} />
							<div className="flex flex-col gap-3">
								<div>
									<h3 className="font-heading text-base font-medium">
										Detections
									</h3>
									<p className="text-sm text-muted-foreground">
										Select a detection to inspect tile evidence.
									</p>
								</div>
								<PredictionList
									predictions={predictions}
									onSelectPrediction={workspace.selectPrediction}
								/>
							</div>
						</div>
					) : null}
				</CardContent>
			</Card>

			<DetectionDetailSheet
				prediction={workspace.selectedPrediction}
				onOpenChange={(open) => {
					if (!open) {
						workspace.clearSelectedPrediction();
					}
				}}
			/>
		</>
	);
}

function PredictionLoadingState() {
	return (
		<div className="flex flex-col gap-4">
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<Skeleton className="h-16" />
				<Skeleton className="h-16" />
				<Skeleton className="h-16" />
				<Skeleton className="h-16" />
			</div>
			<Skeleton className="h-80" />
		</div>
	);
}

function PredictionIdleState() {
	return (
		<Empty className="min-h-64">
			<EmptyHeader>
				<EmptyTitle>No prediction run yet</EmptyTitle>
				<EmptyDescription>
					Run the model for the selected district to inspect detections.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

function PredictionEmptyState() {
	return (
		<Empty className="min-h-64">
			<EmptyHeader>
				<EmptyTitle>No detections returned</EmptyTitle>
				<EmptyDescription>
					The API is responding, but no satellite tile detections were returned.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Separator />
				<p className="text-muted-foreground">
					A tile manifest must be configured before the hosted model can produce
					region predictions.
				</p>
			</EmptyContent>
		</Empty>
	);
}

function PredictionErrorState({ message }: { message: string | null }) {
	return (
		<Empty className="min-h-64">
			<EmptyHeader>
				<EmptyTitle>Prediction failed</EmptyTitle>
				<EmptyDescription>
					{message ?? "The prediction API returned an unexpected error."}
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}
