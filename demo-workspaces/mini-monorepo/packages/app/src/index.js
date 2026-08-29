// @mini/app -- depends on @mini/core, so the Workspace Map draws a real
// dependency edge @mini/app -> @mini/core.
import { greet, createModal, createWidget, notifyWidgetChange } from "@mini/core";

console.log(greet("Flowbook"));

let welcomeModal = createModal({ title: "Welcome", body: "Hello from @mini/app!" });
console.log(`modal isOpen: ${welcomeModal.isOpen}`);
welcomeModal = welcomeModal.open();
console.log(`modal isOpen: ${welcomeModal.isOpen}`);
welcomeModal = welcomeModal.close();
console.log(`modal isOpen: ${welcomeModal.isOpen}`);

let widget = createWidget({ id: "widget-1", name: "Signal Beacon" });
console.log(`widget status: ${widget.status}`);

widget = widget.haunt();
console.log(`widget status: ${widget.status}`);
try {
  widget.archive();
} catch (err) {
  console.log(`archive blocked: ${err.message}`);
}

widget = widget.exorcise();
widget = widget.archive();
notifyWidgetChange(widget, [(w) => console.log(`widget ${w.id} changed to: ${w.status}`)]);
