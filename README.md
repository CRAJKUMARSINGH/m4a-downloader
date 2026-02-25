# 🎵 YouTube Audio Downloader

A simple, powerful web app built with **Streamlit**, **yt-dlp**, and **Python** that extracts high-quality audio from YouTube videos in M4A or MP3 format.

## ✨ Features

- 🎵 **High-Quality Audio** - Download in M4A format (AAC codec)
- 🔄 **MP3 Conversion** - Optional MP3 conversion with ffmpeg
- 📦 **Batch Downloading** - Process multiple URLs at once
- 📱 **Responsive Design** - Works on mobile and desktop
- ⚡ **Real-Time Progress** - Visual feedback during downloads
- 🎨 **Clean UI** - Intuitive interface with video previews
- 🛡️ **Error Handling** - Robust error management

## 🚀 Quick Start

### Option 1: Run Locally (Windows)
Double-click `zzstream.bat` - that's it!

### Option 2: Run Locally (Any OS)
```bash
# Clone and setup
git clone https://github.com/CRAJKUMARSINGH/m4a-downloader.git
cd m4a-downloader
pip install -r requirements.txt

# Run
streamlit run app.py
```

### Option 3: Deploy to Streamlit Cloud
1. Fork this repo
2. Go to [share.streamlit.io](https://share.streamlit.io)
3. Deploy with one click

### Install ffmpeg (Optional - for MP3 conversion)
- **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html)
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt-get install ffmpeg`

## 📖 How to Use

### Single Video Download
1. **Copy YouTube URL** from your browser
2. **Paste URL** in the input field
3. **Choose format**: M4A (smaller) or MP3 (universal)
4. **Click "Download Audio"** button
5. **Save file** to your device

### Batch Download
1. **Enable "Batch Mode"** checkbox
2. **Paste multiple URLs** separated by commas:
   ```
   https://youtube.com/watch?v=VIDEO1,
   https://youtube.com/watch?v=VIDEO2
   ```
3. **Download each video** individually
4. **Save files** one by one

**See [USAGE.md](USAGE.md) for detailed step-by-step guide with screenshots.**

## 🛠️ Tech Stack

- Python 3.7+ | Streamlit | yt-dlp | pydub | ffmpeg

## ⚖️ Legal Notice

For educational and personal use only. Respect copyright laws and YouTube's Terms of Service.

## 🐛 Troubleshooting

- **ffmpeg not found**: Install ffmpeg and add to PATH
- **Download fails**: Check URL and internet connection
- **File won't play**: Use VLC Media Player

See [USAGE.md](USAGE.md) for detailed troubleshooting.

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - See [LICENSE](LICENSE) file. For educational use only.

---

**Made with ❤️ using Python • Streamlit • yt-dlp**
