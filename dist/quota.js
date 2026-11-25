/** Balance, plan windows and reset times for a Command Code account. */

const DEFAULT_BASE = "https://api.commandcode.ai";
const ENV_KEYS = ["COMMAND_CODE_API_KEY", "COMMANDCODE_API_KEY"];
const KEY_TTL_MS = 60_000;
const TIMEOUT_MS = 8_000;

// The CLI reports the monthly pool as a fixed figure per plan, so the used
// share of the pool can only be derived when the plan is known.
const PLAN_CREDITS = {
  "individual-go": 10,
  "individual-go-v1": 10,
  "individual-goat": 70,
  "individual-pro": 30,
  "individual-pro-v1": 80,
  "individual-provider": 15,
  "individual-max": 150,
  "individual-ultra": 300,
  "teams-pro": 40
};
const PLAN_NAMES = {
  "individual-go": "Go",
  "individual-go-v1": "Go",
  "individual-goat": "GOAT",
  "individual-pro": "Pro",
  "individual-pro-v1": "Pro",
  "individual-provider": "Provider",
  "individual-max": "Max",
  "individual-ultra": "Ultra",
  "teams-pro": "Teams Pro"
};
const PLAN_KEYS = Object.keys(PLAN_CREDITS).sort((a, b) => b.length - a.length);
let cachedKey;
function baseUrl() {
  const custom = process.env.COMMANDCODE_API_URL?.trim();
  return (custom || DEFAULT_BASE).replace(/\/+$/, "");
}
function resolvePlan(planId) {
  if (!planId) return null;
  const id = planId.toLowerCase().replace(/_/g, "-");
  const key = PLAN_KEYS.find(candidate => id.startsWith(candidate));
  if (!key) return null;
  return {
    name: PLAN_NAMES[key] ?? key,
    credits: PLAN_CREDITS[key] ?? 0
  };
}
function positive(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
function windowMeter(raw) {
  if (!raw) return null;
  const cap = positive(raw.cap);
  if (cap <= 0) return null;
  const used = Math.max(0, typeof raw.used === "number" ? raw.used : 0);
  return {
    used,
    cap,
    percent: Math.min(100, used / cap * 100),
    limited: raw.exceeded === true,
    resetsAt: typeof raw.resetAt === "number" ? raw.resetAt : 0
  };
}

/** Reads the CLI credential: the environment first, then `~/.commandcode/auth.json`. */
export async function readApiKey() {
  if (cachedKey && Date.now() - cachedKey.at < KEY_TTL_MS) return cachedKey.value;
  for (const name of ENV_KEYS) {
    const value = process.env[name]?.trim();
    if (value) {
      cachedKey = {
        value,
        at: Date.now()
      };
      return value;
    }
  }
  try {
    const {
      readFile
    } = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");
    const raw = await readFile(path.join(os.homedir(), ".commandcode", "auth.json"), "utf8");
    const parsed = JSON.parse(raw);
    const key = typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "";
    if (key) {
      cachedKey = {
        value: key,
        at: Date.now()
      };
      return key;
    }
  } catch {
    // no CLI credential on this machine
  }
  return undefined;
}
async function getJson(endpoint, key) {
  try {
    const response = await fetch(`${baseUrl()}${endpoint}`, {
      headers: {
        authorization: `Bearer ${key}`,
        accept: "application/json"
      },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!response.ok) return undefined;
    return await response.json();
  } catch {
    return undefined;
  }
}

/** Fetches the credit balance and rolling windows, or undefined when unauthenticated. */
export async function fetchQuota() {
  const key = await readApiKey();
  if (!key) return undefined;
  const [credits, subscription] = await Promise.all([getJson("/alpha/billing/credits", key), getJson("/alpha/billing/subscriptions", key)]);
  const balance = credits?.credits;
  if (!balance) return undefined;
  const monthly = Math.max(0, balance.monthlyCredits ?? 0);
  const purchased = Math.max(0, balance.purchasedCredits ?? 0);
  const free = Math.max(0, balance.freeCredits ?? 0);
  const remaining = monthly + purchased + free;
  const plan = resolvePlan(subscription?.data?.planId);
  const total = Math.max(plan?.credits ?? 0, monthly) + purchased + free;
  const used = Math.max(0, total - remaining);
  const periodEnd = subscription?.data?.currentPeriodEnd ? Date.parse(subscription.data.currentPeriodEnd) : 0;
  return {
    plan: plan?.name ?? null,
    fiveHour: windowMeter(credits?.windowLimits?.fiveHour),
    weekly: windowMeter(credits?.windowLimits?.weekly),
    monthly: {
      used,
      cap: total,
      percent: total > 0 ? Math.min(100, used / total * 100) : 0,
      limited: false,
      resetsAt: Number.isFinite(periodEnd) ? periodEnd : 0
    },
    remaining: {
      monthly,
      purchased,
      free
    },
    fetchedAt: Date.now()
  };
}