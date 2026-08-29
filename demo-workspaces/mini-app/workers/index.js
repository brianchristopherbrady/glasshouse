// Pretend background worker -- no real scheduling, just a stub. Real new
// dependency on api/: archives every widget as part of the nightly job,
// same status lifecycle api/index.js and @mini/core's widget.js both use.
// Haunted widgets are skipped, not archived -- same business rule as
// @mini/core's archive(), reimplemented independently here.
import { getWidgets, updateWidgetStatus } from "../api/index.js";

export function runNightlyJob() {
  const skipped = [];
  for (const widget of getWidgets()) {
    if (widget.status === "haunted") {
      skipped.push(widget.id);
      continue;
    }
    updateWidgetStatus(widget.id, "archived");
  }
  return skipped.length > 0 ? `job complete, skipped haunted: ${skipped.join(", ")}` : "job complete";
}
