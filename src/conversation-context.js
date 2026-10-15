export function getConversationKey(message) {
  return `${message.guildId ?? "dm"}:${message.channelId}`;
}

export class ChannelConversationManager {
  constructor({ timeoutMs, now = Date.now }) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error("timeoutMs must be a positive number.");
    }
    this.timeoutMs = timeoutMs;
    this.now = now;
    this.conversations = new Map();
    this.queues = new Map();
  }

  getConversation(conversationKey) {
    const conversation = this.conversations.get(conversationKey);
    if (!conversation) return undefined;
    if (this.now() - conversation.lastUsedAt > this.timeoutMs) {
      this.conversations.delete(conversationKey);
      return undefined;
    }
    return conversation;
  }

  getContinuationId(conversationKey) {
    return this.getConversation(conversationKey)?.continuationId;
  }

  getHistory(conversationKey) {
    return (this.getConversation(conversationKey)?.history ?? []).map((message) => ({ ...message }));
  }

  appendExchange(conversationKey, username, prompt, text) {
    const history = [...this.getHistory(conversationKey),
      { role: "user", content: `${username}: ${prompt}` },
      { role: "assistant", content: text },
    ].slice(-12);
    this.conversations.set(conversationKey, { history, lastUsedAt: this.now() });
  }

  setContinuationId(conversationKey, continuationId) {
    this.conversations.set(conversationKey, { continuationId, lastUsedAt: this.now() });
  }

  reset(conversationKey) {
    this.conversations.delete(conversationKey);
  }

  runInOrder(conversationKey, task) {
    const previousTask = this.queues.get(conversationKey) ?? Promise.resolve();
    const currentTask = previousTask.catch(() => {}).then(task);
    this.queues.set(conversationKey, currentTask);
    return currentTask.finally(() => {
      if (this.queues.get(conversationKey) === currentTask) {
        this.queues.delete(conversationKey);
      }
    });
  }
}
