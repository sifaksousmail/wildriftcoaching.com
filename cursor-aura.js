(function () {
  const canUseAura =
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!canUseAura) return;

  const root = document.body;
  let targetX = window.innerWidth * 0.5;
  let targetY = window.innerHeight * 0.22;
  let currentX = targetX;
  let currentY = targetY;
  let targetOpacity = 0;
  let currentOpacity = 0;
  let running = false;

  root.classList.add("has-cursor-aura");

  function render() {
    currentX += (targetX - currentX) * 0.18;
    currentY += (targetY - currentY) * 0.18;
    currentOpacity += (targetOpacity - currentOpacity) * 0.14;

    root.style.setProperty("--cursor-aura-x", `${currentX.toFixed(1)}px`);
    root.style.setProperty("--cursor-aura-y", `${currentY.toFixed(1)}px`);
    root.style.setProperty("--cursor-aura-opacity", currentOpacity.toFixed(3));
    root.style.setProperty("--cursor-aura-blue", (currentOpacity * 0.2).toFixed(3));
    root.style.setProperty("--cursor-aura-purple", (currentOpacity * 0.16).toFixed(3));
    root.style.setProperty("--cursor-aura-soft", (currentOpacity * 0.12).toFixed(3));

    if (
      Math.abs(targetX - currentX) > 0.1 ||
      Math.abs(targetY - currentY) > 0.1 ||
      Math.abs(targetOpacity - currentOpacity) > 0.01
    ) {
      requestAnimationFrame(render);
      return;
    }

    running = false;
  }

  function schedule() {
    if (running) return;
    running = true;
    requestAnimationFrame(render);
  }

  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      targetX = event.clientX;
      targetY = event.clientY;
      targetOpacity = 1;
      schedule();
    },
    { passive: true }
  );

  document.addEventListener("mouseleave", () => {
    targetOpacity = 0;
    schedule();
  });

  window.addEventListener(
    "blur",
    () => {
      targetOpacity = 0;
      schedule();
    },
    { passive: true }
  );
})();
