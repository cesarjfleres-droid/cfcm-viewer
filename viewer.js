/* ============================================================
 * Baia Bella · viewer.js — v27 · vitrine verrouillée
 *
 * Moteur = viewer Food3D validé (PlayCanvas 2.10, AppBase +
 * createGraphicsDevice, centroïde tourné-négué, pinch-zoom,
 * capture composite, modes studio/immersif, selfie).
 * R2, URLs, échelles, distance caméra : inchangés.
 *
 * v27 — VITRINE VERROUILLÉE :
 *  · L'assiette reste à plat en permanence (aucune bascule).
 *  · Rotation horizontale BORNÉE : ±yawRange (30° par défaut)
 *    autour d'un angle vedette par plat (yaw0) → l'arrière du
 *    scan est inatteignable.
 *  · Vertical = élévation caméra BORNÉE 36°–46° → dessous, flancs
 *    et jupe de splats géométriquement impossibles à voir.
 *  · Chaque plat démarre sur son angle vedette, cadré, centré.
 *  · Zoom min resserré (0.8) : plus de gros plan dans la frange.
 *  · Inertie conservée, s'arrête en douceur aux limites.
 *
 * Calibration sans redéployer :
 *   ?dish=plat1&yaw0=35&yawr=45&elev=38&elevmin=30&elevmax=52
 *   &looky=1400  + ex/ey/ez, fx/fy/fz, scale, camz, lift
 * ============================================================ */
