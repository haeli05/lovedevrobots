#!/usr/bin/env python3
"""
import_gobilda.py — Bulk import goBILDA parts into the catalogue.

Crawl flow:
  top-level category (e.g. /channel/)
    → series pages (e.g. /1120-series-u-channel/)
      → individual product pages (e.g. /1120-series-u-channel-2-hole-72mm-length/)
        → JSON-LD (name, sku, price)
        → STEP zip → build123d → STL
        → catalogue/parts/<SKU>.json

Usage:
    uv run python scripts/import_gobilda.py
    uv run python scripts/import_gobilda.py --category channel
    uv run python scripts/import_gobilda.py --url https://www.gobilda.com/1120-series-u-channel-2-hole-72mm-length/
    uv run python scripts/import_gobilda.py --dry-run --limit 5
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
import time
import zipfile
from pathlib import Path
from typing import Any

import httpx
from bs4 import BeautifulSoup

# ── Paths ──────────────────────────────────────────────────────────────────────

REPO_ROOT   = Path(__file__).parent.parent
PARTS_DIR   = REPO_ROOT / "catalogue" / "parts"
STL_DIR     = REPO_ROOT / "frontend" / "public" / "stl"
PARTS_DIR.mkdir(parents=True, exist_ok=True)
STL_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = "https://www.gobilda.com"

# Top-level category slugs to crawl → our catalogue category
TOP_CATEGORIES: dict[str, str] = {
    "channel":          "frame",
    "beams":            "frame",
    "gorail":           "frame",
    "shafting-tubing-1": "misc",
    "mounts":           "bracket",
    "clamping-mounts":  "bracket",
    "grid-plates":      "bracket",
    "pattern-plates":   "bracket",
    "brackets":         "bracket",
    "baseplates":       "bracket",
    "pattern-adaptors": "bracket",
    "pattern-spacers":  "bracket",
    "standoffs-spacers":"bracket",
    "threaded-plates-1":"bracket",
    "hinges-1":         "bracket",
    "servos":           "servo",
    "linear-servos-1":  "servo",
    "motors":           "motor",
    "wheels-tires":     "wheel",
    "bearings-1":       "misc",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                  " (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}


# ── HTTP ───────────────────────────────────────────────────────────────────────

def get(url: str, *, binary: bool = False, retries: int = 3) -> bytes | str:
    for attempt in range(retries):
        try:
            with httpx.Client(headers=HEADERS, follow_redirects=True, timeout=30) as c:
                resp = c.get(url)
                resp.raise_for_status()
                return resp.content if binary else resp.text
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                raise
            if attempt == retries - 1:
                raise
        except Exception:
            if attempt == retries - 1:
                raise
        time.sleep(2 ** attempt)
    raise RuntimeError("unreachable")


def soup(url: str) -> BeautifulSoup:
    return BeautifulSoup(get(url), "html.parser")  # type: ignore[arg-type]


# ── Crawl helpers ──────────────────────────────────────────────────────────────

def _gobilda_links(page_soup: BeautifulSoup) -> list[str]:
    """All full gobilda.com href links on this page."""
    links = []
    for a in page_soup.find_all("a", href=True):
        href: str = a["href"]
        if href.startswith("/"):
            href = BASE_URL + href
        if "gobilda.com" in href:
            links.append(href.rstrip("/"))
    return links


def get_series_urls(category_slug: str) -> list[str]:
    """Return series-level page URLs from a top-level category page."""
    try:
        s = soup(f"{BASE_URL}/{category_slug}/")
    except Exception as e:
        print(f"  ✗ category {category_slug}: {e}")
        return []

    series = set()
    for href in _gobilda_links(s):
        slug = href.rstrip("/").split("/")[-1]
        # Series pages have slugs like "1120-series-u-channel" (starts with a series number)
        if re.match(r"^\d{4}-series", slug) or re.match(r"^\d{4}-", slug):
            series.add(href)
    return sorted(series)


def get_product_urls(series_url: str) -> list[str]:
    """Return individual product page URLs from a series listing page."""
    try:
        s = soup(series_url)
    except Exception as e:
        print(f"    ✗ series {series_url.split('/')[-1]}: {e}")
        return []

    products = set()
    for href in _gobilda_links(s):
        slug = href.rstrip("/").split("/")[-1]
        # Individual products have longer slugs with dimensions or hole counts
        if (
            len(slug) > 25
            and re.search(r"\d", slug)
            and any(x in slug for x in ["-hole-", "-mm-", "-length", "-width", "-bore", "-pack"])
        ):
            products.add(href)
    return sorted(products)


# ── Product page parsing ───────────────────────────────────────────────────────

def parse_product_page(url: str, our_category: str) -> dict[str, Any] | None:
    try:
        s = soup(url)
    except Exception as e:
        print(f"    ✗ fetch failed: {e}")
        return None

    # JSON-LD gives us name, goBILDA SKU, price cleanly
    sku_gobilda: str | None = None
    name = ""
    price_usd = 0.0
    for script in s.find_all("script", type="application/ld+json"):
        try:
            d = json.loads(script.string or "")
            if d.get("@type") == "Product":
                name = d.get("name", "")
                sku_gobilda = d.get("sku")
                offers = d.get("offers", {})
                if isinstance(offers, list):
                    offers = offers[0]
                price_usd = float(offers.get("price", 0))
                break
        except Exception:
            pass

    if not sku_gobilda:
        print("    ✗ no JSON-LD Product found")
        return None

    # Specs table: weight, material
    weight_g = 0.0
    material = "6061 aluminum"
    page_text = s.get_text(" ")

    m = re.search(r"Weight\s*[\n:]*\s*([\d.]+)\s*g\b", page_text, re.I)
    if m:
        weight_g = float(m.group(1))

    m = re.search(r"Material\s*[\n:]*\s*([A-Za-z0-9 ]+)\n", page_text)
    if m:
        material = m.group(1).strip()

    # Dimensions from the product name
    dims_mm = _dims_from_name(name, our_category)
    if weight_g == 0.0:
        # Estimate from volume × density × fill factor
        vol_cm3 = (dims_mm[0] * dims_mm[1] * dims_mm[2]) / 1_000_000
        fill = 0.25 if our_category == "frame" else 0.7
        weight_g = round(vol_cm3 * 2700 * fill, 1)

    # STEP download URL
    step_url = f"{BASE_URL}/content/step_files/{sku_gobilda}.zip"

    # Our SKU: GOBILDA_ + part number with _ instead of -
    our_sku = "GOBILDA_" + sku_gobilda.replace("-", "_")
    stl_fname = f"{our_sku.lower()}.stl"

    description = f"{name}. {material}. goBILDA part {sku_gobilda}."

    tags = ["gobilda", our_category]
    if "ftc" in url.lower() or "ftc" in page_text.lower():
        tags.append("ftc")

    return {
        "sku": our_sku,
        "name": name,
        "category": our_category,
        "description": description,
        "tags": tags,
        "supplier": "goBILDA",
        "price_usd": price_usd,
        "lead_time_days": 5,
        "mesh_url": f"stl/{stl_fname}",
        "cad_url": step_url,
        "_step_url": step_url,
        "_stl_fname": stl_fname,
        "specs": {
            "weight_g": weight_g,
            "material": material,
            "dims_mm": dims_mm,
        },
        "mount_points": _mount_points(our_category, dims_mm),
    }


def _dims_from_name(name: str, category: str) -> list[float]:
    """Infer [L, W, H] mm from product name string."""
    # "72mm Length" or "72mm" → L
    lengths = re.findall(r"(\d+(?:\.\d+)?)\s*mm", name, re.I)
    nums = [float(x) for x in lengths]

    if category == "frame":
        # U-channel: length varies, cross-section 24x24mm
        l = max(nums) if nums else 72.0
        return [l, 24.0, 24.0]
    elif category in ("bracket", "misc"):
        if len(nums) >= 3:
            return sorted(nums, reverse=True)[:3]
        if len(nums) == 1:
            v = nums[0]
            return [v, v, 10.0]
        return [48.0, 24.0, 10.0]
    elif category == "servo":
        # Typical goBILDA servo 2000 / 5202 size
        return [46.0, 24.0, 36.0]
    elif category == "wheel":
        d = max(nums) if nums else 96.0
        return [d, d, 25.0]
    elif category == "motor":
        return [57.0, 57.0, 93.0]  # NEMA23-ish
    else:
        v = nums[0] if nums else 40.0
        return [v, 20.0, 20.0]


def _mount_points(category: str, dims: list[float]) -> list[dict]:
    l, w, h = dims[0], dims[1], dims[2]
    if category == "frame":
        return [
            {"id": "face_a", "position": [0.0, w / 2, h / 2],
             "orientation": [0.0, 0.0, 1.0, 0.0],
             "connector": "gobilda_m4_8mm", "is_joint": False},
            {"id": "face_b", "position": [l, w / 2, h / 2],
             "orientation": [0.0, 0.0, 0.0, 1.0],
             "connector": "gobilda_m4_8mm", "is_joint": False},
        ]
    elif category in ("bracket", "misc"):
        return [
            {"id": "mount_a", "position": [0.0, 0.0, 0.0],
             "orientation": [0.0, 0.0, 0.0, 1.0],
             "connector": "gobilda_m4_8mm", "is_joint": False},
            {"id": "mount_b", "position": [l, w, 0.0],
             "orientation": [0.0, 0.0, 0.0, 1.0],
             "connector": "gobilda_m4_8mm", "is_joint": False},
        ]
    elif category == "servo":
        return [
            {"id": "base", "position": [0.0, 0.0, 0.0],
             "orientation": [0.0, 0.0, 0.0, 1.0],
             "connector": "gobilda_servo_mount", "is_joint": False},
            {"id": "horn", "position": [l / 2, w / 2, h],
             "orientation": [0.0, 0.0, 0.0, 1.0],
             "connector": "gobilda_spline_25T",
             "is_joint": True, "joint_axis": [0.0, 0.0, 1.0],
             "joint_limits_deg": [-180.0, 180.0]},
        ]
    elif category == "wheel":
        return [
            {"id": "hub", "position": [0.0, 0.0, 0.0],
             "orientation": [0.0, 0.0, 0.0, 1.0],
             "connector": "gobilda_hub_8mm",
             "is_joint": True, "joint_axis": [0.0, 0.0, 1.0],
             "joint_limits_deg": [-360.0, 360.0]},
        ]
    else:
        return [
            {"id": "mount", "position": [0.0, 0.0, 0.0],
             "orientation": [0.0, 0.0, 0.0, 1.0],
             "connector": "gobilda_m4_8mm", "is_joint": False},
        ]


# ── STEP → STL ─────────────────────────────────────────────────────────────────

def download_and_convert(step_url: str, out_stl: Path) -> bool:
    """Download STEP zip, convert to binary STL via build123d/OCC. Returns success."""
    # Download
    try:
        data = get(step_url, binary=True)
    except Exception as e:
        print(f"      ✗ download failed: {e}")
        return False

    # Unzip
    step_bytes: bytes | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as f:
            f.write(data)  # type: ignore[arg-type]
            zip_path = Path(f.name)
        with zipfile.ZipFile(zip_path) as zf:
            names = [n for n in zf.namelist() if n.lower().endswith((".step", ".stp"))]
            if names:
                step_bytes = zf.read(names[0])
        zip_path.unlink(missing_ok=True)
    except zipfile.BadZipFile:
        # Some files are bare STEP, not zipped
        raw = data if isinstance(data, bytes) else data.encode()  # type: ignore[union-attr]
        if raw[:4] in (b"ISO-", b"STEP", b";\n; "):
            step_bytes = raw

    if not step_bytes:
        print("      ✗ no STEP inside zip")
        return False

    # Convert STEP → STL via build123d + OCC
    with tempfile.NamedTemporaryFile(suffix=".step", delete=False) as f:
        f.write(step_bytes)
        step_path = Path(f.name)

    try:
        from build123d import import_step  # type: ignore[import]
        from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh  # type: ignore[import]
        from OCC.Core.StlAPI import StlAPI_Writer  # type: ignore[import]

        shape = import_step(str(step_path))
        step_path.unlink(missing_ok=True)

        occ_shape = shape.wrapped  # type: ignore[attr-defined]
        BRepMesh_IncrementalMesh(occ_shape, 0.05).Perform()  # 0.05mm tolerance

        writer = StlAPI_Writer()
        writer.ASCIIMode(False)
        writer.Write(occ_shape, str(out_stl))
        return out_stl.exists() and out_stl.stat().st_size > 100

    except Exception as e:
        step_path.unlink(missing_ok=True)
        print(f"      ✗ build123d conversion failed: {e}")
        # Fallback: trimesh + cascadio for STEP loading
        try:
            import trimesh  # type: ignore[import]
            with tempfile.NamedTemporaryFile(suffix=".step", delete=False) as f2:
                f2.write(step_bytes)
                sp2 = Path(f2.name)
            loaded = trimesh.load(str(sp2))
            sp2.unlink(missing_ok=True)
            # Scene → single merged Trimesh
            if isinstance(loaded, trimesh.Scene):
                meshes = [g for g in loaded.geometry.values()
                          if isinstance(g, trimesh.Trimesh)]
                merged = trimesh.util.concatenate(meshes) if meshes else None
            else:
                merged = loaded
            if merged is None or not len(getattr(merged, "faces", [])):
                print("      ✗ empty mesh after conversion")
                return False
            # Decimate to ≤5000 faces for file-size sanity
            target_faces = min(5000, max(500, len(merged.faces) // 4))
            if len(merged.faces) > target_faces:
                merged = merged.simplify_quadric_decimation(face_count=target_faces)
            merged.export(str(out_stl))
            return out_stl.exists() and out_stl.stat().st_size > 100
        except Exception as e2:
            print(f"      ✗ trimesh fallback also failed: {e2}")
            return False


# ── Processing ─────────────────────────────────────────────────────────────────

def process_product_url(url: str, our_category: str, dry_run: bool) -> bool:
    slug = url.rstrip("/").split("/")[-1]
    print(f"    · {slug[:60]}")

    part = parse_product_page(url, our_category)
    if not part:
        return False

    sku = part["sku"]
    out_json = PARTS_DIR / f"{sku}.json"
    out_stl  = STL_DIR  / part.pop("_stl_fname")
    step_url = part.pop("_step_url")

    already_json = out_json.exists()
    already_stl  = out_stl.exists()

    if already_json and already_stl:
        print(f"      ✓ exists — skip")
        return True

    # STL conversion
    if not already_stl and not dry_run:
        print(f"      ↓ STEP → STL")
        ok = download_and_convert(step_url, out_stl)
        if ok:
            print(f"      ✓ {out_stl.name} ({out_stl.stat().st_size // 1024}KB)")
        else:
            part["mesh_url"] = None  # type: ignore[assignment]
    elif not already_stl and dry_run:
        print(f"      [dry-run] would download & convert {step_url.split('/')[-1]}")

    # Write JSON
    if not already_json:
        if dry_run:
            print(f"      [dry-run] {sku}.json")
            print("     ", json.dumps({k: v for k, v in part.items() if k != "mount_points"}, indent=2)[:200])
        else:
            out_json.write_text(json.dumps(part, indent=2, ensure_ascii=False))
            print(f"      ✓ {sku}.json")

    return True


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--category", help="Single top-level category slug (e.g. channel, brackets)")
    parser.add_argument("--url", help="Process a single product URL directly")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="Max products (0=unlimited)")
    args = parser.parse_args()

    total = 0

    if args.url:
        # Guess category from URL
        cat = "bracket"
        for slug, c in TOP_CATEGORIES.items():
            if slug.replace("-", "") in args.url:
                cat = c
                break
        process_product_url(args.url, cat, args.dry_run)
        return

    cats = {args.category: TOP_CATEGORIES.get(args.category, "bracket")} if args.category else TOP_CATEGORIES

    for cat_slug, our_cat in cats.items():
        print(f"\n▸ {cat_slug} → {our_cat}")

        series_urls = get_series_urls(cat_slug)
        if not series_urls:
            # The category page might directly list products
            series_urls = [f"{BASE_URL}/{cat_slug}/"]

        for series_url in series_urls:
            series_name = series_url.rstrip("/").split("/")[-1]
            product_urls = get_product_urls(series_url)

            if not product_urls:
                # Single-page series — the series page IS the product page
                if re.search(r"\d{4}-\d{4}-\d{4}", series_url):
                    product_urls = [series_url]
                else:
                    continue

            print(f"  ↳ {series_name}: {len(product_urls)} products")
            for purl in product_urls:
                if args.limit and total >= args.limit:
                    print(f"\nReached --limit {args.limit}")
                    sys.exit(0)
                if process_product_url(purl, our_cat, args.dry_run):
                    total += 1
                time.sleep(0.4)

    print(f"\n✓ Done — {total} parts processed")


if __name__ == "__main__":
    main()
