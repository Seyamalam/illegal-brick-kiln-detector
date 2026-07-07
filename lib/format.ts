export function formatLastUpdated(timestamp: number): string {
	if (timestamp === 0) {
		return "Never updated";
	}

	return new Intl.DateTimeFormat("en", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(timestamp));
}
