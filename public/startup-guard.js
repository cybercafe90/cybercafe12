(() => {
  const root = document.getElementById("root");
  if (!root) return;
  let finished = false;
  const showStartupError = (reason) => {
    if (finished || root.dataset.appBooting !== "true") return;
    finished = true;
    const main = document.createElement("main");
    main.setAttribute("role", "alert");
    main.style.cssText = "min-height:100vh;display:grid;place-content:center;gap:14px;padding:28px 20px;background:#f7f6f1;color:#171713;font-family:system-ui,sans-serif;text-align:center";
    const brand = document.createElement("p");
    brand.textContent = "BABA'S CYBER CAFE";
    brand.style.cssText = "margin:0;color:#92713a;font-size:12px;font-weight:700;letter-spacing:.12em";
    const heading = document.createElement("h1");
    heading.textContent = "The website could not start";
    heading.style.cssText = "margin:0;font-size:clamp(24px,5vw,34px)";
    const message = document.createElement("p");
    message.textContent = reason || "A required page file did not finish loading. Please reload. If this continues, contact support@babacybercafe.in.";
    message.style.cssText = "max-width:440px;margin:0 auto;color:#5c5a52;line-height:1.6";
    const reload = document.createElement("button");
    reload.type = "button";
    reload.textContent = "Reload website";
    reload.style.cssText = "justify-self:center;min-height:44px;padding:0 22px;border:0;border-radius:4px;background:#171713;color:white;font-weight:600";
    reload.addEventListener("click", () => window.location.reload());
    main.append(brand, heading, message, reload);
    root.replaceChildren(main);
    console.error("[BABA'S CYBER CAFE] Startup guard:", reason || "Startup timed out");
  };
  window.addEventListener("error", (event) => {
    if (event.target instanceof HTMLScriptElement) {
      // Optional third-party scripts must not prevent the main app from starting.
      try {
        const scriptUrl = new URL(event.target.src, window.location.href);
        if (scriptUrl.origin === window.location.origin) {
          showStartupError("A required website JavaScript file could not be loaded. Check your connection and reload.");
        }
      } catch {
        // Ignore malformed or optional script URLs; the startup timeout remains.
      }
      return;
    }
    if (event instanceof ErrorEvent) {
      showStartupError("The website encountered a JavaScript startup error. Please reload or contact support@babacybercafe.in.");
    }
  }, true);
  window.addEventListener("unhandledrejection", () => {
    showStartupError("The website encountered an unexpected startup error. Please reload or contact support@babacybercafe.in.");
  });
  window.setTimeout(() => {
    showStartupError("The application did not finish starting within 15 seconds. Please reload. If this continues, contact support@babacybercafe.in.");
  }, 15000);
})();