/** Section-tinted chip / icon fill. 16% reads as a tray chip; 22% as the node icon. */

export function sectionChipStyle(color: string, strength: "chip" | "icon" = "chip"): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  const mix = strength === "icon" ? "22%" : "14%";
  return {
    backgroundColor: `color-mix(in srgb, ${color} ${mix}, white)`,
    color,
    borderColor: "transparent",
  };
}
