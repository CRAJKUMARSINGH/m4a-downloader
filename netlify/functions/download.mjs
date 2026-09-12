/**
 * GET /api/download?url=<youtube-url>&format=m4a&quality=highestaudio&title=<filename>
 *
 * Streams the best-matching audio-only track straight to the browser.
 * Netlify free-tier functions have a 10 s wall-clock timeout, but streaming
 * a Response body bypasses that for most reasonably-sized audio files.
 * For very long videos (>30 min) users should use the direct-link fallback.
 */

import ytdl from '@distube/ytdl-core';

export default async (req, context) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url      = new URL(req.url);
  const videoUrl = url.searchParams.get('url')     || '';
  const format   = url.searchParams.get('format')  || 'm4a';
  const quality  = url.searchParams.get('quality') || 'highestaudio';
  const title    = url.searchParams.get('title')   || 'audio';

  if (!videoUrl) return jsonError('Missing url parameter', 400);

  if (!ytdl.validateURL(videoUrl)) {
    return jsonError('Invalid YouTube URL', 400);
  }

  try {
    // ── 1. Get video info to find the right format ────────────────
    const info = await ytdl.getInfo(videoUrl, {
      requestOptions: { headers: browserHeaders() },
    });

    const chosen = pickAudioFormat(info.formats, format, quality);
    if (!chosen) {
      return jsonError('No suitable audio format found for this video.', 404);
    }

    const mimeType     = mimeFor(format, chosen.mimeType);
    const fileExt      = extFor(format, chosen.mimeType);
    const safeTitle    = sanitizeFilename(title || info.videoDetails.title || 'audio');
    const disposition  = `attachment; filename="${safeTitle}.${fileExt}"`;

    // ── 2. Stream ytdl directly into a Web ReadableStream ────────
    const nodeStream = ytdl.downloadFromInfo(info, {
      format: chosen,
      requestOptions: { headers: browserHeaders() },
    });

    const webStream = nodeToWebStream(nodeStream);

    const headers = {
      'Content-Type':           mimeType,
      'Content-Disposition':    disposition,
      'Cache-Control':          'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(),
    };

    // Include content-length if known (helps browser show progress)
    if (chosen.contentLength) {
      headers['Content-Length'] = String(chosen.contentLength);
    }

    return new Response(webStream, { status: 200, headers });

  } catch (err) {
    console.error('[download] error:', err.message);
    return jsonError(friendlyError(err.message), 502);
  }
};

/* ── Format helpers ──────────────────────────────────── */

function pickAudioFormat(formats, format, quality) {
  const audioOnly = formats.filter(f => f.hasAudio && !f.hasVideo);

  // Exact itag match (when user picked a specific itag)
  if (quality !== 'highestaudio') {
    const byItag = audioOnly.find(f => String(f.itag) === String(quality));
    if (byItag) return byItag;
  }

  const mimeMap = {
    m4a:  'audio/mp4',
    mp3:  'audio/mpeg',
    opus: 'audio/webm',
    webm: 'audio/webm',
  };

  const targetMime = mimeMap[format] || 'audio/mp4';
  const matching   = audioOnly.filter(
    f => f.mimeType?.toLowerCase().includes(targetMime)
  );
  const pool = matching.length > 0 ? matching : audioOnly;

  return pool.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0] ?? null;
}

function mimeFor(format, detectedMime = '') {
  if (detectedMime) {
    // Strip codec params for the Content-Type header
    return detectedMime.split(';')[0].trim();
  }
  const map = { m4a: 'audio/mp4', mp3: 'audio/mpeg', opus: 'audio/webm', webm: 'audio/webm' };
  return map[format] || 'audio/mp4';
}

function extFor(format, detectedMime = '') {
  // If the actual stream is WebM/Opus, use .webm regardless of user pick
  if (detectedMime.includes('audio/webm')) return format === 'opus' ? 'opus' : 'webm';
  if (detectedMime.includes('audio/mp4'))  return 'm4a';
  if (detectedMime.includes('audio/mpeg')) return 'mp3';
  return format || 'm4a';
}

/* ── Convert Node.js stream → Web ReadableStream ──────── */
function nodeToWebStream(nodeStream) {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => {
        controller.enqueue(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
      });
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

/* ── Misc helpers ─────────────────────────────────────── */

function browserHeaders() {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  };
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')   // remove illegal chars
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);                             // keep it reasonable
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function friendlyError(raw = '') {
  if (raw.includes('private video'))   return 'This video is private and cannot be downloaded.';
  if (raw.includes('age-restricted'))  return 'Age-restricted videos are not supported.';
  if (raw.includes('not available'))   return 'Video not available (region-locked or deleted).';
  if (raw.includes('Could not find'))  return 'Could not extract audio. YouTube may have changed its API — try again shortly.';
  if (raw.includes('sign in'))         return 'YouTube requires a sign-in to access this video.';
  return 'Download failed. Please try again in a moment.';
}

export const config = {
  path: '/api/download',
};
