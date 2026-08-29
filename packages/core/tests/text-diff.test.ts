import { describe, it, expect } from "vitest";
import { diffLines } from "../shared/text-diff.js";

describe("diffLines", () => {
  it("reports zero added/removed for identical text", () => {
    const result = diffLines("a\nb\nc\n", "a\nb\nc\n");
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
  });

  it("counts a genuinely appended line as one addition", () => {
    const result = diffLines("a\nb\n", "a\nb\nc\n");
    expect(result.added).toBe(1);
    expect(result.removed).toBe(0);
  });

  it("counts a genuinely removed line as one removal", () => {
    const result = diffLines("a\nb\nc\n", "a\nc\n");
    expect(result.added).toBe(0);
    expect(result.removed).toBe(1);
  });

  it("counts both additions and removals for a real mixed change", () => {
    const result = diffLines("a\nb\nc\n", "a\nx\nc\nd\n");
    expect(result.removed).toBe(1);
    expect(result.added).toBe(2);
  });

  it("handles empty input text", () => {
    // "a\nb\n".split(/\r?\n/) is ["a","b",""] -- the trailing newline
    // produces a real trailing empty-string line, so 3 lines are added,
    // not 2. This documents that real (not idealized) split behavior.
    const result = diffLines("", "a\nb\n");
    expect(result.added).toBe(3);
    expect(result.removed).toBe(0);
  });
});
