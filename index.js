/**
 * Cloudflare Worker proxy for OpenChat -> OpenClaw
 *
 * Required Worker secrets/vars:
 * - OPENCLAW_BASE_URL   (e.g. https://ruska-roma.tail9f4612.ts.net)
 * - OPENCLAW_TOKEN      (gateway token)
 * Optional:
 * - ALLOW_ORIGIN        (e.g. https://jardani1x.github.io)
 */

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env) {
    const allowOrigin = env.ALLOW_ORIGIN || "*";
    const headers = corsHeaders(allowOrigin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/v1/chat/completions" || request.method !== "POST") {
      return new Response("Not found", { status: 404, headers });
    }

    if (!env.OPENCLAW_BASE_URL || !env.OPENCLAW_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Missing OPENCLAW_BASE_URL or OPENCLAW_TOKEN" }),
        {
          status: 500,
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const upstreamUrl = `${env.OPENCLAW_BASE_URL.replace(/\/$/, "")}/v1/chat/completions`;

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENCLAW_TOKEN}`,
      },
      body: await request.text(),
    });

    const outHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(headers)) outHeaders.set(k, v);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: outHeaders,
    });
  },
};
