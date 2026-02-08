# openchat

A lightweight web chat app (HTML + CSS + jQuery) for chatting with your OpenClaw gateway.

## Features

- Clean chat UI
- Connects to OpenClaw OpenAI-compatible endpoint (`/v1/chat/completions`)
- Optional **live streaming replies** (token-by-token feel)
- Connection test in Settings
- Configurable Gateway URL, token, model, and timeout
- Stores settings locally in browser (`localStorage`)

## Setup

1. Open the deployed site (GitHub Pages) or run locally.
2. Click **Settings**.
3. Enter:
   - **Gateway Base URL** (example: `https://your-openclaw-host`)
   - **Gateway Token**
   - Optional **Model** (e.g. `openai-codex/gpt-5.3-codex`)
4. Save and start chatting.

Recommended values (Tailscale):
- Gateway Base URL: `http://<tailscale-ip>:18789`
- Request timeout: `120` to `180` seconds

Common mistakes:
- Do **not** use your static-site port as Gateway URL (e.g. `:18979` for `index.html`).
- If the page is loaded over **HTTPS**, an **HTTP** Gateway URL will be blocked by browser mixed-content rules.

Streaming note:
- Live replies are implemented with HTTP streaming (SSE-style OpenAI chunks), not WebSocket.
- UX is similar to Telegram typing/live output.

## Troubleshooting remote errors

If you see errors like:
- `Fetch API cannot load ... due to access control checks`
- `The network connection was lost`

Use this checklist:

1. **Correct endpoint enabled** in OpenClaw config:
   - `gateway.http.endpoints.chatCompletions.enabled = true`
2. **Do not use static-site port** as Gateway URL.
   - ✅ Gateway is usually `:18789`
   - ❌ `:18979` is typically your static site server
3. **HTTPS page cannot call HTTP API** (mixed content).
   - If using GitHub Pages (`https://...`), your Gateway URL must also be `https://...`
4. **Avoid raw `https://100.x.x.x:18789`** unless you actually run TLS there.
   - OpenClaw default gateway is HTTP on 18789.

Recommended fix for GitHub Pages:
- Put OpenClaw behind an HTTPS endpoint (Tailscale Serve HTTPS, Cloudflare Tunnel, or reverse proxy with TLS), then use that HTTPS URL as Gateway Base URL.

## How to get Gateway Base URL and token

### Local-only setup (same machine)

Use:

- **Gateway Base URL:** `http://127.0.0.1:18789`

Get token from OpenClaw config:

```bash
cat ~/.openclaw/openclaw.json
```

Look for:

```json
"gateway": {
  "auth": {
    "mode": "token",
    "token": "YOUR_GATEWAY_TOKEN"
  }
}
```

### Remote/device setup (phone/another laptop)

`127.0.0.1` only works on the same machine. For remote access, expose your Gateway with LAN/Tailscale/reverse proxy, then use that reachable URL as Base URL.

### Security

- Treat Gateway token like a password.
- Never commit it to GitHub.
- Rotate token if exposed.

## Remote access options

- **General options:** [REMOTE_ACCESS.md](./REMOTE_ACCESS.md)
- **Production-tested runbook (verified):** [TESTED_SETUP.md](./TESTED_SETUP.md)

Options documented:
1. **Tailscale (recommended)**
2. **Cloudflare Tunnel**
3. **Public reverse proxy (Nginx/Caddy)**

## Security Note

This is a static frontend. Your token is stored in browser localStorage. Use only in trusted environments.

## Local preview

Open `index.html` directly, or serve with any static server.

## License

MIT
