// @mini/core -- a minimal modal "component": a plain data object describing
// a modal's content/open-state, with immutable open()/close() transitions.
// No DOM/framework dependency, since this package has none.
export function createModal({ title, body, isOpen = false } = {}) {
  return {
    title: title ?? "Untitled",
    body: body ?? "",
    isOpen,
    open() {
      return createModal({ title: this.title, body: this.body, isOpen: true });
    },
    close() {
      return createModal({ title: this.title, body: this.body, isOpen: false });
    },
  };
}
