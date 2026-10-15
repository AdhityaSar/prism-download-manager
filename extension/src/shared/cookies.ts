export interface CookieLike {
  name: string;
  value: string;
  path?: string;
}

/**
 * Builds a `Cookie` request header from cookies already filtered for a URL
 * (`cookies.getAll({url})`). Longer paths first (RFC 6265 §5.4), otherwise
 * stable order; nameless cookies are sent as their bare value.
 */
export function buildCookieHeader(cookies: CookieLike[]): string {
  return cookies
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (b.c.path?.length ?? 0) - (a.c.path?.length ?? 0) || a.i - b.i)
    .map(({ c }) => (c.name ? `${c.name}=${c.value}` : c.value))
    .join('; ');
}

/** Parses a Cookie header into [name, value] pairs. */
export function parseCookieHeader(header: string | undefined): Array<[string, string]> {
  if (!header) return [];
  return header
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const eq = p.indexOf('=');
      return eq < 0 ? (['', p] as [string, string]) : ([p.slice(0, eq).trim(), p.slice(eq + 1).trim()] as [string, string]);
    });
}

/**
 * Merges the Cookie header the browser actually sent (captured via webRequest,
 * includes partitioned/CHIPS cookies) with the cookie store's view. The sent
 * header wins on name clashes.
 */
export function mergeCookieHeaders(sent: string | undefined, store: string | undefined): string {
  const out = parseCookieHeader(sent);
  const names = new Set(out.map(([n]) => n));
  for (const [n, v] of parseCookieHeader(store)) {
    if (!names.has(n)) {
      out.push([n, v]);
      names.add(n);
    }
  }
  return out.map(([n, v]) => (n ? `${n}=${v}` : v)).join('; ');
}

export interface CookieStoreLike {
  id: string;
  incognito?: boolean;
}

/**
 * Picks the cookie store for a (possibly incognito) download. Chrome's regular
 * store is "0" and incognito "1"; Firefox uses "firefox-default" / "firefox-private".
 */
export function pickCookieStoreId(stores: CookieStoreLike[], incognito: boolean): string | undefined {
  if (!incognito) return undefined; // default store of the extension context
  const flagged = stores.find((s) => s.incognito);
  if (flagged) return flagged.id;
  const known = stores.find((s) => s.id === '1' || s.id === 'firefox-private');
  return known?.id;
}
