// GET /api/products
// Proxies the cake catalog from the Apps Script Web App that's bound to the
// Google Sheet (see /apps-script/Code.gs). Apps Script reads the "Cakes" tab
// directly, so staff just edit the sheet — no publishing step, no redeploy.
// Cached for 5 minutes via the Cache API.

export async function onRequestGet(context) {
  const { env, request } = context;
  const cacheKey = new Request(request.url, request);
  const cache = caches.default;

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  if (!env.APPS_SCRIPT_URL) {
    return jsonResponse({ error: 'APPS_SCRIPT_URL is not configured' }, 500);
  }

  let data;
  try {
    const res = await fetch(env.APPS_SCRIPT_URL, { redirect: 'follow' });
    if (!res.ok) throw new Error('Apps Script fetch failed: ' + res.status);
    data = await res.json();
  } catch (err) {
    return jsonResponse({ error: 'Could not load the menu' }, 502);
  }

  if (data && data.error) {
    return jsonResponse({ error: data.error }, 502);
  }

  const response = jsonResponse(data);
  response.headers.set('Cache-Control', 'public, max-age=300');
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
