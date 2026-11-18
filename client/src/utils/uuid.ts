/**
 * Safe UUID v4 generator that works across all contexts, including non-secure HTTP.
 *
 * Browsers restrict `crypto.randomUUID()` to Secure Contexts (HTTPS / localhost).
 * Over plain HTTP (e.g. staging or demo IP/domain), `crypto.randomUUID` is undefined.
 *
 * 1. Uses `crypto.randomUUID()` if available (native & fastest).
 * 2. Uses `crypto.getRandomValues()` if available (cryptographically secure v4 UUID).
 * 3. Falls back to Math.random() + performance.now() / Date.now() RFC4122 v4 generator.
 */
export function safeRandomUUID(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      // Set version 4 (0100xxxx) and variant (10xxxxxx) per RFC 4122
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }

  // Fallback RFC4122 compliant pseudo-random UUID
  let d = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
