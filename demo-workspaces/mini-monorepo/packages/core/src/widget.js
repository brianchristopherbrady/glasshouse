// @mini/core -- a widget: {id, name, status}, status moves active ->
// archived, with a haunted detour: a haunted widget cannot be archived
// until it's exorcised back to active first. Same immutable-transition
// style as modal.js's open()/close().
export const WIDGET_STATUSES = ["active", "archived", "haunted"];

export function createWidget({ id, name, status = "active" } = {}) {
  return {
    id: id ?? "widget-0",
    name: name ?? "Untitled Widget",
    status,
    activate() {
      return createWidget({ id: this.id, name: this.name, status: "active" });
    },
    archive() {
      if (this.status === "haunted") {
        throw new Error(`cannot archive haunted widget "${this.id}" -- exorcise it first`);
      }
      return createWidget({ id: this.id, name: this.name, status: "archived" });
    },
    haunt() {
      return createWidget({ id: this.id, name: this.name, status: "haunted" });
    },
    exorcise() {
      return createWidget({ id: this.id, name: this.name, status: "active" });
    },
  };
}

/** Minimal pub-sub: calls every listener with the widget that just changed. */
export function notifyWidgetChange(widget, listeners = []) {
  for (const listener of listeners) listener(widget);
  return widget;
}
