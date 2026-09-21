/**
 * Iterant Reverse Proxy Worker
 *
 * Proxies requests from your domain to the Iterant platform,
 * enabling seamless integration of Iterant-generated pages.
 *
 * @see https://github.com/IterantAI/cloudflare-proxy-worker
 */

export interface Env {
  TARGET_HOST: string;
  BRAND_ID: string;
  CACHE_TTL: string;
}

const CACHEABLE_METHODS = ['GET', 'HEAD'];

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    // No fallback host. The old default, sites.iterant.ai, is a retired v1
    // host: a misconfigured proxy silently served nothing from it rather than
    // saying so.
    const targetHost = env.TARGET_HOST;

    if (!targetHost) {
      return new Response('Configuration error: TARGET_HOST not set', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const parsedTtl = parseInt(env.CACHE_TTL || '3600', 10);
    const cacheTtl = Number.isNaN(parsedTtl) ? 3600 : Math.max(0, parsedTtl);

    if (!env.BRAND_ID) {
      return new Response('Configuration error: BRAND_ID not set', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const isCacheable =
      cacheTtl > 0 && CACHEABLE_METHODS.includes(request.method);

    if (isCacheable) {
      const cacheKey = new Request(url.toString(), { method: request.method });
      const cachedResponse = await caches.default.match(cacheKey);

      if (cachedResponse) {
        const response = new Response(cachedResponse.body, cachedResponse);
        response.headers.set('X-Cache-Status', 'HIT');
        return response;
      }
    }

    const targetUrl = new URL(url.pathname, `https://${targetHost}`);
    targetUrl.search = url.search;

    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.body,
      redirect: 'follow',
    });

    proxyRequest.headers.set('Host', targetHost);
    proxyRequest.headers.set('X-Tenant-Brand-ID', env.BRAND_ID);
    proxyRequest.headers.set('X-Forwarded-Host', url.hostname);
    proxyRequest.headers.set(
      'X-Forwarded-Proto',
      url.protocol.replace(':', '')
    );
    proxyRequest.headers.set('X-Original-Path', url.pathname);

    try {
      const response = await fetch(proxyRequest);

      if (isCacheable && response.ok) {
        const responseToCache = response.clone();

        const returnResponse = new Response(response.body, response);
        returnResponse.headers.set(
          'Cache-Control',
          `public, max-age=${cacheTtl}`
        );
        returnResponse.headers.set('X-Cache-Status', 'MISS');

        const cacheKey = new Request(url.toString(), {
          method: request.method,
        });
        ctx.waitUntil(
          (async () => {
            const cacheResponse = new Response(
              responseToCache.body,
              responseToCache
            );
            cacheResponse.headers.set(
              'Cache-Control',
              `public, max-age=${cacheTtl}`
            );
            await caches.default.put(cacheKey, cacheResponse);
          })()
        );

        return returnResponse;
      }

      return response;
    } catch (error) {
      console.error('Proxy error:', error);
      return new Response('Proxy error', {
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  },
};
