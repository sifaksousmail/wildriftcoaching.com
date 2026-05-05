# WildRiftCoaching.com YouTube Outro

Standalone 16:9 outro animation for YouTube videos. It matches the current intro style:

- dark purple/blue background
- soft aurora glow
- existing `../logo-main.svg`
- the same intro music in `assets/intro-music.mp3`
- premium esports coaching identity
- a clean subscribe, like/comment/share, and website call-to-action

The website pages and `/youtube-intro` are not changed by this folder.

## Preview

From the site root:

```bash
python3 -m http.server 8001
```

Then open:

```text
http://localhost:8001/youtube-outro/
```

The outro is designed for `1920x1080` and scales down for smaller preview screens.
Use the **Play outro** button to start the animation with audio. Browsers usually block sound until there is a click.

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
youtube-outro/wildriftcoaching-outro.mp4
```

Default export is 1080p at 30 FPS. To export at 60 FPS:

```bash
FPS=60 npm run export
```

The export script uses a 6-second section from the middle of `assets/intro-music.mp3` at about 60% volume with a short fade in and fade out. By default it starts at 44 seconds. To choose a different starting point:

```bash
AUDIO_START=52 npm run export
```
