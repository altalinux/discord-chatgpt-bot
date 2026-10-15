import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { RequestLimiter } from "./request-limiter.js";

const OPENAI_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const GEMINI_IMAGE_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class SearchLimitError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "SearchLimitError";
  }
}

export function createAiProvider(config) {
  if (config.aiProvider === "sarashina") {
    return new SarashinaProvider({ apiKey: config.sarashinaApiKey, model: config.sarashinaModel });
  }
  if (config.aiProvider === "gemini") {
    return new GeminiProvider({
      apiKey: config.geminiApiKey,
      model: config.geminiModel,
      thinkingLevel: config.geminiThinkingLevel,
      googleSearchEnabled: config.geminiGoogleSearchEnabled,
    });
  }

  return new OpenAIProvider({
    apiKey: config.openaiApiKey,
    model: config.openaiModel,
    reasoningEffort: config.openaiReasoningEffort,
  });
}

export class OpenAIProvider {
  constructor({ apiKey, model, reasoningEffort, client }) {
    this.name = "openai";
    this.model = model;
    this.reasoningEffort = reasoningEffort;
    this.googleSearchEnabled = true;
    this.supportedImageContentTypes = OPENAI_IMAGE_CONTENT_TYPES;
    this.client = client || new OpenAI({ apiKey });
  }

  async generate({ systemPrompt, username, prompt, images, continuationId, useWebSearch }) {
    const request = {
      model: this.model,
      instructions: systemPrompt,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: `${username}: ${defaultPrompt(prompt, images)}` },
            ...images.map((image) => ({
              type: "input_image",
              image_url: image.url,
              detail: "auto",
            })),
          ],
        },
      ],
      ...(continuationId && { previous_response_id: continuationId }),
      ...(this.reasoningEffort && { reasoning: { effort: this.reasoningEffort } }),
      ...(useWebSearch && {
        tools: [{ type: "web_search", search_context_size: "medium" }],
        tool_choice: "auto",
      }),
    };

    const response = await this.client.responses.create(request);
    return {
      text: response.output_text?.trim(),
      continuationId: response.id,
    };
  }
}

export class GeminiProvider {
  constructor({ apiKey, model, thinkingLevel, googleSearchEnabled, client }) {
    this.name = "gemini";
    this.model = model;
    this.thinkingLevel = thinkingLevel;
    this.googleSearchEnabled = googleSearchEnabled;
    this.supportedImageContentTypes = GEMINI_IMAGE_CONTENT_TYPES;
    this.client = client || new GoogleGenAI({ apiKey });
  }

  async generate({ systemPrompt, username, prompt, images, continuationId, useWebSearch }) {
    const request = {
      model: this.model,
      system_instruction: systemPrompt,
      input: [
        { type: "text", text: `${username}: ${defaultPrompt(prompt, images)}` },
        ...images.map((image) => ({
          type: "image",
          uri: image.url,
          mime_type: image.contentType,
        })),
      ],
      ...(continuationId && { previous_interaction_id: continuationId }),
      ...(this.thinkingLevel && {
        generation_config: { thinking_level: this.thinkingLevel },
      }),
      ...(useWebSearch && { tools: [{ type: "google_search" }] }),
    };

    try {
      const interaction = await this.client.interactions.create(request);
      return {
        text: formatGeminiOutput(interaction),
        continuationId: interaction.id,
      };
    } catch (error) {
      if (useWebSearch && isLimitError(error)) {
        throw new SearchLimitError("Gemini web search is temporarily unavailable.", { cause: error });
      }
      throw error;
    }
  }
}

function defaultPrompt(prompt, images) {
  if (prompt) return prompt;
  return images.length > 0 ? "Please describe the attached image." : "";
}

function isLimitError(error) {
  return (
    error?.status === 429 ||
    error?.code === 429 ||
    /quota|resource.?exhausted|rate.?limit/i.test(error?.message || "")
  );
}

export function formatGeminiOutput(interaction) {
  const textBlocks = (interaction.steps || [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content || [])
    .filter((content) => content.type === "text");

  if (textBlocks.length === 0) {
    return interaction.output_text?.trim();
  }

  return textBlocks.map(formatGeminiTextBlock).join("\n").trim();
}

function formatGeminiTextBlock(block) {
  let text = block.text || "";
  const seen = new Set();
  const citations = (block.annotations || [])
    .filter((annotation) => annotation.type === "url_citation" && annotation.url)
    .map((annotation) => ({
      endIndex:
        annotation.endIndex ?? utf8ByteOffsetToStringIndex(text, annotation.end_index),
      title: annotation.title || annotation.url,
      url: annotation.url,
    }))
    .filter(({ endIndex, url }) => {
      if (!Number.isInteger(endIndex) || endIndex < 0 || endIndex > text.length) return false;
      const key = `${endIndex}:${url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.endIndex - a.endIndex);

  for (const citation of citations) {
    const label = citation.title.replaceAll("[", "\\[").replaceAll("]", "\\]");
    const markdown = ` [${label}](${citation.url})`;
    text = `${text.slice(0, citation.endIndex)}${markdown}${text.slice(citation.endIndex)}`;
  }

  return text;
}

function utf8ByteOffsetToStringIndex(text, byteOffset) {
  if (!Number.isInteger(byteOffset) || byteOffset < 0) return undefined;

  let bytes = 0;
  let stringIndex = 0;
  for (const character of text) {
    if (bytes >= byteOffset) break;
    bytes += Buffer.byteLength(character, "utf8");
    stringIndex += character.length;
  }

  return bytes === byteOffset ? stringIndex : undefined;
}


export class SarashinaProvider {
  constructor({ apiKey, model, client, limiter = new RequestLimiter() }) {
    this.name = "sarashina";
    this.model = model;
    this.supportedImageContentTypes = new Set();
    this.limiter = limiter;
    this.client = client || new OpenAI({
      apiKey,
      baseURL: "https://api.sarashina.ai/v1",
      maxRetries: 0,
      timeout: 60_000,
    });
  }

  async generate({ systemPrompt, username, prompt, history = [] }) {
    this.limiter.acquire();
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: `${systemPrompt}\n通常は日本語で1〜3文の短い返答にしてください。詳しく求められた場合は必要に応じて説明してください。ウェブ検索や画像の閲覧はできません。最新情報を確認したふりをせず、不明なことは不明と伝えてください。` },
          ...history,
          { role: "user", content: `${username}: ${prompt}` },
        ],
        max_completion_tokens: 512,
        temperature: 0.7,
      });
      const text = response.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("Sarashina returned an empty answer.");
      return { text };
    } catch (error) {
      if (error?.status === 429) this.limiter.block();
      throw error;
    }
  }
}
