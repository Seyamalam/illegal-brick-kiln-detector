import { Badge } from "@/components/ui/badge";
import type { PredictionSummary as PredictionSummaryData } from "@/lib/prediction-api";
import { formatConfidence } from "@/lib/prediction-api";

type PredictionSummaryProps = {
	summary: PredictionSummaryData;
};

export function PredictionSummary({ summary }: PredictionSummaryProps) {
	const stats = [
		{ label: "Detections", value: summary.total.toString() },
		{ label: "High confidence", value: summary.highConfidence.toString() },
		{ label: "Medium confidence", value: summary.mediumConfidence.toString() },
		{
			label: "Avg. confidence",
			value: formatConfidence(summary.averageConfidence),
		},
	];

	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{stats.map((stat) => (
				<div key={stat.label} className="rounded-lg border bg-background p-3">
					<p className="text-xs text-muted-foreground">{stat.label}</p>
					<p className="font-heading text-2xl font-medium">{stat.value}</p>
				</div>
			))}
			<div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
				<Badge variant="outline">CFCBK {summary.classes.CFCBK}</Badge>
				<Badge variant="outline">FCBK {summary.classes.FCBK}</Badge>
				<Badge variant="outline">Zigzag {summary.classes.Zigzag}</Badge>
			</div>
		</div>
	);
}
