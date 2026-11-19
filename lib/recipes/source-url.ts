const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "mc_cid",
  "mc_eid",
]);

export function normalizeSourceUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Source must be a valid HTTP or HTTPS URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Source must be a valid HTTP or HTTPS URL");
  }

  url.hash = "";

  const meaningfulEntries = [...url.searchParams.entries()]
    .filter(([name]) => {
      const normalizedName = name.toLowerCase();
      return (
        !normalizedName.startsWith("utm_") &&
        !TRACKING_PARAMETERS.has(normalizedName)
      );
    })
    .sort(([leftName, leftValue], [rightName, rightValue]) =>
      leftName === rightName
        ? leftValue.localeCompare(rightValue)
        : leftName.localeCompare(rightName),
    );

  url.search = "";
  for (const [name, entryValue] of meaningfulEntries) {
    url.searchParams.append(name, entryValue);
  }

  return url.toString();
}
