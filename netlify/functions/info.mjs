/**
 * GET /api/info?url=<youtube-url>&format=m4a&quality=highestaudio
 *
 * Uses youtubei.js (Innertube) — the same internal API YouTube's own clients
 * use. Much more reliable than ytdl-core on serverless infrastructure.
 */

export const config = { path: '/api/info' };

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const params   = new URL(req.url).searchParams;
  const videoUrl = params.get('url')     || '';
  const format   = params.get('format')  || 'm4a';
  const quality  = params.get('quality') || 'highestaudio';

  if (!videoUrl) return jsonError('Missing url parameter', 400);

  const videoId = extractVideoId(videoUrl);
  if (!videoId)  return jsonError('Invalid or unsupported YouTube URL', 400);

  try {
    const { Innertube } = await import('youtubei.js');

    // generate_session_locally avoids the extra round-trip to YouTube's servers
    const yt   = await Innertube.create({ generate_session_locally: true });
    const info = await yt.getBasicInfo(videoId);

    const details = info.basic_info;

    if (!details?.id) {
      return jsonError('Video not found or unavailable.', 404);
    }

    // Pull audio-only adaptive formats
    const streamingData = info.streaming_data;
    const adaptiveFmts  = streamingData?.adaptive_formats ?? [];

    const audioFormats = adaptiveFmts
      .filter(f => f.has_audio && !f.has_video)
      .map(f => ({
        itag:          f.itag,
        mimeType:      f.mime_type,
        audioBitrate:  f.audio_sample_rate ? null : (f.bitrate ? Math.round(f.bitrate / 1000) : null),
        bitrate:       f.bitrate || 0,
        contentLength: f.content_length ?? null,
        quality:       f.audio_quality ?? null,
        approxDuration: f.approx_duration_ms ? Math.round(f.approx_duration_ms / 1000) : null,
      }))
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    const chosen = pickFormat(audioFormats, format, quality);

    // Best thumbnail
    const thumbs    = details.thumbnail ?? [];
    const thumbnail = thumbs.sort((a,b) => (b.width||0)-(a.width||0))[0]?.url
      ?? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

    return jsonOk({
      title:      details.title       || 'Unknown title',
      author:     details.author      || '',
      duration:   details.duration    || 0,
      thumbnail,
      viewCount:  details.view_count  || 0,
      videoId:    details.id,
      isLive:     details.is_live     || false,
      formats:    audioFormats,
      chosenItag: chosen?.itag        ?? null,
    });

  } catch (err) {
    console.error('[info] error:', err?.message ?? err);
    return jsonError(friendlyError(String(err?.message ?? err)), 502);
  }
};

/* ── Helpers ──────────────────────────────────────────── */

function pickFormat(formats, format, quality) {
  if (!formats.length) return null;

  if (quality !== 'highestaudio') {
    const byItag = formats.find(f => String(f.itag) === String(quality));
    if (byItag) return byItag;
  }

  // Map user format label → mime substring
  const mimeHint = { m4a: 'mp4', mp3: 'mpeg', opus: 'webm', webm: 'webm' }[format] || 'mp4';
  const matched  = formats.filter(f => f.mimeType?.includes(mimeHint));
  return (matched.length ? matched : formats)[0] || null;
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
  if (raw.includes('private'))        return 'This video is private and cannot be downloaded.';
  if (raw.includes('age-restricted')) return 'Age-restricted videos are not supported.';
  if (raw.includes('not available'))  return 'This video is not available (region-locked or deleted).';
  if (raw.includes('sign in'))        return 'YouTube requires sign-in for this video.';
  if (raw.includes('abort'))          return 'Request timed out. Please try again.';
  return 'Failed to fetch video info. Please try again in a moment.';
}
