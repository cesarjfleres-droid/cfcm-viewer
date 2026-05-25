/* Food3D · mobile camera-overlay viewer
 * Vanilla JS + PlayCanvas. No tracking — pseudo-AR illusion.
 * v2 : ajout flip caméra (selfie / arrière) + capture mirror-aware
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

  // ---------- 1. CAMERA (avec switch front/back) ----------
  let stream = null;
  let currentFacingMode = 'environment';

  async function startCamera(facingMode) {
    // Couper proprement le stream précédent
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
    // Mirror visuel uniquement en mode selfie (convention iOS/Android)
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
  //   COMPOSITION (hardcoded — préservée à l'identique)
  // ============================================================
  const SPLAT_POS_X = 0, SPLAT_POS_Y = 0, SPLAT_POS_Z = 0;
  const CAM_POS_X   = 0, CAM_POS_Y   = 0, CAM_POS_Z   = 5800;
  const SPLAT_SCALE = 2400;
  const SPLAT_EULER_X = -90, SPLAT_EULER_Y = 0, SPLAT_EULER_Z = 180;
  const SPLAT_TRIM_X  = 12,  SPLAT_TRIM_Y  = 0, SPLAT_TRIM_Z  = 0;
  const SPLAT_LIFT_Y  = 400;
  const FOV_Y         = 50;
  // ============================================================

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
  const splatAsset = new pc.Asset('fraise', 'gsplat', { url: 'fraise.ply' });
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

  // ---------- Centrage opaque (offline-computed) ----------
  const TART_LOCAL_CENTRE = new pc.Vec3(0.1644, 0.5843, -1.5571);
  const _scaled = new pc.Vec3(
    TART_LOCAL_CENTRE.x * SPLAT_SCALE,
    TART_LOCAL_CENTRE.y * SPLAT_SCALE,
    TART_LOCAL_CENTRE.z * SPLAT_SCALE
  );
  const _rot = new pc.Quat();
  _rot.setFromEulerAngles(
    SPLAT_EULER_X + SPLAT_TRIM_X,
    SPLAT_EULER_Y + SPLAT_TRIM_Y,
    SPLAT_EULER_Z + SPLAT_TRIM_Z
  );
  const _rotated = new pc.Vec3();
  _rot.transformVector(_scaled, _rotated);
  splatEntity.setLocalPosition(-_rotated.x, -_rotated.y + SPLAT_LIFT_Y, -_rotated.z);

  app.start();
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  setProgress(98);

  // ---------- 5. INTERACTION ----------
  let isDragging = false;
  let activePointerId = null;
  let lastX = 0, lastY = 0;
  let velY = 0, velX = 0;
  let targetRotY = 0, targetRotX = 0;
  let rotY = 0, rotX = 0;
  let userInteracted = false;

  const ROT_SPEED = 0.4;
  const SMOOTH    = 0.22;
  const FRICTION  = 0.95;
  const MAX_TILT  = 8;

  function onDown(e) {
    if (activePointerId !== null) return;
    activePointerId = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    isDragging = true;
    userInteracted = true;
    hint.classList.add('faded');
    velX = velY = 0;
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
    velY = dx * ROT_SPEED;
    velX = dy * ROT_SPEED;
    targetRotY += velY;
    targetRotX = Math.max(-MAX_TILT, Math.min(MAX_TILT, targetRotX + velX));
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
      targetRotY += velY;
      targetRotX = Math.max(-MAX_TILT, Math.min(MAX_TILT, targetRotX + velX));
      velY *= FRICTION;
      velX *= FRICTION;
      if (Math.abs(velY) < 0.01) velY = 0;
      if (Math.abs(velX) < 0.01) velX = 0;
    }

    rotY += (targetRotY - rotY) * SMOOTH;
    rotX += (targetRotX - rotX) * SMOOTH;

    pivot.setLocalEulerAngles(rotX, 0, rotY);

    const s = 1 + Math.sin(t * 1.2) * 0.04;
    const o = 0.85 + Math.sin(t * 1.2) * 0.08;
    shadowEl.style.transform = `translate(-50%, -50%) scale(${s})`;
    shadowEl.style.opacity = o.toFixed(2);
  });

  setProgress(100);
  setTimeout(() => hint.classList.add('faded'), 4000);

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
      // Tentative de fallback : reprendre l'ancienne caméra
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

    // Forcer un frame WebGL frais avant lecture
    app.render();

    const W = window.innerWidth  * dpr;
    const H = window.innerHeight * dpr;
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');

    // 1) Vidéo (mode object-fit: cover) + mirror si selfie
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
        // Match visual mirror : flip horizontal sur le rendu final
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

    // 2) Fake ombre
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

    // 3) Splat (canvas WebGL transparent)
    ctx.drawImage(canvas, 0, 0, W, H);

    out.toBlob((blob) => {
      if (!blob) return;
      const filename = `food3d-${Date.now()}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Food3D' }).catch(() => downloadBlob(blob, filename));
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

  // Hide loader
  setTimeout(() => {
    loader.classList.add('hidden');
    setTimeout(() => loader.style.display = 'none', 700);
  }, 200);

})().catch(err => {
  console.error('[Food3D] FATAL', err);
});
