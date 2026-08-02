import type { Context } from "@netlify/functions";

// Netlify Functions v2 — path registered via export const config below.
// No redirect in netlify.toml needed; Netlify routes /api/playlist-info
// directly to this function before the SPA fallback ever fires.
//
// Behaviour:
//   • Validates the URL and playlist ID.
//   • If BACKEND_URL env var is set → proxies to the Express API server's
//     existing GET /api/playlist-info route (powered by yt-dlp).
//   • If BACKEND_URL is not set → returns HTTP 503 with a clear setup message.
//
// Required one-time setup:
//   1. Deploy artifacts/api-server to a persistent host (Render, Railway …).
//   2. In the Netlify dashboard → Site → Environment variables, add:
//        BACKEND_URL = https://your-api.onrender.com

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const BACKEND_URL = process.env["BACKEND_URL"]?.replace(/\/$/, "");
const PROXY_TIMEOUT_MS = 55_000;

export default async function handler(req: Request, _ctx: Context) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const urlParam = new URL(req.url).searchParams.get("url");
  if (!urlParam) {
    return new Response(JSON.stringify({ error: "url query param required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
  if (!/youtu(\.be|be\.com)/i.test(urlParam)) {
    return new Response(JSON.stringify({ error: "Invalid YouTube URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
  if (!/[?&]list=/.test(urlParam)) {
    return new Response(JSON.stringify({ error: "No playlist ID found in URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  if (!BACKEND_URL) {
    return new Response(
      JSON.stringify({
        error:
          "Playlist info requires the API backend. " +
          "Deploy artifacts/api-server and set BACKEND_URL in the Netlify " +
          "dashboard (e.g. https://my-api.onrender.com).",
      }),
      { status: 503, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  const backendUrl = `${BACKEND_URL}/api/playlist-info?url=${encodeURIComponent(urlParam)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const upstream = await fetch(backendUrl, { signal: controller.signal });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "public, max-age=300",
        ...CORS_HEADERS,
      },
    });
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? "Request to API backend timed out"
        : err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } finally {
    clearTimeout(timer);
  }
}

// v2 function path — Netlify routes /api/playlist-info here directly.
// Do NOT add a redirect for this path in netlify.toml.
export const config = {
  path: "/api/playlist-info",
};
