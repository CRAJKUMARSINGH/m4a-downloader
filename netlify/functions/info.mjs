/**
 * GET /api/info?url=<youtube-url>&format=m4a&quality=highestaudio
 *
 * Strategy:
 *   1. Try Invidious public API (handles YouTube bot-detection server-side)
 *   2. Fall back to @distube/ytdl-core if Invidious fails
 */

export const config = { path: '/api/info' };

// Rotate through several public Invidious instances
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

  if (!videoUrl) return jsonError('Missing url parameter', 400);

  const videoId = extractVideoId(videoUrl);
  if (!videoId)  return jsonError('Invalid or unsupported YouTube URL', 400);

  // ── 1. Try Invidious ───────────────────────────────────────────
  const inv = await tryInvidious(videoId, format, quality);
  if (inv) return jsonOk(inv);

  // ── 2. Fall back to ytdl-core ──────────────────────────────────
  try {
    const ytdl   = (await import('@distube/ytdl-core')).default;
    const info   = await ytdl.getInfo(videoUrl, {
      requestOptions: { headers: browserHeaders() },
    });
    const details = info.videoDetails;
    const chosen  = pickAudioFormat(info.formats, format, quality);
    const audioFormats = buildFormatList(info.formats);

    return jsonOk({
      title:       details.title,
      author:      details.author?.name || details.ownerChannelName || '',
      duration:    parseInt(details.lengthSeconds, 10),
      thumbnail:   bestThumbnail(details.thumbnails),
      viewCount:   details.viewCount,
      videoId:     details.videoId,
      isLive:      details.isLiveContent,
      formats:     audioFormats,
      chosenItag:  chosen?.itag ?? null,
    });
  } catch (err) {
    console.error('[info] ytdl fallback error:', err.message);
    return jsonError(friendlyError(err.message), 502);
  }
};

/* ── Invidious helper ──────────────────────────────────────────── */

async function tryInvidious(videoId, format, quality) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const controller = new AbortController();
      const timer      = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(
        `${base}/api/v1/videos/${videoId}?fields=title,author,lengthSeconds,viewCount,videoThumbnails,adaptiveFormats,liveNow`,
        { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      clearTimeout(timer);

      if (!res.ok) continue;
      const data = await res.json();
      if (data.error) continue;

      // Filter to audio-only adaptive formats
      const audioFormats = (data.adaptiveFormats || [])
        .filter(f => f.type?.startsWith('audio/'))
        .map(f => ({
          itag:          f.itag,
          mimeType:      f.type,
          audioBitrate:  f.bitrate ? Math.round(f.bitrate / 1000) : null,
          contentLength: f.clen || null,
          quality:       f.audioQuality || null,
          url:           f.url,          // direct signed URL from Invidious
        }))
        .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

      const chosen = chooseInvidiousFormat(audioFormats, format, quality);

      return {
        title:      data.title       || '',
        author:     data.author      || '',
        duration:   parseInt(data.lengthSeconds, 10) || 0,
        thumbnail:  invidiousBestThumb(data.videoThumbnails),
        viewCount:  data.viewCount   || 0,
        videoId,
        isLive:     !!data.liveNow,
        formats:    audioFormats,
        chosenItag: chosen?.itag ?? null,
        // Pass the direct URL so download function can use it if available
        directUrl:  chosen?.url      || null,
        _source:    'invidious',
      };
    } catch (e) {
      console.warn(`[info] Invidious ${base} failed:`, e.message);
    }
  }
  return null;
}

function chooseInvidiousFormat(formats, format, quality) {
  if (!formats.length) return null;

  if (quality !== 'highestaudio') {
    const byItag = formats.find(f => String(f.itag) === String(quality));
    if (byItag) return byItag;
  }

  const mimeMap = { m4a: 'audio/mp4', mp3: 'audio/mpeg', opus: 'audio/webm', webm: 'audio/webm' };
  const target  = mimeMap[format] || 'audio/mp4';
  const matched = formats.filter(f => f.mimeType?.includes(target.split('/')[1]));
  return (matched.length ? matched : formats)[0];
}

function invidiousBestThumb(thumbs) {
  if (!thumbs?.length) return '';
  return (
    thumbs.find(t => t.quality === 'maxres')?.url ||
    thumbs.find(t => t.quality === 'high')?.url   ||
    thumbs.sort((a,b) => (b.width||0) - (a.width||0))[0]?.url ||
    ''
  );
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

function buildFormatList(formats) {
  return formats
    .filter(f => f.hasAudio && !f.hasVideo)
    .map(f => ({
      itag:          f.itag,
      mimeType:      f.mimeType,
      audioBitrate:  f.audioBitrate,
      contentLength: f.contentLength,
      quality:       f.audioQuality,
    }))
    .sort((a,b) => (b.audioBitrate||0) - (a.audioBitrate||0));
}

function bestThumbnail(thumbnails) {
  if (!thumbnails?.length) return '';
  return thumbnails
    .filter(t => t.url)
    .sort((a,b) => (b.width||0) - (a.width||0))[0]?.url || '';
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

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonOk(data) {
  return new Response(JSON.stringify(data), {
    status:  200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
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
  if (raw.includes('not available'))   return 'This video is not available (region-locked or deleted).';
  if (raw.includes('Could not find'))  return 'Could not extract audio. Please try again shortly.';
  if (raw.includes('sign in'))         return 'YouTube requires a sign-in for this video.';
  return 'Failed to fetch video info. Please try again in a moment.';
}
