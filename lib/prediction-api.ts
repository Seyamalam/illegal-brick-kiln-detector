export type PredictionClassName = "CFCBK" | "FCBK" | "Zigzag";

export type PredictionBox = {
	type: "obb";
	imageSize: number;
	points: [number, number][];
};

export type Prediction = {
	id: string;
	lat: number;
	lon: number;
	confidence: number;
	label: "kiln" | "no_kiln";
	tileUrl: string;
	className?: PredictionClassName;
	box?: PredictionBox;
};

export type PredictResponse = {
	region: string;
	generatedAt: string;
	predictions: Prediction[];
};

export type PredictionSummary = {
	total: number;
	highConfidence: number;
	mediumConfidence: number;
	averageConfidence: number;
	classes: Record<PredictionClassName, number>;
};

type RawPrediction = Record<string, unknown>;

const predictionClasses = ["CFCBK", "FCBK", "Zigzag"] as const;

export async function fetchRegionPredictions(
	regionSlug: string,
): Promise<PredictResponse> {
	const response = await fetch(`/predict?region=${encodeURIComponent(regionSlug)}`);

	if (!response.ok) {
		throw new Error(`Prediction request failed with status ${response.status}`);
	}

	const data: unknown = await response.json();
	return parsePredictResponse(data);
}

export function summarizePredictions(
	predictions: Prediction[],
): PredictionSummary {
	const classes: Record<PredictionClassName, number> = {
		CFCBK: 0,
		FCBK: 0,
		Zigzag: 0,
	};
	const confidenceTotal = predictions.reduce(
		(total, prediction) => total + prediction.confidence,
		0,
	);

	for (const prediction of predictions) {
		if (prediction.className) {
			classes[prediction.className] += 1;
		}
	}

	return {
		total: predictions.length,
		highConfidence: predictions.filter(({ confidence }) => confidence > 0.8)
			.length,
		mediumConfidence: predictions.filter(
			({ confidence }) => confidence >= 0.5 && confidence <= 0.8,
		).length,
		averageConfidence:
			predictions.length === 0 ? 0 : confidenceTotal / predictions.length,
		classes,
	};
}

export function formatConfidence(confidence: number): string {
	return `${Math.round(confidence * 100)}%`;
}

export function getConfidenceTone(confidence: number): "high" | "medium" | "low" {
	if (confidence > 0.8) {
		return "high";
	}

	if (confidence >= 0.5) {
		return "medium";
	}

	return "low";
}

export function getDisplayTileUrl(tileUrl: string): string | null {
	if (tileUrl.startsWith("http://") || tileUrl.startsWith("https://")) {
		return tileUrl;
	}

	if (tileUrl.startsWith("/")) {
		return tileUrl;
	}

	return null;
}

function parsePredictResponse(data: unknown): PredictResponse {
	if (!isRecord(data) || typeof data.region !== "string") {
		throw new Error("Prediction response is missing region");
	}

	if (typeof data.generatedAt !== "string" || !Array.isArray(data.predictions)) {
		throw new Error("Prediction response has invalid metadata");
	}

	return {
		region: data.region,
		generatedAt: data.generatedAt,
		predictions: data.predictions.map(parsePrediction),
	};
}

function parsePrediction(value: unknown): Prediction {
	if (!isRecord(value)) {
		throw new Error("Prediction item is not an object");
	}

	const prediction = value as RawPrediction;
	const className = parseClassName(prediction.className);

	return {
		id: requireString(prediction.id, "prediction.id"),
		lat: requireNumber(prediction.lat, "prediction.lat"),
		lon: requireNumber(prediction.lon, "prediction.lon"),
		confidence: requireNumber(prediction.confidence, "prediction.confidence"),
		label: prediction.label === "no_kiln" ? "no_kiln" : "kiln",
		tileUrl: requireString(prediction.tileUrl, "prediction.tileUrl"),
		...(className ? { className } : {}),
		...(prediction.box ? { box: parseBox(prediction.box) } : {}),
	};
}

function parseClassName(value: unknown): PredictionClassName | null {
	return predictionClasses.includes(value as PredictionClassName)
		? (value as PredictionClassName)
		: null;
}

function parseBox(value: unknown): PredictionBox {
	if (!isRecord(value) || value.type !== "obb" || !Array.isArray(value.points)) {
		throw new Error("Prediction box is invalid");
	}

	return {
		type: "obb",
		imageSize: requireNumber(value.imageSize, "box.imageSize"),
		points: value.points.map(parsePoint),
	};
}

function parsePoint(value: unknown): [number, number] {
	if (!Array.isArray(value) || value.length !== 2) {
		throw new Error("Prediction box point is invalid");
	}

	return [
		requireNumber(value[0], "box.point.x"),
		requireNumber(value[1], "box.point.y"),
	];
}

function requireString(value: unknown, field: string): string {
	if (typeof value !== "string") {
		throw new Error(`${field} must be a string`);
	}

	return value;
}

function requireNumber(value: unknown, field: string): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new Error(`${field} must be a finite number`);
	}

	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
