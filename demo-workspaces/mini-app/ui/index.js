// Pretend UI layer -- renders whatever the API layer returns.
import { getWidgets } from "../api/index.js";

export function render() {
  return getWidgets()
    .map((w) => `${w.name} (${w.status}${w.status === "haunted" ? " \u{1F47B}" : ""})`)
    .join(", ");
}
