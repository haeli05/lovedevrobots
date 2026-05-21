"""Interactive CLI for tagging a part with mount points.

Creates or updates a part JSON file in catalogue/parts/<SKU>.json.

Usage:
    uv run python scripts/tag_part.py              # create new part
    uv run python scripts/tag_part.py --sku FOO    # edit existing part

Mount-point coordinates come from the part's local frame (Z-up, X-forward, mm).
For a servo: origin at base face center, Z points up toward the horn.

GUI picker (click on STL to place mounts) is planned for v1.
"""

import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent
PARTS_DIR = ROOT / "catalogue" / "parts"
CONNECTORS_FILE = ROOT / "catalogue" / "connectors.yaml"

CATEGORIES = [
    "servo", "bracket", "frame", "controller",
    "gripper", "sensor", "wheel", "motor", "battery", "misc",
]


def load_connectors() -> list[str]:
    with open(CONNECTORS_FILE) as f:
        data = yaml.safe_load(f)
    return list(data.get("connectors", {}).keys())


def prompt(label: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    value = input(f"  {label}{suffix}: ").strip()
    return value if value else default


def prompt_float(label: str, default: float | None = None) -> float:
    suffix = f" [{default}]" if default is not None else ""
    while True:
        raw = input(f"  {label}{suffix}: ").strip()
        if not raw and default is not None:
            return default
        try:
            return float(raw)
        except ValueError:
            print("  Enter a number.")


def prompt_vec3(label: str) -> tuple[float, float, float]:
    print(f"  {label} (x y z in mm, space-separated):")
    while True:
        raw = input("    > ").strip()
        parts = raw.split()
        if len(parts) == 3:
            try:
                return (float(parts[0]), float(parts[1]), float(parts[2]))
            except ValueError:
                pass
        print("  Enter 3 numbers separated by spaces.")


def prompt_choice(label: str, choices: list[str]) -> str:
    print(f"\n  {label}:")
    for i, c in enumerate(choices, 1):
        print(f"    {i:2d}. {c}")
    while True:
        raw = input("  Choice (number or name): ").strip()
        if raw.isdigit():
            idx = int(raw) - 1
            if 0 <= idx < len(choices):
                return choices[idx]
        if raw in choices:
            return raw
        print("  Invalid choice.")


def prompt_bool(label: str, default: bool = False) -> bool:
    suffix = "[Y/n]" if default else "[y/N]"
    raw = input(f"  {label} {suffix}: ").strip().lower()
    if not raw:
        return default
    return raw.startswith("y")


def collect_mount_point(connectors: list[str]) -> dict:
    print("\n  -- Mount point --")
    mp_id = prompt("id (e.g. 'base', 'horn', 'output_left')")
    if not mp_id:
        return {}

    position = prompt_vec3("position")
    connector = prompt_choice("connector type", connectors)
    is_joint = prompt_bool("is_joint (actuated axis)?")

    joint_axis = None
    joint_limits_deg = None
    if is_joint:
        joint_axis = prompt_vec3("joint_axis (unit vector, local frame)")
        lo = prompt_float("joint_limits_deg min", -180.0)
        hi = prompt_float("joint_limits_deg max", 180.0)
        joint_limits_deg = [lo, hi]

    return {
        "id": mp_id,
        "position": list(position),
        "orientation": [0.0, 0.0, 0.0, 1.0],
        "connector": connector,
        "is_joint": is_joint,
        **({"joint_axis": list(joint_axis)} if joint_axis else {}),
        **({"joint_limits_deg": joint_limits_deg} if joint_limits_deg else {}),
    }


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Tag a part with mount points")
    parser.add_argument("--sku", help="SKU of an existing part to edit")
    args = parser.parse_args()

    connectors = load_connectors()
    print(f"Loaded {len(connectors)} connector types.\n")

    existing: dict = {}
    if args.sku:
        path = PARTS_DIR / f"{args.sku}.json"
        if path.exists():
            with open(path) as f:
                existing = json.load(f)
            print(f"Editing existing part: {args.sku}")
        else:
            print(f"No existing part found for SKU '{args.sku}'. Creating new.")

    print("=== Part metadata ===")
    sku = prompt("SKU (e.g. FEETECH_STS3215)", existing.get("sku", "")).upper()
    if not sku:
        print("SKU required.")
        sys.exit(1)

    name = prompt("name", existing.get("name", ""))
    description = prompt("description", existing.get("description", ""))
    category = prompt_choice("category", CATEGORIES) if "category" not in existing else existing["category"]
    if existing.get("category"):
        override = prompt_bool(f"Category is '{existing['category']}' — change?", False)
        if override:
            category = prompt_choice("category", CATEGORIES)

    print("\n=== Specs ===")
    weight_g = prompt_float("weight_g", existing.get("specs", {}).get("weight_g"))
    price_usd = prompt_float("price_usd", existing.get("price_usd", 0.0))
    lead_time_days = int(prompt_float("lead_time_days", existing.get("lead_time_days", 14)))
    supplier = prompt("supplier", existing.get("supplier", "TBD"))
    mesh_url = prompt("mesh_url (STL path in frontend/public/)", existing.get("mesh_url", f"stl/{sku.lower()}.stl"))
    tags_raw = prompt("tags (comma-separated)", ", ".join(existing.get("tags", [])))
    tags = [t.strip() for t in tags_raw.split(",") if t.strip()]

    # Extra specs
    extra_specs: dict = {k: v for k, v in existing.get("specs", {}).items() if k != "weight_g"}
    print("\n  Extra specs (e.g. torque_nm=2.94 voltage_v=7.4). Enter blank to finish.")
    while True:
        raw = input("  key=value (or blank): ").strip()
        if not raw:
            break
        if "=" in raw:
            k, _, v = raw.partition("=")
            try:
                extra_specs[k.strip()] = float(v.strip())
            except ValueError:
                extra_specs[k.strip()] = v.strip()

    print("\n=== Mount points ===")
    existing_mounts = existing.get("mount_points", [])
    if existing_mounts:
        print(f"  Existing mounts: {[m['id'] for m in existing_mounts]}")
        keep = prompt_bool("Keep existing mount points?", True)
        mount_points = existing_mounts if keep else []
    else:
        mount_points = []

    print("  Add mount points (enter blank id to stop):")
    while True:
        mp = collect_mount_point(connectors)
        if not mp:
            break
        mount_points.append(mp)
        if not prompt_bool("Add another mount point?", False):
            break

    part = {
        "sku": sku,
        "name": name,
        "description": description,
        "category": category,
        "specs": {"weight_g": weight_g, **extra_specs},
        "mount_points": mount_points,
        "mesh_url": mesh_url,
        "cad_url": existing.get("cad_url"),
        "price_usd": price_usd,
        "lead_time_days": lead_time_days,
        "supplier": supplier,
        "tags": tags,
    }

    out_path = PARTS_DIR / f"{sku}.json"
    print(f"\nSaving to {out_path} ...")
    with open(out_path, "w") as f:
        json.dump(part, f, indent=2)
    print("Done.")
    print(f"\nNext: run `uv run python scripts/validate_catalogue.py` to verify.")


if __name__ == "__main__":
    main()