(async function main() {
  const $ = (id) => document.getElementById(id);
  const loader = $('loader');
  const loaderFill = $('loader-fill');
  const loaderPercent = $('loader-percent');
  const loaderDish = $('loader-dish');
  const video = $('camera-feed');
  const canvas = $('viewer-3d');
  const shadowEl = $('shadow');
  const hint = $('hint');
  const flash = $('capture-flash');
  const captureBtn = $('capture-btn');
  const resetBtn = $('reset-btn');
  const arBtn = $('ar-btn');
  const flipBtn = $('flip-btn');
  const toast = $('toast');

  const setProgress = (p) => {
    loaderFill.style.width = p + '%';
    loaderPercent.textContent = Math.round(p) + '%';
  };

  let toastTimer = null;
  function showToast(msg, ms = 4000) {
    toast.textContent = msg;
    toast.hidden = false;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), ms);
  }

  // ============================================================
  //   PLATS — Cloudflare R2 (NE PAS MODIFIER les URLs)
  // ============================================================
  const R2 = 'https://pub-cb6130d8c47d41edaef19f32291a50d2.r2.dev/models';

  const DISHES = {
    plat1: {
      name: 'La Baia',
      price: '25 €',
      url: `${R2}/plat1.ply`,
      euler: [0, 90, 0],          // base (validée pour le cadrage)
      correction: [180, 0, 0],    // ✔ était à l'envers → retourné
      centre: [-5.535, -0.903, -0.464],
      scale: 2450,
      camZ: 10000,
      lift: -1,
      yaw0: 0,        // angle vedette au chargement (à calibrer : &yaw0=)
      yawRange: 360,  // v28 : tour complet libre
      // Bol profond : on regarde DEDANS, jamais le flanc (capture 1 :
      // vue rasante = jupe de splats sous le rebord) → fenêtre haute
      elev0: 44, elevMin: 40, elevMax: 50, zoomMin: 0.55,
    },
    plat2: {
      name: 'Scampis sauvages rôtis',
      price: '39,50 €',
      url: `${R2}/plat2.ply`,
      euler: [-90, 0, 0],
      correction: [0, 0, 0],      // ✔ correct, aucune correction
      centre: [0.987, -0.398, -0.161],
      scale: 2250,
      camZ: 10000,
      lift: -1,
      yaw0: 0,
      yawRange: 360,
      // Assiette creuse : la frange apparaissait sous le bord avant
      // (captures 3-5) → plancher relevé, gros plan limité
      elev0: 40, elevMin: 37, elevMax: 47, zoomMin: 0.55,
    },
    plat3: {
      name: 'Fresca',
      price: '24 €',
      url: `${R2}/plat3.ply`,
      euler: [90, 0, 0],
      correction: [180, 0, 0],    // ✔ était à l'envers → retourné
      centre: [-0.031, -1.269, -0.099],
      scale: 2450,
      camZ: 10000,
      lift: -1,
      yaw0: 0,
      yawRange: 360,
      // Pizza plate : la croûte frangeait en vue inclinée (capture 2)
      // → vue plongeante uniquement
      elev0: 42, elevMin: 38, elevMax: 50, zoomMin: 0.55,
    },
  };

  const params = new URLSearchParams(location.search);
  const dishKey = DISHES[params.get('dish')] ? params.get('dish') : 'plat1';
  const dish = DISHES[dishKey];
  const v = params.get('v') || '0';

  // Overrides URL (calibration à chaud, sans redéployer)
  const num = (k, fallback) => {
    const raw = params.get(k);
    const n = raw === null ? NaN : parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  };
  const SPLAT_EULER_X = num('ex', dish.euler[0]);
  const SPLAT_EULER_Y = num('ey', dish.euler[1]);
  const SPLAT_EULER_Z = num('ez', dish.euler[2]);
  const CORR_X        = num('fx', dish.correction[0]);
  const CORR_Y        = num('fy', dish.correction[1]);
  const CORR_Z        = num('fz', dish.correction[2]);
  const SPLAT_SCALE   = num('scale', dish.scale);
  const CAM_Z_BASE    = num('camz', dish.camZ);   // distance caméra : inchangée (pas de zoom initial)
  const SPLAT_LIFT_Y  = num('lift', dish.lift);

  // ----- Mise en scène "posé sur table" + VITRINE (v27) -----
  // v27 : fenêtre VERROUILLÉE — les captures clients montraient encore
  // des vues rasantes / inclinées. La caméra vit désormais dans un cône
  // étroit autour de l'angle vedette, défini PAR PLAT (un bol profond et
  // une assiette plate n'ont pas la même zone sûre). Le dessous, les
  // flancs et la jupe de splats sont hors d'atteinte.
  // Priorité : URL (calibration) > config du plat > défaut global.
  const CAM_ELEV_DEG  = num('elev', dish.elev0 ?? 40);       // angle vedette vertical
  const ELEV_MIN_DEG  = num('elevmin', dish.elevMin ?? 37);  // plancher : jamais rasant, jamais le dessous
  const ELEV_MAX_DEG  = num('elevmax', dish.elevMax ?? 48);  // plafond : jamais de zénith écrasé
  const LOOK_Y        = num('looky', 1400);       // point de visée au-dessus du plat (~62 %)
  const YAW_START     = num('yaw0', dish.yaw0);   // angle vedette horizontal au chargement
  const YAW_RANGE     = num('yawr', dish.yawRange); // rotation autorisée : ± autour de l'angle vedette

  const FOV_Y = 50;
  const ZOOM_MIN = num('zoommin', dish.zoomMin ?? 0.55);  // v28 : gros plan profond rétabli
  const ZOOM_MAX = 1.7;

  // Fiche plat dans l'UI
  $('dish-name').textContent = dish.name;
  $('dish-price').textContent = dish.price;
  loaderDish.textContent = dish.name;
  document.title = `Baia Bella · ${dish.name} en 3D`;

  // ---------- 1. PLAYCANVAS APP ----------
  if (typeof pc === 'undefined') {
    loader.querySelector('.loader-sub').textContent = 'Le moteur 3D n\u2019a pas pu être chargé';
    loaderPercent.textContent = 'Vérifiez votre connexion puis rechargez la page';
    return;
  }

  const app = new pc.AppBase(canvas);

  let gfxDevice;
  try {
    gfxDevice = await pc.createGraphicsDevice(canvas, {
      deviceTypes: ['webgl2', 'webgl1'],
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,   // requis pour la capture
      powerPreference: 'high-performance'
    });
  } catch (err) {
    console.error('GraphicsDevice failed:', err);
    loader.querySelector('.loader-sub').textContent = 'Appareil non compatible 3D';
    loaderPercent.textContent = 'Essayez avec un navigateur plus récent';
    return;
  }

  const createOptions = new pc.AppOptions();
  createOptions.graphicsDevice = gfxDevice;
  createOptions.mouse = new pc.Mouse(canvas);
  createOptions.touch = new pc.TouchDevice(canvas);
  createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
  ];
  createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler,
    pc.GSplatHandler
  ];

  app.init(createOptions);
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  gfxDevice.maxPixelRatio = dpr;

  app.scene.skyboxIntensity = 0;
  setProgress(10);

  const camPosFor = (dist, elevDeg) => {
    const e = elevDeg * Math.PI / 180;
    return { x: 0, y: dist * Math.sin(e), z: dist * Math.cos(e) };
  };

  const cameraEntity = new pc.Entity('camera');
  cameraEntity.addComponent('camera', {
    clearColor: new pc.Color(0, 0, 0, 0),
    clearColorBuffer: true,
    clearDepthBuffer: true,
    fov: FOV_Y,
    nearClip: 0.01,
    farClip: 1e7
  });
  const _p0 = camPosFor(CAM_Z_BASE, CAM_ELEV_DEG);
  cameraEntity.setPosition(_p0.x, _p0.y, _p0.z);
  cameraEntity.lookAt(0, LOOK_Y, 0);
  app.root.addChild(cameraEntity);
  setProgress(18);

  // ---------- 2. LOAD SPLAT (R2, avec progression) ----------
  const splatAsset = new pc.Asset(dishKey, 'gsplat', { url: `${dish.url}?v=${v}` });
  app.assets.add(splatAsset);

  splatAsset.on('progress', (received, total) => {
    if (total > 0) setProgress(18 + (received / total) * 72);
  });

  try {
    await new Promise((resolve, reject) => {
      splatAsset.once('load', resolve);
      splatAsset.once('error', reject);
      app.assets.load(splatAsset);
    });
  } catch (err) {
    console.error('Splat load failed:', err);
    loader.querySelector('.loader-sub').textContent = 'Le plat n\u2019a pas pu être chargé';
    loaderPercent.textContent = 'Vérifiez votre connexion puis rechargez la page';
    return;
  }
  setProgress(92);

  // ---------- 3. COMPOSITION : base + CORRECTION + MISE À PLAT TABLE ----------
  // qFinal = table ∘ correction ∘ base.
  //  - base + correction : orientent le dessus du plat vers la caméra (+Z), validé.
  //  - table (Rx -90°)   : couche ensuite le plat à plat, dessus vers le haut (+Y),
  //    horizontal et stable, prêt à être vu en plongée. rotation X/Z finales = 0.
  // Le centroïde est transformé par la MÊME rotation finale → plat centré.
  const qBase  = new pc.Quat().setFromEulerAngles(SPLAT_EULER_X, SPLAT_EULER_Y, SPLAT_EULER_Z);
  const qCorr  = new pc.Quat().setFromEulerAngles(CORR_X, CORR_Y, CORR_Z);
  const qTable = new pc.Quat().setFromEulerAngles(-90, 0, 0);
  const qFinal = new pc.Quat().mul2(qCorr, qBase);
  qFinal.mul2(qTable, qFinal);

  const pivot = new pc.Entity('pivot');
  app.root.addChild(pivot);
  pivot.setPosition(0, 0, 0);

  const splatEntity = new pc.Entity('splat');
  splatEntity.addComponent('gsplat', { asset: splatAsset });
  pivot.addChild(splatEntity);

  splatEntity.setLocalScale(SPLAT_SCALE, SPLAT_SCALE, SPLAT_SCALE);
  splatEntity.setLocalRotation(qFinal);

  // Centroïde local → monde : tourné (rotation finale) puis négué
  const LOCAL_CENTRE = new pc.Vec3(dish.centre[0], dish.centre[1], dish.centre[2]);
  const _scaled = new pc.Vec3(
    LOCAL_CENTRE.x * SPLAT_SCALE,
    LOCAL_CENTRE.y * SPLAT_SCALE,
    LOCAL_CENTRE.z * SPLAT_SCALE
  );
  const _rotated = new pc.Vec3();
  qFinal.transformVector(_scaled, _rotated);
  splatEntity.setLocalPosition(-_rotated.x, -_rotated.y + SPLAT_LIFT_Y, -_rotated.z);

  app.start();
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  setProgress(100);

  // ---------- 4. MODE IMMERSIF (caméra, opt-in, non bloquant) ----------
  let stream = null;
  let arActive = false;
  let facing = 'environment';   // 'environment' = arrière · 'user' = selfie
  let requesting = false;

  function cameraErrorMessage(err) {
    switch (err && err.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return "Accès caméra refusé — la dégustation continue en mode studio. Vous pouvez l'autoriser dans les réglages du navigateur.";
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return "Aucune caméra détectée sur cet appareil — mode studio conservé.";
      case 'NotReadableError':
      case 'TrackStartError':
        return "La caméra est occupée par une autre application — fermez-la puis réessayez.";
      case 'OverconstrainedError':
        return "Caméra arrière indisponible — mode studio conservé.";
      default:
        return "La caméra n'a pas pu démarrer — la dégustation continue en mode studio.";
    }
  }

  async function getCameraStream(mode) {
    const constraints = {
      video: {
        facingMode: { ideal: mode },
        width:  { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      // Desktop / appareils sans caméra "environment" : on retente
      // sans contrainte d'orientation (webcam frontale par exemple).
      if (err && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      throw err;
    }
  }

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
      video.srcObject = null;
    }
  }

  function applyMirror() {
    // Selfie : aperçu en miroir (comme l'app photo native)
    video.classList.toggle('mirrored', facing === 'user');
  }

  async function startCamera(mode) {
    // HTTPS obligatoire pour getUserMedia (sauf localhost)
    if (!window.isSecureContext) {
      showToast("La caméra nécessite une connexion sécurisée (https).");
      return false;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast("Ce navigateur ne permet pas l'accès à la caméra — mode studio conservé.");
      return false;
    }
    try {
      stopStream();
      stream = await getCameraStream(mode);
      video.srcObject = stream;
      try { await video.play(); } catch (_) { /* iOS : déjà autoplay+muted */ }
      facing = mode;
      applyMirror();
      return true;
    } catch (err) {
      console.warn('Camera error:', err);
      showToast(cameraErrorMessage(err));
      return false;
    }
  }

  async function enableAR() {
    if (requesting) return;
    requesting = true;
    arBtn.disabled = true;
    const ok = await startCamera(facing);
    arBtn.disabled = false;
    requesting = false;
    if (!ok) return;
    arActive = true;
    document.body.classList.add('mode-ar');
    arBtn.classList.add('active');
    arBtn.setAttribute('aria-pressed', 'true');
  }

  function disableAR() {
    arActive = false;
    document.body.classList.remove('mode-ar');
    arBtn.classList.remove('active');
    arBtn.setAttribute('aria-pressed', 'false');
    stopStream();   // batterie + confidentialité
  }

  arBtn.addEventListener('click', () => {
    if (arActive) disableAR(); else enableAR();
  });

  // Selfie : retourner la caméra (visible uniquement en mode immersif)
  flipBtn.addEventListener('click', async () => {
    if (!arActive || requesting) return;
    requesting = true;
    flipBtn.disabled = true;
    const next = facing === 'environment' ? 'user' : 'environment';
    const ok = await startCamera(next);
    if (!ok) {
      // on retombe sur la caméra précédente si possible
      await startCamera(facing);
    }
    flipBtn.disabled = false;
    requesting = false;
  });

  // ---------- 5. INTERACTION — VITRINE GASTRONOMIQUE (v26) ----------
  // Le plat reste TOUJOURS à plat sur la table (aucune bascule d'assiette).
  //  · glisser horizontal → rotation du plat autour de son axe vertical,
  //    BORNÉE à ±YAW_RANGE autour de l'angle vedette (pas de tour complet,
  //    l'arrière du scan est inatteignable)
  //  · glisser vertical → élévation de la caméra, BORNÉE entre ELEV_MIN
  //    et ELEV_MAX (le dessous de l'assiette est géométriquement
  //    impossible à voir, le zénith écrasé aussi)
  // v28 : yawRange >= 180 → rotation 360° totalement libre (pas de butées).
  // Une valeur plus basse (ex: 30) réactive la vitrine bornée par plat.
  const FREE_YAW = YAW_RANGE >= 180;
  const YAW_MIN = YAW_START - YAW_RANGE;
  const YAW_MAX = YAW_START + YAW_RANGE;

  let isDragging = false;
  const pointers = new Map();
  let pinchStartDist = 0;
  let pinchStartZoom = 1;
  let lastX = 0, lastY = 0;
  let velY = 0, velX = 0;
  let targetRotY = YAW_START, rotY = YAW_START;
  let targetElev = CAM_ELEV_DEG, elev = CAM_ELEV_DEG;
  let zoom = 1, targetZoom = 1;
  let userInteracted = false;

  const ROT_SPEED  = 0.6;    // v28 : vivacité d'origine — le 360° libre doit filer sous le doigt
  const ELEV_SPEED = 0.08;   // verticale très douce : ±10° de fenêtre seulement
  const SMOOTH     = 0.25;
  const FRICTION   = 0.94;

  const clampYaw  = FREE_YAW ? (y) => y : (y) => Math.max(YAW_MIN, Math.min(YAW_MAX, y));
  const clampElev = (e) => Math.max(ELEV_MIN_DEG, Math.min(ELEV_MAX_DEG, e));

  function pinchDistance() {
    const pts = [...pointers.values()];
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function onDown(e) {
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    userInteracted = true;
    hint.classList.add('faded');

    if (pointers.size === 1) {
      isDragging = true;
      velX = velY = 0;
      lastX = e.clientX;
      lastY = e.clientY;
    } else if (pointers.size === 2) {
      isDragging = false;
      velX = velY = 0;
      pinchStartDist = pinchDistance();
      pinchStartZoom = targetZoom;
    }
    if (e.cancelable) e.preventDefault();
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    if (e.cancelable) e.preventDefault();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2 && pinchStartDist > 0) {
      const d = pinchDistance();
      targetZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinchStartZoom * (pinchStartDist / d)));
      return;
    }

    if (!isDragging || pointers.size !== 1) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    velY = dx * ROT_SPEED;
    // glisser vers le bas = caméra qui descend (vue plus frontale), borné
    velX = dy * ELEV_SPEED;
    targetRotY = clampYaw(targetRotY + velY);
    targetElev = clampElev(targetElev - velX);
  }

  function onUp(e) {
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      isDragging = false;
      pinchStartDist = 0;
    } else if (pointers.size === 1) {
      const p = [...pointers.values()][0];
      lastX = p.x; lastY = p.y;
      isDragging = true;
      velX = velY = 0;
      pinchStartDist = 0;
    }
  }

  canvas.addEventListener('pointerdown',   onDown, { passive: false });
  canvas.addEventListener('pointermove',   onMove, { passive: false });
  canvas.addEventListener('pointerup',     onUp);
  canvas.addEventListener('pointercancel', onUp);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    userInteracted = true;
    hint.classList.add('faded');
    targetZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, targetZoom * (e.deltaY > 0 ? 1.07 : 0.93)));
  }, { passive: false });

  resetBtn.addEventListener('click', () => {
    targetRotY = YAW_START;
    targetElev = CAM_ELEV_DEG;
    velX = velY = 0;
    targetZoom = 1;
  });

  // ---------- 6. UPDATE LOOP ----------
  let t0 = performance.now();
  app.on('update', (dt) => {
    const t = (performance.now() - t0) / 1000;

    if (userInteracted && !isDragging) {
      // inertie bornée : la rotation glisse puis s'arrête en douceur aux limites
      targetRotY = clampYaw(targetRotY + velY);
      targetElev = clampElev(targetElev - velX);
      if (!FREE_YAW && (targetRotY === YAW_MIN || targetRotY === YAW_MAX)) velY = 0;
      if (targetElev === ELEV_MIN_DEG || targetElev === ELEV_MAX_DEG) velX = 0;
      velY *= FRICTION;
      velX *= FRICTION;
      if (Math.abs(velY) < 0.01) velY = 0;
      if (Math.abs(velX) < 0.01) velX = 0;
    }

    rotY += (targetRotY - rotY) * SMOOTH;
    elev += (targetElev - elev) * SMOOTH;
    zoom += (targetZoom - zoom) * SMOOTH;

    // L'assiette reste à plat en toutes circonstances : seule la rotation
    // autour de son axe vertical (bornée) est appliquée au modèle.
    pivot.setLocalEulerAngles(0, rotY, 0);
    const _p = camPosFor(CAM_Z_BASE * zoom, elev);
    cameraEntity.setPosition(_p.x, _p.y, _p.z);
    cameraEntity.lookAt(0, LOOK_Y, 0);

    const s = (1 + Math.sin(t * 1.2) * 0.04) / zoom;
    const o = 0.85 + Math.sin(t * 1.2) * 0.08;
    shadowEl.style.transform = `translate(-50%, -50%) scale(${s.toFixed(3)})`;
    shadowEl.style.opacity = o.toFixed(2);
  });

  setTimeout(() => hint.classList.add('faded'), 4500);

  // ---------- 7. RESIZE ----------
  const handleResize = () => { app.resizeCanvas(); };
  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', () => setTimeout(handleResize, 200));

  // ---------- 8. CAPTURE ----------
  function paintStudioBackground(ctx, W, H) {
    const base = ctx.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0,    '#0f5666');
    base.addColorStop(0.45, '#0d4f5c');
    base.addColorStop(1,    '#06262e');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W / 2, -H * 0.05, 0, W / 2, -H * 0.05, H * 0.7);
    glow.addColorStop(0, 'rgba(111,194,207,0.28)');
    glow.addColorStop(1, 'rgba(111,194,207,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  captureBtn.addEventListener('click', () => {
    flash.classList.add('flash');
    setTimeout(() => flash.classList.remove('flash'), 120);

    app.render();

    const W = window.innerWidth  * dpr;
    const H = window.innerHeight * dpr;
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');

    const vw = video.videoWidth, vh = video.videoHeight;
    if (arActive && vw && vh) {
      const screenAR = W / H;
      const videoAR = vw / vh;
      let sx, sy, sw, sh;
      if (videoAR > screenAR) {
        sh = vh; sw = vh * screenAR;
        sx = (vw - sw) / 2; sy = 0;
      } else {
        sw = vw; sh = vw / screenAR;
        sx = 0; sy = (vh - sh) / 2;
      }
      // Selfie : la photo reprend le miroir de l'aperçu (comme l'app native)
      ctx.save();
      if (facing === 'user') {
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
      ctx.restore();
    } else {
      paintStudioBackground(ctx, W, H);
    }

    // Ombre de contact (sous le plat posé bas — aligné avec le CSS)
    const cx = W / 2;
    const cy = H * 0.73;
    const rx = W * 0.23;
    const ry = H * 0.035;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    grad.addColorStop(0,   'rgba(0,0,0,0.55)');
    grad.addColorStop(0.35,'rgba(0,0,0,0.30)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.drawImage(canvas, 0, 0, W, H);

    out.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `baia-bella-${dishKey}-${Date.now()}.jpg`, { type: 'image/jpeg' });

      // Mobile : feuille de partage native (enregistrer dans Photos,
      // envoyer, publier). Sinon : téléchargement automatique.
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file] }).catch(() => downloadBlob(blob));
      } else {
        downloadBlob(blob);
      }
    }, 'image/jpeg', 0.92);
  });

  function downloadBlob(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baia-bella-${dishKey}-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ---------- 9. CLEANUP ----------
  window.addEventListener('pagehide', () => {
    stopStream();
    try { app.destroy(); } catch (e) {}
  });

  document.addEventListener('visibilitychange', () => {
    // iOS coupe parfois le flux en arrière-plan : on relance proprement
    if (document.visibilityState === 'visible' && arActive && stream) {
      const track = stream.getVideoTracks()[0];
      if (!track || track.readyState === 'ended') startCamera(facing);
    }
  });

  // Loader out
  setTimeout(() => {
    loader.classList.add('hidden');
    setTimeout(() => loader.style.display = 'none', 700);
  }, 0);

})().catch(err => {
  console.error('FATAL', err);
});
