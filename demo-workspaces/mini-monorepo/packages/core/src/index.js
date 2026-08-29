// @mini/core -- a tiny shared function, deliberately trivial.
export function greet(name) {
  return `Hello, ${name}!`;
}

export { createModal } from "./modal.js";
export { createWidget, notifyWidgetChange, WIDGET_STATUSES } from "./widget.js";
