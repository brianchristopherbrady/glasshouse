// Node-only loader: reads world/<agent>_actions/{actions,downstream_effects}.md
// and parses them into BookEntry records keyed by chapter.thread.entry, per
// the numbering convention in .github/skills/dispatch/SKILL.md. Also reads
// world/chapters/chapter-<N>.md (assembled by the writer Skill, per
// .github/skills/writer/SKILL.md) into Chapter records, and world/storyboard.json
// (written by the storyboard Skill, per .github/skills/storyboard/SKILL.md)
// into StoryboardBeat records. Not imported by frontend code (browser
// bundle has no filesystem access).
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { BookCharacter, BookData, BookEntry, BookSource, Chapter, ChapterBeat, StoryboardBeat } from "./book-types.js";

export const DEFAULT_WORLD_DIR = path.resolve(process.cwd(), "world");

// Agent id (as used in world/dispatch.json and .agent.md frontmatter) ->
// { folder, displayName }. The folder naming is inconsistent on disk
// (b_actions, choir_actions, house-vey_actions, simon_kade_actions) so this
// mapping is the single source of truth rather than a naming convention.
const AGENTS: Array<{ id: string; folder: string; displayName: string }> = [
  { id: "mote", folder: "mote_actions", displayName: "Mote" },
  { id: "b", folder: "b_actions", displayName: "B" },
  { id: "noor", folder: "noor_actions", displayName: "Noor" },
  { id: "the-choir", folder: "choir_actions", displayName: "The Choir" },
  { id: "asterion", folder: "asterion_actions", displayName: "Asterion" },
  { id: "house-vey", folder: "house-vey_actions", displayName: "House Vey" },
  { id: "simon-kade", folder: "simon_kade_actions", displayName: "Simon Kade" },
  { id: "the-public", folder: "the-public_actions", displayName: "The Public" },
];

const LOCATOR_HEADING = /^##\s+(\d+)\.(\d+)\.(\d+)\s*$/;

/**
 * Splits a markdown file into entries by "## chapter.thread.entry" headings.
 * Text before the first such heading (e.g. a leading "# chapter N" title) is
 * discarded -- it's a section title, not a locatable entry. Each entry's text
 * runs until the next "## x.y.z" heading or end of file.
 */
function parseEntries(agentId: string, source: BookSource, raw: string): BookEntry[] {
  const lines = raw.split(/\r?\n/);
  const entries: BookEntry[] = [];
  let current: { chapter: number; thread: number; entry: number; buf: string[] } | null = null;

  function flush() {
    if (!current) return;
    const text = current.buf.join("\n").trim();
    entries.push({
      agentId,
      source,
      locator: `${current.chapter}.${current.thread}.${current.entry}`,
      chapter: current.chapter,
      thread: current.thread,
      entry: current.entry,
      text,
    });
  }

  for (const line of lines) {
    const match = line.match(LOCATOR_HEADING);
    if (match) {
      flush();
      current = { chapter: Number(match[1]), thread: Number(match[2]), entry: Number(match[3]), buf: [] };
    } else if (current) {
      current.buf.push(line);
    }
  }
  flush();

  return entries.filter((e) => e.text.length > 0);
}

