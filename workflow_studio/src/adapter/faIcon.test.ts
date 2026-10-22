import { describe, expect, it } from "vitest";

import { faClasses } from "./faIcon";

describe("faClasses (registry icon normalization)", () => {
  it("renders free styles as solid with the same glyph", () => {
    expect(faClasses("far fa-database")).toBe("fa-solid fa-database");
    expect(faClasses("fa-solid fa-eye")).toBe("fa-solid fa-eye");
    expect(faClasses("fal fa-atom")).toBe("fa-solid fa-atom");
  });

  it("keeps brand glyphs on the brands font even with a foreign style prefix", () => {
    expect(faClasses("fa-brands fa-google")).toBe("fa-brands fa-google");
    expect(faClasses("far fa-brands fa-meta")).toBe("fa-brands fa-meta");
  });

  it("substitutes pro-only glyph names with validated free glyphs", () => {
    expect(faClasses("far fa-chart-network")).toBe("fa-solid fa-diagram-project");
    expect(faClasses("far fa-aperture")).toBe("fa-solid fa-camera-retro");
    expect(faClasses("fak fa-message-image")).toBe("fa-solid fa-image");
  });

  it("falls back for missing or malformed input", () => {
    expect(faClasses(undefined)).toBe("fa-solid fa-cube");
    expect(faClasses("")).toBe("fa-solid fa-cube");
    expect(faClasses("not-an-icon")).toBe("fa-solid fa-cube");
  });
});
