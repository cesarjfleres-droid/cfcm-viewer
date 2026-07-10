/* ============================================================
 * Salina · salina-viewer.js — v1 (moteur Baia Bella v27, validé prod)
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
 * v29 — auto-pose durcie (conservée) :
 *  · Correctif flip : les hauteurs suivent le retournement de la normale.
 *  · CŒUR DU PLAT : profil de densité le long des axes du plan → la table
 *    autour (scan tacos) est exclue ; recentrage + échelle calés sur le
 *    cœur seulement quand du contexte est détecté.
 *
 * v30 — STUDIO BLANC, PLAT VEDETTE :
 *  · SOCLE SUPPRIMÉ : le volume cache-trous créait des artefacts
 *    (perçages, plaques blanches). Le fond studio passe au BLANC (CSS) :
 *    les trous du scan se fondent dans l'assiette, zéro géométrie ajoutée.
 *  · PLAT PLUS GRAND : cadrage auto 2250 → 2700 (+20 %).
 *  · PLAT PLUS HAUT : point de visée abaissé (looky 1400 → 200) → le plat
 *    remonte vers le centre de l'écran, dégagé des boutons du bas.
 *  · DÉZOOM BRIDÉ : ZOOM_MAX 1.7 → 1.2, le plat reste toujours dominant.
 *
 * Calibration sans redéployer :
 *   ?dish=plat1&yaw0=35&yawr=45&elev=38&elevmin=30&elevmax=52
 *   &looky=200  + ex/ey/ez, fx/fy/fz, scale, camz, lift, zoommin
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
  const R2 = 'https://pub-cb6130d8c47d41edaef19f32291a50d2.r2.dev/Salina';

  const DISHES = {
    canolo: {
      name: 'Cannolo Sicilien',
      price: '15 \u20ac',
      url: `${R2}/canolo.ply`,
      // PLY brut du pipeline (sans transform SuperSplat) : dessus vers +Z
      // → base identité, la mise à plat table (Rx -90) fait le reste.
      // Validé sur canolo ; si un plat diffère : calibrer via &ex= &ey= &ez=
      euler: [0, 0, 0],
      correction: [0, 0, 0],
      centre: [0.508, -0.531, -0.401],   // centre strict P3–P97, op ≥ 0.6
      scale: 3400,
      camZ: 10000,
      lift: -450,
      yaw0: 0,
      yawRange: 360,
      elev0: 46, elevMin: 42, elevMax: 54, zoomMin: 0.55,
    },
    pates: {
      name: 'Spaghetto alla chitarra Mancini',
      price: '38 \u20ac',
      url: `${R2}/pates.ply`,
      // PLY brut du pipeline (sans transform SuperSplat) : dessus vers +Z
      // → base identité, la mise à plat table (Rx -90) fait le reste.
      // Validé sur canolo ; si un plat diffère : calibrer via &ex= &ey= &ez=
      euler: [0, 0, 0],
      correction: [0, 0, 0],
      centre: [0.360, -0.811, -0.933],   // centre strict
      scale: 3430,
      camZ: 10000,
      lift: -450,
      yaw0: 0,
      yawRange: 360,
      elev0: 46, elevMin: 42, elevMax: 54, zoomMin: 0.55,
    },
    thon: {
      name: 'Tartare de Thon',
      price: '28 \u20ac',
      url: `${R2}/thon.ply`,
      // PLY brut du pipeline (sans transform SuperSplat) : dessus vers +Z
      // → base identité, la mise à plat table (Rx -90) fait le reste.
      // Validé sur canolo ; si un plat diffère : calibrer via &ex= &ey= &ez=
      euler: [0, 0, 0],
      correction: [0, 0, 0],
      centre: [-0.060, 0.307, -0.084],   // centre strict
      scale: 3620,
      camZ: 10000,
      lift: -450,
      yaw0: 0,
      yawRange: 360,
      elev0: 46, elevMin: 42, elevMax: 54, zoomMin: 0.55,
    },
    tartare: {
      name: 'Tartare',
      price: '28 \u20ac',
      url: `${R2}/tartare-2.ply`,
      euler: [0, 0, 0],
      correction: [0, 0, 0],
      centre: [0, 0, 0],      // l'auto-pose mesure le vrai centre au chargement
      scale: 3200,            // fallback si l'auto-pose échoue
      camZ: 10000,
      lift: -450,
      yaw0: 0,
      yawRange: 360,
      elev0: 46, elevMin: 42, elevMax: 54, zoomMin: 0.55,
    },
    tacos: {
      name: 'Tacos Saumon',
      price: '20 \u20ac',
      url: `${R2}/tacos.ply`,
      disc: { shape: 'box' },   // plateau rectangulaire → socle assorti
      // Nuage non recentré (repère COLMAP décalé) : centre mesuré loin de
      // l'origine, étendue plus grande → échelle plus faible. Le viewer compense.
      // PLY brut du pipeline (sans transform SuperSplat) : dessus vers +Z
      // → base identité, la mise à plat table (Rx -90) fait le reste.
      // Validé sur canolo ; si un plat diffère : calibrer via &ex= &ey= &ez=
      euler: [0, 0, 0],
      correction: [0, 0, 0],
      centre: [-31.793, -0.203, 9.268],  // centre strict
      scale: 740,
      camZ: 10000,
      lift: -450,
      yaw0: 0,
      yawRange: 360,
      elev0: 50, elevMin: 42, elevMax: 60, zoomMin: 0.55,
    },
  };

  const params = new URLSearchParams(location.search);
  const dishKey = DISHES[params.get('dish')] ? params.get('dish') : 'canolo';
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
  const CENTRE_X      = num('cx', dish.centre[0]);
  const CENTRE_Y      = num('cy', dish.centre[1]);
  const CENTRE_Z      = num('cz', dish.centre[2]);
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
  const LOOK_Y        = num('looky', 200);        // v30 : visée basse → plat quasi centré, dégagé des boutons
  const YAW_START     = num('yaw0', dish.yaw0);   // angle vedette horizontal au chargement
  const YAW_RANGE     = num('yawr', dish.yawRange); // rotation autorisée : ± autour de l'angle vedette

  const FOV_Y = 50;
  const ZOOM_MIN = num('zoommin', dish.zoomMin ?? 0.55);  // v28 : gros plan profond rétabli
  const ZOOM_MAX = num('zoommax', 1.2);   // v30 : dézoom bridé, le plat reste dominant

  // Fiche plat dans l'UI
  $('dish-name').textContent = dish.name;
  $('dish-price').textContent = dish.price;
  loaderDish.textContent = dish.name;
  document.title = `Salina · ${dish.name} en 3D`;

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

  // ---------- 3pre. AUTO-POSE : le viewer mesure le nuage lui-même ----------
  // Les PLY sortent du pipeline sans nettoyage ni convention d'axes stable :
  // orientation, centre et échelle changent à chaque re-export. Plutôt que de
  // calibrer à la main, on lit les positions des gaussiennes chargées :
  //  · plan dominant (covariance + Jacobi) = l'assiette → normale à aligner sur +Y
  //  · signe de la normale : la nourriture est AU-DESSUS du plan
  //  · centre = médiane des points opaques (robuste aux floaters)
  //  · étendue → échelle et rayon du socle
  // Prioritiés : URL > config du plat > mesure auto. &flip=1 retourne si le
  // détecteur de dessus se trompe. Fallback silencieux si l'API est absente.
  let AUTO = null;
  try {
    const res = splatAsset.resource;
    const gd = res && (res.gsplatData || res.splatData);
    const N = gd && gd.numSplats;
    if (gd && gd.getProp && N > 500) {
      const px = gd.getProp('x'), py = gd.getProp('y'), pz = gd.getProp('z');
      const po = gd.getProp('opacity');   // logit
      if (px && py && pz) {
        // Échantillon de points opaques (≤ 30 000)
        const stride = Math.max(1, Math.floor(N / 30000));
        const xs = [], ys = [], zs = [];
        for (let i = 0; i < N; i += stride) {
          if (po) { const o = 1 / (1 + Math.exp(-po[i])); if (o < 0.6) continue; }
          xs.push(px[i]); ys.push(py[i]); zs.push(pz[i]);
        }
        const n = xs.length;
        if (n > 300) {
          const med = (arr) => { const s = arr.slice().sort((a, b) => a - b); return s[s.length >> 1]; };
          const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
          const cx = med(xs), cy = med(ys), cz = med(zs);
          // Covariance 3×3 centrée
          let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
          for (let i = 0; i < n; i++) {
            const dx = xs[i] - cx, dy = ys[i] - cy, dz = zs[i] - cz;
            xx += dx * dx; xy += dx * dy; xz += dx * dz;
            yy += dy * dy; yz += dy * dz; zz += dz * dz;
          }
          const A = [[xx / n, xy / n, xz / n], [xy / n, yy / n, yz / n], [xz / n, yz / n, zz / n]];
          // Jacobi : vecteur propre de la plus petite valeur propre = normale du plan
          const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
          for (let it = 0; it < 40; it++) {
            let p = 0, q = 1;
            if (Math.abs(A[0][2]) > Math.abs(A[p][q])) { p = 0; q = 2; }
            if (Math.abs(A[1][2]) > Math.abs(A[p][q])) { p = 1; q = 2; }
            if (Math.abs(A[p][q]) < 1e-12) break;
            const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
            const t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1));
            const c = 1 / Math.sqrt(t * t + 1), s = t * c;
            const app = A[p][p], aqq = A[q][q], apq = A[p][q];
            A[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
            A[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
            A[p][q] = A[q][p] = 0;
            for (let k = 0; k < 3; k++) {
              if (k !== p && k !== q) {
                const akp = A[k][p], akq = A[k][q];
                A[k][p] = A[p][k] = c * akp - s * akq;
                A[k][q] = A[q][k] = s * akp + c * akq;
              }
              const vkp = V[k][p], vkq = V[k][q];
              V[k][p] = c * vkp - s * vkq;
              V[k][q] = s * vkp + c * vkq;
            }
          }
          let mi = 0;
          if (A[1][1] < A[mi][mi]) mi = 1;
          if (A[2][2] < A[mi][mi]) mi = 2;
          let nx = V[0][mi], ny = V[1][mi], nz = V[2][mi];
          const nl = Math.hypot(nx, ny, nz) || 1;
          nx /= nl; ny /= nl; nz /= nl;
          // Étendues et rayon (distances au centre, signées le long de la normale
          // et radiales dans le plan)
          const dsig = new Array(n), drad = new Array(n);
          for (let i = 0; i < n; i++) {
            const dx = xs[i] - cx, dy = ys[i] - cy, dz = zs[i] - cz;
            const d = dx * nx + dy * ny + dz * nz;
            dsig[i] = d;
            const rx = dx - d * nx, ry = dy - d * ny, rz = dz - d * nz;
            drad[i] = Math.hypot(rx, ry, rz);
          }
          const radS = drad.slice().sort((a, b) => a - b);
          const radius = pct(radS, 0.95);            // rayon de l'assiette
          // Axes principaux DANS le plan (grand axe i1, petit axe i2) — sert au socle rectangulaire
          const idx = [0, 1, 2].filter((k) => k !== mi).sort((a, b) => A[b][b] - A[a][a]);
          const e1 = [V[0][idx[0]], V[1][idx[0]], V[2][idx[0]]];
          const e2 = [V[0][idx[1]], V[1][idx[1]], V[2][idx[1]]];
          // Dessus = côté de la NOURRITURE. Deux votes combinés :
          //  1) couleur : les points saturés (nourriture) vs neutres (assiette/jupe)
          //  2) masse   : points opaques dans le cylindre central de l'assiette
          const band = radius * 0.9;
          let aColor = 0, bColor = 0, aMass = 0, bMass = 0;
          // couleurs SH0 → RGB (si présentes dans le fichier)
          const r0 = gd.getProp('f_dc_0'), g0 = gd.getProp('f_dc_1'), b0 = gd.getProp('f_dc_2');
          const sats = (r0 && g0 && b0) ? new Array(n) : null;
          if (sats) {
            let k = 0;
            for (let i = 0; i < N; i += stride) {
              if (po) { const o = 1 / (1 + Math.exp(-po[i])); if (o < 0.6) continue; }
              const rr = 0.5 + 0.2820948 * r0[i], gg = 0.5 + 0.2820948 * g0[i], bb = 0.5 + 0.2820948 * b0[i];
              sats[k++] = Math.max(rr, gg, bb) - Math.min(rr, gg, bb);
            }
          }
          const satThr = 0.14;
          for (let i = 0; i < n; i++) {
            const d = dsig[i], ad = Math.abs(d);
            if (ad < 0.02 * band || ad > band) continue;
            if (sats && sats[i] >= satThr && drad[i] < 0.7 * radius) {
              if (d > 0) aColor++; else bColor++;
            }
            if (drad[i] < 0.55 * radius) {
              if (d > 0) aMass++; else bMass++;
            }
          }
          let score = 0;
          if (aColor + bColor > 200) score += 2 * (aColor - bColor) / (aColor + bColor);
          if (aMass + bMass > 200) score += (aMass - bMass) / (aMass + bMass);
          // Retournement (auto et/ou &flip=1) : on retourne AUSSI les hauteurs
          // mesurées, sinon "point le plus bas" et "bord" sont lus du mauvais
          // côté → socle mal placé (cause historique des perçages).
          let flipped = false;
          if (score < 0) flipped = !flipped;
          if (num('flip', 0)) flipped = !flipped;
          if (flipped) {
            nx = -nx; ny = -ny; nz = -nz;
            for (let i = 0; i < n; i++) dsig[i] = -dsig[i];
          }
          // Quaternion normale → +Y (from-to)
          let qAuto;
          const dot = ny;
          if (dot > 0.99999) qAuto = new pc.Quat();
          else if (dot < -0.99999) qAuto = new pc.Quat().setFromAxisAngle(new pc.Vec3(1, 0, 0), 180);
          else {
            const ax = new pc.Vec3(-nz, 0, nx).normalize();  // n × up
            qAuto = new pc.Quat().setFromAxisAngle(ax, Math.acos(dot) * 180 / Math.PI);
          }
          // Point le plus bas du nuage le long de la normale (le socle ira dessous)
          const sigS = dsig.slice().sort((a, b) => a - b);
          const dLow = pct(sigS, 0.005);

          // ---- CŒUR DU PLAT (v29) ----
          // Certains scans (tacos) embarquent la table autour du plat : le nuage
          // est bien plus grand que le plat seul. On isole le CŒUR par profil de
          // densité 1D le long de chaque axe du plan : le pipeline concentre les
          // gaussiennes sur le sujet, la densité s'effondre au bord du plat.
          // Toutes les mesures du socle (bas, bord, trous) se font sur ce cœur.
          const coreBox = !!(dish.disc && dish.disc.shape === 'box');
          const measure = (e1c, e2c) => {
            const pa = new Array(n), pb = new Array(n);
            for (let i = 0; i < n; i++) {
              const dx = xs[i] - cx, dy = ys[i] - cy, dz = zs[i] - cz;
              pa[i] = dx * e1c[0] + dy * e1c[1] + dz * e1c[2];
              pb[i] = dx * e2c[0] + dy * e2c[1] + dz * e2c[2];
            }
            const knee = (proj) => {
              const abs = new Array(n);
              for (let i = 0; i < n; i++) abs[i] = Math.abs(proj[i]);
              const absS = abs.slice().sort((u, v) => u - v);
              const pMax = pct(absS, 0.99);
              const fallback = pct(absS, 0.97);
              if (!(pMax > 1e-9)) return fallback;
              const B = 60, w = pMax / B, hist = new Float32Array(B);
              for (let i = 0; i < n; i++) hist[Math.min(B - 1, (abs[i] / w) | 0)]++;
              const sm = new Float32Array(B);
              for (let i = 0; i < B; i++)
                sm[i] = (hist[Math.max(0, i - 1)] + hist[i] + hist[Math.min(B - 1, i + 1)]) / 3;
              const refArr = Array.from(sm.slice(1, Math.max(4, (B * 0.35) | 0))).sort((u, v) => u - v);
              const ref = refArr[refArr.length >> 1] || 1;
              const thr = 0.2 * ref;   // la densité tombe sous 20 % du centre = bord du plat
              for (let i = (B * 0.3) | 0; i < B - 2; i++) {
                if (sm[i] < thr && sm[i + 1] < thr && sm[i + 2] < thr) return (i + 0.5) * w;
              }
              return fallback;   // pas de contexte : bord = P97 (scans cadrés)
            };
            let h1 = Math.min(knee(pa), radius * 1.05);
            let h2 = Math.min(knee(pb), radius * 1.05);
            h1 = Math.max(h1, radius * 0.15);
            h2 = Math.max(h2, radius * 0.15);
            const cA = [], cB = [], cH = [];
            for (let i = 0; i < n; i++) {
              if (Math.abs(pa[i]) <= h1 * 1.05 && Math.abs(pb[i]) <= h2 * 1.05) {
                cA.push(pa[i]); cB.push(pb[i]); cH.push(dsig[i]);
              }
            }
            return { h1, h2, cA, cB, cH };
          };

          let e1c = e1, e2c = e2;
          let M = measure(e1c, e2c);
          // Affinage : axes principaux du CŒUR seul — le contexte table fausse
          // l'orientation mesurée sur le nuage entier (critique pour le plateau tacos)
          if (M.cA.length > 300) {
            const mA = med(M.cA), mB = med(M.cB);
            let sAA = 0, sAB = 0, sBB = 0;
            for (let i = 0; i < M.cA.length; i++) {
              const da = M.cA[i] - mA, db = M.cB[i] - mB;
              sAA += da * da; sAB += da * db; sBB += db * db;
            }
            const phi = 0.5 * Math.atan2(2 * sAB, sAA - sBB);
            if (Math.abs(phi) > 0.03) {
              const cph = Math.cos(phi), sph = Math.sin(phi);
              const r1 = [
                cph * e1c[0] + sph * e2c[0],
                cph * e1c[1] + sph * e2c[1],
                cph * e1c[2] + sph * e2c[2]];
              const r2 = [
                -sph * e1c[0] + cph * e2c[0],
                -sph * e1c[1] + cph * e2c[1],
                -sph * e1c[2] + cph * e2c[2]];
              e1c = r1; e2c = r2;
              M = measure(e1c, e2c);
            }
          }
          // Grand axe en premier (h1 >= h2)
          if (M.h2 > M.h1) {
            const th = M.h1; M.h1 = M.h2; M.h2 = th;
            const tc = M.cA; M.cA = M.cB; M.cB = tc;
            const te = e1c; e1c = e2c; e2c = te;
          }

          const coreOK = M.cH.length > 300;
          // Contexte table détecté = le cœur est nettement plus petit que le nuage.
          // Dans ce cas seulement : recentrage + échelle sur le cœur (le rendu
          // des scans cadrés déjà validés reste strictement identique).
          const CTX = coreOK && Math.max(M.h1, M.h2) < radius * 0.85;
          let shiftA = 0, shiftB = 0, coreLow = dLow, coreRim = 0;
          let holeR = 0, holeA = 0, holeB = 0;
          if (coreOK) {
            if (CTX) { shiftA = med(M.cA); shiftB = med(M.cB); }
            const hS = M.cH.slice().sort((u, v) => u - v);
            coreLow = pct(hS, 0.01);   // vrai point bas du plat (P1, floaters exclus)
            // Bas du bord visible (bande extérieure du cœur) → référence silhouette
            const rimArr = [];
            for (let i = 0; i < M.cA.length; i++) {
              const u = Math.abs(M.cA[i] - shiftA) / M.h1;
              const v = Math.abs(M.cB[i] - shiftB) / M.h2;
              const m = Math.max(u, v);
              if (m >= 0.72 && m <= 1.05) rimArr.push(M.cH[i]);
            }
            const rimS = rimArr.sort((u, v) => u - v);
            coreRim = rimS.length > 50 ? pct(rimS, 0.25) : pct(hS, 0.6);
            // Carte d'occupation 18×18 : où sont les VRAIS trous du plat ?
            const G = 18, grid = new Int32Array(G * G);
            for (let i = 0; i < M.cA.length; i++) {
              const u = (M.cA[i] - shiftA) / M.h1;
              const v = (M.cB[i] - shiftB) / M.h2;
              const gx = (((u + 1) / 2) * G) | 0, gy = (((v + 1) / 2) * G) | 0;
              if (gx >= 0 && gx < G && gy >= 0 && gy < G) grid[gy * G + gx]++;
            }
            const solidThr = Math.max(3, Math.round((M.cA.length / (G * G)) * 0.30));
            for (let gy = 0; gy < G; gy++) {
              for (let gx = 0; gx < G; gx++) {
                if (grid[gy * G + gx] >= solidThr) continue;
                const u = ((gx + 0.5) / G) * 2 - 1;
                const v = ((gy + 0.5) / G) * 2 - 1;
                // seuls les trous INTÉRIEURS comptent (le pourtour = vide normal)
                const interior = coreBox
                  ? (Math.abs(u) <= 0.86 && Math.abs(v) <= 0.86)
                  : (u * u + v * v <= 0.74);
                if (!interior) continue;
                const aw = Math.abs(u) * M.h1, bw = Math.abs(v) * M.h2;
                if (aw > holeA) holeA = aw;
                if (bw > holeB) holeB = bw;
                const rw = Math.hypot(aw, bw);
                if (rw > holeR) holeR = rw;
              }
            }
            if (holeR === 0) {   // aucun trou détecté : socle minimal de sécurité
              holeR = 0.3 * Math.min(M.h1, M.h2);
              holeA = 0.3 * M.h1;
              holeB = 0.3 * M.h2;
            }
          }
          const cRef = CTX ? [
            cx + shiftA * e1c[0] + shiftB * e2c[0],
            cy + shiftA * e1c[1] + shiftB * e2c[1],
            cz + shiftA * e1c[2] + shiftB * e2c[2],
          ] : [cx, cy, cz];
          AUTO = {
            quat: qAuto,
            centre: cRef,
            radius: radius,
            extent: CTX ? 2 * Math.max(M.h1, M.h2) : radius * 2,
            dLow: dLow,
            coreOK: coreOK,
            coreH1: M.h1,
            coreH2: M.h2,
            coreLow: coreLow,
            coreRim: coreRim,
            holeR: holeR,
            holeA: holeA,
            holeB: holeB,
            axis1: e1c,
          };
        }
      }
    }
  } catch (e) { console.warn('Auto-pose indisponible, calibration config utilisée', e); }

  // ---------- 3. COMPOSITION : base + CORRECTION + MISE À PLAT TABLE ----------
  // qFinal = table ∘ correction ∘ base.
  //  - base + correction : orientent le dessus du plat vers la caméra (+Z), validé.
  //  - table (Rx -90°)   : couche ensuite le plat à plat, dessus vers le haut (+Y),
  //    horizontal et stable, prêt à être vu en plongée. rotation X/Z finales = 0.
  // Le centroïde est transformé par la MÊME rotation finale → plat centré.
  const qCorr  = new pc.Quat().setFromEulerAngles(CORR_X, CORR_Y, CORR_Z);
  let qFinal;
  if (AUTO) {
    // qAuto pose déjà l'assiette à plat (normale → +Y) ; fx/fy/fz = retouche
    qFinal = new pc.Quat().mul2(qCorr, AUTO.quat);
  } else {
    const qBase  = new pc.Quat().setFromEulerAngles(SPLAT_EULER_X, SPLAT_EULER_Y, SPLAT_EULER_Z);
    const qTable = new pc.Quat().setFromEulerAngles(-90, 0, 0);
    qFinal = new pc.Quat().mul2(qCorr, qBase);
    qFinal.mul2(qTable, qFinal);
  }

  const pivot = new pc.Entity('pivot');
  app.root.addChild(pivot);
  pivot.setPosition(0, 0, 0);

  const splatEntity = new pc.Entity('splat');
  splatEntity.addComponent('gsplat', { asset: splatAsset });
  pivot.addChild(splatEntity);

  const SCALE_EFF = Number.isFinite(num('scale', NaN)) ? num('scale', NaN)
                  : (AUTO ? 2700 / AUTO.extent : SPLAT_SCALE);
  splatEntity.setLocalScale(SCALE_EFF, SCALE_EFF, SCALE_EFF);
  console.info('[cadrage v30]', dishKey, '| scale =', Math.round(SCALE_EFF), AUTO ? ('| extent = ' + AUTO.extent.toFixed(2) + ' | coreOK = ' + AUTO.coreOK) : '| auto off');
  splatEntity.setLocalRotation(qFinal);

  // Centroïde local → monde : tourné (rotation finale) puis négué
  const LOCAL_CENTRE = new pc.Vec3(
    Number.isFinite(num('cx', NaN)) ? num('cx', NaN) : (AUTO ? AUTO.centre[0] : CENTRE_X),
    Number.isFinite(num('cy', NaN)) ? num('cy', NaN) : (AUTO ? AUTO.centre[1] : CENTRE_Y),
    Number.isFinite(num('cz', NaN)) ? num('cz', NaN) : (AUTO ? AUTO.centre[2] : CENTRE_Z)
  );
  const _scaled = new pc.Vec3(
    LOCAL_CENTRE.x * SCALE_EFF,
    LOCAL_CENTRE.y * SCALE_EFF,
    LOCAL_CENTRE.z * SCALE_EFF
  );
  const _rotated = new pc.Vec3();
  qFinal.transformVector(_scaled, _rotated);
  splatEntity.setLocalPosition(-_rotated.x, -_rotated.y + SPLAT_LIFT_Y, -_rotated.z);

  // ---------- 3bis. SOCLE : SUPPRIMÉ (v30) ----------
  // Le volume cache-trous créait des artefacts visibles (perçages, plaques).
  // Nouvelle stratégie : fond STUDIO BLANC (CSS) → les zones sans gaussiennes
  // laissent voir le blanc, qui se fond naturellement dans l'assiette.
  // Aucune géométrie ajoutée sous le plat.

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
