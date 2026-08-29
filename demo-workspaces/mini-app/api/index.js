// Pretend API layer -- returns a static payload, no real server. Widget
// shape ({id, name, status}) mirrors @mini/core's createWidget() in the
// mini-monorepo demo, same status lifecycle: active -> archived, with the
// same haunted detour independently reimplemented here (not shared code):
// a haunted widget must be exorcised before it can be archived.
const widgets = [
  { id: 1, name: "widget-a", status: "active" },
  { id: 2, name: "widget-b", status: "haunted" },
];

export function getWidgets() {
  return widgets;
}

export function updateWidgetStatus(id, status) {
  const widget = widgets.find((w) => w.id === id);
  if (!widget) return undefined;
  if (widget.status === "haunted" && status === "archived") {
    throw new Error(`cannot archive haunted widget "${id}" -- exorcise it first`);
  }
  widget.status = status;
  return widget;
}

export function hauntWidget(id) {
  return updateWidgetStatus(id, "haunted");
}

export function exorciseWidget(id) {
  return updateWidgetStatus(id, "active");
}
