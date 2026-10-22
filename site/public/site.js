// Progressive enhancement only: every page reads fine without this file.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Header border once the page scrolls.
  const header = document.querySelector(".site-header");
  const onScroll = () => header && header.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Tabs: [role=tablist] > [role=tab][aria-controls]. Arrow keys move between tabs.
  for (const list of document.querySelectorAll('[role="tablist"]')) {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const select = (tab, focus) => {
      for (const t of tabs) {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) {
          panel.hidden = !on;
          if (on) play(panel);
        }
      }
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (d) { e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true); }
      });
    });
  }

  // Demo panels replay their sequence from the start.
  function play(el) {
    if (!el.matches("[data-demo]")) return;
    el.classList.remove("play");
    void el.offsetWidth;
    el.classList.add("play");
  }
  for (const btn of document.querySelectorAll("[data-replay]")) {
    btn.addEventListener("click", () => {
      const panel = document.querySelector("[data-demo]:not([hidden])");
      if (panel) play(panel);
    });
  }

  // Reveal on scroll, and start demos when they come into view.
  if (!("IntersectionObserver" in window) || reduce) {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
    document.querySelectorAll("[data-demo]").forEach((el) => el.classList.add("play"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      if (e.target.matches("[data-demo]")) play(e.target);
      else e.target.classList.add("in");
      io.unobserve(e.target);
    }
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.15 });
  document.querySelectorAll(".reveal, [data-demo]:not([hidden])").forEach((el) => io.observe(el));
})();
