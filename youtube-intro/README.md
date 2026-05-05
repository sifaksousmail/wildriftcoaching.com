# WildRiftCoaching.com YouTube Intro

Standalone 16:9 intro animation for YouTube. It uses the existing site assets:

- `../logo-main.svg`
- `../rank-sovereign.png`
- `../rank-challenger.png`

The website pages are not changed by this folder.

## Preview

From the site root:

```bash
python3 -m http.server 8001
```

Then open:

```text
http://localhost:8001/youtube-intro/
```

The composition is designed for `1920x1080` and scales down to fit smaller screens.

Click `Play intro` to start the animation with the music. Use `Mute` / `Unmute` for audio preview.

The intro uses `assets/eyes-patrick-jordan-patrikios.mp3` as the only audio source. The preview starts it at `0:00`, uses the first 8 seconds, plays it at about 60% volume, and applies a slight fade-in plus a smooth fade-out.

## Export MP4

Requirements:

- Node.js/npm
- FFmpeg installed and available as `ffmpeg`

From this folder:

```bash
npm install
npm run export
```

The script renders deterministic PNG frames with Playwright and creates:

```text
youtube-intro/wildriftcoaching-intro.mp4
```

If `assets/eyes-patrick-jordan-patrikios.mp3` exists, the export script includes only the first 8 seconds as AAC audio in the MP4.

Default export is 1080p at 30 FPS. To export at 60 FPS:

```bash
FPS=60 npm run export
```

If FFmpeg is not installed, install it first or record the browser preview with system audio using your video editor.
