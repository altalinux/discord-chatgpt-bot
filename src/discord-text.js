const MAX_DISCORD_MESSAGE_LENGTH = 2000;

export function splitForDiscord(text) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > MAX_DISCORD_MESSAGE_LENGTH) {
    const slice = remaining.slice(0, MAX_DISCORD_MESSAGE_LENGTH);
    const splitAt = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(" "));
    const chunkEnd = splitAt > 1000 ? splitAt : MAX_DISCORD_MESSAGE_LENGTH;

    chunks.push(remaining.slice(0, chunkEnd).trim());
    remaining = remaining.slice(chunkEnd).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}
