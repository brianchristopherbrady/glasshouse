import { describe, it, expect } from "vitest";
import { extractTemplateVariables, renderTemplate } from "../shared/prompt-template.js";

describe("extractTemplateVariables", () => {
  it("returns an empty array for a template with no placeholders", () => {
    expect(extractTemplateVariables("no variables here")).toEqual([]);
  });

  it("extracts a single placeholder", () => {
    expect(extractTemplateVariables("Hello {{name}}!")).toEqual(["name"]);
  });

  it("extracts multiple distinct placeholders in first-appearance order", () => {
    expect(extractTemplateVariables("{{b}} then {{a}} then {{b}}")).toEqual(["b", "a"]);
  });

  it("tolerates whitespace inside the braces", () => {
    expect(extractTemplateVariables("{{  spaced  }}")).toEqual(["spaced"]);
  });

  it("supports dotted variable names", () => {
    expect(extractTemplateVariables("{{user.name}}")).toEqual(["user.name"]);
  });
});

describe("renderTemplate", () => {
  it("substitutes a string value", () => {
    expect(renderTemplate("Hello {{name}}!", { name: "Ada" })).toBe("Hello Ada!");
  });

  it("JSON-stringifies non-string values", () => {
    expect(renderTemplate("Count: {{count}}", { count: 3 })).toBe("Count: 3");
    expect(renderTemplate("Items: {{items}}", { items: ["a", "b"] })).toBe('Items: ["a","b"]');
  });

  it("leaves unresolved placeholders verbatim instead of dropping them", () => {
    expect(renderTemplate("Hello {{name}}!", {})).toBe("Hello {{name}}!");
  });

  it("substitutes multiple distinct placeholders independently", () => {
    expect(renderTemplate("{{a}}-{{b}}-{{a}}", { a: "x", b: "y" })).toBe("x-y-x");
  });
});
