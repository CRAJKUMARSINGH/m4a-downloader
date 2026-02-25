# 🤝 Contributing

Thank you for your interest in contributing!

## How to Contribute

### Reporting Bugs
1. Check existing issues first
2. Use GitHub Issues
3. Include:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment (OS, browser, Python version)

### Suggesting Features
1. Check if already proposed
2. Open GitHub Issue
3. Describe problem and proposed solution

### Contributing Code

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/youtube-audio-downloader.git
   cd youtube-audio-downloader
   ```
3. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make changes**
5. **Test thoroughly**
6. **Commit with clear message**
   ```bash
   git commit -m "feat: add new feature"
   ```
7. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Coding Standards

### Python Style
- Follow PEP 8
- Use 4 spaces for indentation
- Line length: 88 characters
- Add docstrings to functions

### Commit Messages
Use conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring

### Example
```python
def download_audio(url):
    """
    Download audio from YouTube URL.
    
    Args:
        url (str): YouTube video URL
        
    Returns:
        BytesIO: Audio data
    """
    # Implementation
    pass
```

## Development Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Run app
streamlit run app.py
```

## Testing

Before submitting:
- Test with various YouTube URLs
- Check error handling
- Verify on different browsers
- Test batch mode

## Code of Conduct

- Be respectful and inclusive
- Accept constructive criticism
- Focus on what's best for the project
- Show empathy towards others

## Questions?

- Open GitHub Discussion
- Check existing issues
- Read documentation

---

**Thank you for contributing! 🎉**
