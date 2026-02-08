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

## Security Note

This is a static frontend. Your token is stored in browser localStorage. Use only in trusted environments.

## Local preview

Open `index.html` directly, or serve with any static server.

## License

MIT
