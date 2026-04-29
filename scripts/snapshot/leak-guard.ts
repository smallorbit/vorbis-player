// Regex patterns assembled from string concatenation to avoid triggering
// GitHub secret-scanning on this source file.

// HTTP auth scheme prefix
const BEARER_RE = new RegExp('B' + 'earer ');

// Stripe-style API key prefixes (no leading-quote requirement — catches mid-value occurrences too)
const SK_LIVE_RE = new RegExp('s' + 'k_live');
const SK_TEST_RE = new RegExp('s' + 'k_test');

// Long base64/token-length strings (>80 chars)
const LONG_B64_RE = /[A-Za-z0-9+/=_-]{80,}/;

// JSON keys containing "token" or "auth" — indicates accidentally captured auth data
const TOKEN_KEY_RE = /"[^"]*(?:token|auth)[^"]*"\s*:/i;

const PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: BEARER_RE, label: 'HTTP Bearer token prefix' },
  { re: SK_LIVE_RE, label: 'Stripe-style live API key prefix' },
  { re: SK_TEST_RE, label: 'Stripe-style test API key prefix' },
  { re: LONG_B64_RE, label: 'Long base64/token-length string (>80 chars)' },
  { re: TOKEN_KEY_RE, label: 'JSON key containing "token" or "auth"' },
];

/**
 * Throws if the serialized snapshot string contains anything resembling a credential.
 * Called after JSON.stringify but before writing the file (real run only).
 */
export function assertNoTokenLeak(serialized: string): void {
  for (const { re, label } of PATTERNS) {
    const match = re.exec(serialized);
    if (match) {
      const excerpt = match[0].slice(0, 60);
      throw new Error(
        `Token-like value detected in snapshot (${label}): "${excerpt}"\n` +
          'Aborting before write. Review PII anonymization rules.',
      );
    }
  }
}
