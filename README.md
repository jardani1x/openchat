# openchat

A lightweight web chat app (HTML + CSS + jQuery) for chatting with your OpenClaw gateway.

## Features

- Clean chat UI
- Connects to OpenClaw OpenAI-compatible endpoint (`/v1/chat/completions`)
- Configurable Gateway URL, token, and model
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

See [REMOTE_ACCESS.md](./REMOTE_ACCESS.md) for full setup guides:

1. **Tailscale (recommended)**
2. **Cloudflare Tunnel**
3. **Public reverse proxy (Nginx/Caddy)**

## Security Note

This is a static frontend. Your token is stored in browser localStorage. Use only in trusted environments.

## Local preview

Open `index.html` directly, or serve with any static server.

## License

MIT
