"use client";

import * as React from "react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { EmptyRegionsState } from "./EmptyRegionsState";
import { PredictionWorkspace } from "./PredictionWorkspace";
import { RegionStatus } from "./RegionStatus";
import { RegionSwitcher } from "./RegionSwitcher";

const hasConfiguredConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

const localDemoRegions = [
	{
		_id: "local_brahmanbaria" as Id<"regions">,
		_creationTime: 0,
		slug: "brahmanbaria",
		name: "Brahmanbaria",
		centerLat: 23.9571,
		centerLon: 91.1119,
		defaultZoom: 11,
		lastUpdated: 0,
	},
	{
		_id: "local_jessore" as Id<"regions">,
		_creationTime: 0,
		slug: "jessore",
		name: "Jessore",
		centerLat: 23.1634,
		centerLon: 89.2182,
		defaultZoom: 11,
		lastUpdated: 0,
	},
	{
		_id: "local_manikganj" as Id<"regions">,
		_creationTime: 0,
		slug: "manikganj",
		name: "Manikganj",
		centerLat: 23.8617,
		centerLon: 90.0003,
		defaultZoom: 11,
		lastUpdated: 0,
	},
	{
		_id: "local_mymensingh" as Id<"regions">,
		_creationTime: 0,
		slug: "mymensingh",
		name: "Mymensingh",
		centerLat: 24.7471,
		centerLon: 90.4203,
		defaultZoom: 11,
		lastUpdated: 0,
	},
	{
		_id: "local_tangail" as Id<"regions">,
		_creationTime: 0,
		slug: "tangail",
		name: "Tangail",
		centerLat: 24.2513,
		centerLon: 89.9167,
		defaultZoom: 11,
		lastUpdated: 0,
	},
] satisfies Doc<"regions">[];

export function KilnDashboard() {
	if (!hasConfiguredConvex) {
		return <KilnDashboardView regions={localDemoRegions} />;
	}

	return <ConvexKilnDashboard />;
}

function ConvexKilnDashboard() {
	const regions = useQuery(api.regions.getRegions);

	if (regions === undefined) {
		return <DashboardSkeleton />;
	}

	return <KilnDashboardView regions={regions} />;
}

function KilnDashboardView({ regions }: { regions: Doc<"regions">[] }) {
	const [selectedRegionId, setSelectedRegionId] =
		React.useState<Id<"regions"> | null>(null);

	if (regions.length === 0) {
		return <EmptyRegionsState />;
	}

	const selectedRegion =
		regions.find((region) => region._id === selectedRegionId) ?? regions[0];

	return (
		<main className="flex min-h-full flex-1 bg-background">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
				<header className="flex flex-col gap-1">
					<h1 className="font-heading text-3xl font-medium leading-tight">
						Illegal Brick Kiln Detector
					</h1>
					<p className="text-sm text-muted-foreground">
						Bangladesh district monitoring
					</p>
				</header>

				<Card>
					<CardHeader>
						<CardTitle>District overview</CardTitle>
						<CardDescription>
							District metadata and update status
						</CardDescription>
						<CardAction className="w-full sm:w-auto">
							<RegionSwitcher
								regions={regions}
								selectedRegionId={selectedRegion._id}
								onSelectedRegionIdChange={setSelectedRegionId}
							/>
						</CardAction>
					</CardHeader>
					<CardContent>
						<RegionStatus region={selectedRegion} />
					</CardContent>
					<CardFooter className="justify-between gap-3">
						<p className="text-sm text-muted-foreground">
							{regions.length} supported districts
						</p>
						<Badge variant="outline">Connected</Badge>
					</CardFooter>
				</Card>

				<PredictionWorkspace region={selectedRegion} />
			</div>
		</main>
	);
}
