const SUPPORTED_REASONING_EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"];
const supportedReasoningEfforts = new Set(SUPPORTED_REASONING_EFFORTS);

export function parseReasoningEffort(value) {
  if (value === undefined || value === null || value.trim() === "") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (!supportedReasoningEfforts.has(normalized)) {
    throw new Error(
      `OPENAI_REASONING_EFFORT must be one of: ${SUPPORTED_REASONING_EFFORTS.join(", ")}.`,
    );
  }

  return normalized;
}
