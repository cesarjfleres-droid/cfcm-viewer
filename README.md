# Baia Bella — Carte numérique premium

Carte interactive du restaurant Baia Bella (Beaulieu-sur-Mer) avec dégustation visuelle en 3D Gaussian Splatting.

## Architecture

```
/
├── index.html        Structure (hero, nav catégories, carte, fiche plat)
├── style.css         Design Côte d'Azur premium — mobile first
├── script.js         Rendu de la carte + viewer PlayCanvas gsplat
├── menu.json         Données : restaurant, catégories, 33 plats, configs caméra
├── models/
│   ├── plat1.ply     La Baia (salade) — 35 109 splats
│   ├── plat2.ply     Scampis sauvages rôtis — 108 561 splats
│   └── plat3.ply     Fresca (pizza) — 62 172 splats
└── assets/           (réservé : logo, photos, favicon)
```

Aucun build, aucune dépendance npm. PlayCanvas 1.77.0 est chargé depuis jsDelivr **uniquement** au premier clic sur un plat 3D.

## Déploiement

**Cloudflare Pages** : connecter le repo, build command vide, output `/`. Rien d'autre.
**GitHub Pages** : Settings → Pages → branche `main`, racine `/`.

Les `.ply` (8–27 Mo) passent sans souci sur les deux (limite Cloudflare : 25 Mo par fichier — ⚠️ `plat2.ply` fait **26,9 Mo**, voir ci-dessous).

> ⚠️ **plat2.ply dépasse la limite de 25 Mo de Cloudflare Pages.** Deux options :
> 1. Re-exporter depuis SuperSplat après nettoyage du fond (il descendra largement sous 25 Mo) ;
> 2. Le servir depuis un autre origin (R2, GitHub raw…) en mettant l'URL complète dans `model3d`.
> GitHub Pages accepte jusqu'à 100 Mo : aucun problème de ce côté.

## Cache

`VIEWER_VERSION` dans `script.js` suffixe `menu.json` et les `.ply` (`?v=1.0.0`).
À chaque déploiement : incrémenter la constante.

## Calibration caméra (`?debug=1`)

Chaque plat possède sa propre config dans `menu.json` → clé `viewer` :

| Clé | Rôle |
|---|---|
| `rotation` | Euler XYZ appliqué au modèle (remise à plat du splat) |
| `center` | Centre du plat dans le repère du PLY (mesuré, ne pas toucher) |
| `yaw` / `pitch` | Angle marketing initial (`pitch` négatif = vue plongeante) |
| `distance` + `min/maxDistance` | Zoom initial et limites |
| `min/maxPitch` | Empêche de passer sous la table / au zénith |
| `fov`, `targetHeight`, `autoRotateSpeed` | Champ, hauteur de visée, rotation idle |

Ouvrir `index.html?debug=1` → ouvrir un plat → l'overlay affiche yaw/pitch/dist en direct,
les boutons tournent le modèle par pas de 90°, **« copier la config »** met le bloc JSON
prêt à coller dans `menu.json`.

**Les `center` sont mesurés sur les vrais fichiers** (percentiles 2–98 sur les splats
d'opacité > 0,3). Les `rotation` initiales sont des estimations à partir de l'axe plat
de chaque nuage — à vérifier visuellement au premier lancement :

- `plat1` : axe plat = X → rotation `[0, 0, 90]` (si à l'envers : `[0, 0, -90]`)
- `plat2` : axe plat = Y, masse en haut → `[180, 0, 0]`
- `plat3` : axe plat = Y, masse en bas → `[0, 0, 0]`

## Performance

- Moteur 3D chargé à la demande (la carte seule ne pèse que ~30 Ko + fontes)
- `maxPixelRatio` plafonné à 2, antialias désactivé (les splats n'en ont pas besoin)
- Un seul splat en mémoire à la fois (`unload()` du précédent)
- Auto-rotation coupée si `prefers-reduced-motion`
- Contrôles Pointer Events : un doigt = orbite, pincement = zoom, molette desktop
