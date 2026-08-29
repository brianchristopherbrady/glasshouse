import { describe, it, expect } from "vitest";
import { createEvent } from "../shared/events.js";
import { computeWorkspaceActivity, extractWorkspaceLinks } from "../shared/workspace-activity.js";
import type { WorkspaceGraph } from "../shared/workspace-types.js";

const graph: WorkspaceGraph = {
  source: "package-manager",
  members: [
    { id: "@acme/web-components", label: "@acme/web-components", path: "packages/web-components", kind: "package", dependsOn: [], source: "package-manager" },
    { id: "@acme/react-wrapper", label: "@acme/react-wrapper", path: "packages/react-wrapper", kind: "package", dependsOn: ["@acme/web-components"], source: "package-manager" },
  ],
  edges: [{ from: "@acme/react-wrapper", to: "@acme/web-components" }],
};

describe("computeWorkspaceActivity", () => {
  it("attributes a file.written event to the member whose path contains it", () => {
    const events = [
      createEvent({
        sessionId: "s1",
        type: "file.written",
        source: "hook",
        evidence: "observed",
        label: "File written",
        actor: { id: "agent", kind: "agent", name: "Mote" },
        metadata: { path: "packages/web-components/src/button.ts" },
      }),
    ];
    const touches = computeWorkspaceActivity(events, graph);
    expect(touches).toHaveLength(1);
    expect(touches[0]!.memberId).toBe("@acme/web-components");
    expect(touches[0]!.filesWritten).toEqual(["packages/web-components/src/button.ts"]);
    expect(touches[0]!.actors).toEqual([{ id: "agent", name: "Mote" }]);
  });

  it("ignores files that don't fall under any known member path", () => {
    const events = [
      createEvent({
        sessionId: "s1",
        type: "file.read",
        source: "hook",
        evidence: "observed",
        label: "File read",
        metadata: { path: "README.md" },
      }),
    ];
    expect(computeWorkspaceActivity(events, graph)).toEqual([]);
  });

  it("separates read/written/searched buckets and tracks multiple actors", () => {
    const events = [
      createEvent({
        sessionId: "s1",
        type: "file.read",
        source: "hook",
        evidence: "observed",
        label: "read",
        actor: { id: "agent", kind: "agent" },
        metadata: { path: "packages/react-wrapper/src/index.ts" },
      }),
      createEvent({
        sessionId: "s1",
        type: "file.written",
        source: "hook",
        evidence: "observed",
        label: "write",
        actor: { id: "sub-1", kind: "subagent", name: "Wrapper Specialist" },
        metadata: { path: "packages/react-wrapper/src/Button.tsx" },
      }),
    ];
    const touches = computeWorkspaceActivity(events, graph);
    expect(touches).toHaveLength(1);
    const touch = touches[0]!;
    expect(touch.filesRead).toEqual(["packages/react-wrapper/src/index.ts"]);
    expect(touch.filesWritten).toEqual(["packages/react-wrapper/src/Button.tsx"]);
    expect(touch.actors.map((a) => a.id).sort()).toEqual(["agent", "sub-1"]);
  });

  it("matches a member whose path is a single file, not a directory", () => {
    const chapterGraph: WorkspaceGraph = {
      source: "config",
      members: [
        { id: "chapter-1", label: "Chapter 1", path: "manuscript/part-1/chapter-1.md", kind: "chapter", dependsOn: [], source: "config" },
      ],
      edges: [],
    };
    const events = [
      createEvent({
        sessionId: "s1",
        type: "file.written",
        source: "hook",
        evidence: "observed",
        label: "write",
        actor: { id: "agent", kind: "agent" },
        metadata: { path: "manuscript/part-1/chapter-1.md" },
      }),
    ];
    const touches = computeWorkspaceActivity(events, chapterGraph);
    expect(touches).toHaveLength(1);
    expect(touches[0]!.memberId).toBe("chapter-1");
  });
});

describe("extractWorkspaceLinks", () => {
  it("extracts a declared workspace.linked event into a WorkspaceLink", () => {
    const events = [
      createEvent({
        sessionId: "s1",
        type: "workspace.linked",
        source: "agent-declared",
        evidence: "declared",
        label: "@acme/web-components → @acme/react-wrapper",
        actor: { id: "agent", kind: "agent", name: "Mote" },
        metadata: {
          from: "@acme/web-components",
          to: "@acme/react-wrapper",
          reason: "renamed variant prop to tone",
        },
      }),
    ];
    const links = extractWorkspaceLinks(events);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      from: "@acme/web-components",
      to: "@acme/react-wrapper",
      reason: "renamed variant prop to tone",
      actor: { id: "agent", name: "Mote" },
    });
  });

  it("ignores non-workspace.linked events", () => {
    const events = [
      createEvent({
        sessionId: "s1",
        type: "file.read",
        source: "hook",
        evidence: "observed",
        label: "read",
      }),
    ];
    expect(extractWorkspaceLinks(events)).toEqual([]);
  });
});
