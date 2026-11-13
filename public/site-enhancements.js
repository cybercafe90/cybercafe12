(() => {
  const WA_URL = "https://wa.me/917006865909?text=Assalamu%20Alaikum%2C%20I%20need%20help%20with%20a%20service%20from%20babacybercafe.in";
  const slugify = (value) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const style = document.createElement("style");
  style.textContent = "@media(max-width:767px){#bbc-mobile-actions{position:fixed;z-index:40;inset:auto 0 0;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(7,13,29,.97);border-top:1px solid rgba(0,242,255,.28);box-shadow:0 -8px 28px rgba(0,0,0,.28);backdrop-filter:blur(14px)}#bbc-mobile-actions a{min-height:48px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:10px;font:700 13px system-ui,sans-serif;text-decoration:none}#bbc-mobile-actions .bbc-call{color:#071321;background:#00f2ff}#bbc-mobile-actions .bbc-wa{color:#eaffff;border:1px solid rgba(0,242,255,.7);background:#10243b}#root{padding-bottom:82px}.customer-chat-assistant{left:auto!important;right:12px!important;bottom:88px!important;align-items:flex-end!important}.customer-chat-panel{max-height:calc(100dvh - 175px)!important}.customer-chat-launcher{min-height:48px!important}}@media(min-width:768px){#bbc-mobile-actions{display:none!important}}.bbc-department-pills{display:flex;gap:8px;overflow-x:auto;padding:4px 0 12px;margin:2px 0 8px;scrollbar-width:thin}.bbc-department-pills button{flex:0 0 auto;border:1px solid rgba(0,242,255,.25);border-radius:999px;padding:9px 14px;color:inherit;background:rgba(9,22,43,.72);font:600 11px system-ui,sans-serif;cursor:pointer;white-space:nowrap}.bbc-department-pills button[aria-pressed=true]{color:#061321;border-color:#00f2ff;background:#00f2ff;box-shadow:0 0 18px rgba(0,242,255,.18)}.bbc-empty-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:14px}.bbc-empty-actions button,.bbc-empty-actions a{display:inline-flex;min-height:40px;align-items:center;justify-content:center;padding:0 14px;border:1px solid rgba(0,242,255,.45);border-radius:8px;color:inherit;background:transparent;font:600 11px system-ui,sans-serif;cursor:pointer;text-decoration:none}.bbc-empty-actions a{color:#061321;background:#00f2ff;border-color:#00f2ff}";
  document.head.appendChild(style);

  function mobileBar() {
    if (document.getElementById("bbc-mobile-actions")) return;
    const bar = document.createElement("nav");
    bar.id = "bbc-mobile-actions";
    bar.setAttribute("aria-label", "Quick contact actions");
    bar.innerHTML = '<a class="bbc-call" href="tel:+917006865909">☎ Call Now</a><a class="bbc-wa" href="' + WA_URL + '" target="_blank" rel="noopener noreferrer">◉ WhatsApp Desk</a>';
    document.body.appendChild(bar);
  }

  function localBusinessSchema() {
    if (document.getElementById("bbc-local-business-schema")) return;
    document.querySelectorAll('script[type="application/ld+json"]').forEach((node) => node.remove());
    const schema = {"@context":"https://schema.org","@type":"LocalBusiness","name":"BABA'S CYBER CAFE","url":"https://babacybercafe.in","telephone":"+91-7006865909","email":"support@babacybercafe.in","address":{"@type":"PostalAddress","streetAddress":"Zaripora Zoonimar","addressLocality":"Srinagar","addressRegion":"Jammu & Kashmir","postalCode":"190011","addressCountry":"IN"},"areaServed":"Srinagar, Jammu & Kashmir"};
    const node = document.createElement("script");
    node.id = "bbc-local-business-schema";
    node.type = "application/ld+json";
    node.textContent = JSON.stringify(schema);
    document.head.appendChild(node);
  }

  function fixChallanTitle() {
    if (location.pathname === "/challan" && document.title !== "Check Traffic Challan | BABA'S CYBER CAFE") {
      document.title = "Check Traffic Challan | BABA'S CYBER CAFE";
    }
  }

  function serviceDirectory() {
    if (location.pathname !== "/services") return;
    const toolbar = document.querySelector(".catalog-toolbar");
    if (!toolbar) return;
    const search = toolbar.querySelector(".search-box input");
    const selects = toolbar.querySelectorAll("select");
    const department = selects[0];
    if (search) {
      search.placeholder = "Search Fard, PAN Card, Birth Certificate, Driving Licence, Insurance…";
      search.setAttribute("aria-label", "Search services by name, department or keywords");
    }
    if (department && !document.querySelector(".bbc-department-pills")) {
      const pills = document.createElement("div");
      pills.className = "bbc-department-pills";
      pills.setAttribute("role", "group");
      pills.setAttribute("aria-label", "Filter services by department");
      const options = [{value:"all",label:"All"}, ...[...department.options].filter((option) => option.value).map((option) => ({value:option.value,label:option.textContent.trim()}))];
      options.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.department = option.value;
        button.textContent = option.label;
        button.setAttribute("aria-pressed", String(department.value === option.value));
        button.addEventListener("click", () => {
          department.value = option.value;
          department.dispatchEvent(new Event("change", {bubbles:true}));
          pills.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item.dataset.department === department.value)));
        });
        pills.appendChild(button);
      });
      toolbar.insertAdjacentElement("afterend", pills);
      department.addEventListener("change", () => pills.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item.dataset.department === department.value))));
    }

    const empty = document.querySelector(".empty-state");
    if (empty && !empty.querySelector(".bbc-empty-actions")) {
      const actions = document.createElement("div");
      actions.className = "bbc-empty-actions";
      const clear = document.createElement("button");
      clear.type = "button";
      clear.textContent = "Clear filters";
      clear.addEventListener("click", () => {
        if (search) { search.value = ""; search.dispatchEvent(new Event("input", {bubbles:true})); }
        selects.forEach((select) => { if (!select.disabled) { select.value = "all"; select.dispatchEvent(new Event("change", {bubbles:true})); } });
      });
      const ask = document.createElement("a");
      ask.href = WA_URL; ask.target = "_blank"; ask.rel = "noopener noreferrer"; ask.textContent = "Ask on WhatsApp";
      actions.append(clear, ask);
      empty.appendChild(actions);
    }

    document.querySelectorAll(".service-card").forEach((card) => {
      const link = card.querySelector(".service-card-bottom a");
      const name = card.querySelector("h2")?.textContent?.trim();
      if (!link || !name) return;
      const current = new URL(link.href, location.origin);
      const departmentSlug = current.searchParams.get("category") || "other";
      const href = "/apply?" + new URLSearchParams({department:departmentSlug,service:slugify(name)}).toString();
      if (link.getAttribute("href") !== href) link.setAttribute("href", href);
    });
  }

  function preselectService() {
    if (location.pathname !== "/apply") return;
    const slug = new URLSearchParams(location.search).get("service");
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) return;
    document.querySelectorAll("select").forEach((select) => {
      const option = [...select.options].find((item) => slugify(item.textContent.trim()) === slug);
      if (option && select.value !== option.value) {
        select.value = option.value;
        select.dispatchEvent(new Event("change", {bubbles:true}));
      }
    });
  }

  function run() { mobileBar(); localBusinessSchema(); fixChallanTitle(); serviceDirectory(); preselectService(); }
  run();
  const observer = new MutationObserver(run);
  observer.observe(document.documentElement, {childList:true,subtree:true});
  window.addEventListener("popstate", run);
  const push = history.pushState;
  history.pushState = function(...args) { const result = push.apply(this,args); window.dispatchEvent(new Event("bbc-route-change")); return result; };
  window.addEventListener("bbc-route-change", run);
})();