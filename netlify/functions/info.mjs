/**
 * GET /api/info?url=<youtube-url>&format=m4a&quality=highestaudio
 *
 * Returns JSON with video metadata + available audio formats.
 * Uses @distube/ytdl-core — the most actively maintained ytdl fork.
 */

import ytdl from '@distube/ytdl-core';

// Netlify routes /api/info → netlify/functions/info.mjs
export default async (req, context) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  const url = new URL(req.url);
  const videoUrl = url.searchParams.get('url') || '';
  const format   = url.searchParams.get('format')  || 'm4a';
  const quality  = url.searchParams.get('quality') || 'highestaudio';

  if (!videoUrl) {
    return jsonError('Missing url parameter', 400);
  }

  if (!ytdl.validateURL(videoUrl)) {
    return jsonError('Invalid or unsupported YouTube URL', 400);
  }

  try {
    const info = await ytdl.getInfo(videoUrl, {
      requestOptions: {
        headers: {
          // Mimic a real browser to reduce bot-detection blocks
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
    });

    const details = info.videoDetails;

    // Pick the best audio-only format based on user preference
    const chosenFormat = pickAudioFormat(info.formats, format, quality);

    // Build a safe list of available audio formats for the client
    const audioFormats = info.formats
      .filter(f => f.hasAudio && !f.hasVideo)
      .map(f => ({
        itag:       f.itag,
        mimeType:   f.mimeType,
        audioBitrate: f.audioBitrate,
        contentLength: f.contentLength,
        quality:    f.audioQuality,
      }))
      .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

    return new Response(
      JSON.stringify({
        title:       details.title,
        author:      details.author?.name || details.ownerChannelName || '',
        duration:    parseInt(details.lengthSeconds, 10),
        thumbnail:   bestThumbnail(details.thumbnails),
        viewCount:   details.viewCount,
        videoId:     details.videoId,
        isLive:      details.isLiveContent,
        formats:     audioFormats,
        chosenItag:  chosenFormat?.itag ?? null,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      }
    );

  } catch (err) {
    console.error('[info] ytdl error:', err.message);

    // Surface a friendly message for common failures
    const msg = friendlyError(err.message);
    return jsonError(msg, 502);
  }
};

/* ── Helpers ──────────────────────────────────────────── */

/**
 * Pick the best audio-only format matching the user's format + quality prefs.
 * Priority: exact itag match → mime-type match by format → highest bitrate.
 */
function pickAudioFormat(formats, format, quality) {
  const audioOnly = formats.filter(f => f.hasAudio && !f.hasVideo);

  // If a specific itag was requested
  if (quality !== 'highestaudio') {
    const byItag = audioOnly.find(f => String(f.itag) === String(quality));
    if (byItag) return byItag;
  }

  // Map user-friendly format names to mime-type substrings
  const mimeMap = {
    m4a:  'audio/mp4',
    mp3:  'audio/mpeg',
    opus: 'audio/webm; codecs="opus"',
    webm: 'audio/webm',
  };

  const targetMime = mimeMap[format] || 'audio/mp4';
  const matching = audioOnly.filter(f =>
    f.mimeType && f.mimeType.toLowerCase().includes(targetMime.split(';')[0].trim())
  );

  const pool = matching.length > 0 ? matching : audioOnly;
  return pool.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0] ?? null;
}

/** Return the highest-resolution thumbnail URL */
function bestThumbnail(thumbnails) {
  if (!thumbnails?.length) return '';
  return thumbnails
    .filter(t => t.url)
    .sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || '';
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
  if (raw.includes('age-restricted')) return 'This video is age-restricted. Age-restricted videos are not supported.';
  if (raw.includes('not available'))  return 'This video is not available (may be region-locked or deleted).';
  if (raw.includes('Could not find'))  return 'Could not extract audio from this video. YouTube may have changed its format — please try again shortly.';
  if (raw.includes('sign in'))        return 'YouTube requires a sign-in to access this video.';
  return 'Failed to fetch video info from YouTube. Please try again in a moment.';
}

export const config = {
  path: '/api/info',
};
