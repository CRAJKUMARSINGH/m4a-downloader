import yt_dlp
import os
from io import BytesIO

def get_video_info(url):
    try:
        ydl_opts = {
            'quiet': True,
            'skip_download': True,
            'format': '140',
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return {
                'title': info.get('title'),
                'duration': info.get('duration'),
                'thumbnail': info.get('thumbnail'),
                'filesize': info.get('formats')[0].get('filesize') or 0,
                'bitrate': info.get('formats')[0].get('abr'),
            }
    except Exception as e:
        return str(e)

def download_audio_bytes(url, progress_hook=None):
    ydl_opts = {
        'format': '140',
        'quiet': True,
        'outtmpl': '%(title)s.%(ext)s',
        'progress_hooks': [progress_hook] if progress_hook else [],
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        result = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(result)
        with open(filename, 'rb') as f:
            audio_data = BytesIO(f.read())
        os.remove(filename)
        return audio_data, result['title']