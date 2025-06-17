import streamlit as st
import os
import tempfile
from urllib.error import URLError
from utils.helpers import is_valid_youtube_url, format_duration
from utils.downloader import get_video_info, download_audio_bytes

# Page config
st.set_page_config(page_title="🎵 YouTube M4A Downloader", page_icon="🎵", layout="centered")

# Progress tracking
if 'progress' not in st.session_state:
    st.session_state.progress = 0
if 'download_ready' not in st.session_state:
    st.session_state.download_ready = False
if 'audio_data' not in st.session_state:
    st.session_state.audio_data = None
if 'file_name' not in st.session_state:
    st.session_state.file_name = ''

# Theme toggle
if 'dark_mode' not in st.session_state:
    st.session_state.dark_mode = True

def update_progress(d):
    if d['status'] == 'downloading':
        downloaded_bytes = d.get('downloaded_bytes', 0)
        total_bytes = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
        if total_bytes > 0:
            percent = int((downloaded_bytes / total_bytes) * 100)
            st.session_state.progress = percent
    elif d['status'] == 'finished':
        st.session_state.download_ready = True

def convert_to_mp3(data):
    from pydub import AudioSegment
    from io import BytesIO
    audio = AudioSegment.from_file(BytesIO(data.getvalue()), format="m4a")
    mp3_io = BytesIO()
    audio.export(mp3_io, format="mp3")
    return mp3_io, "audio/mp3"

# UI
st.title("🎵 YouTube M4A Downloader")
st.markdown("Paste a YouTube video URL below to extract and download its audio.")

url = st.text_input("YouTube Video URL", placeholder="https://www.youtube.com/watch?v=...")

col1, col2 = st.columns([1, 1])
with col1:
    batch_mode = st.checkbox("Batch Mode (comma-separated URLs)")
with col2:
    convert_mp3_flag = st.checkbox("Convert to MP3")

if url:
    if not is_valid_youtube_url(url):
        st.error("Please enter a valid YouTube URL.")
    else:
        urls = [u.strip() for u in url.split(',') if u.strip()]
        for idx, single_url in enumerate(urls):
            st.markdown(f"### Video {idx+1}") 
            with st.spinner("Fetching video details..."):
                video_info = get_video_info(single_url)

            if isinstance(video_info, dict):
                col_img, col_info = st.columns([1, 2])
                with col_img:
                    st.image(video_info['thumbnail'], width=150)
                with col_info:
                    st.subheader(video_info['title'])
                    st.write(f"🕒 Duration: {format_duration(video_info['duration'])}")
                    if video_info['filesize']:
                        st.write(f"📦 File Size: {round(video_info['filesize'] / (1024 * 1024), 2)} MB")
                    if video_info['bitrate']:
                        st.write(f"🔊 Bitrate: {video_info['bitrate']} kbps")

                if st.button(f"⬇️ Start Download ({idx+1})", key=f"btn_{idx}"):
                    with st.spinner("Downloading..."):
                        data, title = download_audio_bytes(single_url, update_progress)
                        st.session_state.audio_data = data
                        st.session_state.file_name = f"{title}.{'mp3' if convert_mp3_flag else 'm4a'}"
                        if convert_mp3_flag:
                            st.session_state.audio_data, _ = convert_to_mp3(data)

                        st.success("✅ Download complete!")
                        st.download_button(
                            label="📥 Save Audio",
                            data=st.session_state.audio_data,
                            file_name=st.session_state.file_name,
                            mime="audio/mp3" if convert_mp3_flag else "audio/mp4"
                        )
            else:
                st.warning(f"Could not retrieve video information for video {idx+1}")

# Footer
st.markdown("---")
=======
import streamlit as st
import os
import tempfile
from urllib.error import URLError
from utils.helpers import is_valid_youtube_url, format_duration
from utils.downloader import get_video_info, download_audio_bytes

# Page config
st.set_page_config(page_title="🎵 YouTube M4A Downloader", page_icon="🎵", layout="centered")

# Progress tracking
if 'progress' not in st.session_state:
    st.session_state.progress = 0
if 'download_ready' not in st.session_state:
    st.session_state.download_ready = False
if 'audio_data' not in st.session_state:
    st.session_state.audio_data = None
if 'file_name' not in st.session_state:
    st.session_state.file_name = ''

# Theme toggle
if 'dark_mode' not in st.session_state:
    st.session_state.dark_mode = True

def update_progress(d):
    if d['status'] == 'downloading':
        downloaded_bytes = d.get('downloaded_bytes', 0)
        total_bytes = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
        if total_bytes > 0:
            percent = int((downloaded_bytes / total_bytes) * 100)
            st.session_state.progress = percent
    elif d['status'] == 'finished':
        st.session_state.download_ready = True

def convert_to_mp3(data):
    from pydub import AudioSegment
    from io import BytesIO
    audio = AudioSegment.from_file(BytesIO(data.getvalue()), format="m4a")
    mp3_io = BytesIO()
    audio.export(mp3_io, format="mp3")
    return mp3_io, "audio/mp3"

# UI
st.title("🎵 YouTube M4A Downloader")
st.markdown("Paste a YouTube video URL below to extract and download its audio.")

url = st.text_input("YouTube Video URL", placeholder="https://www.youtube.com/watch?v=...")

col1, col2 = st.columns([1, 1])
with col1:
    batch_mode = st.checkbox("Batch Mode (comma-separated URLs)")
with col2:
    convert_mp3_flag = st.checkbox("Convert to MP3")

if url:
    if not is_valid_youtube_url(url):
        st.error("Please enter a valid YouTube URL.")
    else:
        urls = [u.strip() for u in url.split(',') if u.strip()]
        for idx, single_url in enumerate(urls):
            st.markdown(f"### Video {idx+1}") 
            with st.spinner("Fetching video details..."):
                video_info = get_video_info(single_url)

            if isinstance(video_info, dict):
                col_img, col_info = st.columns([1, 2])
                with col_img:
                    st.image(video_info['thumbnail'], width=150)
                with col_info:
                    st.subheader(video_info['title'])
                    st.write(f"🕒 Duration: {format_duration(video_info['duration'])}")
                    if video_info['filesize']:
                        st.write(f"📦 File Size: {round(video_info['filesize'] / (1024 * 1024), 2)} MB")
                    if video_info['bitrate']:
                        st.write(f"🔊 Bitrate: {video_info['bitrate']} kbps")

                if st.button(f"⬇️ Start Download ({idx+1})", key=f"btn_{idx}"):
                    with st.spinner("Downloading..."):
                        data, title = download_audio_bytes(single_url, update_progress)
                        st.session_state.audio_data = data
                        st.session_state.file_name = f"{title}.{'mp3' if convert_mp3_flag else 'm4a'}"
                        if convert_mp3_flag:
                            st.session_state.audio_data, _ = convert_to_mp3(data)

                        st.success("✅ Download complete!")
                        st.download_button(
                            label="📥 Save Audio",
                            data=st.session_state.audio_data,
                            file_name=st.session_state.file_name,
                            mime="audio/mp3" if convert_mp3_flag else "audio/mp4"
                        )
            else:
                st.warning(f"Could not retrieve video information for video {idx+1}")

# Footer
st.markdown("---")

st.markdown("<div style='text-align:center; color:gray;'>Built with 🐍 Python, Streamlit & yt-dlp</div>", unsafe_allow_html=True)
