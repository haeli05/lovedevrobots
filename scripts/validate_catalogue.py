"""Validate every part in catalogue/parts/ against the schema and connector registry.

Usage:
    uv run python scripts/validate_catalogue.py
    uv run python scripts/validate_catalogue.py --parts-dir catalogue/parts_expanded
"""

import argparse
import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent


def load_connectors(connectors_file: Path) -> set[str]:
    with open(connectors_file) as f:
        data = yaml.safe_load(f)
    return set(data.get("connectors", {}).keys())


def validate_part(path: Path, known_connectors: set[str]) -> list[str]:
    errors: list[str] = []

    try:
        with open(path) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return [f"JSON parse error: {e}"]

    # Import here so the script can be run from repo root without install
    sys.path.insert(0, str(ROOT / "backend"))
    try:
        from app.models.part import Part

        Part.model_validate(data)
    except Exception as e:
        errors.append(f"Schema validation failed: {e}")
        return errors

    from app.models.part import Part

    part = Part.model_validate(data)

    # Check connector types are registered
    for mp in part.mount_points:
        if mp.connector not in known_connectors:
            errors.append(
                f"Mount '{mp.id}': connector '{mp.connector}' not in connectors.yaml"
            )

    # Check joint mounts have joint_axis
    for mp in part.mount_points:
        if mp.is_joint and mp.joint_axis is None:
            errors.append(f"Mount '{mp.id}': is_joint=True but joint_axis is missing")

    # Check mesh_url (warn, don't fail — STL files are optional)
    mesh_path = ROOT / "frontend" / "public" / part.mesh_url.lstrip("/")
    if not mesh_path.exists():
        errors.append(f"WARNING: mesh_url '{part.mesh_url}' not found at {mesh_path}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate parts catalogue")
    parser.add_argument(
        "--parts-dir",
        default="catalogue/parts",
        help="Directory containing part JSON files",
    )
    parser.add_argument(
        "--connectors",
        default="catalogue/connectors.yaml",
        help="Path to connectors.yaml",
    )
    args = parser.parse_args()

    parts_dir = ROOT / args.parts_dir
    connectors_file = ROOT / args.connectors

    if not parts_dir.exists():
        print(f"ERROR: parts directory not found: {parts_dir}", file=sys.stderr)
        return 1
    if not connectors_file.exists():
        print(f"ERROR: connectors file not found: {connectors_file}", file=sys.stderr)
        return 1

    known_connectors = load_connectors(connectors_file)
    print(f"Loaded {len(known_connectors)} connector types from {connectors_file.name}")

    part_files = sorted(parts_dir.glob("*.json"))
    if not part_files:
        print(f"ERROR: no JSON files found in {parts_dir}", file=sys.stderr)
        return 1

    total = len(part_files)
    fail_count = 0
    warn_count = 0

    for path in part_files:
        errors = validate_part(path, known_connectors)
        hard = [e for e in errors if not e.startswith("WARNING:")]
        warnings = [e for e in errors if e.startswith("WARNING:")]
        if hard:
            fail_count += 1
            print(f"FAIL  {path.name}")
            for e in hard:
                print(f"       {e}")
        elif warnings:
            warn_count += 1
            print(f"WARN  {path.name}")
            for w in warnings:
                print(f"       {w}")
        else:
            print(f"OK    {path.name}")

    print(f"\n{total} parts: {total - fail_count - warn_count} ok, {warn_count} warnings, {fail_count} errors")

    # Verify connector coverage: every connector must appear in ≥2 parts
    sys.path.insert(0, str(ROOT / "backend"))
    from app.models.part import Part
    from app.services.catalogue import CatalogueService

    catalogue = CatalogueService.load_from_disk(str(parts_dir))
    connector_usage: dict[str, list[str]] = {c: [] for c in known_connectors}
    for part in catalogue.parts.values():
        for mp in part.mount_points:
            if mp.connector in connector_usage:
                connector_usage[mp.connector].append(part.sku)

    orphan_connectors = [c for c, skus in connector_usage.items() if len(skus) < 2]
    if orphan_connectors:
        print("\nConnectors with fewer than 2 parts (useless — see CLAUDE.md):")
        for c in orphan_connectors:
            skus = connector_usage[c]
            print(f"  {c}: {skus if skus else 'no parts'}")

    return 1 if fail_count > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
