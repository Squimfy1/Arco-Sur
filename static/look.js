// Runs before the page is drawn, so the app opens straight in the look chosen
// on the Settings screen, with no flash of the other one. Kept in step with
// src/lib/ui/settings.svelte.ts, which saves the same two choices.
(function () {
  var root = document.documentElement;
  var get = function (key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  };
  var theme = get("arco-sur.theme") || "dark";
  if (theme === "system") theme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  root.setAttribute("data-theme", theme);
  if (get("arco-sur.text") === "large") root.setAttribute("data-text", "large");
})();
