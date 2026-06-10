/* ═══════════════════════════════════════════════════════════════
   BAIA BELLA — Carte numérique premium
   - Rendu de la carte depuis menu.json
   - Fiche plat avec viewer 3D (PlayCanvas · Gaussian Splatting)
   - Paramètres caméra individuels par plat (menu.json > viewer)
   - Mode calibration : ajouter ?debug=1 à l'URL
   ═══════════════════════════════════════════════════════════════ */

"use strict";

/* Incrémenter à chaque déploiement pour invalider le cache CDN */
const VIEWER_VERSION = "1.0.0";

const PLAYCANVAS_CDN =
  "https://cdn.jsdelivr.net/npm/playcanvas@1.77.0/build/playcanvas.min.js";

const DEBUG = new URLSearchParams(location.search).has("debug");

/* ────────────────────────────────────────────────────────────────
   1. CHARGEMENT & RENDU DE LA CARTE
   ──────────────────────────────────────────────────────────────── */

const state = {
  data: null,
  dishesById: new Map(),
};

const els = {
  menuRoot: document.getElementById("menu-root"),
  catTrack: document.getElementById("catnav-track"),
  footnote: document.getElementById("menu-footnote"),
  sheet: document.getElementById("dish-sheet"),
  sheetBackdrop: document.getElementById("sheet-backdrop"),
  sheetClose: document.getElementById("sheet-close"),
  sheetTitle: document.getElementById("sheet-title"),
  sheetPrice: document.getElementById("sheet-price"),
  sheetBadges: document.getElementById("sheet-badges"),
  sheetDesc: document.getElementById("sheet-desc"),
  sheetDescEn: document.getElementById("sheet-desc-en"),
  canvas: document.getElementById("viewer-canvas"),
  loader: document.getElementById("viewer-loader"),
  hint: document.getElementById("viewer-hint"),
  debugBox: document.getElementById("viewer-debug"),
};

init();

async function init() {
  try {
    const res = await fetch(`menu.json?v=${VIEWER_VERSION}`);
    if (!res.ok) throw new Error(`menu.json introuvable (HTTP ${res.status})`);
    state.data = await res.json();
    state.data.dishes.forEach((d) => state.dishesById.set(d.id, d));
    renderNav();
    renderMenu();
    setupScrollSpy();
    els.footnote.textContent = state.data.restaurant.footnote || "";
  } catch (err) {
    els.menuRoot.innerHTML = `<p class="menu-loading">La carte n'a pas pu être chargée. Vérifiez votre connexion puis rechargez la page.</p>`;
    console.error(err);
  }
}

