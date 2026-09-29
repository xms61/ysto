// The player's IP for rate limits (docs/SECURITY.md#transport), for HTTP requests and socket upgrades alike.
// Behind YSTO_TRUST_PROXY proxies, X-Forwarded-For holds it; each trusted proxy appended the address it saw,
// so the client is that many entries from the end. With no proxy trusted, the header is ignored, since
// anyone can send it.
export function clientIp(
  remoteAddress: string | undefined,
  forwardedFor: string | string[] | undefined,
  trustedHops: number,
): string {
  const direct = remoteAddress ?? 'unknown';
  if (trustedHops === 0 || forwardedFor === undefined) return direct;
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
  const chain = header
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
  // The direct peer is the nearest proxy; the entries before it came from the proxies further out.
  return chain[chain.length - trustedHops] ?? chain[0] ?? direct;
}
