/**
 * Registry icon strings use FontAwesome classes, including Pro-only styles
 * ("fal" light, "fak" kit, "fad" duotone) and Pro-only glyph names. The free
 * webfont bundled in the app cannot render those, so every icon is normalized:
 * brands keep the brands font, everything else renders as free solid (the free
 * regular set is only ~170 glyphs), and Pro-only glyph names are substituted
 * with the closest free glyph below. Substitutions were validated against the
 * class list in @fortawesome/fontawesome-free css/all.min.css (FA v7).
 */

const FALLBACK_ICON = "fa-solid fa-cube";

/** Pro-only / renamed glyph name -> closest free glyph (validated against FA v7 CSS). */
const GLYPH_SUBSTITUTES: Record<string, string> = {
  analytics: "chart-line",
  aperture: "camera-retro",
  "arrow-progress": "arrow-trend-up",
  "bell-exclamation": "bell",
  "brackets-curly": "code",
  branching: "code-branch",
  "bring-front": "layer-group",
  "calculator-simple": "calculator",
  "camera-cctv": "camera",
  "chart-network": "diagram-project",
  "chart-scatter-bubble": "chart-simple",
  "circles-overlap": "circle-nodes",
  "cloud-upload": "cloud-arrow-up",
  "diagram-nested": "sitemap",
  "distribute-spacing-horizontal": "left-right",
  "empty-set": "ban",
  eyes: "eye",
  "gear-code": "code",
  grid: "table-cells",
  "grid-2-plus": "table-cells-large",
  "layer-minus": "layer-group",
  "lightbulb-on": "lightbulb",
  "list-timeline": "list-ul",
  "magnifying-glass-arrows-rotate": "magnifying-glass",
  "message-image": "image",
  "object-union": "object-group",
  "rectangles-mixed": "shapes",
  reel: "film",
  "ruler-triangle": "ruler-combined",
  scribble: "pen",
  split: "arrows-split-up-and-left",
  "square-dashed": "square",
  "square-o": "square",
  "table-tree": "sitemap",
  tally: "list-ol",
  text: "font",
  timer: "stopwatch",
  triangle: "shapes",
  "waveform-lines": "wave-square",
  webhook: "link",
};

export function faClasses(icon: string | null | undefined): string {
  if (!icon) {
    return FALLBACK_ICON;
  }
  const tokens = icon.trim().split(/\s+/).filter(Boolean);
  const glyph = tokens[tokens.length - 1];
  if (!glyph || !glyph.startsWith("fa-")) {
    return FALLBACK_ICON;
  }
  const name = glyph.slice("fa-".length);
  if (tokens.includes("fa-brands")) {
    return `fa-brands fa-${name}`;
  }
  return `fa-solid fa-${GLYPH_SUBSTITUTES[name] ?? name}`;
}
