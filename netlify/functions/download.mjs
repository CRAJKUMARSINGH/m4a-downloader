/**
 * GET /api/download?url=<youtube-url>&format=m4a&quality=highestaudio&title=<filename>
 *
 * Uses youtubei.js (Innertube) to get a signed direct stream URL, then
 * proxies the audio bytes back to the browser with a download filename.
 */

export const config = { path: '/api/download' };

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const params   = new URL(req.url).searchParams;
  const videoUrl = params.get('url')     || '';
  const format   = params.get('format')  || 'm4a';
  const quality  = params.get('quality') || 'highestaudio';
  const title    = params.get('title')   || 'audio';

  if (!videoUrl) return jsonError('Missing url parameter', 400);

  const videoId = extractVideoId(videoUrl);
  if (!videoId)  return jsonError('Invalid YouTube URL', 400);

  const safeTitle = sanitizeFilename(title);

  try {
    const { Innertube } = await import('youtubei.js');
    const yt = await Innertube.create({ generate_session_locally: true });

    // getStreamingData returns a single best-matched Format with a deciphered URL
    const fmt = await yt.getStreamingData(videoId, {
      type:    'audio',
      quality: 'best',
      format:  format === 'mp3' ? 'mp4' : format, // Innertube doesn't re-encode
    });

    if (!fmt?.url) {
      return jsonError('No streamable audio format found.', 404);
    }

    const mimeType  = fmt.mime_type?.split(';')[0]?.trim() || 'audio/mp4';
    const ext       = mimeToExt(mimeType, format);
    const disposition = `attachment; filename="${safeTitle}.${ext}"`;

    // Proxy through our function so browser sees correct filename + no CORS
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), 24000);

    const upstream = await fetch(fmt.url, {
      signal:  controller.signal,
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept-Encoding': 'identity',
        'Range':           'bytes=0-',
      },
    });
    clearTimeout(timer);

    if (!upstream.ok && upstream.status !== 206) {
      throw new Error(`Upstream returned ${upstream.status}`);
    }

    const respHeaders = {
      'Content-Type':           mimeType,
      'Content-Disposition':    disposition,
      'Cache-Control':          'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(),
    };

    const cl = upstream.headers.get('content-length');
    if (cl) respHeaders['Content-Length'] = cl;

    return new Response(upstream.body, {
      status:  upstream.status === 206 ? 206 : 200,
      headers: respHeaders,
    });

  } catch (err) {
    console.error('[download] error:', err?.message ?? err);
    return jsonError(friendlyError(String(err?.message ?? err)), 502);
  }
};

/* ── Helpers ──────────────────────────────────────────── */

function mimeToExt(mime, fallback = 'm4a') {
  if (mime.includes('mp4'))  return 'm4a';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('webm')) return fallback === 'opus' ? 'opus' : 'webm';
  return fallback;
}

function extractVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be'))    return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2];
      return u.searchParams.get('v') || null;
    }
  } catch {}
  return null;
}

function sanitizeFilename(name) {
  return (name || 'audio')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'audio';
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function friendlyError(raw = '') {
  if (raw.includes('private'))        return 'This video is private and cannot be downloaded.';
  if (raw.includes('age-restricted')) return 'Age-restricted videos are not supported.';
  if (raw.includes('not available'))  return 'Video not available (region-locked or deleted).';
  if (raw.includes('sign in'))        return 'YouTube requires sign-in for this video.';
  if (raw.includes('abort'))          return 'Request timed out. Please try again.';
  return 'Download failed. Please try again in a moment.';
}
