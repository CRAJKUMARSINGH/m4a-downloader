# 📖 Usage Guide

Complete guide to using the YouTube Audio Downloader.

## Quick Start

### First Time Setup
1. **Install Python 3.7+** from [python.org](https://www.python.org/downloads/)
2. **Download this app** or clone from GitHub
3. **Double-click `zzstream.bat`** (Windows) - it will auto-install dependencies
4. **Browser opens automatically** at `http://localhost:8501`

### For Other Operating Systems
```bash
# Install dependencies
pip install -r requirements.txt

# Run the app
streamlit run app.py
```

## Step-by-Step Usage

### Single Video Download

**Step 1: Find Your Video**
- Go to YouTube
- Find the video you want
- Copy the URL from address bar
  - Example: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`

**Step 2: Open the App**
- Double-click `zzstream.bat` (Windows)
- Or run `streamlit run app.py` in terminal
- Browser opens automatically

**Step 3: Paste URL**
- Click in the "YouTube Video URL" input field
- Paste your copied URL
- Press Enter or click outside the field

**Step 4: Review Video Info**
- App automatically fetches video details:
  - Thumbnail preview
  - Video title
  - Duration
  - File size (approximate)
  - Audio bitrate

**Step 5: Choose Format**
- **M4A (Default)**: 
  - Smaller file size
  - Great quality (128kbps AAC)
  - No conversion needed (faster)
  - Best for: iOS, modern players
- **MP3**: 
  - Universal compatibility
  - Slightly larger (192kbps)
  - Requires ffmpeg installed
  - Best for: All devices

**Step 6: Download**
- Click the **"Download Audio"** button
- Watch the progress:
  - "Downloading audio..." message
  - Progress bar (if available)
  - "Converting to MP3..." (if MP3 selected)

**Step 7: Save File**
- Click **"Save Audio File"** button
- Choose save location (usually Downloads folder)
- File is named after video title automatically

**Done!** Your audio file is ready to use.

### Batch Download Multiple Videos

**Step 1: Enable Batch Mode**
- Check the **"📋 Batch Mode"** checkbox
- This tells the app you'll paste multiple URLs

**Step 2: Prepare Your URLs**
- Open multiple YouTube videos in tabs
- Copy each URL
- Paste them in a text editor first (optional)

**Step 3: Paste Multiple URLs**
- In the app's input field, paste URLs separated by commas:
  ```
  https://youtube.com/watch?v=VIDEO1,
  https://youtube.com/watch?v=VIDEO2,
  https://youtube.com/watch?v=VIDEO3
  ```
- Or paste on separate lines (app handles both)

**Step 4: Review All Videos**
- Each video appears in its own section
- Shows: Video 1, Video 2, Video 3, etc.
- Each has its own preview and info

**Step 5: Download Each Video**
- Click "Download Audio" for first video
- Wait for completion
- Save the file
- Repeat for remaining videos

**Tips for Batch Downloads:**
- Process 3-5 videos at a time for best performance
- Don't close browser until all downloads complete
- Each video downloads independently

## Understanding the Interface

### Main Screen
```
┌─────────────────────────────────────────┐
│  🎵 YouTube Audio Downloader            │
│  Extract high-quality audio from        │
│  YouTube videos in seconds              │
├─────────────────────────────────────────┤
│  YouTube Video URL                      │
│  [Paste URL here...]                    │
│                                         │
│  ☐ 📋 Batch Mode  ☐ 🔄 Convert to MP3  │
│                                         │
│  [Video Preview]                        │
│  Title: Song Name                       │
│  Duration: 3:45                         │
│  Size: 4.2 MB                           │
│                                         │
│  [⬇️ Download Audio]                    │
└─────────────────────────────────────────┘
```

### Sidebar (Left Panel)
- **How to Use** - Quick instructions
- **Features** - What the app can do
- **Tech Stack** - Technologies used
- **Status** - ffmpeg availability

### Progress Indicators
- **"🔍 Fetching video details..."** - Getting video info
- **"📥 Downloading audio..."** - Downloading from YouTube
- **"🔄 Converting to MP3..."** - Converting format
- **"✅ Download complete!"** - Ready to save

## Supported Formats

### M4A (Default)
- Codec: AAC
- Bitrate: ~128kbps
- File size: Smaller
- Quality: Excellent
- Best for: iOS, modern players

### MP3
- Codec: LAME MP3
- Bitrate: 192kbps
- File size: Larger
- Quality: Excellent
- Best for: Universal compatibility

## FAQ

### Q: Is this legal?
A: The tool is legal. However, downloading copyrighted content without permission may violate YouTube's ToS. Use responsibly for personal, educational, or permitted content only.

### Q: What quality is the audio?
A: Best available, typically 128kbps AAC (M4A) or 192kbps MP3.

### Q: Can I download playlists?
A: Not directly. Paste individual video URLs separated by commas for batch download.

### Q: Does this work with other sites?
A: Currently YouTube only.

### Q: Why is MP3 conversion disabled?
A: ffmpeg is not installed. Install it to enable MP3 conversion.

### Q: Download fails immediately
A: Check if URL is valid and video is publicly accessible.

### Q: File won't play
A: Use VLC Media Player which supports all formats.

### Q: App is slow
A: Check internet speed, close other tabs, or try smaller videos.

## Troubleshooting

### ffmpeg not found
1. Download from [ffmpeg.org](https://ffmpeg.org/download.html)
2. Install and add to system PATH
3. Restart terminal/app
4. Verify: `ffmpeg -version`

### Download fails
- Verify URL is correct
- Check internet connection
- Try a different video
- Check if video is region-restricted

### File downloads but won't play
- Use VLC Media Player
- Verify download completed fully
- Try different format

### Slow performance
- Use stable WiFi connection
- Close unnecessary browser tabs
- Try downloading smaller files first
- Disable MP3 conversion for faster processing

## Tips

- **Stable Internet**: WiFi recommended for best results
- **File Size**: Average song is 3-5 MB (M4A), 4-7 MB (MP3)
- **Format Choice**: M4A for size, MP3 for compatibility
- **Batch Mode**: Process 3-5 videos at a time for best performance
- **Legal Use**: Only download content you have permission to use

## Technical Details

### Audio Quality Priority
1. Format 140 (M4A, 128kbps AAC)
2. Best available M4A
3. Best available audio in any format

### File Naming
- Automatically named after video title
- Special characters removed
- Limited to 200 characters

### Supported URLs
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- Any standard YouTube video URL

## Need More Help?

- Check [README.md](README.md) for setup
- Open GitHub issue for bugs
- See [CONTRIBUTING.md](CONTRIBUTING.md) to contribute

---

**Happy downloading! 🎵**
