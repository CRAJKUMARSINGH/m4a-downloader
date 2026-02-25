# 📖 Usage Guide

## Basic Usage

### Single Video Download
1. Copy YouTube URL
2. Paste in the app
3. Choose format (M4A or MP3)
4. Click "Download Audio"
5. Save file

### Batch Download
1. Enable "Batch Mode" checkbox
2. Paste multiple URLs separated by commas
3. Download each video
4. Save files

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
