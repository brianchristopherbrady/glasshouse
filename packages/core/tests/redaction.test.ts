import { describe, it, expect } from "vitest";
import { redact, redactEventPayload, REDACTED, MAX_STRING_LENGTH } from "../shared/redaction.js";

describe("redact", () => {
  it("redacts values under sensitive-looking keys", () => {
    const result = redact({ apiKey: "abcdef123456", note: "hello" }) as Record<string, unknown>;
    expect(result.apiKey).toBe(REDACTED);
    expect(result.note).toBe("hello");
  });

  it("redacts bearer tokens embedded in a string", () => {
    const result = redact("Authorization header was: Bearer abc123.def456") as string;
    expect(result).not.toContain("abc123.def456");
    expect(result).toContain(REDACTED);
  });

  it("redacts GitHub-style personal access tokens", () => {
    const token = "ghp_" + "a".repeat(36);
    const result = redact(`token=${token}`) as string;
    expect(result).not.toContain(token);
  });

  it("truncates very long strings", () => {
    const long = "x".repeat(MAX_STRING_LENGTH + 500);
    const result = redact(long) as string;
    expect(result.length).toBeLessThan(long.length);
    expect(result).toContain("truncated");
  });

  it("recurses into nested arrays and objects", () => {
    const result = redact({
      list: [{ password: "hunter2" }, { fine: "yes" }],
    }) as { list: Array<Record<string, unknown>> };
    expect(result.list[0]!.password).toBe(REDACTED);
    expect(result.list[1]!.fine).toBe("yes");
  });

  it("leaves non-sensitive small payloads untouched", () => {
    const result = redact({ count: 3, name: "Surveyor" });
    expect(result).toEqual({ count: 3, name: "Surveyor" });
  });
});

describe("redactEventPayload", () => {
  it("redacts metadata and raw without touching other fields", () => {
    const event = {
      id: "e1",
      metadata: { token: "sk-abcdefghijklmnopqrst" },
      raw: { headers: { authorization: "Bearer topsecret" } },
    };
    const result = redactEventPayload(event);
    expect(result.id).toBe("e1");
    expect(result.metadata!.token).toBe(REDACTED);
    expect((result.raw as { headers: { authorization: string } }).headers.authorization).toBe(REDACTED);
  });
});
