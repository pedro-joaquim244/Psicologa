import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const MINUTE = 60_000;
const DEFAULT_MEMORY_MAX_ENTRIES = 10_000;
export const RATE_LIMIT_CODE = 'RATE_LIMIT';

const messages = {
  global: 'Muitas requisições. Aguarde um momento e tente novamente.',
  login: 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.',
  register: 'Muitos cadastros foram tentados. Aguarde alguns minutos e tente novamente.',
  verification: 'Muitas tentativas de verificação. Aguarde alguns minutos e tente novamente.',
  resend: 'Muitos pedidos de código. Aguarde alguns minutos e tente novamente.',
  booking: 'Muitas tentativas de agendamento. Aguarde alguns minutos e tente novamente.',
  write: 'Muitas alterações em pouco tempo. Aguarde um momento e tente novamente.',
};

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function duration(windowMs) {
  return `${Math.max(1, Math.ceil(windowMs / 1000))} s`;
}

function isProduction() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

function firstHeaderValue(value) {
  return typeof value === 'string' ? value.split(',')[0].trim() : '';
}

// Vercel overwrites this header with the public client IP. Outside Vercel, the
// value comes from Express only after an explicitly configured trusted proxy.
export function clientIp(req) {
  const vercelIp = process.env.VERCEL === '1' ? firstHeaderValue(req.get?.('x-vercel-forwarded-for')) : '';
  if (vercelIp) return vercelIp;
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function authenticatedUserKey(req) {
  const user = req.usuario;
  return user?.id && typeof user.tipo === 'string'
    ? `user:${user.tipo}:${user.id}`
    : `ip:${clientIp(req)}`;
}

export class MemoryRateLimitStore {
  constructor({ maxEntries = DEFAULT_MEMORY_MAX_ENTRIES, now = () => Date.now() } = {}) {
    this.maxEntries = positiveInteger(maxEntries, DEFAULT_MEMORY_MAX_ENTRIES);
    this.now = now;
    this.entries = new Map();
    this.nextCleanup = 0;
  }

  removeExpired(time) {
    if (time < this.nextCleanup) return;
    let nextReset = Infinity;
    for (const [entryKey, entry] of this.entries) {
      if (entry.reset <= time) this.entries.delete(entryKey);
      else nextReset = Math.min(nextReset, entry.reset);
    }
    this.nextCleanup = nextReset;
  }

  clear() {
    this.entries.clear();
    this.nextCleanup = 0;
  }

  async consume({ namespace, key, max, windowMs }) {
    const time = this.now();
    this.removeExpired(time);
    const entryKey = `${namespace}:${key}`;
    let entry = this.entries.get(entryKey);
    if (entry?.reset <= time) {
      this.entries.delete(entryKey);
      entry = undefined;
    }
    if (!entry) {
      if (this.entries.size >= this.maxEntries) {
        return { success: false, limit: max, remaining: 0, reset: Math.min(this.nextCleanup, time + MINUTE), reason: 'capacity' };
      }
      entry = { count: 0, reset: time + windowMs };
      this.entries.set(entryKey, entry);
      this.nextCleanup = Math.min(this.nextCleanup, entry.reset);
    }
    entry.count += 1;
    return {
      success: entry.count <= max,
      limit: max,
      remaining: Math.max(0, max - entry.count),
      reset: entry.reset,
    };
  }
}

export class UpstashRateLimitStore {
  constructor({ url, token, prefix = 'psicologa:rate-limit' }) {
    this.redis = new Redis({ url, token });
    this.prefix = prefix;
    this.limiters = new Map();
  }

  limiter(namespace, max, windowMs) {
    const limiterKey = `${namespace}:${max}:${windowMs}`;
    if (!this.limiters.has(limiterKey)) {
      this.limiters.set(limiterKey, new Ratelimit({
        redis: this.redis,
        limiter: Ratelimit.slidingWindow(max, duration(windowMs)),
        prefix: `${this.prefix}:${namespace}`,
        analytics: false,
        timeout: 1_000,
      }));
    }
    return this.limiters.get(limiterKey);
  }

  async consume({ namespace, key, max, windowMs }) {
    const result = await this.limiter(namespace, max, windowMs).limit(key);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      reason: result.reason,
    };
  }
}

export function createRateLimitStore({
  mode = process.env.RATE_LIMIT_STORE || 'auto',
  url = process.env.UPSTASH_REDIS_REST_URL,
  token = process.env.UPSTASH_REDIS_REST_TOKEN,
  prefix = process.env.RATE_LIMIT_PREFIX || 'psicologa:rate-limit',
  maxEntries = positiveInteger(process.env.RATE_LIMIT_MEMORY_MAX_ENTRIES, DEFAULT_MEMORY_MAX_ENTRIES),
  now,
} = {}) {
  const normalizedMode = String(mode).toLowerCase();
  if (!['auto', 'memory', 'upstash'].includes(normalizedMode)) throw new Error('RATE_LIMIT_STORE deve ser auto, memory ou upstash.');
  const hasCredentials = Boolean(url && token);
  if (normalizedMode === 'upstash' && !hasCredentials) {
    throw new Error('RATE_LIMIT_STORE=upstash exige UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN.');
  }
  if (normalizedMode === 'upstash' || (normalizedMode === 'auto' && hasCredentials)) {
    return new UpstashRateLimitStore({ url, token, prefix });
  }
  if (isProduction() && normalizedMode !== 'memory') {
    console.warn('Rate limiting usa memória local nesta instância. Configure Upstash Redis para proteção compartilhada na Vercel.');
  }
  return new MemoryRateLimitStore({ maxEntries, now });
}

