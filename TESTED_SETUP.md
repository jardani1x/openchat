# openchat — Tested Setup Guide (Verified on this host)

This guide only includes flows that were tested end-to-end on this machine.

## What was tested successfully

### A) Same-origin production setup (recommended)
- URL: `https://ruska-roma.tail9f4612.ts.net/`
- openchat app loads ✅
- OpenClaw API reachable under `/v1/chat/completions` ✅
- Dashboard available at `/dashboard/chat?session=main` ✅
- WebSocket handshake for dashboard chat works (no `1006` handshake mismatch) ✅

### B) Direct API check through tailnet HTTPS
- `POST https://ruska-roma.tail9f4612.ts.net/v1/chat/completions` returns `200` ✅

### C) Known non-working pattern (tested)
- GitHub Pages app (`https://jardani1x.github.io/openchat/`) calling a different origin directly may fail due to preflight/CORS depending on gateway pathing. We observed `OPTIONS ... 405` during that cross-origin setup. ❌

---

## Recommended production architecture (tested)

Use a local Caddy reverse proxy in front of OpenClaw, then publish that proxy with Tailscale Serve.

Flow:
- Browser → `https://<tailnet-host>/` (openchat)
- Browser → same origin `/v1/*` (OpenClaw API)
- Browser → same origin `/dashboard/*` (OpenClaw Control UI)

This avoids mixed-content + CORS + dashboard websocket path mismatch.

---

## Step-by-step (tested)

## 1) OpenClaw config required

Ensure these are set in `~/.openclaw/openclaw.json`:

- `gateway.bind = "tailnet"`
- `gateway.auth.mode = "token"`
- `gateway.auth.allowTailscale = true`
- `gateway.http.endpoints.chatCompletions.enabled = true`
- `gateway.controlUi.basePath = "/dashboard"`
- `gateway.controlUi.allowedOrigins` includes your tailnet HTTPS URL
- `gateway.controlUi.allowInsecureAuth = true` (needed when TLS is terminated before OpenClaw)

Then restart gateway (or use config patch flow).

## 2) Run virtual Caddy (user-level, no system takeover)

Create `Caddyfile.virtual`:

```caddy
{
  auto_https off
  admin off
}

:18080 {
  root * /home/jardani/.openclaw/workspace/openchat
  encode gzip zstd

  @ws {
    header Connection *Upgrade*
    header Upgrade websocket
  }
  handle @ws {
    reverse_proxy http://100.64.8.8:18789
  }

  @api path /v1/*
  handle @api {
    reverse_proxy http://100.64.8.8:18789
  }

  @dashboard path /dashboard*
  handle @dashboard {
    reverse_proxy http://100.64.8.8:18789
  }

  handle {
    try_files {path} /index.html
    file_server
  }
}
```

Run it:

```bash
caddy run --config /home/jardani/.openclaw/workspace/openchat/Caddyfile.virtual --adapter caddyfile
```

## 3) Publish Caddy via Tailscale Serve (HTTPS)

```bash
sudo tailscale serve reset
sudo tailscale serve --bg --https=443 http://127.0.0.1:18080
sudo tailscale serve status
```

Expected:
- `https://<your-tailnet-host>/` proxies to `http://127.0.0.1:18080`

## 4) openchat settings

In app Settings:

- Gateway Base URL: `https://<your-tailnet-host>`
- Gateway Token: value from `~/.openclaw/openclaw.json` → `gateway.auth.token`
- Model: optional (e.g. `openai-codex/gpt-5.3-codex`)
- Timeout: `120` to `180`
- Live streaming: optional

## 5) Dashboard URL

Use:

- `https://<your-tailnet-host>/dashboard/chat?session=main`

If it says token missing, paste token once in Control UI settings for that browser/device.

---

## Quick diagnostics

### Check Serve mapping
```bash
sudo tailscale serve status
```

### Check API reachable
```bash
curl -i -X POST https://<your-tailnet-host>/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -d '{"model":"openai-codex/gpt-5.3-codex","stream":false,"messages":[{"role":"user","content":"ping"}]}'
```

### If dashboard shows `1006` websocket errors
- Verify websocket traffic is proxied at `/` in Caddy (`@ws` block above)
- Ensure Tailscale Serve points to Caddy (`127.0.0.1:18080`), not directly to gateway

---

## No-Caddy alternative (simpler but limited)

If you do **not** use Caddy:
- You can expose OpenClaw directly with Tailscale Serve.
- This is okay for dashboard/API usage on the same endpoint.
- But serving openchat from GitHub Pages + cross-origin API can still hit browser constraints depending on route and preflight behavior.

For production reliability across devices, use the Caddy same-origin setup above.
