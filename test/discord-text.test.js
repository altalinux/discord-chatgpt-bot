import assert from "node:assert/strict";
import test from "node:test";

import { splitForDiscord } from "../src/discord-text.js";

test("splits citation-expanded output within Discord's message limit", () => {
  const text = `${"a".repeat(1990)} [Source](https://example.com) ${"b".repeat(100)}`;
  const chunks = splitForDiscord(text);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 2000));
  assert.equal(chunks.join(" ").replaceAll(" ", ""), text.replaceAll(" ", ""));
});
