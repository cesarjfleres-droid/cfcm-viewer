#!/usr/bin/env python3
# ============================================================
# Food3D · ply_cleaner.py
#
# Nettoie les exports Gaussian Splatting (Nerfstudio / splatfacto)
# AVANT upload sur R2 : supprime toute gaussienne contenant des
# valeurs NaN ou Inf (position, échelle, rotation, couleur...).
#
# Pourquoi : une seule gaussienne NaN suffit à casser le rendu
# PlayCanvas (bounding box / tri invalides) → le plat entier
# devient invisible dans le viewer. Cas réel : tartare-2.ply
# (268 gaussiennes NaN sur 47 972 → plat absent).
#
# Usage :
#   python ply_cleaner.py plat.ply                 → plat.clean.ply
#   python ply_cleaner.py plat.ply -o sortie.ply   → nom choisi
#   python ply_cleaner.py dossier/ --in-place      → tous les .ply,
#                                                    remplacés sur place
#                                                    (backup .bak)
#
# Format supporté : PLY binary_little_endian, propriétés float
# (export standard splatfacto). Les autres formats sont refusés
# proprement avec un message clair.
# ============================================================

import argparse
import logging
import shutil
import sys
from pathlib import Path

import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ply_cleaner")

HEADER_END = b"end_header\n"


def clean_ply(src: Path, dst: Path) -> dict:
    """Lit un PLY splatfacto, retire les gaussiennes non finies, écrit dst.

    Retourne un dict de stats {total, dropped, kept}.
    Lève ValueError si le format n'est pas géré.
    """
    data = src.read_bytes()

    end = data.find(HEADER_END)
    if end < 0:
        raise ValueError("en-tête PLY invalide (end_header introuvable)")
    header_bytes = data[: end + len(HEADER_END)]
    header = header_bytes.decode("ascii", errors="strict")

    if "format binary_little_endian 1.0" not in header:
        raise ValueError("format non géré (attendu : binary_little_endian 1.0)")

    n_vertex = None
    props = []
    for line in header.splitlines():
        parts = line.split()
        if line.startswith("element vertex"):
            n_vertex = int(parts[-1])
        elif line.startswith("element") and "vertex" not in line:
            raise ValueError(f"élément non géré : {line!r}")
        elif line.startswith("property"):
            if parts[1] != "float":
                raise ValueError(f"propriété non float non gérée : {line!r}")
            props.append(parts[-1])

    if not n_vertex or not props:
        raise ValueError("en-tête PLY incomplet (element vertex / property)")

    n_props = len(props)
    expected = n_vertex * n_props * 4
    body = data[len(header_bytes):]
    if len(body) < expected:
        raise ValueError(
            f"corps tronqué : {len(body)} octets, {expected} attendus "
            f"({n_vertex} sommets × {n_props} floats)"
        )

    arr = np.frombuffer(body, dtype="<f4", count=n_vertex * n_props)
    arr = arr.reshape(n_vertex, n_props)

    finite = np.isfinite(arr).all(axis=1)
    kept = int(finite.sum())
    dropped = n_vertex - kept

    if dropped == 0:
        # Rien à nettoyer : copie conforme (garde le pipeline idempotent)
        dst.write_bytes(data)
        return {"total": n_vertex, "dropped": 0, "kept": kept}

    clean = np.ascontiguousarray(arr[finite])
    new_header = header.replace(
        f"element vertex {n_vertex}", f"element vertex {kept}", 1
    ).encode("ascii")

    tmp = dst.with_suffix(dst.suffix + ".tmp")
    try:
        with open(tmp, "wb") as f:
            f.write(new_header)
            f.write(clean.tobytes())
        tmp.replace(dst)  # écriture atomique : jamais de fichier à moitié écrit
    finally:
        tmp.unlink(missing_ok=True)

    return {"total": n_vertex, "dropped": dropped, "kept": kept}


def process(path: Path, out: Path | None, in_place: bool) -> bool:
    """Nettoie un fichier. Retourne True si OK."""
    try:
        if in_place:
            backup = path.with_suffix(path.suffix + ".bak")
            shutil.copy2(path, backup)
            stats = clean_ply(backup, path)
        else:
            dst = out if out else path.with_suffix(".clean.ply")
            stats = clean_ply(path, dst)

        target = path if in_place else (out if out else path.with_suffix(".clean.ply"))
        if stats["dropped"]:
            log.warning(
                "%s : %d gaussiennes NaN/Inf supprimées sur %d (%.1f%%) → %s",
                path.name, stats["dropped"], stats["total"],
                100 * stats["dropped"] / stats["total"], target.name,
            )
        else:
            log.info("%s : sain (%d gaussiennes), copie → %s",
                     path.name, stats["total"], target.name)
        return True
    except (ValueError, OSError) as exc:
        log.error("%s : ÉCHEC — %s", path.name, exc)
        return False


def main() -> int:
    p = argparse.ArgumentParser(
        description="Supprime les gaussiennes NaN/Inf des PLY splatfacto avant upload R2."
    )
    p.add_argument("input", type=Path, help="fichier .ply ou dossier")
    p.add_argument("-o", "--output", type=Path, default=None,
                   help="fichier de sortie (mode fichier unique)")
    p.add_argument("--in-place", action="store_true",
                   help="remplace les fichiers sur place (backup .bak)")
    args = p.parse_args()

    if not args.input.exists():
        log.error("introuvable : %s", args.input)
        return 1

    if args.input.is_dir():
        files = sorted(args.input.glob("*.ply"))
        if not files:
            log.error("aucun .ply dans %s", args.input)
            return 1
        if args.output:
            log.error("-o incompatible avec un dossier ; utiliser --in-place ou traiter fichier par fichier")
            return 1
        ok = all([process(f, None, args.in_place) for f in files])
        return 0 if ok else 1

    return 0 if process(args.input, args.output, args.in_place) else 1


if __name__ == "__main__":
    sys.exit(main())
