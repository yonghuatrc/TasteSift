// Adapted from the existing Video Knowledge Extraction caption parser so the
// TasteSift helper and its tests can start without that optional checkout.
export function parseVideoCaptions(value, language = "und") {
  const segments = [];
  for (const block of String(value).replace(/^\uFEFF/, "").split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const at = lines.findIndex((line) => line.includes("-->"));
    if (at < 0) continue;
    const match = lines[at].match(/((?:\d{2,}:)?\d{2}:\d{2}[.,]\d{3})\s+-->\s+((?:\d{2,}:)?\d{2}:\d{2}[.,]\d{3})/);
    if (!match) continue;
    const seconds = (text) => text.replace(",", ".").split(":").reduce((total, part) => total * 60 + Number(part), 0);
    const offset = seconds(match[1]);
    const end = seconds(match[2]);
    const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " " };
    const text = lines.slice(at + 1).join(" ").replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/g, (_, name) => entities[name]).replace(/\s+/g, " ").trim();
    if (text && end >= offset && segments.at(-1)?.text !== text) segments.push({ offset, duration: end - offset, text, lang: language });
  }
  return segments;
}

export function groupTranscriptSegments(segments) {
  const groups = [];
  for (const segment of segments) {
    if (typeof segment.text !== "string" || !segment.text.trim()) continue;
    const text = segment.text.trim(); const current = groups.at(-1);
    if (!current || segment.offset - current.offset > 20 || current.text.length + text.length > 800) groups.push({ offset: segment.offset, text });
    else current.text += ` ${text}`;
  }
  return groups.map((group) => group.text);
}
