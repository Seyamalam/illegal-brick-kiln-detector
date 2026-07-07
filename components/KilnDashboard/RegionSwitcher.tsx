import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

type Region = Doc<"regions">;

type RegionSwitcherProps = {
	regions: Region[];
	selectedRegionId: Id<"regions"> | null;
	onSelectedRegionIdChange: (regionId: Id<"regions">) => void;
};

export function RegionSwitcher({
	regions,
	selectedRegionId,
	onSelectedRegionIdChange,
}: RegionSwitcherProps) {
	return (
		<Select
			value={selectedRegionId ?? undefined}
			onValueChange={(regionId) =>
				onSelectedRegionIdChange(regionId as Id<"regions">)
			}
			disabled={regions.length === 0}
		>
			<SelectTrigger className="w-full min-w-52 sm:w-64" aria-label="District">
				<SelectValue placeholder="Select district" />
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					{regions.map((region) => (
						<SelectItem key={region._id} value={region._id}>
							{region.name}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}
