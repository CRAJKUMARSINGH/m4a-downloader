import type { Context } from "@netlify/functions";

// ---------------------------------------------------------------------------
// PATCH v3 – Proxy to Express backend instead of dead Invidious/Piped
//
// Previous approach: call a rotating list of public Invidious/Piped instances.
// Problem: every public instance is either shut down, rate-limiting, or
// returning 403/500.  There is no reliable serverless-friendly public API for
// YouTube playlist metadata.
//
// New approach: proxy this request to the Express API server (BACKEND_URL),
// which already has a working GET /api/playlist-info route powered by yt-dlp
// (see artifacts/api-server/src/routes/downloads.ts).
//
// Setup required:
//   1. Deploy artifacts/api-server to a persistent host (Render, Railway, Fly.io…).
//   2. Set the BACKEND_URL environment variable in the Netlify dashboard to
//      the root URL of that server, e.g. https://my-api.onrender.com
//
// When BACKEND_URL is not set this function returns a 503 with a clear message
// so the user sees an actionable error instead of a cryptic 404/timeout.
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Read from the Netlify environment (set in the dashboard under Site → Environment variables). */
const BACKEND_URL = process.env["BACKEND_URL"]?.replace(/\/$/, "");

const PROXY_TIMEOUT_MS = 55_000; // just under the 60-s Netlify function timeout

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

  // ── Validate inputs before bothering the backend ──────────────────────────

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

  // ── Guard: BACKEND_URL must be configured ─────────────────────────────────

  if (!BACKEND_URL) {
    return new Response(
      JSON.stringify({
        error:
          "Playlist info requires the API backend. " +
          "Deploy artifacts/api-server and set the BACKEND_URL environment " +
          "variable in the Netlify dashboard to its root URL " +
          "(e.g. https://my-api.onrender.com).",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }

  // ── Proxy to Express backend ───────────────────────────────────────────────

  const backendUrl = `${BACKEND_URL}/api/playlist-info?url=${encodeURIComponent(urlParam)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const upstream = await fetch(backendUrl, { signal: controller.signal });

    // Stream the response body as-is; preserve the upstream status code.
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
        : err instanceof Error
        ? err.message
        : String(err);

    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } finally {
    clearTimeout(timer);
  }
}

export const config = {
  path: "/api/playlist-info",
};
