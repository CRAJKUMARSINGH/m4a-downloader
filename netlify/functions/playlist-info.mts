import type { Context } from "@netlify/functions";

// ---------------------------------------------------------------------------
// PATCH: Bug 1 – "Network error fetching playlist"
//
// Root cause: vid.puffyan.us is a defunct Invidious instance. When it is
// unreachable the function hangs until Netlify's 60-s timeout fires and
// returns an HTML error page. The browser then fails to parse JSON and the
// generic catch block in home.tsx shows "Network error fetching playlist".
//
// Fix:
//   • Rotate through five active public Invidious instances.
//   • Apply a 15-second AbortController timeout per attempt so a dead
//     instance fails fast and the next one is tried immediately.
//   • Return CORS headers on every response.
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Active public Invidious instances (update list periodically from https://api.invidious.io) */
const INVIDIOUS_INSTANCES = [
  "https://yewtu.be",
  "https://inv.vern.cc",
  "https://invidious.privacydev.net",
  "https://invidious.fdn.fr",
  "https://vid.priv.au",
];

const FETCH_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPlaylist(playlistId: string): Promise<{ entries: unknown[]; count: number }> {
  let lastError = "All Invidious instances failed";

  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const apiUrl = `${base}/api/v1/playlists/${playlistId}`;
      const response = await fetchWithTimeout(apiUrl, FETCH_TIMEOUT_MS);

      if (!response.ok) {
        lastError = `${base} returned HTTP ${response.status}`;
        continue;
      }

      const data = await response.json();

      if (!data.videos || data.videos.length === 0) {
        throw new Error("No videos found in playlist");
      }

      const entries = (data.videos as Record<string, unknown>[]).map((video) => ({
        url: `https://www.youtube.com/watch?v=${video["videoId"]}`,
        title: (video["title"] as string) || "Unknown",
        duration: (video["lengthSeconds"] as number) || 0,
        thumbnail:
          (video["videoThumbnails"] as Array<{ quality: string; url: string }> | undefined)?.find(
            (t) => t.quality === "medium"
          )?.url ??
          (video["videoThumbnails"] as Array<{ url: string }> | undefined)?.[0]?.url ??
          `https://i.ytimg.com/vi/${video["videoId"]}/mqdefault.jpg`,
      }));

      return { entries, count: entries.length };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        lastError = `${base} timed out after ${FETCH_TIMEOUT_MS / 1000}s`;
      } else if (err instanceof Error) {
        // Surface hard errors (e.g. "No videos found") immediately
        if (err.message === "No videos found in playlist") throw err;
        lastError = `${base}: ${err.message}`;
      }
      // Try next instance
    }
  }

  throw new Error(lastError);
}

export default async function handler(req: Request, _ctx: Context) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const url = new URL(req.url).searchParams.get("url");
  if (!url) {
    return new Response(JSON.stringify({ error: "url query param required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  if (!/youtu(\.be|be\.com)/i.test(url)) {
    return new Response(JSON.stringify({ error: "Invalid YouTube URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const playlistMatch = url.match(/[?&]list=([^&]+)/);
  if (!playlistMatch) {
    return new Response(JSON.stringify({ error: "No playlist ID found in URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const playlistId = playlistMatch[1];

  try {
    const result = await fetchPlaylist(playlistId);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
        ...CORS_HEADERS,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,  // 502 Bad Gateway is more accurate than 400 for upstream failures
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
}

export const config = {
  path: "/api/playlist-info",
};