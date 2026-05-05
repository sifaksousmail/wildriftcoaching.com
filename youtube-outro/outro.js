const DURATION_SECONDS = 6.0;

const stage = document.getElementById("outro-stage");
const root = stage.style;
const playButton = document.getElementById("play-outro");
const muteButton = document.getElementById("mute-outro");
const audio = document.getElementById("outro-audio");
const audioUrl = audio?.getAttribute("src");
const query = new URLSearchParams(window.location.search);
const isExportMode = query.has("export");
const isFrameCaptureMode = query.has("framecapture");
const MUSIC_VOLUME = 0.6;
const MUSIC_START_SECONDS = 44;
const FADE_IN_SECONDS = 0.25;
const FADE_OUT_SECONDS = 0.85;

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

if (isExportMode) {
  document.documentElement.classList.add("is-export");
  document.body.classList.add("is-export");
}

function setPx(name, value) {
  root.setProperty(name, `${value.toFixed(2)}px`);
}

function setUnit(name, value) {
  root.setProperty(name, value.toFixed(4));
}

function setOutroTime(rawTime) {
  const time = clamp(rawTime, 0, DURATION_SECONDS);
  const drift = Math.sin(time * 0.62);

  setPx("--aurora-x", lerp(-14, 20, (drift + 1) / 2));
  setPx("--aurora-y", lerp(-7, 9, (Math.cos(time * 0.48) + 1) / 2));
  root.setProperty("--aurora-rot", `${lerp(-9, 7, (Math.sin(time * 0.44) + 1) / 2).toFixed(2)}deg`);

  const lines = smooth(0.52, 1.32, time) * (1 - smooth(5.65, 6.0, time));
  setUnit("--line-opacity", lines * 0.85);
  setUnit("--line-scale", lerp(0.28, 1.0, smooth(0.52, 1.32, time)));
  setPx("--line-x", lerp(-80, 40, easeOutCubic((time - 0.52) / 0.8)));

  const logoRaw = reveal(0.5, 0.72, time);
  const logo = easeOutCubic(logoRaw);
  setUnit("--logo-opacity", logo);
  setUnit("--logo-scale", lerp(0.84, 1.0, logo));
  setPx("--logo-blur", lerp(12, 0, easeOutQuint(logoRaw)));
  setUnit("--ring-opacity", smooth(0.72, 1.42, time) * 0.85);
  setUnit("--ring-scale", lerp(0.86, 1.08, easeOutCubic((time - 0.72) / 1.0)));

  const pulse = smooth(0.72, 1.45, time) * (1 - smooth(4.7, 5.6, time));
  setUnit("--pulse-opacity", pulse * 0.7);
  setUnit("--pulse-scale", lerp(0.86, 1.34, easeOutCubic((time - 0.72) / 1.4)));

  const thanksRaw = reveal(1.18, 0.78, time);
  const thanks = easeOutCubic(thanksRaw);
  setUnit("--thanks-opacity", smooth(1.18, 1.74, time));
  setPx("--thanks-y", lerp(22, 0, thanks));
  setPx("--thanks-blur", lerp(12, 0, easeOutQuint(thanksRaw)));
  setUnit("--thanks-scale", lerp(0.99, 1.0, thanks));
  root.setProperty("--thanks-clip", `${lerp(100, 0, easeInOutCubic(thanksRaw)).toFixed(2)}%`);

  const subscribeRaw = reveal(2.02, 0.72, time);
  const subscribe = easeOutCubic(subscribeRaw);
  setUnit("--sub-opacity", smooth(2.02, 2.48, time));
  setPx("--sub-y", lerp(18, 0, subscribe));
  setPx("--sub-blur", lerp(9, 0, easeOutQuint(subscribeRaw)));
  root.setProperty("--sub-clip", `${lerp(100, 0, easeInOutCubic(subscribeRaw)).toFixed(2)}%`);

  const siteRaw = reveal(3.45, 0.72, time);
  const site = easeOutCubic(siteRaw);
  setUnit("--site-opacity", smooth(3.45, 3.98, time));
  setPx("--site-y", lerp(18, 0, easeOutCubic(site)));
  setPx("--site-blur", lerp(10, 0, easeOutQuint(siteRaw)));
  setUnit("--site-scale", lerp(0.98, 1.0, site));
  root.setProperty("--site-clip", `${lerp(100, 0, easeInOutCubic(siteRaw)).toFixed(2)}%`);

  const firstShine = reveal(3.92, 1.08, time) * (1 - reveal(5.0, 0.18, time));
  const secondShine = reveal(5.08, 0.72, time) * (1 - reveal(5.8, 0.16, time));
  const shine = Math.max(firstShine, secondShine * 0.72);
  root.setProperty("--site-shine-x", `${lerp(-135, 155, shine).toFixed(2)}%`);
}

