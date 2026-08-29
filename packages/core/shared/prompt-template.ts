// Real `{{variable}}` prompt template rendering -- no LLM involved, pure
// string substitution, so "Template" (source) vs "Resolved" (what a model
// actually received) in the UI are both genuine, inspectable text, never
// invented. Deliberately tiny: Flowbook's job is to SHOW what a workflow
// sends, not to be a templating engine in its own right.
const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/** Extracts every `{{name}}` placeholder in a template, in first-appearance
 * order, deduplicated -- used to populate `PromptResource.variables`
 * mechanically from the template text itself. */
export function extractTemplateVariables(template: string): string[] {
  const seen = new Set<string>();
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    seen.add(match[1]!);
  }
  return [...seen];
}

/** Renders a template against real values, leaving any unresolved
 * `{{name}}` placeholder verbatim (never silently dropped or replaced with
 * an invented default) so a missing variable is honestly visible in the
 * Resolved view rather than papered over. */
export function renderTemplate(template: string, values: Record<string, unknown>): string {
  return template.replace(VARIABLE_PATTERN, (whole, name: string) => {
    if (!(name in values)) return whole;
    const value = values[name];
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}
