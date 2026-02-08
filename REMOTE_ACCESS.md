# Remote Access Setup for openchat

This guide shows 3 ways to access your OpenClaw-backed web chat remotely.

## Option 1 (Recommended): Tailscale

Best balance of security + simplicity.

### Why
- Private network (no public exposure)
- End-to-end encrypted
- Works across Wi-Fi/mobile networks
- Easy to revoke devices

### Steps
1. Install Tailscale on your OpenClaw host (laptop) and your remote device.
2. Sign in to the same Tailscale account on both devices.
3. On the OpenClaw host, verify Gateway is running on port `18789`.
4. Get your host Tailscale IP:
   - `tailscale ip -4`
5. In openchat Settings, set:
   - **Gateway Base URL:** `http://<TAILSCALE_IP>:18789`
   - **Gateway Token:** from `~/.openclaw/openclaw.json` (`gateway.auth.token`)

> This works best when openchat is served locally or over HTTP. If you use GitHub Pages (`https://...`), your Gateway URL must also be HTTPS.

### Optional (recommended for GitHub Pages): Tailscale Serve HTTPS

On your OpenClaw host:

```bash
tailscale serve --https=443 http://127.0.0.1:18789
tailscale serve status
```

Use the HTTPS URL shown by `tailscale serve status` as your **Gateway Base URL** in openchat.

---

## Option 2: Cloudflare Tunnel (Good, more setup)

### Why
- Public URL without opening router ports
- TLS by default
- Add Cloudflare Access for login protection

### Steps (high level)
1. Install `cloudflared` on OpenClaw host.
2. Create tunnel and map hostname (e.g. `chat.yourdomain.com`) to `http://127.0.0.1:18789`.
3. Protect with Cloudflare Access policy (email/OAuth allowlist).
4. In openchat Settings, set:
   - **Gateway Base URL:** `https://chat.yourdomain.com`
   - **Gateway Token:** your OpenClaw token

---

## Option 3: Public Reverse Proxy (Advanced)

Nginx/Caddy in front of OpenClaw.

### Why
- Full control
- Standard production style deployment

### Requirements
- Public domain + DNS
- HTTPS (Let’s Encrypt)
- Strict firewall rules
- Optional IP allowlist / basic auth / OAuth proxy

### Steps (high level)
1. Run OpenClaw on host (`127.0.0.1:18789` recommended).
2. Configure Nginx/Caddy to proxy `https://chat.yourdomain.com` -> `http://127.0.0.1:18789`.
3. Enforce TLS + security headers + rate limits.
4. Keep OpenClaw token auth enabled.
5. Use `https://chat.yourdomain.com` in openchat.

---

## Security Checklist (all options)
- Keep `gateway.auth.mode = token`
- Never commit token to GitHub
- Rotate token if leaked
- Prefer private networking (Tailscale) over public exposure
- Keep OpenClaw and OS updated
