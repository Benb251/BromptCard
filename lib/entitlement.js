// All analysis modes are free and unlimited.

export const FREE_DAILY_LIMIT = Infinity;

// Kept for callers that still branch on "metered" modes.
export const FREE_MODES = new Set(["analyze", "style"]);

export function isMetered(_mode) {
  return false;
}

export async function isPro() {
  return true;
}

export async function setPro(_value) {
  /* no-op — paywall removed */
}

export async function getQuota() {
  return {
    pro: true,
    limit: Infinity,
    used: 0,
    remaining: Infinity
  };
}

export class QuotaError extends Error {
  constructor(message, quota) {
    super(message);
    this.name = "QuotaError";
    this.code = "QUOTA_EXCEEDED";
    this.quota = quota;
  }
}

export async function ensureAllowed(_mode) {
  return { metered: false };
}

export async function consume(_mode) {
  /* no-op */
}
