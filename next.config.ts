import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	async rewrites() {
		if (!process.env.PREDICT_API_BASE) {
			return [];
		}

		return [
			{
				source: "/predict",
				destination: `${process.env.PREDICT_API_BASE}/predict`,
			},
		];
	},
};

export default nextConfig;
