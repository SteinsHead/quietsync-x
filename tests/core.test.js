import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSyncQueue,
  buildAutoSyncQueue,
  classifyTerm,
  mergeDictionary,
  normalizeTerm,
  parseDictionary,
  sourceOriginPattern
} from "../src/shared/core.js";

test("normalizes Unicode, case, and whitespace", () => {
  assert.equal(normalizeTerm("  ＢＴＣ   AIRDROP  "), "btc airdrop");
});

test("parses line lists without treating hashtags as comments", () => {
  const entries = parseDictionary("// comment\n#Giveaway\n加微领取\n#giveaway\n");
  assert.equal(entries.length, 2);
  assert.equal(entries[0].term, "#Giveaway");
  assert.equal(entries[1].category, "spam");
});

test("parses categorized TXT and converts username groups for X native muting", () => {
  const entries = parseDictionary("# [仇恨用语]\n去死\n# [用户名]\nspam_bot\n#realhashtag");
  assert.deepEqual(entries.map((entry) => entry.term), ["去死", "@spam_bot", "#realhashtag"]);
  assert.deepEqual(entries.map((entry) => entry.category), ["harassment", "custom", "custom"]);
});

test("removes invisible evasion characters", () => {
  assert.equal(normalizeTerm("求主\u200b人"), "求主人");
});

test("keeps source regex visible but excludes it from native X sync", () => {
  const parsed = parseDictionary("/^spam.*bot$/i\ndm me");
  const merged = mergeDictionary([], [{ sourceId: "one", entries: parsed }]);
  assert.equal(merged[0].kind === "regex" || merged[1].kind === "regex", true);
  assert.deepEqual(buildSyncQueue(merged).map((entry) => entry.term), ["dm me"]);
});

test("parses category maps and object entries", () => {
  const entries = parseDictionary(JSON.stringify({
    scam: ["connect wallet"],
    words: [{ word: "AI美女", category: "ai_slop" }]
  }), "application/json");
  assert.deepEqual(entries.map((entry) => entry.category), ["scam", "ai_slop"]);
});

test("ignores JSON metadata next to dictionary containers", () => {
  const entries = parseDictionary(JSON.stringify({
    name: "Community list",
    license: "MIT",
    version: "1",
    keywords: ["dm me"]
  }), "application/json");
  assert.deepEqual(entries.map((entry) => entry.term), ["dm me"]);
});

test("classifies common spam patterns", () => {
  assert.equal(classifyTerm("follow me for follow back").category, "engagement");
  assert.equal(classifyTerm("connect your wallet").category, "scam");
});

test("merges sources and preserves user-locked categories", () => {
  const existing = [{
    id: "q_old",
    term: "Airdrop",
    normalized: "airdrop",
    category: "custom",
    confidence: 1,
    categoryLocked: true,
    sourceIds: ["one"],
    enabled: true,
    status: "pending"
  }];
  const incoming = [{
    sourceId: "two",
    entries: parseDictionary("airdrop\ndm me")
  }];
  const merged = mergeDictionary(existing, incoming, "2026-08-26T00:00:00.000Z");
  assert.equal(merged.length, 2);
  assert.equal(merged.find((entry) => entry.normalized === "airdrop").category, "custom");
  assert.deepEqual(merged.find((entry) => entry.normalized === "airdrop").sourceIds, ["one", "two"]);
});

test("marks terms removed from a successfully refreshed source as stale", () => {
  const existing = [{
    id: "q_old", term: "old", normalized: "old", category: "custom",
    confidence: 0.45, sourceIds: ["one"], enabled: true, status: "pending", stale: false
  }];
  const merged = mergeDictionary(existing, [{ sourceId: "one", entries: parseDictionary("new") }]);
  assert.equal(merged.find((entry) => entry.normalized === "old").stale, true);
  assert.deepEqual(merged.find((entry) => entry.normalized === "old").sourceIds, []);
});

test("builds add-only queue", () => {
  const entries = [
    { term: "one", normalized: "one", enabled: true, status: "pending", stale: false },
    { term: "two", normalized: "two", enabled: true, status: "synced", stale: false },
    { term: "three", normalized: "three", enabled: false, status: "pending", stale: false }
  ];
  assert.deepEqual(buildSyncQueue(entries, ["TWO"]).map((entry) => entry.term), ["one"]);
});

test("automatic queue excludes low-confidence custom terms", () => {
  const entries = [
    { term: "broad", normalized: "broad", category: "custom", confidence: 0.45, enabled: true, status: "pending", stale: false },
    { term: "dm me", normalized: "dm me", category: "spam", confidence: 0.72, enabled: true, status: "pending", stale: false },
    { term: "reviewed", normalized: "reviewed", category: "custom", confidence: 1, categoryLocked: true, enabled: true, status: "pending", stale: false }
  ];
  assert.deepEqual(buildAutoSyncQueue(entries).map((entry) => entry.term), ["dm me", "reviewed"]);
});

test("creates least-privilege source origin patterns", () => {
  assert.equal(sourceOriginPattern("https://raw.githubusercontent.com/a/b/main/list.txt"), "https://raw.githubusercontent.com/*");
  assert.throws(() => sourceOriginPattern("file:///tmp/list.txt"));
  assert.throws(() => sourceOriginPattern("http://example.com/list.txt"), /HTTPS/);
  assert.throws(() => sourceOriginPattern("https://user:secret@example.com/list.txt"), /credentials/);
});
