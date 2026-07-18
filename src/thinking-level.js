const SUPPORTED_THINKING_LEVELS = ["minimal", "low", "medium", "high"];
const supportedThinkingLevels = new Set(SUPPORTED_THINKING_LEVELS);

export function parseThinkingLevel(value) {
  if (value === undefined || value === null || value.trim() === "") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (!supportedThinkingLevels.has(normalized)) {
    throw new Error(
      `GEMINI_THINKING_LEVEL must be one of: ${SUPPORTED_THINKING_LEVELS.join(", ")}.`,
    );
  }

  return normalized;
}
