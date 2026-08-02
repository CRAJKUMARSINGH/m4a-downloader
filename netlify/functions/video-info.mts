import type { Context } from "@netlify/functions";

// ---------------------------------------------------------------------------
// PATCH v3 – Use YouTube oEmbed instead of dead Invidious/Piped instances
//
// Previous approach (execFile yt-dlp, then Invidious HTTP): both broken.
//   • yt-dlp can't run in Netlify Lambda (binary not present in runtime).
//   • Every Invidious and Piped public instance is shut down or blocking.
//
// New approach: YouTube's own oEmbed endpoint.
//   URL: https://www.youtube.com/oembed?url=<videoUrl>&format=json
//   Returns: title, thumbnail_url, author_name — no API key required.
//   Duration / filesize / bitrate are not available via oEmbed; they are
//   returned as 0 / null.  This is acceptable — they are display-only fields
//   and the download still works without them.
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const OEMBED_URL = "https://www.youtube.com/oembed";
const FETCH_TIMEOUT_MS = 8_000;

function extractVideoId(url: string): string | null {
  const short = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (short) return short[1];
  const long = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  return long ? long[1] : null;
}

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

  const videoId = extractVideoId(urlParam);
  if (!videoId) {
    return new Response(
      JSON.stringify({ error: "Could not extract video ID from URL" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const oembedResp = await fetch(
      `${OEMBED_URL}?url=${encodeURIComponent(canonicalUrl)}&format=json`,
      { signal: controller.signal }
    );

    if (!oembedResp.ok) {
      // 404 from oEmbed means the video is private, deleted, or age-restricted
      const hint =
        oembedResp.status === 404
          ? "Video not found, private, or age-restricted"
          : `oEmbed returned HTTP ${oembedResp.status}`;
      return new Response(JSON.stringify({ error: hint }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const data = await oembedResp.json() as {
      title?: string;
      thumbnail_url?: string;
      author_name?: string;
    };

    // duration, filesize, bitrate are not available from oEmbed.
    // Return 0 / null — the UI shows them as empty, download is unaffected.
    return new Response(
      JSON.stringify({
        title: data.title ?? "Unknown",
        duration: 0,
        thumbnail: data.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        filesize: null,
        bitrate: null,
        videoId,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
          ...CORS_HEADERS,
        },
      }
    );
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? "Request to YouTube timed out"
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
  path: "/api/video-info",
};
