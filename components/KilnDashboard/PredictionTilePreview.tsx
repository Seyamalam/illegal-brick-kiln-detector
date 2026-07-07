import { RiImageLine } from "@remixicon/react";
import Image from "next/image";

import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import type { Prediction } from "@/lib/prediction-api";
import { getDisplayTileUrl } from "@/lib/prediction-api";

type PredictionTilePreviewProps = {
	prediction: Prediction;
};

export function PredictionTilePreview({
	prediction,
}: PredictionTilePreviewProps) {
	const tileUrl = getDisplayTileUrl(prediction.tileUrl);
	const viewBoxSize = prediction.box?.imageSize ?? 256;
	const points = prediction.box?.points
		.map(([x, y]) => `${x},${y}`)
		.join(" ");

	return (
		<div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
			{tileUrl ? (
				<Image
					src={tileUrl}
					alt={`Satellite tile for detection ${prediction.id}`}
					fill
					unoptimized
					sizes="(max-width: 768px) 100vw, 384px"
					className="object-cover"
				/>
			) : (
				<Empty className="size-full rounded-none border-0">
					<EmptyMedia variant="icon">
						<RiImageLine />
					</EmptyMedia>
					<EmptyDescription>Tile image is not browser-accessible.</EmptyDescription>
				</Empty>
			)}

			{points ? (
				<svg
					className="pointer-events-none absolute inset-0 size-full"
					viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
					aria-hidden="true"
				>
					<polygon
						points={points}
						className="fill-detection-fill stroke-confidence-high"
						strokeWidth="2"
						vectorEffect="non-scaling-stroke"
					/>
				</svg>
			) : null}
		</div>
	);
}
