/* Food3D · mobile camera-overlay viewer
 * Vanilla JS + PlayCanvas. No tracking — pseudo-AR illusion.
 */
(async function main() {
  const $ = (id) => document.getElementById(id);
  const loader = $('loader');
  const loaderFill = $('loader-fill');
  const loaderPercent = $('loader-percent');
  const video = $('camera-feed');
  const canvas = $('viewer-3d');
  const shadowEl = $('shadow');
  const hint = $('hint');
  const flash = $('capture-flash');
  const captureBtn = $('capture-btn');

  const setProgress = (p) => {
    loaderFill.style.width = p + '%';
    loaderPercent.textContent = Math.round(p) + '%';
  };

  // ---------- 1. CAMERA ----------
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    setProgress(15);
  } catch (err) {
    console.error('Camera denied:', err);
    $('camera-denied').classList.add('visible');
    loader.style.display = 'none';
    return;
  }

  // ---------- 2. PLAYCANVAS APP ----------
  if (typeof pc === 'undefined') {
    console.error('PlayCanvas not loaded');
    return;
  }

  const app = new pc.AppBase(canvas);

  const gfxDevice = await pc.createGraphicsDevice(canvas, {
    deviceTypes: ['webgl2', 'webgl1'],
    antialias: true,               // smoother splat edges
    alpha: true,
    preserveDrawingBuffer: true,   // needed for capture
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

  // Render at full device pixel ratio (iPhones are 3) for maximum splat sharpness.
  // Drop the cap to 2 if FPS suffers on older Androids.
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  gfxDevice.maxPixelRatio = dpr;

  app.scene.skyboxIntensity = 0;
  setProgress(28);

  // ============================================================
  //   RESTORED COMPOSITION (world-anchored, "Much closer now" state)
  //   Camera pulled back along +Z, tart at world origin.
  //   All hardcoded — no AABB, no fitting, no normalisation.
  // ============================================================
  const SPLAT_POS_X   = 0;
  const SPLAT_POS_Y   = 0;
  const SPLAT_POS_Z   = 0;
  const CAM_POS_X     = 0;
  const CAM_POS_Y     = 0;
  // Camera distance: was 30 with the OLD off-centre setup, where the tart's
  // centroid happened to land ~5100 units away from the camera after rotation
  // & scale. Now that we explicitly centre the tart at world origin, we need
  // to put the camera at that same ~5100-unit distance to preserve the
  // apparent on-screen size. Tweak this single number to zoom in/out.
  const CAM_POS_Z     = 5800;

  const SPLAT_SCALE   = 3000;

  // Orientation: base axis-swap + fine trim.
  const SPLAT_EULER_X = -90;
  const SPLAT_EULER_Y = 0;
  const SPLAT_EULER_Z = 180;
  const SPLAT_TRIM_X  = 12;
  const SPLAT_TRIM_Y  = 0;
  const SPLAT_TRIM_Z  = 0;

  // Vertical screen position. Negative = slightly below centre (table-top feel).
  const SPLAT_LIFT_Y  = 2500;

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
      const p = 40 + (received / total) * 50; // 40 -> 90
      setProgress(p);
    }
  });

  await new Promise((resolve, reject) => {
    splatAsset.once('load', resolve);
    splatAsset.once('error', reject);
    app.assets.load(splatAsset);
  });
  setProgress(92);

  // Pivot at world origin (SPLAT_POS). World-anchored — gives the tart a "spatial" feel.
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

  // ---------- AUTO-CENTRE the tart on the visible core ----------
  // The .ply contains thousands of "floater" splats from the gaussian
  // reconstruction, scattered up to ±24 units away from the actual cake.
  // PlayCanvas's runtime AABB includes them, so its centre is way off
  // (around (10.9, -5.1, -5.0) in local space) — using it shifts the
  // tart tens of thousands of world units off-screen.
  //
  // Instead, we hardcode the centre of the OPAQUE (visible) splats only,
  // computed offline from fraise.ply (opacity sigmoid >= 0.5):
  //   X: [-0.24, 0.57]   centre = 0.165
  //   Y: [ 0.39, 0.86]   centre = 0.623
  //   Z: [-1.91, -1.23]  centre = -1.573
  // This is the geometric centre of the cake in splat-local space.
  //
  // We translate by -R*S*centre so that point lands at world (0,0,0)
  // — i.e. exactly where the camera looks. Scale and orientation untouched.
  const TART_LOCAL_CENTRE = new pc.Vec3(0.165, 0.623, -1.573);
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
  // Negate to centre, then re-apply SPLAT_LIFT_Y as a fine vertical tweak.
  splatEntity.setLocalPosition(-_rotated.x, -_rotated.y + SPLAT_LIFT_Y, -_rotated.z);

  app.start();
  // Two settle frames so the splat is rendered at its final position before the loader fades.
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  setProgress(98);

  // ---------- 5. INTERACTION (mobile-first, pointer events + capture) ----------
  let isDragging = false;
  let activePointerId = null;
  let lastX = 0, lastY = 0;
  let velY = 0, velX = 0;
  let targetRotY = 0, targetRotX = 0;
  let rotY = 0, rotX = 0;
  let userInteracted = false;

  const ROT_SPEED = 0.6;        // deg per px — slightly faster for thumb-scale drags
  const SMOOTH    = 0.25;       // higher = snappier
  const FRICTION  = 0.94;       // closer to 1 = longer glide
  // Tilt limit: the gaussian-splat was trained mainly from above, so steep
  // angles reveal floaters, holes and unmodelled sides of the tart. Keep the
  // user inside the "well-reconstructed" cone — 40° lets the pastry crust be
  // visible from a comfortable 3/4 angle but stays short of the back-side
  // artefact zone (which starts around 50°+). PlayCanvas's gsplat pass
  // can't be depth-occluded by meshes, so this tilt cap is the artefact fix.
  const MAX_TILT  = 40;

  function onDown(e) {
    if (activePointerId !== null) return;          // ignore second finger
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
      // inertia
      targetRotY += velY;
      targetRotX = Math.max(-MAX_TILT, Math.min(MAX_TILT, targetRotX + velX));
      velY *= FRICTION;
      velX *= FRICTION;
      if (Math.abs(velY) < 0.01) velY = 0;
      if (Math.abs(velX) < 0.01) velX = 0;
    }

    rotY += (targetRotY - rotY) * SMOOTH;
    rotX += (targetRotX - rotX) * SMOOTH;

    // Pivot lives in camera-local space — use setLocalEulerAngles so rotation is correct.
    // NOTE: horizontal swipes use the Z-axis (3rd arg), NOT the Y-axis. Reason:
    // after the base rotation (-78, 0, 180), the tart's own vertical axis
    // (top-of-cake → bottom-of-cake) lines up with world Z, not world Y. If we
    // spun around world Y, horizontal swipes would TIP the tart on its side and
    // reveal the unmodelled underside. Spinning around world Z makes the tart
    // rotate cleanly on its base, top-of-cake stays facing the camera.
    pivot.setLocalEulerAngles(rotX, 0, rotY);

    // CSS shadow: gentle breathing in sync with float
    const s = 1 + Math.sin(t * 1.2) * 0.04;
    const o = 0.85 + Math.sin(t * 1.2) * 0.08;
    shadowEl.style.transform = `translate(-50%, -50%) scale(${s})`;
    shadowEl.style.opacity = o.toFixed(2);
  });

  // app.start() already called above before the AABB poll.
  setProgress(100);

  // Auto-fade hint after 4s even without touch
  setTimeout(() => hint.classList.add('faded'), 4000);

  // ---------- 7. RESIZE ----------
  const handleResize = () => { app.resizeCanvas(); };
  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', () => setTimeout(handleResize, 200));

  // ---------- 8. CAPTURE ----------
  captureBtn.addEventListener('click', async () => {
    flash.classList.add('flash');
    setTimeout(() => flash.classList.remove('flash'), 120);

    // Force a fresh frame on the WebGL canvas before reading it.
    app.render();

    const W = window.innerWidth  * dpr;
    const H = window.innerHeight * dpr;
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');

    // 1) video, replicating object-fit: cover
    const vw = video.videoWidth, vh = video.videoHeight;
    if (vw && vh) {
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
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
    }

    // 2) fake shadow under the dish
    const cx = W / 2;
    const cy = H * 0.62;
    const rx = W * 0.21;
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

    // 3) splat (transparent WebGL canvas)
    ctx.drawImage(canvas, 0, 0, W, H);

    out.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `food3d-${Date.now()}.jpg`, { type: 'image/jpeg' });

      // Try native share with the file (iOS 16+, Android Chrome)
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
    a.download = `food3d-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ---------- 9. CLEANUP ----------
  window.addEventListener('pagehide', () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    try { app.destroy(); } catch (e) {}
  });

  // Hide loader
  setTimeout(() => {
    loader.classList.add('hidden');
    setTimeout(() => loader.style.display = 'none', 700);
  }, 0);

})().catch(err => {
  console.error('FATAL', err);
});
