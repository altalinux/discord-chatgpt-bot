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

  getPreviousResponseId(conversationKey) {
    const conversation = this.conversations.get(conversationKey);
    if (!conversation) return undefined;
    if (this.now() - conversation.lastUsedAt > this.timeoutMs) {
      this.conversations.delete(conversationKey);
      return undefined;
    }
    return conversation.responseId;
  }

  setResponseId(conversationKey, responseId) {
    this.conversations.set(conversationKey, { responseId, lastUsedAt: this.now() });
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