function formatPrice(dish) {
  const main = dish.price.toLocaleString("fr-FR", {
    minimumFractionDigits: dish.price % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const note = dish.price_note
    ? ` <small>${escapeHtml(dish.price_note)}</small>`
    : "";
  return `${main}&nbsp;€${note}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function renderNav() {
  els.catTrack.innerHTML = state.data.categories
    .map(
      (c) =>
        `<button class="catnav-pill" data-target="cat-${c.id}">${escapeHtml(c.name)}</button>`
    )
    .join("");

  els.catTrack.addEventListener("click", (e) => {
    const pill = e.target.closest(".catnav-pill");
    if (!pill) return;
    document
      .getElementById(pill.dataset.target)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderMenu() {
  const html = state.data.categories
    .map((cat) => {
      const dishes = state.data.dishes.filter((d) => d.category === cat.id);
      if (!dishes.length) return "";
      return `
        <section class="menu-section" id="cat-${cat.id}" data-cat="${cat.id}">
          <h2 class="menu-section-title">${escapeHtml(cat.name)}</h2>
          ${cat.subtitle ? `<p class="menu-section-sub">${escapeHtml(cat.subtitle)}</p>` : ""}
          <div class="horizon" aria-hidden="true"></div>
          <div class="dish-list">
            ${dishes.map(renderDishCard).join("")}
          </div>
        </section>`;
    })
    .join("");

  els.menuRoot.innerHTML = html;

  els.menuRoot.addEventListener("click", (e) => {
    const card = e.target.closest(".dish-card--3d");
    if (card) openDish(card.dataset.dish);
  });
  els.menuRoot.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".dish-card--3d");
    if (card) {
      e.preventDefault();
      openDish(card.dataset.dish);
    }
  });
}

function renderDishCard(dish) {
  const has3d = Boolean(dish.model3d);
  const tags = [
    has3d ? `<span class="tag tag--3d">Voir en 3D</span>` : "",
    dish.vegetarian ? `<span class="tag tag--veg">Végétarien</span>` : "",
    dish.gluten_free ? `<span class="tag tag--gf">Sans gluten</span>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <article class="dish-card ${has3d ? "dish-card--3d" : ""}"
             ${has3d ? `data-dish="${dish.id}" role="button" tabindex="0" aria-label="${escapeHtml(dish.name)}, voir en 3D"` : ""}>
      <div class="dish-top">
        <h3 class="dish-name">${escapeHtml(dish.name)}</h3>
        <span class="dish-dots" aria-hidden="true"></span>
        <span class="dish-price">${formatPrice(dish)}</span>
      </div>
      <p class="dish-desc">${escapeHtml(dish.description)}</p>
      ${tags ? `<div class="dish-tags">${tags}</div>` : ""}
    </article>`;
}

/* surbrillance de la catégorie visible */
function setupScrollSpy() {
  const sections = [...document.querySelectorAll(".menu-section")];
  const pills = [...document.querySelectorAll(".catnav-pill")];
  const byId = Object.fromEntries(pills.map((p) => [p.dataset.target, p]));

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        pills.forEach((p) => p.classList.remove("is-active"));
        const pill = byId[`cat-${entry.target.dataset.cat}`];
        if (pill) {
          pill.classList.add("is-active");
          pill.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }
      });
    },
    { rootMargin: "-30% 0px -60% 0px" }
  );
  sections.forEach((s) => obs.observe(s));
}

/* ────────────────────────────────────────────────────────────────
   2. FICHE PLAT (bottom sheet)
   ──────────────────────────────────────────────────────────────── */

let lastFocused = null;

function openDish(id) {
  const dish = state.dishesById.get(id);
  if (!dish) return;

  lastFocused = document.activeElement;

  els.sheetTitle.textContent = dish.name;
  els.sheetPrice.innerHTML = formatPrice(dish);
  els.sheetDesc.textContent = dish.description;
  els.sheetDescEn.textContent = dish.description_en || "";
  els.sheetBadges.innerHTML = [
    dish.vegetarian ? `<span class="tag tag--veg">Végétarien</span>` : "",
    dish.gluten_free ? `<span class="tag tag--gf">Sans gluten</span>` : "",
  ].join("");

  els.sheet.hidden = false;
  requestAnimationFrame(() => els.sheet.classList.add("is-open"));
  document.body.style.overflow = "hidden";
  els.sheetClose.focus();

  Viewer3D.show(dish);
}

function closeDish() {
  els.sheet.classList.remove("is-open");
  document.body.style.overflow = "";
  Viewer3D.hide();
  setTimeout(() => {
    els.sheet.hidden = true;
  }, 340);
  lastFocused?.focus?.();
}

els.sheetClose.addEventListener("click", closeDish);
els.sheetBackdrop.addEventListener("click", closeDish);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !els.sheet.hidden) closeDish();
});

/* ────────────────────────────────────────────────────────────────
   3. VIEWER 3D — PlayCanvas Gaussian Splatting
   ──────────────────────────────────────────────────────────────── */

const Viewer3D = (() => {
  let app = null;
  let cameraEntity = null;
  let pivot = null;
  let currentAsset = null;
  let engineLoading = null;
  let resizeObs = null;

  /* état orbital courant */
  const orbit = {
    yaw: 0,
    elev: 28, // élévation caméra en degrés (positif = au-dessus du plat)
    dist: 1.5,
    target: { x: 0, y: 0, z: 0 },
    cfg: null,
    lastInteraction: 0,
  };

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── chargement paresseux du moteur ── */
  function loadEngine() {
    if (window.pc) return Promise.resolve();
    if (engineLoading) return engineLoading;
    engineLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = PLAYCANVAS_CDN;
      s.onload = resolve;
      s.onerror = () =>
        reject(new Error("Le moteur 3D n'a pas pu être chargé."));
      document.head.appendChild(s);
    });
    return engineLoading;
  }

  function createApp() {
    if (app) return;

    app = new pc.Application(els.canvas, {
      mouse: new pc.Mouse(els.canvas),
      touch: "ontouchstart" in window ? new pc.TouchDevice(els.canvas) : null,
      graphicsDeviceOptions: {
        alpha: true,
        antialias: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
      },
    });

    app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    cameraEntity = new pc.Entity("camera");
    cameraEntity.addComponent("camera", {
      clearColor: new pc.Color(0, 0, 0, 0), // laisse voir le dégradé CSS
      fov: 40,
      nearClip: 0.01,
      farClip: 100,
    });
    app.root.addChild(cameraEntity);

    app.on("update", onUpdate);
    app.start();

    /* redimensionnement fiable (sheet, rotation d'écran) */
    resizeObs = new ResizeObserver(() => resize());
    resizeObs.observe(els.canvas.parentElement);
    resize();

    setupControls();
  }

  function resize() {
    if (!app) return;
    const r = els.canvas.parentElement.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) app.resizeCanvas(r.width, r.height);
  }

  /* ── affichage d'un plat ── */
  async function show(dish) {
    if (!dish.model3d) {
      els.loader.classList.add("is-hidden");
      return;
    }

    els.loader.classList.remove("is-hidden");
    els.hint.classList.remove("is-hidden");

    try {
      await loadEngine();
      createApp();
      resize();

      /* config caméra individuelle du plat */
      const cfg = Object.assign(
        {
          rotation: [0, 0, 0],
          center: [0, 0, 0],
          yaw: 0,
          pitch: -28,
          distance: 1.5,
          minDistance: 0.6,
          maxDistance: 3,
          minPitch: -80,
          maxPitch: -5,
          fov: 40,
          targetHeight: 0,
          autoRotateSpeed: 6,
        },
        dish.viewer || {}
      );

      orbit.cfg = cfg;
      orbit.yaw = cfg.yaw;
      orbit.elev = -cfg.pitch;
      orbit.dist = cfg.distance;
      orbit.target = { x: 0, y: cfg.targetHeight, z: 0 };
      orbit.lastInteraction = 0;
      cameraEntity.camera.fov = cfg.fov;

      clearScene();

      const url = `${dish.model3d}?v=${VIEWER_VERSION}`;
      const asset = new pc.Asset(dish.id, "gsplat", { url });
      currentAsset = asset;
      app.assets.add(asset);

      await new Promise((resolve, reject) => {
        asset.on("error", (err) => reject(new Error(err)));
        asset.ready(() => resolve());
        app.assets.load(asset);
      });

      /* si l'utilisateur a fermé/changé entre-temps */
      if (currentAsset !== asset) return;

      pivot = new pc.Entity("pivot");
      const splat = new pc.Entity("splat");
      splat.addComponent("gsplat", { asset });
      splat.setLocalPosition(-cfg.center[0], -cfg.center[1], -cfg.center[2]);
      pivot.addChild(splat);
      pivot.setLocalEulerAngles(
        cfg.rotation[0],
        cfg.rotation[1],
        cfg.rotation[2]
      );
      app.root.addChild(pivot);

      els.loader.classList.add("is-hidden");
      if (DEBUG) showDebug();
    } catch (err) {
      console.error(err);
      els.loader.querySelector("p").textContent =
        "Le modèle 3D n'a pas pu être chargé.";
    }
  }

  function clearScene() {
    if (pivot) {
      pivot.destroy();
      pivot = null;
    }
    /* libère le splat précédent (mémoire mobile) */
    if (currentAsset && app) {
      app.assets.remove(currentAsset);
      currentAsset.unload();
      currentAsset = null;
    }
  }

  function hide() {
    if (!app) return;
    clearScene();
  }

  /* ── boucle caméra ── */
  function onUpdate(dt) {
    if (!orbit.cfg) return;

    /* rotation automatique douce après 3 s d'inactivité */
    if (!reducedMotion && orbit.cfg.autoRotateSpeed) {
      orbit.lastInteraction += dt;
      if (orbit.lastInteraction > 3) {
        orbit.yaw += orbit.cfg.autoRotateSpeed * dt;
      }
    }

    const minElev = -orbit.cfg.maxPitch;
    const maxElev = -orbit.cfg.minPitch;
    orbit.elev = Math.min(maxElev, Math.max(minElev, orbit.elev));
    orbit.dist = Math.min(
      orbit.cfg.maxDistance,
      Math.max(orbit.cfg.minDistance, orbit.dist)
    );

    const yawR = (orbit.yaw * Math.PI) / 180;
    const elevR = (orbit.elev * Math.PI) / 180;
    const t = orbit.target;

    const x = t.x + orbit.dist * Math.cos(elevR) * Math.sin(yawR);
    const y = t.y + orbit.dist * Math.sin(elevR);
    const z = t.z + orbit.dist * Math.cos(elevR) * Math.cos(yawR);

    cameraEntity.setPosition(x, y, z);
    cameraEntity.lookAt(t.x, t.y, t.z);

    if (DEBUG) updateDebug();
  }

  /* ── contrôles : un doigt = orbite, pincement / molette = zoom ── */
  function setupControls() {
    const pointers = new Map();
    let pinchDist = 0;

    const markInteraction = () => {
      orbit.lastInteraction = 0;
      els.hint.classList.add("is-hidden");
    };

    els.canvas.addEventListener("pointerdown", (e) => {
      els.canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
      markInteraction();
    });

    els.canvas.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 1) {
        orbit.yaw -= dx * 0.4;
        orbit.elev += dy * 0.3;
        markInteraction();
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) orbit.dist *= pinchDist / d;
        pinchDist = d;
        markInteraction();
      }
    });

    const release = (e) => {
      pointers.delete(e.pointerId);
      pinchDist = 0;
    };
    els.canvas.addEventListener("pointerup", release);
    els.canvas.addEventListener("pointercancel", release);

    els.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        orbit.dist *= e.deltaY > 0 ? 1.08 : 0.92;
        markInteraction();
      },
      { passive: false }
    );
  }

  /* ── mode calibration (?debug=1) ── */
  function showDebug() {
    els.debugBox.hidden = false;
    els.debugBox.innerHTML = `
      <div id="dbg-readout"></div>
      <div>
        rot&nbsp;X <button data-rot="0,90">+90</button><button data-rot="0,-90">-90</button><br>
        rot&nbsp;Y <button data-rot="1,90">+90</button><button data-rot="1,-90">-90</button><br>
        rot&nbsp;Z <button data-rot="2,90">+90</button><button data-rot="2,-90">-90</button><br>
        <button id="dbg-copy">copier la config</button>
      </div>`;
    els.debugBox.querySelectorAll("[data-rot]").forEach((b) =>
      b.addEventListener("click", () => {
        const [axis, deg] = b.dataset.rot.split(",").map(Number);
        orbit.cfg.rotation[axis] = (orbit.cfg.rotation[axis] + deg) % 360;
        pivot?.setLocalEulerAngles(
          orbit.cfg.rotation[0],
          orbit.cfg.rotation[1],
          orbit.cfg.rotation[2]
        );
      })
    );
    els.debugBox
      .querySelector("#dbg-copy")
      .addEventListener("click", () => {
        const c = orbit.cfg;
        const json = JSON.stringify(
          {
            rotation: c.rotation,
            center: c.center,
            yaw: Math.round(orbit.yaw % 360),
            pitch: -Math.round(orbit.elev),
            distance: Number(orbit.dist.toFixed(2)),
            minDistance: c.minDistance,
            maxDistance: c.maxDistance,
            minPitch: c.minPitch,
            maxPitch: c.maxPitch,
            fov: c.fov,
            targetHeight: c.targetHeight,
            autoRotateSpeed: c.autoRotateSpeed,
          },
          null,
          2
        );
        navigator.clipboard?.writeText(json);
      });
  }

  function updateDebug() {
    const r = els.debugBox.querySelector("#dbg-readout");
    if (!r) return;
    r.textContent = `yaw ${orbit.yaw.toFixed(0)}° · pitch ${(-orbit.elev).toFixed(0)}° · dist ${orbit.dist.toFixed(2)} · rot [${orbit.cfg.rotation.join(", ")}]`;
  }

  return { show, hide };
})();
