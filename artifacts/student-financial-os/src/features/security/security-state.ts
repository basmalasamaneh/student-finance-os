/** Device-only preferences; never an authentication or authorization boundary. */
export const PIN_ITERATIONS = 210_000;
export const ATTEMPT_LIMIT = 5;
export const COOLDOWN_MS = 60_000;
export type IdleMinutes = 0 | 1 | 5 | 15;
export type PinHash = { salt: string; hash: string; iterations: number };
export type SecurityState = {
  version: 1;
  hideBalances: boolean;
  thresholdMinor: number;
  pin: PinHash | null;
  idleMinutes: IdleMinutes;
  attempts: number;
  cooldownUntil: number;
};

export function defaultSecurityState(): SecurityState {
  return { version: 1, hideBalances: false, thresholdMinor: 20_000, pin: null, idleMinutes: 5, attempts: 0, cooldownUntil: 0 };
}

export function securityKey(accountId: string) {
  if (!accountId) throw new Error('A verified account is required');
  return `sfos.deviceSecurity.v1.${accountId}`;
}

/** Earlier Home builds stored "1"; later builds stored JSON booleans. */
export function legacyHideBalances(raw: string | null): boolean {
  return raw === '1' || raw === 'true';
}

/** Browser scroll events can also come from code: require a recent real gesture. */
export function isUserIdleActivity(event: { type: string; isTrusted: boolean; buttons?: number }, now: number, lastGesture: number): boolean {
  if (!event.isTrusted) return false;
  if (event.type === 'scroll') return now - lastGesture >= 0 && now - lastGesture <= 2_000;
  if (event.type === 'pointermove') return (event.buttons ?? 0) > 0;
  return ['pointerdown', 'keydown', 'wheel', 'touchmove'].includes(event.type);
}

/** Reject damaged records rather than silently removing an existing lock. */
export function decodeSecurityState(raw: string | null): SecurityState {
  if (raw === null) return defaultSecurityState();
  const v = JSON.parse(raw) as SecurityState;
  if (!v || v.version !== 1 || typeof v.hideBalances !== 'boolean'
    || !Number.isSafeInteger(v.thresholdMinor) || v.thresholdMinor < 0
    || ![0, 1, 5, 15].includes(v.idleMinutes)
    || !Number.isSafeInteger(v.attempts) || v.attempts < 0 || v.attempts > ATTEMPT_LIMIT
    || !Number.isSafeInteger(v.cooldownUntil) || v.cooldownUntil < 0
    || (v.pin !== null && (!v.pin || !/^[a-f0-9]{32}$/.test(v.pin.salt)
      || !/^[a-f0-9]{64}$/.test(v.pin.hash) || v.pin.iterations !== PIN_ITERATIONS))) {
    throw new Error('Invalid device security preferences');
  }
  return { version: 1, hideBalances: v.hideBalances, thresholdMinor: v.thresholdMinor, pin: v.pin, idleMinutes: v.idleMinutes, attempts: v.attempts, cooldownUntil: v.cooldownUntil };
}

export function remainingCooldown(state: SecurityState, now: number): number {
  return Math.max(0, Math.ceil((state.cooldownUntil - now) / 1000));
}

/** Reserve the attempt BEFORE hashing so reloading mid-check cannot skip the counter. */
export function reserveAttempt(state: SecurityState, now: number): SecurityState {
  if (remainingCooldown(state, now)) throw new Error('cooldown');
  const attempts = (state.cooldownUntil > 0 ? 0 : state.attempts) + 1;
  return { ...state, attempts, cooldownUntil: attempts >= ATTEMPT_LIMIT ? now + COOLDOWN_MS : 0 };
}

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (value: string) => new Uint8Array(value.match(/.{2}/g)!.map((pair) => parseInt(pair, 16)));
export function normalizePin(value: string): string {
  return value.replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => String((digit.charCodeAt(0) & 15) % 10));
}
export function validPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto unavailable');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return hex(new Uint8Array(bits));
}
export async function hashPin(pin: string): Promise<PinHash> {
  if (!validPin(pin)) throw new Error('Invalid PIN');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: hex(salt), hash: await derive(pin, salt, PIN_ITERATIONS), iterations: PIN_ITERATIONS };
}
export async function verifyPin(pin: string, record: PinHash): Promise<boolean> {
  if (!validPin(pin)) return false;
  const actual = await derive(pin, unhex(record.salt), record.iterations);
  let different = 0;
  for (let i = 0; i < actual.length; i++) different |= actual.charCodeAt(i) ^ record.hash.charCodeAt(i);
  return different === 0;
}

/** Exact local preference parsing, not a financial calculation or FX conversion. */
export function parseThreshold(raw: string): number | null {
  const value = normalizePin(raw).replace(/\u066b/g, '.').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return minor <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(minor) : null;
}
export function thresholdText(minor: number): string {
  const value = BigInt(minor);
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}