export type SiteLanguage = 'en' | 'cs';
export const siteLanguage = (path: string): SiteLanguage => /^\/cs(?:\/|$)/.test(path) ? 'cs' : 'en';
export const unlocalizedPath = (path: string) => path.replace(/^\/cs(?=\/|$)/, '') || '/';
export function localizedPath(path: string, language: SiteLanguage) {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  const plain = unlocalizedPath(path);
  return language === 'cs' ? `/cs${plain}` : plain;
}

// Reuse the existing allow-listed callback path, carrying language as a preference.
export function accountCallbackPath(language: SiteLanguage, invite?: string | null) {
  const params = new URLSearchParams();
  if (language === 'cs') params.set('lang', 'cs');
  if (invite) params.set('invite', invite);
  return '/account/' + (params.size ? `?${params}` : '');
}
export function localizedAccountReturn(current: URL): string | null {
  if (unlocalizedPath(current.pathname) !== '/account/') return null;
  const language = current.searchParams.get('lang');
  if (language !== 'cs' && language !== 'en') return null;
  const target = new URL(current);
  target.pathname = localizedPath('/account/', language);
  target.searchParams.delete('lang');
  // Preserve auth fragments verbatim and never accept an external redirect target.
  return target.pathname + target.search + target.hash;
}
