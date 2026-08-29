---
name: interpret-session
description: Cross-references a session's real event log against the repo's actual local changes (git status/diff) before event-storyboard or workspace-map produce anything from it -- catches events that don't match reality (a recorded file.written whose change was later reverted, a file changed outside any observed tool call) so the Storyboard and Workspace Map stay grounded in what's actually true on disk, not just what the log claims. Run once per session, before event-storyboard and before declaring any workspace.linked edges.
---

# Interpret Session

Every other narrative/mapping Skill in this package (`event-storyboard`,
`workspace-map`) trusts the event log as its input. This
Skill is what earns that trust: it's the one place a session's real
`FlowbookEvent` log is checked against the repo's actual current state
on disk, before anything downstream treats the log as ground truth.

```
real FlowbookEvents (the log)          real local changes (git status/diff)
        \                                          /
         \                                        /
          -----------> interpret-session <-------
                    (this Skill: reconcile)
                             |
              writes findings used by:
                             |
        +--------------------+---------------------+
        |                                           |
  event-storyboard                            workspace-map / map-members
  (Storyboard beats grounded                  (link_workspaces calls grounded
   in what really happened)                    in what really changed)
```

## Why this exists

The event log is real telemetry, but it is not automatically the same
thing as "what the repo looks like right now":

- A `file.written` event can be recorded for a change that was later
  reverted (by the agent itself, a subsequent edit, or a human) --
  narrating it as a completed change would be wrong.
- A file can be genuinely changed by a process the hooks never observed
  (a manual edit, a script, a merge) -- the Workspace Map's touch overlay
  would silently miss it if only the log were consulted.
- Multiple `file.written` events on the same path across a session collapse
  into one real net change (or none, if they cancel out) -- narrating each
  one as a separate "change" overstates what happened.

Reconciling the log against `git status`/`git diff` (or, if the repo isn't
a git repo, a direct read of the files the log claims were touched) is what
lets the Storyboard and Workspace Map make an honest claim: not just "the
log says this happened" but "this happened, and it's still true."

## When to invoke this Skill

Once per session (or once per meaningful stretch of a long session) --
after the session has real activity to interpret, and *before* running
`event-storyboard` or declaring any `workspace.linked` edges via
`link_workspaces`. Re-run it if significant time has passed since the last
run and more changes may have landed.

## What it does

1. **Read the session's real events.** `GET /api/sessions/:id/events` (or
   the live stream). Collect every `file.written` (and, if relevant,
   `file.read`) event's path, along with which actor and which beat
   (`decision.declared`/`workspace.linked`/etc.) it's associated with.
2. **Read the repo's real current state.** Run `git status --short` and, for
   files the log claims were touched, `git diff` (or `git diff --staged` /
   `git show` as appropriate) to see what's *actually* different right now.
   If the repo isn't under git, read the claimed files directly and compare
   against what the log's own metadata would imply (e.g. a
   `replace_string_in_file` tool call's `oldString`/`newString`, if
   present in the event's raw payload).
3. **Reconcile, honestly:**
   - A file the log says was written AND that shows a real diff/status
     change: confirmed -- safe for `event-storyboard` to narrate as a real
     completed change, and for `workspace-map`/`map-members` to treat as a
     genuine touch.
   - A file the log says was written but shows NO real difference from
     before the session (reverted, or the write was a no-op): note this
     explicitly -- do not let `event-storyboard` narrate it as a completed
     change. Say so plainly ("recorded as written, but reverted/unchanged
     by end of session") rather than silently dropping it, since the
     attempt itself may still be a real part of the story.
   - A file that's genuinely different in `git status`/`git diff` but has
     NO corresponding `file.written` event: flag this as an unobserved
     change -- the Workspace Map's activity overlay should still be able to
     account for it if possible (e.g. by treating it as evidence for a
     member touch even without a matching event), and it's worth noting in
     the Storyboard as an honest gap ("this file changed; no tool call in
     the log explains how").
4. **Hand off a reconciled summary** for `event-storyboard` and
   `workspace-map`/`map-members` to use as their actual input -- this can
   be as simple as a short note in your own working context for the rest of
   the session's Skill invocations; this Skill does not define its own
   separate persisted file format.

## What this Skill does not do

- It does not write the Storyboard itself -- that's `event-storyboard`'s
  job, using this Skill's reconciled view of what's real.
- It does not call `link_workspaces` itself -- that's `workspace-map`'s
  job, but it should only declare links for changes this Skill has already
  confirmed are real.
- It does not modify the repo to "fix" a discrepancy between the log and
  reality -- reconciliation is about accurate reporting, not correcting
  history.
- It does not assume every repo is a git repo -- fall back to direct file
  comparison when `git status` isn't available, and say so rather than
  skipping reconciliation silently.
