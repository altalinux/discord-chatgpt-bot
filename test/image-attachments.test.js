import assert from "node:assert/strict";
import test from "node:test";

import { validateImageAttachments } from "../src/image-attachments.js";

const gif = { contentType: "image/gif", size: 100 };

test("allows GIF for OpenAI but rejects it for Gemini", () => {
  const openai = {
    name: "openai",
    supportedImageContentTypes: new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  };
  const gemini = {
    name: "gemini",
    supportedImageContentTypes: new Set(["image/jpeg", "image/png", "image/webp"]),
  };

  assert.equal(validateImageAttachments([gif], openai), null);
  assert.match(validateImageAttachments([gif], gemini), /Gemini does not support GIF/);
  assert.match(
    validateImageAttachments([{ name: "animation.gif", contentType: null, size: 100 }], gemini),
    /Gemini does not support GIF/,
  );
});

test("rejects too many and oversized images", () => {
  const provider = { name: "gemini", supportedImageContentTypes: new Set(["image/png"]) };
  const image = { contentType: "image/png", size: 100 };
  assert.match(validateImageAttachments(Array(5).fill(image), provider), /up to 4 images/);
  assert.match(
    validateImageAttachments([{ ...image, size: 20 * 1024 * 1024 + 1 }], provider),
    /20 MB or smaller/,
  );
});
