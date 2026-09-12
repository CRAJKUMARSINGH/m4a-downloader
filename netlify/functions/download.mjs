/**
 * GET /api/download?url=<youtube-url>&format=m4a&quality=highestaudio&title=<filename>
 *
 * Strategy:
 *   1. Ask /api/info for a directUrl (from Invidious signed URL)
 *   2. If directUrl exists → proxy/redirect to it (fastest, no re-stream needed)
 *   3. Otherwise fall back to @distube/ytdl-core streaming
 */

export const config = { path: '/api/download' };

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.privacydev.net',
  'https://invidious.nerdvpn.de',
  'https://yt.drgnz.club',
  'https://invidious.fdn.fr',
];

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const params    = new URL(req.url).searchParams;
  const videoUrl  = params.get('url')     || '';
  const format    = params.get('format')  || 'm4a';
  const quality   = params.get('quality') || 'highestaudio';
  const title     = params.get('title')   || 'audio';

  if (!videoUrl)                return jsonError('Missing url parameter', 400);

  const videoId = extractVideoId(videoUrl);
  if (!videoId)                 return jsonError('Invalid YouTube URL', 400);

  const safeTitle   = sanitizeFilename(title);

  // ── 1. Try Invidious for a direct signed audio URL ────────────
  const invResult = await tryInvidiousDirect(videoId, format, quality);

  if (invResult?.url) {
    const { url: directUrl, mimeType, ext } = invResult;
    const disposition = `attachment; filename="${safeTitle}.${ext}"`;

    // Proxy the stream through our function so the browser downloads it
    // (avoids CORS issues and keeps the filename correct)
    try {
      const controller = new AbortController();
      const timer      = setTimeout(() => controller.abort(), 25000);

      const upstream = await fetch(directUrl, {
        signal:  controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Range': 'bytes=0-' },
      });
      clearTimeout(timer);

      if (!upstream.ok) throw new Error(`Upstream ${upstream.status}`);

      const headers = {
        'Content-Type':           mimeType,
        'Content-Disposition':    disposition,
        'Cache-Control':          'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...corsHeaders(),
      };
      const cl = upstream.headers.get('content-length');
      if (cl) headers['Content-Length'] = cl;

      return new Response(upstream.body, { status: 200, headers });

    } catch (proxyErr) {
      console.warn('[download] Invidious proxy failed, falling back:', proxyErr.message);
    }
  }

  // ── 2. Fall back to ytdl-core streaming ───────────────────────
  try {
    const ytdl   = (await import('@distube/ytdl-core')).default;
    const info   = await ytdl.getInfo(videoUrl, {
      requestOptions: { headers: browserHeaders() },
    });

    const chosen = pickAudioFormat(info.formats, format, quality);
    if (!chosen) return jsonError('No suitable audio format found.', 404);

    const mimeType    = mimeFor(format, chosen.mimeType);
    const ext         = extFor(format, chosen.mimeType);
    const disposition = `attachment; filename="${safeTitle}.${ext}"`;

    const nodeStream = ytdl.downloadFromInfo(info, {
      format:         chosen,
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
    if (chosen.contentLength) headers['Content-Length'] = String(chosen.contentLength);

    return new Response(webStream, { status: 200, headers });

  } catch (err) {
    console.error('[download] ytdl error:', err.message);
    return jsonError(friendlyError(err.message), 502);
  }
};

/* ── Invidious: get direct audio URL ─────────────────────────── */

async function tryInvidiousDirect(videoId, format, quality) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const controller = new AbortController();
      const timer      = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(
        `${base}/api/v1/videos/${videoId}?fields=adaptiveFormats`,
        { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      clearTimeout(timer);

      if (!res.ok) continue;
      const data = await res.json();
      if (!data.adaptiveFormats?.length) continue;

      const audioFmts = data.adaptiveFormats
        .filter(f => f.type?.startsWith('audio/') && f.url)
        .map(f => ({
          itag:    f.itag,
          mime:    f.type?.split(';')[0]?.trim() || 'audio/mp4',
          bitrate: f.bitrate || 0,
          url:     f.url,
        }))
        .sort((a,b) => b.bitrate - a.bitrate);

      if (!audioFmts.length) continue;

      const chosen = chooseFormat(audioFmts, format, quality);
      if (!chosen) continue;

      return {
        url:      chosen.url,
        mimeType: chosen.mime,
        ext:      mimeToExt(chosen.mime, format),
      };

    } catch (e) {
      console.warn(`[download] Invidious ${base} failed:`, e.message);
    }
  }
  return null;
}

function chooseFormat(fmts, format, quality) {
  if (quality !== 'highestaudio') {
    const byItag = fmts.find(f => String(f.itag) === String(quality));
    if (byItag) return byItag;
  }
  const mimeMap = { m4a: 'mp4', mp3: 'mpeg', opus: 'webm', webm: 'webm' };
  const target  = mimeMap[format] || 'mp4';
  const matched = fmts.filter(f => f.mime.includes(target));
  return (matched.length ? matched : fmts)[0] || null;
}

function mimeToExt(mime, fallback) {
  if (mime.includes('mp4'))  return 'm4a';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('webm')) return fallback === 'opus' ? 'opus' : 'webm';
  return fallback || 'm4a';
}

/* ── ytdl helpers ─────────────────────────────────────────────── */

function pickAudioFormat(formats, format, quality) {
  const audioOnly = formats.filter(f => f.hasAudio && !f.hasVideo);
  if (quality !== 'highestaudio') {
    const byItag = audioOnly.find(f => String(f.itag) === String(quality));
    if (byItag) return byItag;
  }
  const mimeMap = { m4a: 'audio/mp4', mp3: 'audio/mpeg', opus: 'audio/webm', webm: 'audio/webm' };
  const target  = mimeMap[format] || 'audio/mp4';
  const matched = audioOnly.filter(f => f.mimeType?.toLowerCase().includes(target));
  const pool    = matched.length ? matched : audioOnly;
  return pool.sort((a,b) => (b.audioBitrate||0) - (a.audioBitrate||0))[0] ?? null;
}

function mimeFor(format, detectedMime = '') {
  if (detectedMime) return detectedMime.split(';')[0].trim();
  return { m4a: 'audio/mp4', mp3: 'audio/mpeg', opus: 'audio/webm', webm: 'audio/webm' }[format] || 'audio/mp4';
}

function extFor(format, detectedMime = '') {
  if (detectedMime.includes('audio/webm')) return format === 'opus' ? 'opus' : 'webm';
  if (detectedMime.includes('audio/mp4'))  return 'm4a';
  if (detectedMime.includes('audio/mpeg')) return 'mp3';
  return format || 'm4a';
}

function nodeToWebStream(nodeStream) {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data',  chunk => controller.enqueue(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)));
      nodeStream.on('end',   ()    => controller.close());
      nodeStream.on('error', err   => controller.error(err));
    },
    cancel() { nodeStream.destroy(); },
  });
}

/* ── Shared helpers ───────────────────────────────────────────── */

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

function browserHeaders() {
  return {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  };
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
  if (raw.includes('private video'))  return 'This video is private and cannot be downloaded.';
  if (raw.includes('age-restricted')) return 'Age-restricted videos are not supported.';
  if (raw.includes('not available'))  return 'Video not available (region-locked or deleted).';
  if (raw.includes('Could not find')) return 'Could not extract audio. Try again shortly.';
  if (raw.includes('sign in'))        return 'YouTube requires a sign-in for this video.';
  return 'Download failed. Please try again in a moment.';
}
