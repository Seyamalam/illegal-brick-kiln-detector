import { RiCrosshair2Line } from "@remixicon/react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Prediction } from "@/lib/prediction-api";
import { formatConfidence, getConfidenceTone } from "@/lib/prediction-api";

type PredictionListProps = {
	predictions: Prediction[];
	onSelectPrediction: (prediction: Prediction) => void;
};

export function PredictionList({
	predictions,
	onSelectPrediction,
}: PredictionListProps) {
	return (
		<ScrollArea className="h-80 rounded-lg border">
			<div className="flex flex-col">
				{predictions.map((prediction) => (
					<button
						key={prediction.id}
						type="button"
						className="flex items-start justify-between gap-3 border-b p-3 text-left transition-colors last:border-b-0 hover:bg-muted"
						onClick={() => onSelectPrediction(prediction)}
					>
						<div className="flex min-w-0 flex-col gap-1">
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant={getBadgeVariant(prediction.confidence)}>
									{formatConfidence(prediction.confidence)}
								</Badge>
								<Badge variant="outline">
									{prediction.className ?? prediction.label}
								</Badge>
							</div>
							<p className="truncate font-medium">{prediction.id}</p>
							<p className="text-xs text-muted-foreground">
								{prediction.lat.toFixed(5)}, {prediction.lon.toFixed(5)}
							</p>
						</div>
						<RiCrosshair2Line
							className="mt-1 shrink-0 text-muted-foreground"
							aria-hidden="true"
						/>
					</button>
				))}
			</div>
		</ScrollArea>
	);
}

function getBadgeVariant(
	confidence: number,
): "default" | "secondary" | "outline" {
	const tone = getConfidenceTone(confidence);

	if (tone === "high") {
		return "default";
	}

	if (tone === "medium") {
		return "secondary";
	}

	return "outline";
}
