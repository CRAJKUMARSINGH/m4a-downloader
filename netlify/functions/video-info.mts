import type { Context } from "@netlify/functions";

// ---------------------------------------------------------------------------
// PATCH: Bug 2 – yt-dlp cannot run inside Netlify Lambda functions
//
// Root cause: yt-dlp is a Python binary installed during the *build* step, but
// Netlify functions execute in a separate AWS Lambda environment that has no
// access to the build container's filesystem. So findYtdlp() always throws
// "yt-dlp not found" and every /api/video-info request returns a 400 error in
// production. The Replit-specific path /home/runner/workspace/.pythonlibs/...
// was also the first probe candidate, adding a useless filesystem hit on every
// cold start outside Replit.
//
// Fix: Replace execFile(yt-dlp) with a pure-HTTP call to the Invidious public
// API. Extract the video ID from the URL, hit /api/v1/videos/:id on one of
// several rotating instances (with a 15-s AbortController timeout per attempt),
// and map the response to the VideoInfo schema. No child processes, no yt-dlp
// dependency – works anywhere that can make outbound HTTPS calls.
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Active public Invidious instances (update periodically from https://api.invidious.io) */
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

/** Extract a YouTube video ID from any standard YouTube URL form. */
function extractVideoId(url: string): string | null {
  // youtu.be/<id>
  const short = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (short) return short[1];
  // youtube.com/watch?v=<id>  or  youtube.com/shorts/<id>
  const long = url.match(/[?&v=\/]([A-Za-z0-9_-]{11})(?:[?&]|$)/);
  return long ? long[1] : null;
}

interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  filesize: number | null;
  bitrate: number | null;
  videoId: string;
}

async function fetchVideoInfo(videoId: string): Promise<VideoInfo> {
  let lastError = "All Invidious instances failed";

  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const apiUrl = `${base}/api/v1/videos/${videoId}?fields=title,lengthSeconds,videoThumbnails,adaptiveFormats,videoId`;
      const response = await fetchWithTimeout(apiUrl, FETCH_TIMEOUT_MS);

      if (!response.ok) {
        lastError = `${base} returned HTTP ${response.status}`;
        continue;
      }

      const data = await response.json() as Record<string, unknown>;

      type Thumbnail = { quality: string; url: string };
      type AdaptiveFormat = { type: string; bitrate: number; clen?: number };

      const thumbnails = (data["videoThumbnails"] as Thumbnail[] | undefined) ?? [];
      const thumbnail =
        thumbnails.find((t) => t.quality === "medium")?.url ??
        thumbnails.find((t) => t.quality === "high")?.url ??
        thumbnails[0]?.url ??
        `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

      // Pick best audio-only adaptive format for filesize/bitrate estimates
      const adaptiveFmts = (data["adaptiveFormats"] as AdaptiveFormat[] | undefined) ?? [];
      const audioFmt = adaptiveFmts
        .filter((f) => f.type?.startsWith("audio/"))
        .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];

      return {
        title: (data["title"] as string) || "Unknown",
        duration: (data["lengthSeconds"] as number) || 0,
        thumbnail,
        filesize: audioFmt?.clen ? Number(audioFmt.clen) : null,
        bitrate: audioFmt?.bitrate ? Math.round(audioFmt.bitrate / 1000) : null,
        videoId: (data["videoId"] as string) || videoId,
      };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        lastError = `${base} timed out after ${FETCH_TIMEOUT_MS / 1000}s`;
      } else if (err instanceof Error) {
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

  const videoId = extractVideoId(urlParam);
  if (!videoId) {
    return new Response(JSON.stringify({ error: "Could not extract video ID from URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const info = await fetchVideoInfo(videoId);
    return new Response(JSON.stringify(info), {
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
      status: 502,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
}

export const config = {
  path: "/api/video-info",
};