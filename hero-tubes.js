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

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canUseWebGL = () => {
  try {
    const testCanvas = document.createElement("canvas");
    return Boolean(testCanvas.getContext("webgl2") || testCanvas.getContext("webgl"));
  } catch {
    return false;
  }
};

if (hero && canvas && !prefersReducedMotion && canUseWebGL()) {
  const loadTubes = async () => {
    try {
      const module = await import("https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js");
      const TubesCursor = module.default ?? module;
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
      window.addEventListener("pagehide", () => {
        window.removeEventListener("pointermove", relayPointer);
        app?.dispose?.();
      }, { once: true });
    } catch (error) {
      hero.classList.remove("tubes-ready");
      console.info("Hero tube background skipped:", error);
    }
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(loadTubes, { timeout: 1600 });
  } else {
    window.addEventListener("load", loadTubes, { once: true });
  }
}
