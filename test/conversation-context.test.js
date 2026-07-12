import assert from "node:assert/strict";
import test from "node:test";
import { ChannelConversationManager, getConversationKey } from "../src/conversation-context.js";

test("conversation keys are shared by users in the same channel", () => {
  const firstUser = { guildId: "guild-1", channelId: "channel-1", author: { id: "user-1" } };
  const secondUser = { guildId: "guild-1", channelId: "channel-1", author: { id: "user-2" } };
  assert.equal(getConversationKey(firstUser), getConversationKey(secondUser));
});

test("different channels, DMs, and threads have separate conversation keys", () => {
  assert.notEqual(getConversationKey({ guildId: "guild-1", channelId: "channel-1" }), getConversationKey({ guildId: "guild-1", channelId: "channel-2" }));
  assert.notEqual(getConversationKey({ guildId: null, channelId: "dm-1" }), getConversationKey({ guildId: null, channelId: "dm-2" }));
  assert.notEqual(getConversationKey({ guildId: "guild-1", channelId: "channel-1" }), getConversationKey({ guildId: "guild-1", channelId: "thread-1" }));
});

test("conversation state expires and can be reset for the whole channel", () => {
  let now = 1_000;
  const manager = new ChannelConversationManager({ timeoutMs: 60_000, now: () => now });
  manager.setResponseId("guild-1:channel-1", "response-1");
  assert.equal(manager.getPreviousResponseId("guild-1:channel-1"), "response-1");
  manager.reset("guild-1:channel-1");
  assert.equal(manager.getPreviousResponseId("guild-1:channel-1"), undefined);
  manager.setResponseId("guild-1:channel-1", "response-2");
  now += 60_001;
  assert.equal(manager.getPreviousResponseId("guild-1:channel-1"), undefined);
});

test("tasks are serialized per channel while different channels run independently", async () => {
  const manager = new ChannelConversationManager({ timeoutMs: 60_000 });
  const events = [];
  let releaseFirstTask;
  const firstTaskGate = new Promise((resolve) => { releaseFirstTask = resolve; });
  const firstTask = manager.runInOrder("guild-1:channel-1", async () => {
    events.push("first:start");
    await firstTaskGate;
    events.push("first:end");
  });
  const secondTask = manager.runInOrder("guild-1:channel-1", async () => { events.push("second"); });
  const otherChannelTask = manager.runInOrder("guild-1:channel-2", async () => { events.push("other-channel"); });
  await otherChannelTask;
  assert.deepEqual(events, ["first:start", "other-channel"]);
  releaseFirstTask();
  await Promise.all([firstTask, secondTask]);
  assert.deepEqual(events, ["first:start", "other-channel", "first:end", "second"]);
});
