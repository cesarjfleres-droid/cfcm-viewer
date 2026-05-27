/* Food3D · mobile camera-overlay viewer
 * v19 — PRODUCTION FINALE
 *
 * CATALOGUE :
 *   - tarte-fraises : interactive, limites strictes "belle vue 3/4"
 *     PITCH ∈ [-55°, -30°] · YAW ∈ [-45°, 40°]
 *     Départ : pitch -45°, yaw 0°
 *
 *   - salade-homard : FIGÉE (static)
 *     Angle calibré : pitch -180°, yaw -177.3°
 *     Scale 2500
 *
 * ARCHITECTURE :
 *   - Limites de rotation définies par plat (DISH_CATALOG.limits)
 *   - URL params : ?dish=<id> ?debug ?free ?pitch=X ?yaw=Y ?lift=N
 *
 * CONVENTION SIGNES (validée debug v12) :
 *   PITCH négatif fort  = vue 3/4 inclinée (belle, appétissante)
 *   PITCH proche de 0   = vue du dessus aplatie (moche)
 *   PITCH positif       = on voit le dessous (interdit)
 *   YAW négatif         = rotation gauche
 *   YAW positif         = rotation droite
 */
(async function main() {
  const $ = (id) => document.getElementById(id);
  const loader        = $('loader');
  const loaderFill    = $('loader-fill');
  const loaderPercent = $('loader-percent');
  const video         = $('camera-feed');
  const canvas        = $('viewer-3d');
  const shadowEl      = $('shadow');
  const hint          = $('hint');
  const flash         = $('capture-flash');
  const captureBtn    = $('capture-btn');
  const flipBtn       = $('flip-btn');

  const setProgress = (p) => {
    loaderFill.style.width = p + '%';
    loaderPercent.textContent = Math.round(p) + '%';
  };

  // ============================================================
  //   CATALOGUE DES PLATS
  // ============================================================
  const DISH_CATALOG = {
    'tarte-fraises': {
      file: 'fraise.ply',
      scale: 2400,
      lift: 400,
      euler: { x: -90, y: 0, z: 180 },
      trim:  { x: 12, y: 0, z: 0 },
      centerLocal: { x: 0.1644, y: 0.5843, z: -1.5571 },
      // Vue 3/4 appétissante au démarrage (au lieu de vue du dessus aplatie)
      defaultPitch: -45,
      defaultYaw: 0,
      static: false,
      // Limites de rotation strictes pour la tarte (zone "belle vue")
      limits: { pitchMin: -55, pitchMax: -30, yawMin: -45, yawMax: 40 }
    },
    'salade-homard': {
      file: 'salade.ply',
      scale: 2500,
      lift: 400,
      euler: { x: -90, y: 0, z: 180 },
      trim:  { x: 0, y: 0, z: 0 },
      // ✅ v19 PRODUCTION FINALE
      // Angle figé calibré par l'utilisateur (capture 02:24)
      // PITCH = -180°, YAW = -177.3°, scale = 2500
      centerLocal: { x: 1.2075, y: 0.9820, z: 1.1778 },
      defaultPitch: -180,
      defaultYaw: -177.3,
      static: true,
      // limits inutilisé car static, mais conservé pour cohérence d'API
      limits: { pitchMin: -180, pitchMax: 180, yawMin: -180, yawMax: 180 }
    },
  };

  const urlParams = new URLSearchParams(location.search);
  const dishId = urlParams.get('dish') || 'tarte-fraises';
  const dish = DISH_CATALOG[dishId] || DISH_CATALOG['tarte-fraises'];

  const urlPitch = parseFloat(urlParams.get('pitch'));
  const urlYaw   = parseFloat(urlParams.get('yaw'));
  const urlLift  = parseFloat(urlParams.get('lift'));
  const urlFree  = urlParams.has('free');

  if (!isNaN(urlPitch)) dish.defaultPitch = urlPitch;
  if (!isNaN(urlYaw))   dish.defaultYaw   = urlYaw;
  if (!isNaN(urlLift))  dish.lift         = urlLift;
  if (urlFree)          dish.static       = false;

  console.log('[Food3D v19] Loading dish:', dishId, '→', dish.file);

  // ---------- 1. CAMERA ----------
  let stream = null;
  let currentFacingMode = 'environment';

  async function startCamera(facingMode) {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    const constraints = {
      video: {
        facingMode: { ideal: facingMode },
        width:  { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    await video.play();
    currentFacingMode = facingMode;
    video.classList.toggle('mirrored', facingMode === 'user');
  }

  try {
    await startCamera('environment');
    setProgress(15);
  } catch (err) {
    console.error('[Food3D] Camera denied or unavailable:', err);
    $('camera-denied').classList.add('visible');
    loader.style.display = 'none';
    return;
  }

  // ---------- 2. PLAYCANVAS APP ----------
  if (typeof pc === 'undefined') {
    console.error('[Food3D] PlayCanvas not loaded');
    return;
  }

  const app = new pc.AppBase(canvas);
  const gfxDevice = await pc.createGraphicsDevice(canvas, {
    deviceTypes: ['webgl2', 'webgl1'],
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });

  const createOptions = new pc.AppOptions();
  createOptions.graphicsDevice = gfxDevice;
  createOptions.mouse = new pc.Mouse(canvas);
  createOptions.touch = new pc.TouchDevice(canvas);
  createOptions.componentSystems = [
    pc.RenderComponentSystem, pc.CameraComponentSystem,
    pc.ScriptComponentSystem, pc.GSplatComponentSystem
  ];
  createOptions.resourceHandlers = [
    pc.TextureHandler, pc.ContainerHandler,
    pc.ScriptHandler, pc.GSplatHandler
  ];

  app.init(createOptions);
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  gfxDevice.maxPixelRatio = dpr;

  app.scene.skyboxIntensity = 0;
  setProgress(28);

  // ============================================================
  //   COMPOSITION
  // ============================================================
  const SPLAT_POS_X = 0, SPLAT_POS_Y = 0, SPLAT_POS_Z = 0;
  const CAM_POS_X   = 0, CAM_POS_Y   = 0, CAM_POS_Z   = 5800;
  const SPLAT_SCALE = dish.scale;
  const SPLAT_EULER_X = dish.euler.x, SPLAT_EULER_Y = dish.euler.y, SPLAT_EULER_Z = dish.euler.z;
  const SPLAT_TRIM_X  = dish.trim.x,  SPLAT_TRIM_Y  = dish.trim.y, SPLAT_TRIM_Z  = dish.trim.z;
  const SPLAT_LIFT_Y  = dish.lift;
  const FOV_Y         = 50;

  const cameraEntity = new pc.Entity('camera');
  cameraEntity.addComponent('camera', {
    clearColor: new pc.Color(0, 0, 0, 0),
    clearColorBuffer: true,
    clearDepthBuffer: true,
    fov: FOV_Y,
    nearClip: 0.01,
    farClip: 1e7
  });
  cameraEntity.setPosition(CAM_POS_X, CAM_POS_Y, CAM_POS_Z);
  cameraEntity.lookAt(SPLAT_POS_X, SPLAT_POS_Y, SPLAT_POS_Z);
  app.root.addChild(cameraEntity);
  setProgress(40);

  // ---------- 4. LOAD SPLAT ----------
  const splatAsset = new pc.Asset(dishId, 'gsplat', { url: dish.file });
  app.assets.add(splatAsset);

  splatAsset.on('progress', (received, total) => {
    if (total > 0) {
      const p = 40 + (received / total) * 50;
      setProgress(p);
    }
  });

  try {
    await new Promise((resolve, reject) => {
      splatAsset.once('load', resolve);
      splatAsset.once('error', reject);
      app.assets.load(splatAsset);
    });
  } catch (err) {
    console.error('[Food3D] Splat load failed:', err);
    loader.style.display = 'none';
    return;
  }
  setProgress(92);

  const pivot = new pc.Entity('pivot');
  app.root.addChild(pivot);
  pivot.setPosition(SPLAT_POS_X, SPLAT_POS_Y, SPLAT_POS_Z);

  const splatEntity = new pc.Entity('splat');
  splatEntity.addComponent('gsplat', { asset: splatAsset });
  pivot.addChild(splatEntity);

  splatEntity.setLocalScale(SPLAT_SCALE, SPLAT_SCALE, SPLAT_SCALE);
  splatEntity.setLocalEulerAngles(
    SPLAT_EULER_X + SPLAT_TRIM_X,
    SPLAT_EULER_Y + SPLAT_TRIM_Y,
    SPLAT_EULER_Z + SPLAT_TRIM_Z
  );

  // ============================================================
  //   CENTRAGE HARDCODÉ
  // ============================================================
  const localCenter = new pc.Vec3(
    dish.centerLocal.x,
    dish.centerLocal.y,
    dish.centerLocal.z
  );
  const scaledCenter = new pc.Vec3(
    localCenter.x * SPLAT_SCALE,
    localCenter.y * SPLAT_SCALE,
    localCenter.z * SPLAT_SCALE
  );
  const rotQuat = new pc.Quat();
  rotQuat.setFromEulerAngles(
    SPLAT_EULER_X + SPLAT_TRIM_X,
    SPLAT_EULER_Y + SPLAT_TRIM_Y,
    SPLAT_EULER_Z + SPLAT_TRIM_Z
  );
  const worldCenter = new pc.Vec3();
  rotQuat.transformVector(scaledCenter, worldCenter);

  splatEntity.setLocalPosition(
    -worldCenter.x,
    -worldCenter.y + SPLAT_LIFT_Y,
    -worldCenter.z
  );

  app.start();
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  setProgress(98);

  // ============================================================
  //   CONTRÔLES — LIMITES PAR PLAT v18
  //   Chaque plat définit ses propres limites dans DISH_CATALOG.limits
  //   - Tarte : zone restreinte "belle vue 3/4"
  //   - Salade : libre (mode calibration)
  // ============================================================
  const ROT_SPEED_H   = 0.4;
  const ROT_SPEED_V   = 0.6;
  const SMOOTH        = 0.22;
  const FRICTION      = 0.93;

  // Limites par plat (fallback large si non défini)
  const DEFAULT_LIMITS = { pitchMin: -180, pitchMax: 180, yawMin: -180, yawMax: 180 };
  const limits = dish.limits || DEFAULT_LIMITS;
  const PITCH_MIN = limits.pitchMin;
  const PITCH_MAX = limits.pitchMax;
  const YAW_MIN   = limits.yawMin;
  const YAW_MAX   = limits.yawMax;

  let isDragging = false;
  let activePointerId = null;
  let lastX = 0, lastY = 0;
  let velYaw = 0, velPitch = 0;
  let targetYaw   = dish.defaultYaw   || 0;
  let targetPitch = dish.defaultPitch || -45;
  let yaw   = targetYaw;
  let pitch = targetPitch;
  let userInteracted = false;

  function clampPitch(angle) {
    return Math.max(PITCH_MIN, Math.min(PITCH_MAX, angle));
  }
  function clampYaw(angle) {
    return Math.max(YAW_MIN, Math.min(YAW_MAX, angle));
  }

  if (!dish.static) {
    function onDown(e) {
      if (activePointerId !== null) return;
      activePointerId = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      isDragging = true;
      userInteracted = true;
      hint.classList.add('faded');
      velYaw = velPitch = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      if (e.cancelable) e.preventDefault();
    }
    function onMove(e) {
      if (!isDragging || e.pointerId !== activePointerId) return;
      if (e.cancelable) e.preventDefault();
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      velYaw   = dx * ROT_SPEED_H;
      velPitch = dy * ROT_SPEED_V;
      targetYaw   = clampYaw(targetYaw + velYaw);
      targetPitch = clampPitch(targetPitch + velPitch);
    }
    function onUp(e) {
      if (e.pointerId !== activePointerId) return;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      activePointerId = null;
      isDragging = false;
    }
    canvas.addEventListener('pointerdown',   onDown, { passive: false });
    canvas.addEventListener('pointermove',   onMove, { passive: false });
    canvas.addEventListener('pointerup',     onUp);
    canvas.addEventListener('pointercancel', onUp);
  } else {
    console.log('[Food3D v19] STATIC mode for', dishId);
    hint.style.display = 'none';
  }

  // ---------- UPDATE LOOP ----------
  let t0 = performance.now();
  app.on('update', (dt) => {
    const t = (performance.now() - t0) / 1000;
    if (!dish.static && userInteracted && !isDragging) {
      targetYaw   = clampYaw(targetYaw + velYaw);
      targetPitch = clampPitch(targetPitch + velPitch);
      velYaw   *= FRICTION;
      velPitch *= FRICTION;
      if (Math.abs(velYaw)   < 0.01) velYaw   = 0;
      if (Math.abs(velPitch) < 0.01) velPitch = 0;
    }
    yaw   += (targetYaw   - yaw)   * SMOOTH;
    pitch += (targetPitch - pitch) * SMOOTH;
    pivot.setLocalEulerAngles(pitch, yaw, 0);
    const s = 1 + Math.sin(t * 1.2) * 0.04;
    const o = 0.85 + Math.sin(t * 1.2) * 0.08;
    shadowEl.style.transform = `translate(-50%, -50%) scale(${s})`;
    shadowEl.style.opacity = o.toFixed(2);
  });

  setProgress(100);
  setTimeout(() => hint.classList.add('faded'), 4000);

  // ---------- DEBUG ----------
  const DEBUG = urlParams.has('debug');
  if (DEBUG) {
    const debugEl = document.createElement('div');
    debugEl.style.cssText = 'position:fixed;top:10px;left:10px;z-index:99999;background:rgba(0,0,0,0.9);color:#0f0;font:bold 16px monospace;padding:12px 16px;border-radius:10px;pointer-events:none;line-height:1.5;border:2px solid #0f0;';
    document.body.appendChild(debugEl);
    setInterval(() => {
      const hasLimits = PITCH_MAX < 180;
      let pitchArrow;
      if (hasLimits) {
        pitchArrow = pitch > PITCH_MAX - 1 ? '⚠️ TROP PLAT' : (pitch < PITCH_MIN + 1 ? '⚠️ TROP INCLINÉ' : '✅');
      } else {
        pitchArrow = pitch > 1 ? '⬇️ BAS' : (pitch < -1 ? '⬆️ HAUT' : '·');
      }
      const yawArrow   = yaw   > 1 ? '➡️ DROITE' : (yaw   < -1 ? '⬅️ GAUCHE' : '·');
      debugEl.innerHTML =
        '<span style="color:#ff0">PITCH: ' + pitch.toFixed(1) + '° ' + pitchArrow + '</span><br>' +
        '<span style="color:#ff0">YAW: ' + yaw.toFixed(1) + '° ' + yawArrow + '</span><br>' +
        '<span style="font-size:11px;color:#0a0">DISH: ' + dishId + '</span><br>' +
        '<span style="font-size:11px;color:#0a0">' + (hasLimits ? 'PITCH ∈ [' + PITCH_MIN + ', ' + PITCH_MAX + '] · YAW ∈ [' + YAW_MIN + ', ' + YAW_MAX + ']' : '🔓 LIBRE (mode calibration)') + '</span>';
    }, 50);
  }

  // ---------- RESIZE ----------
  const handleResize = () => { app.resizeCanvas(); };
  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', () => setTimeout(handleResize, 200));

  // ---------- FLIP CAMERA ----------
  let flipLock = false;
  flipBtn.addEventListener('click', async () => {
    if (flipLock) return;
    flipLock = true;
    flipBtn.classList.add('flipping');
    const next = currentFacingMode === 'environment' ? 'user' : 'environment';
    try {
      await startCamera(next);
    } catch (err) {
      console.error('[Food3D] Flip camera failed:', err);
      try { await startCamera(currentFacingMode); } catch (_) {}
    } finally {
      setTimeout(() => {
        flipBtn.classList.remove('flipping');
        flipLock = false;
      }, 500);
    }
  });

  // ---------- CAPTURE ----------
  captureBtn.addEventListener('click', async () => {
    flash.classList.add('flash');
    setTimeout(() => flash.classList.remove('flash'), 120);
    app.render();
    const W = window.innerWidth  * dpr;
    const H = window.innerHeight * dpr;
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');
    const vw = video.videoWidth, vh = video.videoHeight;
    if (vw && vh) {
      const screenAR = W / H;
      const videoAR  = vw / vh;
      let sx, sy, sw, sh;
      if (videoAR > screenAR) {
        sh = vh; sw = vh * screenAR;
        sx = (vw - sw) / 2; sy = 0;
      } else {
        sw = vw; sh = vw / screenAR;
        sx = 0; sy = (vh - sh) / 2;
      }
      if (currentFacingMode === 'user') {
        ctx.save();
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
        ctx.restore();
      } else {
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
      }
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
    }
    const cx = W / 2;
    const cy = H * 0.62;
    const rx = W * 0.21;
    const ry = H * 0.035;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    grad.addColorStop(0,    'rgba(0,0,0,0.55)');
    grad.addColorStop(0.35, 'rgba(0,0,0,0.30)');
    grad.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.drawImage(canvas, 0, 0, W, H);
    out.toBlob((blob) => {
      if (!blob) return;
      const filename = 'food3d-' + dishId + '-' + Date.now() + '.jpg';
      const file = new File([blob], filename, { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Food3D · ' + dishId }).catch(() => downloadBlob(blob, filename));
      } else {
        downloadBlob(blob, filename);
      }
    }, 'image/jpeg', 0.92);
  });

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ---------- CLEANUP ----------
  window.addEventListener('pagehide', () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    try { app.destroy(); } catch (e) {}
  });

  setTimeout(() => {
    loader.classList.add('hidden');
    setTimeout(() => loader.style.display = 'none', 700);
  }, 200);

})().catch(err => {
  console.error('[Food3D] FATAL', err);
});
