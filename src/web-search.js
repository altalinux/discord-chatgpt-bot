const WEB_SEARCH_KEYWORDS = ["最新", "ニュース", "調べて", "検索", "現在", "今日", "価格", "天気", "公式"];

export function getWebSearchDecision({ prompt, webSearchEnabled, provider }) {
  if (provider.name === "sarashina") return "disabled";

  if (!webSearchEnabled || !WEB_SEARCH_KEYWORDS.some((keyword) => prompt.includes(keyword))) {
    return "disabled";
  }

  if (provider.name === "gemini" && !provider.googleSearchEnabled) {
    return "unavailable";
  }

  return "enabled";
}
