/* Food3D · mobile camera-overlay viewer
 * v6 : Multi-plats dynamique + centrage automatique
 *   - Lit ?dish=XXX dans l'URL et charge le bon .ply
 *   - Centrage géométrique automatique (plus de hardcoding par plat)
 *   - Inclinaison max 60° (anti-artefacts), swipe progressif
 *   - Axe yaw fixé sur Y
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
  //   📋 CATALOGUE DES PLATS — Modifier ici pour ajouter un plat
  // ============================================================
  const DISH_CATALOG = {
    'tarte-fraises': {
      file: 'fraise.ply',
      scale: 2400,
      lift: 400,
      euler: { x: -90, y: 0, z: 180 },
      trim: { x: 12, y: 0, z: 0 }
    },
    'salade-homard': {
      file: 'salade.ply',
      scale: 2400,     // À ajuster selon le rendu
      lift: 400,       // À ajuster selon le rendu
      euler: { x: -90, y: 0, z: 180 },
      trim: { x: 0, y: 0, z: 0 }
    },
    // Pour ajouter un plat : copier le bloc et changer id/file
  };

  // Lire le paramètre ?dish= dans l'URL
  const urlParams = new URLSearchParams(location.search);
  const dishId = urlParams.get('dish') || 'tarte-fraises';  // tarte par défaut
  const dish = DISH_CATALOG[dishId] || DISH_CATALOG['tarte-fraises'];
  console.log('[Food3D v6] Loading dish:', dishId, '→', dish.file);

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
  setProgress(28);

  // ============================================================
  //   COMPOSITION (paramètres tirés du catalogue)
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

  // ---------- 4. LOAD SPLAT DYNAMIQUE ----------
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

  // ---------- Centrage automatique via bounding box ----------
  // On utilise l'AABB (Axis-Aligned Bounding Box) du splat pour calculer
  // le centre géométrique sans hardcoding.
  await new Promise((r) => requestAnimationFrame(r));
  let centerX = 0, centerY = 0, centerZ = 0;
  try {
    const aabb = splatEntity.gsplat.instance.aabb;
    if (aabb && aabb.center) {
      const c = aabb.center;
      centerX = c.x;
      centerY = c.y;
      centerZ = c.z;
      console.log('[Food3D v6] Auto-center:', { x: centerX, y: centerY, z: centerZ });
    }
  } catch (e) {
    console.warn('[Food3D v6] Auto-center failed, fallback to fraise hardcoded:', e);
    // Fallback : valeurs de la fraise (compatibilité descendante)
    const fallback = new pc.Vec3(0.1644, 0.5843, -1.5571);
    const _scaled = new pc.Vec3(
      fallback.x * SPLAT_SCALE,
      fallback.y * SPLAT_SCALE,
      fallback.z * SPLAT_SCALE
    );
    const _rot = new pc.Quat();
    _rot.setFromEulerAngles(
      SPLAT_EULER_X + SPLAT_TRIM_X,
      SPLAT_EULER_Y + SPLAT_TRIM_Y,
      SPLAT_EULER_Z + SPLAT_TRIM_Z
    );
    const _rotated = new pc.Vec3();
    _rot.transformVector(_scaled, _rotated);
    centerX = _rotated.x;
    centerY = _rotated.y;
    centerZ = _rotated.z;
  }
  splatEntity.setLocalPosition(-centerX, -centerY + SPLAT_LIFT_Y, -centerZ);

  app.start();
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  setProgress(98);

  // ============================================================
  //   ⚙️  CONTRÔLES INTERACTION
  // ============================================================
  const ROT_SPEED_H   = 0.4;
  const ROT_SPEED_V   = 0.6;     // Sensibilité progressive (contrôle précis)
  const SMOOTH        = 0.22;
  const FRICTION      = 0.93;
  const MAX_TILT_UP   = 60;      // Vue plongeante anti-artefacts
  const MAX_TILT_DOWN = 60;
  // ============================================================

  // ---------- 5. INTERACTION ----------
  let isDragging = false;
  let activePointerId = null;
  let lastX = 0, lastY = 0;
  let velYaw = 0, velPitch = 0;
  let targetYaw = 0, targetPitch = 0;
  let yaw = 0, pitch = 0;
  let userInteracted = false;

  function clampPitch(angle) {
    return Math.max(-MAX_TILT_DOWN, Math.min(MAX_TILT_UP, angle));
  }

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
    targetYaw   += velYaw;
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

  // ---------- 6. UPDATE LOOP ----------
  let t0 = performance.now();
  app.on('update', (dt) => {
    const t = (performance.now() - t0) / 1000;

    if (userInteracted && !isDragging) {
      targetYaw   += velYaw;
      targetPitch = clampPitch(targetPitch + velPitch);
      velYaw   *= FRICTION;
      velPitch *= FRICTION;
      if (Math.abs(velYaw)   < 0.01) velYaw   = 0;
      if (Math.abs(velPitch) < 0.01) velPitch = 0;
    }

    yaw   += (targetYaw   - yaw)   * SMOOTH;
    pitch += (targetPitch - pitch) * SMOOTH;

    // pitch -> X, yaw -> Y, Z=0 (fix axe v4)
    pivot.setLocalEulerAngles(pitch, yaw, 0);

    const s = 1 + Math.sin(t * 1.2) * 0.04;
    const o = 0.85 + Math.sin(t * 1.2) * 0.08;
    shadowEl.style.transform = `translate(-50%, -50%) scale(${s})`;
    shadowEl.style.opacity = o.toFixed(2);
  });

  setProgress(100);
  setTimeout(() => hint.classList.add('faded'), 4000);

  // ---------- DEBUG VISUEL (?debug=1) ----------
  const DEBUG = urlParams.has('debug');
  if (DEBUG) {
    const debugEl = document.createElement('div');
    debugEl.style.cssText = 'position:fixed;top:10px;left:10px;z-index:99999;background:rgba(0,0,0,0.85);color:#0f0;font:12px monospace;padding:10px;border-radius:8px;pointer-events:none;line-height:1.5;border:1px solid #0f0;';
    document.body.appendChild(debugEl);
    setInterval(() => {
      debugEl.innerHTML =
        '<b>DISH:</b> ' + dishId + '<br>' +
        '<b>FILE:</b> ' + dish.file + '<br>' +
        '<b>PITCH:</b> ' + pitch.toFixed(1) + 'deg<br>' +
        '<b>YAW:</b> ' + (yaw % 360).toFixed(1) + 'deg<br>' +
        '<b>MAX_TILT:</b> +/-' + MAX_TILT_UP + 'deg';
    }, 50);
    console.log('[Food3D v6] DEBUG ON', { dishId, dish, MAX_TILT_UP, ROT_SPEED_V });
  }

  // ---------- 7. RESIZE ----------
  const handleResize = () => { app.resizeCanvas(); };
  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', () => setTimeout(handleResize, 200));

  // ---------- 8. FLIP CAMERA ----------
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

  // ---------- 9. CAPTURE ----------
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

  // ---------- 10. CLEANUP ----------
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
