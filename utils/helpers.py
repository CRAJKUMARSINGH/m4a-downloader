import re

def is_valid_youtube_url(url):
    """Validate if the input is a valid YouTube URL."""
    youtube_regex = (
        r'(https?://)?(www\.)?(youtube\.com|youtu\.be)/'
    )
    return re.match(youtube_regex, url) is not None

def format_duration(seconds):
    """Convert seconds to MM:SS or HH:MM:SS format."""
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    return f"{h:d}:{m:02d}:{s:02d}" if h > 0 else f"{m:02d}:{s:02d}"