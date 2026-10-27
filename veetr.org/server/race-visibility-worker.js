// Cloudflare Pages advanced-mode handler. Only public race document requests
// need a live visibility check; every other URL stays on static asset hosting.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const series = url.searchParams.get('series') ?? url.searchParams.get('public');
    if (!['GET', 'HEAD'].includes(request.method) ||
        !/^\/(cs\/)?races(?:\/manage)?\/?$/.test(url.pathname) || !series) {
      return env.ASSETS.fetch(request);
    }
    let status = 200, unlisted = false;
    try {
      if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) throw new Error('Missing configuration');
      const rpc = async (name, body) => {
        const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/${name}`, {
          method: 'POST', headers: {apikey: env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json'},
          body: JSON.stringify(body), signal: AbortSignal.timeout(5000), cache: 'no-store',
        });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Visibility check failed');
        return response.json();
      };
      const data = await rpc('public_series_by_route', {series_route: series});
      unlisted = data?.visibility === 'unlisted';
      const event = url.searchParams.get('event'), heat = url.searchParams.get('heat');
      const heats = data?.races ?? [];
      if (!data || !['public', 'unlisted'].includes(data.visibility ?? (data.status === 'draft' ? 'draft' : 'public')) ||
          (event && !heats.some(r => (r.eventId ?? r.id) === event)) ||
          (heat && !heats.some(r => r.id === heat && (!event || (r.eventId ?? r.id) === event)))) status = 404;
    } catch {
      // An outage is not evidence that a race does not exist.
      status = 503;
    }
    // Return the usual empty app shell even for 404: organizers can still
    // restore their browser session and open the authorized private editor.
    const asset = await env.ASSETS.fetch(request);
    if (!asset.ok) return asset;
    const headers = new Headers(asset.headers);
    headers.set('Cache-Control', 'no-store');
    if (status !== 200 || unlisted) headers.set('X-Robots-Tag', 'noindex');
    if (status === 503) headers.set('Retry-After', '30');
    return new Response(request.method === 'HEAD' ? null : asset.body, {status, headers});
  },
};
