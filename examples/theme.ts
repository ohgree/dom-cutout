// Shared theme toggle for all three pages. daisyUI resolves the theme from
// data-theme on <html>, falling back to prefers-color-scheme (see the
// --prefersdark theme in styles.css). Each page's <head> applies the stored
// choice inline before first paint; this module owns the toggle button.
const KEY = "dom-cutout-theme";

const current = (): "light" | "dark" =>
  (document.documentElement.dataset.theme as "light" | "dark" | undefined) ??
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

// Shows the theme the click switches TO.
const sun = `<svg viewBox="0 0 24 24" class="h-4 w-4 fill-none stroke-current" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
const moon = `<svg viewBox="0 0 24 24" class="h-4 w-4 fill-none stroke-current" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

// iOS Safari derives its chrome tint (top/bottom bars, the overscroll
// canvas) from the page at load and does not track CSS-variable changes,
// so a live theme flip leaves the chrome stale until reload. The
// theme-color meta IS tracked live; mirror the page background into it on
// load and on every theme change.
const syncChromeTint = () => {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
  }
  meta.content = getComputedStyle(document.documentElement).backgroundColor;
};

export const wireThemeToggle = (button: HTMLElement) => {
  // "true", not "" — an empty string is falsy and the guard would never
  // trip (React StrictMode invokes the ref twice; two listeners toggle
  // twice per click, netting out to nothing).
  if (button.dataset.themeWired) return;
  button.dataset.themeWired = "true";
  const render = () => {
    button.innerHTML = current() === "dark" ? sun : moon;
    button.setAttribute("aria-label", `Switch to ${current() === "dark" ? "light" : "dark"} theme`);
    syncChromeTint();
  };
  button.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(KEY, next);
    render();
  });
  // With no stored choice the theme follows the system, so the button icon
  // and the chrome tint must follow it too.
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
  render();
};
