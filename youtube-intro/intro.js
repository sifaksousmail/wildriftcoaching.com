const DURATION_SECONDS = 8.0;
const MUSIC_VOLUME = 0.6;
const MUSIC_FADE_IN_SECONDS = 0.22;
const MUSIC_FADE_OUT_SECONDS = 1.05;

const stage = document.getElementById("intro-stage");
const root = stage.style;
const audio = document.getElementById("intro-audio");
const playButton = document.getElementById("play-intro");
const muteButton = document.getElementById("mute-intro");
const query = new URLSearchParams(window.location.search);
const isExportMode = query.has("export");
const isFrameCaptureMode = query.has("framecapture");

if (isExportMode) {
  document.documentElement.classList.add("is-exporting");
  document.body.classList.add("is-exporting");
}

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (from, to, amount) => from + (to - from) * amount;
const easeOutCubic = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeOutQuint = (x) => 1 - Math.pow(1 - clamp(x), 5);
const easeInOutCubic = (x) => {
  const t = clamp(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const smooth = (start, end, time) => easeInOutCubic((time - start) / (end - start));
const reveal = (start, duration, time) => clamp((time - start) / duration);
const fadeWindow = (fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd, time) => (
  smooth(fadeInStart, fadeInEnd, time) * (1 - smooth(fadeOutStart, fadeOutEnd, time))
);

function setPx(name, value) {
  root.setProperty(name, `${value.toFixed(2)}px`);
}

function setUnit(name, value) {
  root.setProperty(name, value.toFixed(4));
}

function setIntroTime(rawTime) {
  const time = clamp(rawTime, 0, DURATION_SECONDS);
  const drift = Math.sin(time * 0.72);

  setPx("--aurora-x", lerp(-18, 18, (drift + 1) / 2));
  setPx("--aurora-y", lerp(-8, 10, (Math.cos(time * 0.5) + 1) / 2));
  root.setProperty("--aurora-rot", `${lerp(-10, 8, (Math.sin(time * 0.46) + 1) / 2).toFixed(2)}deg`);

  const streak = fadeWindow(0.35, 0.7, 1.55, 2.05, time);
  setUnit("--streak-opacity", streak);
  setUnit("--streak-scale", lerp(0.20, 1.15, easeOutCubic((time - 0.35) / 1.0)));
  setPx("--streak-x", lerp(-920, 320, easeInOutCubic((time - 0.35) / 1.55)));
  setPx("--streak-y", lerp(18, -18, easeInOutCubic((time - 0.35) / 1.55)));

  const streak2 = fadeWindow(0.65, 0.9, 1.6, 2.2, time);
  setUnit("--streak2-opacity", streak2 * 0.72);
  setUnit("--streak2-scale", lerp(0.18, 0.92, easeOutCubic((time - 0.65) / 1.05)));
  setPx("--streak2-x", lerp(-980, 260, easeInOutCubic((time - 0.65) / 1.55)));

  const logoIn = smooth(1.18, 2.25, time);
  setUnit("--logo-opacity", logoIn);
  setUnit("--logo-scale", lerp(0.78, 1.0, easeOutCubic((time - 1.18) / 1.1)));
  setUnit("--logo-glow", lerp(0.16, 0.52, logoIn) + Math.sin(time * 5.2) * 0.025 * logoIn);

  const pulse = fadeWindow(1.95, 2.25, 3.35, 3.95, time);
  setUnit("--pulse-opacity", pulse * 0.8);
  setUnit("--pulse-scale", lerp(0.68, 1.42, easeOutCubic((time - 1.95) / 1.7)));
  setUnit("--ring-opacity", fadeWindow(1.75, 2.18, 5.95, 6.65, time) * 0.85);
  setUnit("--ring-scale", lerp(0.78, 1.08, easeOutCubic((time - 1.75) / 1.4)));

  const ranks = reveal(1.9, 1.75, time);
  const rankFloat = Math.sin(time * 2.0) * 7 * ranks * (1 - smooth(6.25, 7.0, time));
  setUnit("--rank-opacity", ranks);
  setUnit("--rank-scale", lerp(0.80, 1.0, smooth(1.9, 3.65, time)));
  setPx("--rank-float", rankFloat);

  const titleRaw = reveal(2.82, 0.78, time);
  const title = easeOutQuint(titleRaw);
  const titleMask = easeInOutCubic(titleRaw);
  setUnit("--title-opacity", smooth(2.82, 3.32, time));
  setPx("--title-y", lerp(18, 0, title));
  setPx("--title-blur", lerp(14, 0, title));
  setUnit("--title-scale", lerp(0.985, 1.0, title));
  root.setProperty("--title-track", `${lerp(0.065, 0, title).toFixed(4)}em`);
  root.setProperty("--title-clip-left", `${lerp(3, 0, titleMask).toFixed(2)}%`);
  root.setProperty("--title-clip-right", `${lerp(100, 0, titleMask).toFixed(2)}%`);

  const subtitleRaw = reveal(3.42, 0.52, time);
  const subtitle = easeOutCubic(subtitleRaw);
  setUnit("--subtitle-opacity", smooth(3.42, 3.78, time));
  setPx("--subtitle-y", lerp(14, 0, subtitle));
  setPx("--subtitle-blur", lerp(9, 0, subtitle));
  setUnit("--subtitle-scale", lerp(0.992, 1.0, subtitle));
  root.setProperty("--subtitle-track", `${lerp(0.05, 0, subtitle).toFixed(4)}em`);

  const siteRaw = reveal(4.18, 0.62, time);
  const site = easeOutCubic(siteRaw);
  const shinePrimary = reveal(4.82, 1.35, time) * (1 - reveal(6.17, 0.18, time));
  const shineSecond = reveal(6.65, 1.15, time) * (1 - reveal(7.8, 0.18, time));
  const shine = shinePrimary > 0 ? shinePrimary : shineSecond;
  const shineStrength = shinePrimary > 0 ? 1 : shineSecond * 0.42;
  setUnit("--site-opacity", smooth(4.18, 4.62, time));
  setPx("--site-y", lerp(12, 0, site));
  setPx("--site-blur", lerp(8, 0, site));
  root.setProperty("--site-clip", `${lerp(100, 0, easeInOutCubic(siteRaw)).toFixed(2)}%`);
  root.setProperty("--site-shine-x", `${lerp(125, -125, shine).toFixed(2)}%`);
  setUnit("--site-shine-opacity", shineStrength);
}

window.__setIntroTime = setIntroTime;
window.__INTRO_DURATION_SECONDS = DURATION_SECONDS;

let startedAt = null;
let isPlaying = false;
function animate(now) {
  if (!isPlaying && !isExportMode) return;
  if (startedAt === null) startedAt = now;
  const elapsed = (now - startedAt) / 1000;
  setIntroTime(Math.min(elapsed, DURATION_SECONDS));
  updateMusicVolume(elapsed);
  if (elapsed >= DURATION_SECONDS && !isExportMode) {
    isPlaying = false;
    stage.classList.remove("is-playing");
    playButton.textContent = "Replay intro";
    setIntroTime(DURATION_SECONDS);
    stopMusicAtEnd();
    return;
  }
  requestAnimationFrame(animate);
}

function updateMusicVolume(elapsed) {
  if (!audio) return;
  const fadeIn = clamp(elapsed / MUSIC_FADE_IN_SECONDS);
  const fadeOut = clamp((DURATION_SECONDS - elapsed) / MUSIC_FADE_OUT_SECONDS);
  audio.volume = MUSIC_VOLUME * Math.min(fadeIn, fadeOut);
}

function stopMusicAtEnd() {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
  audio.volume = MUSIC_VOLUME;
}

function startIntro() {
  startedAt = null;
  isPlaying = true;
  setIntroTime(0);
  stage.classList.add("is-playing");
  playButton.textContent = "Replay intro";

  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0;
    audio.play().catch(() => {
      playButton.textContent = "Play intro";
    });
  }

  requestAnimationFrame(animate);
}

function toggleMute() {
  if (!audio) return;
  audio.muted = !audio.muted;
  muteButton.textContent = audio.muted ? "Unmute" : "Mute";
  muteButton.setAttribute("aria-pressed", String(audio.muted));
}

setIntroTime(0);
if (isExportMode) {
  if (!isFrameCaptureMode) {
    isPlaying = true;
    requestAnimationFrame(animate);
  }
} else {
  playButton?.addEventListener("click", startIntro);
  muteButton?.addEventListener("click", toggleMute);
  audio?.addEventListener("ended", () => {
    if (!isPlaying) return;
    isPlaying = false;
    stage.classList.remove("is-playing");
    setIntroTime(DURATION_SECONDS);
  });
}
