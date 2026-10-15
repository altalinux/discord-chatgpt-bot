export class RateLimitError extends Error {
  constructor(waitSeconds) {
    super(`ちょっと待ってね。あと${waitSeconds}秒くらいでまた話せるよ。`);
    this.name = "RateLimitError";
    this.waitSeconds = waitSeconds;
  }
}

// One instance per provider, shared across all Discord channels.
export class RequestLimiter {
  constructor({ now = Date.now } = {}) {
    this.now = now;
    this.sentAt = [];
    this.blockedUntil = 0;
  }

  acquire() {
    const now = this.now();
    this.sentAt = this.sentAt.filter((time) => now - time < 60_000);
    const availableAt = Math.max(
      this.blockedUntil,
      this.sentAt.length >= 6 ? this.sentAt[0] + 60_000 : 0,
    );
    if (availableAt > now) throw new RateLimitError(Math.ceil((availableAt - now) / 1000));
    this.sentAt.push(now);
  }

  block() {
    this.blockedUntil = this.now() + 60_000;
  }
}
