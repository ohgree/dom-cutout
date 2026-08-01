// Scroll-reveal for elements marked data-reveal: rise in on first entry
// into the viewport. The initial hidden state is JS-applied, so without
// JS everything is simply visible; skipped under prefers-reduced-motion.
//
// Translation + opacity ONLY: a translate shifts a cutout's content and
// overlay rects equally, so masks measured mid-reveal stay correct — a
// scale would skew them (see the transform caveat in the README).
export const wireReveals = () => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const targets = document.querySelectorAll("[data-reveal]");
  if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -10% 0px" },
  );
  for (const el of targets) {
    el.classList.add("reveal-pending");
    observer.observe(el);
  }
};
