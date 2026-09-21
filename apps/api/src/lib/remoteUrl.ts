import dns from 'dns/promises';
import net from 'net';

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8')) {
    return true;
  }

  if (net.isIP(normalized) !== 4) return false;
  const octets = normalized.split('.').map(Number);
  const [first = 0, second = 0] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

export async function assertSafeRemoteMediaUrl(value: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Media URL is invalid');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Media URL must be an HTTP(S) URL without embedded credentials');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Private media hosts are not allowed');
  }

  if (isPrivateAddress(hostname)) {
    throw new Error('Private media addresses are not allowed');
  }

  const addresses = await dns.lookup(hostname, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Media URL resolves to a private address');
  }

  return parsed;
}

export async function fetchSafeRemoteMedia(
  value: string,
  init: RequestInit = {},
  maxRedirects = 5
): Promise<Response> {
  let currentUrl = (await assertSafeRemoteMediaUrl(value)).toString();

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetch(currentUrl, { ...init, redirect: 'manual' });
    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get('location');
    if (!location) return response;
    currentUrl = (await assertSafeRemoteMediaUrl(new URL(location, currentUrl).toString())).toString();
  }

  throw new Error('Too many redirects while fetching media');
}