window.__setOutroTime = setOutroTime;
window.__OUTRO_DURATION_SECONDS = DURATION_SECONDS;

let startedAt = null;
let isPlaying = false;
let isMuted = false;
let audioContext = null;
let musicBufferPromise = null;
let musicSource = null;
let musicGain = null;

function updateAudioVolume(elapsed) {
  if (!musicGain || !audioContext) return;

  const fadeIn = clamp(elapsed / FADE_IN_SECONDS);
  const fadeOut = clamp((DURATION_SECONDS - elapsed) / FADE_OUT_SECONDS);
  const shaped = Math.min(fadeIn, fadeOut);
  const volume = isMuted ? 0 : MUSIC_VOLUME * shaped;
  musicGain.gain.setTargetAtTime(volume, audioContext.currentTime, 0.025);
}

function getAudioContext() {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  return audioContext;
}

async function loadMusicBuffer() {
  if (!audioUrl) return null;

  musicBufferPromise ||= fetch(audioUrl)
    .then((response) => response.arrayBuffer())
    .then((arrayBuffer) => getAudioContext().decodeAudioData(arrayBuffer));

  return musicBufferPromise;
}

async function startAudio() {
  if (!audioUrl || isExportMode) return;

  try {
    stopAudio();
    const context = getAudioContext();
    await context.resume();
    const buffer = await loadMusicBuffer();
    if (!buffer) return;

    const source = context.createBufferSource();
    const gain = context.createGain();
    const latestStart = Math.max(0, buffer.duration - DURATION_SECONDS - 1);
    const startAt = Math.min(MUSIC_START_SECONDS, latestStart);

    gain.gain.value = 0;
    source.buffer = buffer;
    source.connect(gain).connect(context.destination);
    source.start(0, startAt, DURATION_SECONDS + 0.15);

    musicSource = source;
    musicGain = gain;
    window.__outroAudioState = { startAt, duration: buffer.duration, source: "web-audio" };
  } catch {
    // Browser audio rules can still block sound if this was not user-triggered.
  }
}

function stopAudio() {
  if (musicSource) {
    try {
      musicSource.stop();
    } catch {
      // Already stopped.
    }
    musicSource.disconnect();
    musicSource = null;
  }

  if (musicGain) {
    musicGain.disconnect();
    musicGain = null;
  }
}

function animate(now) {
  if (!isPlaying && !isExportMode) return;
  if (startedAt === null) startedAt = now;
  const elapsed = (now - startedAt) / 1000;
  setOutroTime(Math.min(elapsed, DURATION_SECONDS));
  updateAudioVolume(Math.min(elapsed, DURATION_SECONDS));
  if (elapsed >= DURATION_SECONDS && !isExportMode) {
    isPlaying = false;
    stage.classList.remove("is-playing");
    playButton.textContent = "Replay outro";
    setOutroTime(DURATION_SECONDS);
    stopAudio();
    return;
  }
  requestAnimationFrame(animate);
}

async function startOutro() {
  playButton.textContent = "Loading outro...";
  await startAudio();
  startedAt = null;
  isPlaying = true;
  setOutroTime(0);
  stage.classList.add("is-playing");
  playButton.textContent = "Replay outro";
  requestAnimationFrame(animate);
}

setOutroTime(0);
if (isExportMode) {
  stage.classList.add("is-export");
  if (!isFrameCaptureMode) {
    isPlaying = true;
    requestAnimationFrame(animate);
  }
} else {
  playButton?.addEventListener("click", startOutro);
  muteButton?.addEventListener("click", () => {
    isMuted = !isMuted;
    updateAudioVolume(startedAt === null ? 0 : (performance.now() - startedAt) / 1000);
    muteButton.textContent = isMuted ? "Unmute" : "Mute";
    muteButton.setAttribute("aria-pressed", String(isMuted));
  });
}