async function readMaybe(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

const CHAPTER_TITLE = /^#\s+(.+?)\s*$/;
const CHAPTER_FILE = /^chapter-(\d+)\.md$/;

/**
 * Parses a world/chapters/chapter-<N>.md file (writer Skill output) into a
 * Chapter: the leading "# Chapter N" (or similar) line becomes `title`, and
 * each "## chapter.thread.entry" section becomes a ChapterBeat -- same
 * heading convention as the ledger files, so Book mode can deep-link
 * consistently across both raw accounts and assembled prose.
 */
function parseChapter(chapterNumber: number, raw: string): Chapter {
  const lines = raw.split(/\r?\n/);
  let title = `Chapter ${chapterNumber}`;
  const beats: ChapterBeat[] = [];
  let current: { chapter: number; thread: number; entry: number; buf: string[] } | null = null;
  let sawTitle = false;

  function flush() {
    if (!current) return;
    const text = current.buf.join("\n").trim();
    if (text.length > 0) {
      beats.push({
        locator: `${current.chapter}.${current.thread}.${current.entry}`,
        chapter: current.chapter,
        thread: current.thread,
        entry: current.entry,
        text,
      });
    }
  }

  for (const line of lines) {
    const locatorMatch = line.match(LOCATOR_HEADING);
    if (locatorMatch) {
      flush();
      current = { chapter: Number(locatorMatch[1]), thread: Number(locatorMatch[2]), entry: Number(locatorMatch[3]), buf: [] };
      continue;
    }
    if (!sawTitle && !current) {
      const titleMatch = line.match(CHAPTER_TITLE);
      if (titleMatch) {
        title = titleMatch[1]!;
        sawTitle = true;
        continue;
      }
    }
    if (current) current.buf.push(line);
  }
  flush();

  beats.sort((a, b) => a.thread - b.thread || a.entry - b.entry);
  return { number: chapterNumber, title, beats };
}

async function loadChapters(worldDir: string): Promise<Chapter[]> {
  const chaptersDir = path.join(worldDir, "chapters");
  let files: string[];
  try {
    files = await readdir(chaptersDir);
  } catch {
    return [];
  }

  const chapters = await Promise.all(
    files
      .map((f) => ({ f, match: f.match(CHAPTER_FILE) }))
      .filter((x): x is { f: string; match: RegExpMatchArray } => x.match !== null)
      .map(async ({ f, match }) => {
        const raw = await readFile(path.join(chaptersDir, f), "utf-8");
        return parseChapter(Number(match[1]), raw);
      })
  );

  return chapters.sort((a, b) => a.number - b.number);
}

interface StoryboardFile {
  beats?: Array<{
    locator?: unknown;
    agentId?: unknown;
    source?: unknown;
    description?: unknown;
    involves?: unknown;
    bloomrotAware?: unknown;
    citedSources?: unknown;
  }>;
}

/** Reads world/storyboard.json (storyboard Skill output). Tolerant of a
 * missing file (nothing storyboarded yet) and of individual malformed
 * entries (skipped rather than crashing the whole book load). */
async function loadStoryboard(worldDir: string): Promise<StoryboardBeat[]> {
  const raw = await readMaybe(path.join(worldDir, "storyboard.json"));
  if (!raw.trim()) return [];

  let parsed: StoryboardFile;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const beats: StoryboardBeat[] = [];
  for (const b of parsed.beats ?? []) {
    if (typeof b.locator !== "string" || typeof b.agentId !== "string" || typeof b.description !== "string") continue;
    beats.push({
      locator: b.locator,
      agentId: b.agentId,
      source: b.source === "downstream" ? "downstream" : "actions",
      description: b.description,
      involves: Array.isArray(b.involves) ? b.involves.filter((x): x is string => typeof x === "string") : [],
      bloomrotAware: b.bloomrotAware === true,
      citedSources: Array.isArray(b.citedSources) ? b.citedSources.filter((x): x is string => typeof x === "string") : [],
    });
  }
  return beats;
}

export async function loadBook(worldDir: string = DEFAULT_WORLD_DIR): Promise<BookData> {
  const [characters, chapters, storyboard] = await Promise.all([
    Promise.all(
      AGENTS.map(async ({ id, folder, displayName }) => {
        const dir = path.join(worldDir, folder);
        const [actionsRaw, downstreamRaw] = await Promise.all([
          readMaybe(path.join(dir, "actions.md")),
          readMaybe(path.join(dir, "downstream_effects.md")),
        ]);
        const entries = [
          ...parseEntries(id, "actions", actionsRaw),
          ...parseEntries(id, "downstream", downstreamRaw),
        ].sort((a, b) => a.chapter - b.chapter || a.thread - b.thread || a.entry - b.entry);
        return { id, displayName, entries };
      })
    ),
    loadChapters(worldDir),
    loadStoryboard(worldDir),
  ]);

  const byLocator: Record<string, BookEntry[]> = {};
  for (const character of characters) {
    for (const entry of character.entries) {
      (byLocator[entry.locator] ??= []).push(entry);
    }
  }

  const storyboardByLocator: Record<string, StoryboardBeat[]> = {};
  for (const beat of storyboard) {
    (storyboardByLocator[beat.locator] ??= []).push(beat);
  }

  return { characters, byLocator, chapters, storyboardByLocator };
}
