import type { Doc } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatLastUpdated } from "@/lib/format";

type RegionStatusProps = {
	region: Doc<"regions"> | null;
};

function formatCoordinate(value: number): string {
	return value.toFixed(4);
}

export function RegionStatus({ region }: RegionStatusProps) {
	if (!region) {
		return (
			<p className="text-sm text-muted-foreground">
				No district is currently selected.
			</p>
		);
	}

	const lastUpdatedLabel = formatLastUpdated(region.lastUpdated);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<h2 className="font-heading text-xl font-medium leading-snug">
					{region.name}
				</h2>
				<Badge variant={region.lastUpdated === 0 ? "secondary" : "default"}>
					{region.lastUpdated === 0 ? "Never updated" : "Updated"}
				</Badge>
			</div>
			<Separator />
			<dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
				<div className="flex flex-col gap-1">
					<dt className="text-muted-foreground">Slug</dt>
					<dd className="font-medium">{region.slug}</dd>
				</div>
				<div className="flex flex-col gap-1">
					<dt className="text-muted-foreground">Center</dt>
					<dd className="font-medium">
						{formatCoordinate(region.centerLat)},{" "}
						{formatCoordinate(region.centerLon)}
					</dd>
				</div>
				<div className="flex flex-col gap-1">
					<dt className="text-muted-foreground">Default zoom</dt>
					<dd className="font-medium">{region.defaultZoom}</dd>
				</div>
				<div className="flex flex-col gap-1">
					<dt className="text-muted-foreground">Last updated</dt>
					<dd className="font-medium">{lastUpdatedLabel}</dd>
				</div>
			</dl>
		</div>
	);
}
