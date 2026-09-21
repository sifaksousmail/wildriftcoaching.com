const hero = document.querySelector("[data-tubes-hero]");
const canvas = document.getElementById("hero-tubes");

const settleBookingHash = () => {
  if (window.location.hash !== "#book-coaching") return;
  const bookingSection = document.getElementById("book-coaching");
  if (!bookingSection) return;

  window.setTimeout(() => {
    bookingSection.scrollIntoView({ block: "start" });
  }, 120);
};

if (document.readyState === "complete") {
  settleBookingHash();
} else {
  window.addEventListener("load", settleBookingHash, { once: true });
}

const canUseTubes = () =>
  window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
  !navigator.connection?.saveData;
const canUseWebGL = () => {
  try {
    const testCanvas = document.createElement("canvas");
    return Boolean(testCanvas.getContext("webgl2") || testCanvas.getContext("webgl"));
  } catch {
    return false;
  }
};

if (hero && canvas && canUseTubes() && canUseWebGL()) {
  let loading = false;
  let pageHidden = false;
  let visibilityObserver;
  const heroIsVisible = () => {
    const bounds = hero.getBoundingClientRect();
    return !document.hidden && bounds.bottom > 0 && bounds.top < window.innerHeight;
  };
  const stopWaiting = () => {
    visibilityObserver?.disconnect();
    document.removeEventListener("visibilitychange", scheduleLoad);
  };

  const loadTubes = async () => {
    if (loading || pageHidden || !canUseTubes() || !heroIsVisible()) return;
    loading = true;
    stopWaiting();
    try {
      const module = await import("https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js");
      if (pageHidden) return;
      const TubesCursor = module.default ?? module;
      // The pinned component pauses its render loop offscreen and in hidden tabs.
      const app = TubesCursor(canvas, {
        tubes: {
          colors: ["#38bdf8", "#7c3aed", "#a78bfa"],
          lights: {
            intensity: 145,
            colors: ["#38bdf8", "#8b5cf6", "#c4b5fd", "#22d3ee"],
          },
        },
      });

      hero.classList.add("tubes-ready");

      const relayPointer = (event) => {
        const bounds = hero.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          return;
        }

        const eventOptions = {
          bubbles: false,
          clientX: event.clientX,
          clientY: event.clientY,
          screenX: event.screenX,
          screenY: event.screenY,
          movementX: event.movementX || 0,
          movementY: event.movementY || 0,
        };

        canvas.dispatchEvent(new MouseEvent("mousemove", eventOptions));
        if ("PointerEvent" in window) {
          canvas.dispatchEvent(new PointerEvent("pointermove", {
            ...eventOptions,
            pointerId: event.pointerId || 1,
            pointerType: event.pointerType || "mouse",
            isPrimary: true,
          }));
        }
      };

      window.addEventListener("pointermove", relayPointer, { passive: true });
      window.addEventListener("pagehide", (event) => {
        if (event.persisted) return;
        window.removeEventListener("pointermove", relayPointer);
        app?.dispose?.();
      });
    } catch (error) {
      hero.classList.remove("tubes-ready");
      console.info("Hero tube background skipped:", error);
    }
  };

  function scheduleLoad() {
    if (loading || pageHidden || !heroIsVisible()) return;
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(loadTubes, { timeout: 1600 });
    } else if (document.readyState === "complete") {
      loadTubes();
    } else {
      window.addEventListener("load", loadTubes, { once: true });
    }
  }

  if ("IntersectionObserver" in window) {
    visibilityObserver = new IntersectionObserver(scheduleLoad);
    visibilityObserver.observe(hero);
  }
  document.addEventListener("visibilitychange", scheduleLoad);
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    pageHidden = true;
    stopWaiting();
  });
  scheduleLoad();
}