export const rateLimitPolicies = Object.freeze({
  global: { max: positiveInteger(process.env.RATE_LIMIT_GLOBAL_MAX, 180), windowMs: positiveInteger(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS, MINUTE), message: messages.global },
  login: { max: positiveInteger(process.env.RATE_LIMIT_LOGIN_MAX, 10), windowMs: positiveInteger(process.env.RATE_LIMIT_LOGIN_WINDOW_MS, 15 * MINUTE), message: messages.login },
  register: { max: positiveInteger(process.env.RATE_LIMIT_REGISTER_MAX, 5), windowMs: positiveInteger(process.env.RATE_LIMIT_REGISTER_WINDOW_MS, 30 * MINUTE), message: messages.register },
  verification: { max: positiveInteger(process.env.RATE_LIMIT_VERIFICATION_MAX, 10), windowMs: positiveInteger(process.env.RATE_LIMIT_VERIFICATION_WINDOW_MS, 15 * MINUTE), message: messages.verification },
  resend: { max: positiveInteger(process.env.RATE_LIMIT_RESEND_MAX, 5), windowMs: positiveInteger(process.env.RATE_LIMIT_RESEND_WINDOW_MS, 15 * MINUTE), message: messages.resend },
  booking: { max: positiveInteger(process.env.RATE_LIMIT_BOOKING_MAX, 20), windowMs: positiveInteger(process.env.RATE_LIMIT_BOOKING_WINDOW_MS, 10 * MINUTE), message: messages.booking },
  write: { max: positiveInteger(process.env.RATE_LIMIT_WRITE_MAX, 60), windowMs: positiveInteger(process.env.RATE_LIMIT_WRITE_WINDOW_MS, MINUTE), message: messages.write },
});

const recentLogs = new Map();
function shouldLog(event) {
  const now = Date.now();
  if (recentLogs.get(event) > now - MINUTE) return false;
  if (recentLogs.size >= 1_000) recentLogs.delete(recentLogs.keys().next().value);
  recentLogs.set(event, now);
  return true;
}

function logExceeded(policy, req) {
  if (process.env.RATE_LIMIT_LOGS === 'false') return;
  const event = `${policy.name}:${req.baseUrl}${req.path}`;
  if (!shouldLog(event)) return;
  const now = Date.now();
  console.warn('Rate limit atingido', { limiter: policy.name, rota: `${req.baseUrl}${req.path}`, timestamp: new Date(now).toISOString() });
}

function logStoreFailure(policy, error) {
  const event = `store:${policy.name}:${error?.name || 'unknown'}`;
  if (!shouldLog(event)) return;
  console.error('Rate limit store unavailable:', error?.name || 'unknown error');
}

function applyHeaders(res, result, now, windowMs) {
  const resetSeconds = Math.max(0, Math.ceil((Number(result.reset) - now) / 1000));
  res.set('RateLimit-Limit', String(result.limit));
  res.set('RateLimit-Remaining', String(Math.max(0, result.remaining)));
  res.set('RateLimit-Reset', String(resetSeconds));
  res.set('RateLimit-Policy', `${result.limit};w=${Math.max(1, Math.ceil(windowMs / 1000))}`);
  return resetSeconds;
}

export function createRateLimiter({
  name = 'custom',
  max = undefined,
  maxAttempts = undefined,
  windowMs = 15 * MINUTE,
  message = messages.global,
  key = clientIp,
  store = undefined,
  maxEntries = DEFAULT_MEMORY_MAX_ENTRIES,
  now = () => Date.now(),
  skip = (req) => req.method === 'OPTIONS',
} = {}) {
  const limit = positiveInteger(max ?? maxAttempts, 30);
  const policy = { name, max: limit, windowMs: positiveInteger(windowMs, 15 * MINUTE), message };
  const resolvedStore = store || new MemoryRateLimitStore({ maxEntries, now });
  return async function rateLimit(req, res, next) {
    if (skip(req)) return next();
    try {
      const result = await resolvedStore.consume({ namespace: policy.name, key: String(key(req) || 'unknown'), max: policy.max, windowMs: policy.windowMs });
      const retryAfter = applyHeaders(res, result, now(), policy.windowMs);
      if (result.success) return next();
      logExceeded(policy, req);
      res.set('Retry-After', String(Math.max(1, retryAfter)));
      return res.status(429).json({ erro: policy.message, codigo: RATE_LIMIT_CODE });
    } catch (error) {
      // Availability takes precedence if the optional remote store is briefly
      // unavailable. This never changes application errors into a 429 or 500.
      logStoreFailure(policy, error);
      return next();
    }
  };
}

const defaultStore = createRateLimitStore();
const withPolicy = (name, options = {}) => createRateLimiter({ name, ...rateLimitPolicies[name], store: defaultStore, ...options });

export const globalApiLimiter = withPolicy('global');
export const loginLimiter = withPolicy('login');
export const registerLimiter = withPolicy('register');
export const verificationLimiter = withPolicy('verification');
export const resendLimiter = withPolicy('resend');
export const bookingLimiter = withPolicy('booking', { key: authenticatedUserKey });
export const writeLimiter = withPolicy('write', { key: authenticatedUserKey });

// The application never invokes this helper. It keeps isolated Node test cases
// from accidentally sharing the in-process development fallback state.
export function resetRateLimitStoreForTests() {
  if (defaultStore instanceof MemoryRateLimitStore) defaultStore.clear();
}

// Compatibility export for the existing authentication routes while all rate
// limiting remains in this single, shared module.
export const limitAuth = loginLimiter;
