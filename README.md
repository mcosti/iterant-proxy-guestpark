# Iterant Cloudflare Proxy Worker

A Cloudflare Worker that proxies requests from your domain to the Iterant platform, enabling seamless integration of Iterant-generated landing pages on your website.

## One-Click Deploy

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/IterantAI/cloudflare-proxy-worker)

## Features

- Edge-based reverse proxy with global distribution
- Built-in caching with configurable TTL
- Secure tenant identification headers
- Supports both path-based and subdomain routing
- Zero runtime dependencies
- TypeScript with strict mode

## Configuration

| Variable      | Required | Default | Description                                      |
| ------------- | -------- | ------- | ------------------------------------------------ |
| `TARGET_HOST` | Yes      | -       | The Iterant origin serving your pages, host only |
| `BRAND_ID`    | Yes      | -       | The brand this proxy serves, a UUID              |
| `CACHE_TTL`   | No       | `3600`  | Cache duration in seconds (0 to disable)         |

## Post-Deployment Setup

After deploying the worker, you need to configure a route in your Cloudflare dashboard.

### Path-based routing

Route pattern: `yourdomain.com/marketing/*`

Requests to `https://yourdomain.com/marketing/page` will be proxied.

### Subdomain routing

Route pattern: `marketing.yourdomain.com/*`

Requests to `https://marketing.yourdomain.com/page` will be proxied.

### Steps

1. Go to your [Cloudflare dashboard](https://dash.cloudflare.com)
2. Select your domain
3. Navigate to **Workers Routes** (under Workers & Pages)
4. Click **Add Route**
5. Enter your route pattern
6. Select the deployed worker (`iterant-proxy`)
7. Click **Save**

## Local Development

```bash
# Install dependencies
npm install

# Set TARGET_HOST and BRAND_ID in wrangler.toml, then start the dev server
npm run dev
```

> `TARGET_HOST` and `BRAND_ID` are plain variables, not secrets, so they live
> in `wrangler.toml`. Keep them out of `.dev.vars`: the Deploy to Cloudflare
> button reads both files and would ask for each name twice, once masked.

The worker will be available at `http://localhost:8787`.

## Manual Deployment

```bash
# Login to Cloudflare
wrangler login

# Set your Brand ID as a secret
wrangler secret put BRAND_ID

# Deploy the worker
npm run deploy
```

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Visitor       │     │  Cloudflare     │     │    Iterant      │
│                 │     │  Worker         │     │    Platform     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  GET /page            │                       │
         │ ─────────────────────>│                       │
         │                       │                       │
         │                       │  GET /page            │
         │                       │  + Tenant Headers     │
         │                       │ ─────────────────────>│
         │                       │                       │
         │                       │      Response         │
         │                       │ <─────────────────────│
         │                       │                       │
         │     Response          │  (cached at edge)     │
         │ <─────────────────────│                       │
         │                       │                       │
```

1. Requests matching your route pattern are handled by the worker
2. The worker adds tenant identification headers
3. Request is proxied to Iterant platform
4. Response is cached at the edge (if enabled)
5. Cached or fresh response is returned to the visitor

## Headers Added

| Header              | Value             | Purpose                   |
| ------------------- | ----------------- | ------------------------- |
| `X-Tenant-Brand-ID` | Your Brand ID     | Identifies your brand     |
| `X-Forwarded-Host`  | Original hostname | Preserves original domain |
| `X-Forwarded-Proto` | `https`           | Preserves protocol        |
| `X-Original-Path`   | Original path     | Preserves full path       |

## Troubleshooting

### "Configuration error: BRAND_ID not set"

Make sure you've set the BRAND_ID secret:

```bash
wrangler secret put BRAND_ID
```

Or when using Deploy to Cloudflare, enter your Brand ID in the deployment form.

### Pages not loading

1. Verify the route pattern is configured correctly
2. Verify your domain is verified in the [Iterant Dashboard](https://dashboard.iterant.ai)
3. Check the worker logs in Cloudflare dashboard

### Caching issues

- Set `CACHE_TTL=0` to disable caching for debugging
- Check `X-Cache-Status` response header (`HIT` = cached, `MISS` = fresh)
- Clear cache by purging in Cloudflare dashboard

### CORS errors

The worker preserves CORS headers from the origin. If you're seeing CORS errors, ensure your Iterant content is configured correctly for your domain.

## Development

```bash
# Run linting
npm run lint

# Run TypeScript check
npm run typecheck

# Format code
npm run format
```

## Environment Variables Reference

### `BRAND_ID` (Required)

The brand this proxy serves. Find it in your [Iterant Dashboard](https://dashboard.iterant.ai) under **Settings > Domains**.

Format: a UUID, like `eb39b3ec-41f5-41db-ba81-e88b40ceac37`.

### `TARGET_HOST` (Required)

The Iterant origin that serves your brand's pages, host only, with no scheme.

Format: `your-brand.iterant.site`.

> There is no default. The worker answers 500 rather than proxying to a host
> you did not choose.

### `CACHE_TTL`

Cache duration in seconds for successful responses.

Default: `3600` (1 hour)

Set to `0` to disable caching entirely.

## Support

- [Iterant Documentation](https://docs.iterant.ai)
- [GitHub Issues](https://github.com/IterantAI/cloudflare-proxy-worker/issues)

## License

MIT
