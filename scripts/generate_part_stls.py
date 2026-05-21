"""
Generate parametric STL files for catalogue parts using build123d.
Outputs to frontend/public/stl/

Run from repo root:  python3 scripts/generate_part_stls.py
"""

from pathlib import Path
from build123d import *

OUT = Path(__file__).parent.parent / "frontend" / "public" / "stl"
OUT.mkdir(parents=True, exist_ok=True)


def save(part, name: str) -> None:
    path = OUT / f"{name}.stl"
    export_stl(part, str(path))
    size_kb = path.stat().st_size // 1024
    print(f"  ✓  {name}.stl  ({size_kb} KB)")


# ── Servo STS3215 / ST3020 class (40×20×40 mm) ───────────────────────────────
def make_servo_large():
    W, D, H = 40, 20, 40
    with BuildPart() as p:
        Box(W, D, H)
        # Side mounting tabs
        with Locations((-W / 2 - 5, 0, -H / 2 + 12)):
            Box(10, D, 24)
        with Locations((W / 2 + 5, 0, -H / 2 + 12)):
            Box(10, D, 24)
        # Output horn disc
        with Locations((0, 0, H / 2 + 2.5)):
            Cylinder(6, 5)
        # Horn centre nub
        with Locations((0, 0, H / 2 + 6)):
            Cylinder(2.5, 3)
        # Cable groove on bottom
        with Locations((0, D / 2 - 0.1, -H / 2 + 3)):
            Box(14, 3, 6, mode=Mode.SUBTRACT)
        # M3 bolt holes on base (20×20 pattern)
        with Locations((0, 0, -H / 2)):
            for x, y in [(-10, -7), (-10, 7), (10, -7), (10, 7)]:
                with Locations((x, y, 0)):
                    Hole(1.6, depth=6)
    return p.part


# ── Mini servo SCS0009 (23×12×24 mm) ─────────────────────────────────────────
def make_servo_mini():
    W, D, H = 23, 12, 24
    with BuildPart() as p:
        Box(W, D, H)
        with Locations((0, 0, H / 2 + 1.5)):
            Cylinder(4, 3)
        with Locations((0, 0, H / 2 + 3.5)):
            Cylinder(1.5, 2)
        with Locations((0, 0, -H / 2)):
            for x, y in [(-5, -3), (-5, 3), (5, -3), (5, 3)]:
                with Locations((x, y, 0)):
                    Hole(1.3, depth=4)
    return p.part


# ── Small U-bracket (40×25×40 mm, 3 mm walls) ────────────────────────────────
def make_bracket_u_small():
    W, D, H, T = 40, 25, 40, 3
    with BuildPart() as p:
        # Base
        with Locations((0, 0, -H / 2 + T / 2)):
            Box(W, D, T)
        # Left arm
        with Locations((-W / 2 + T / 2, 0, 0)):
            Box(T, D, H)
        # Right arm
        with Locations((W / 2 - T / 2, 0, 0)):
            Box(T, D, H)
        # Horn-side M3 holes (top)
        with Locations((0, 0, H / 2)):
            for x, y in [(-10, -6), (-10, 6), (10, -6), (10, 6)]:
                with Locations((x, y, 0)):
                    Hole(1.6, depth=T + 2)
        # Base-side M3 holes
        with Locations((0, 0, -H / 2)):
            for x, y in [(-10, -6), (-10, 6), (10, -6), (10, 6)]:
                with Locations((x, y, 0)):
                    Hole(1.6, depth=T + 2)
    return p.part


# ── Large U-bracket (60×35×55 mm, 4 mm walls) ────────────────────────────────
def make_bracket_u_large():
    W, D, H, T = 60, 35, 55, 4
    with BuildPart() as p:
        with Locations((0, 0, -H / 2 + T / 2)):
            Box(W, D, T)
        with Locations((-W / 2 + T / 2, 0, 0)):
            Box(T, D, H)
        with Locations((W / 2 - T / 2, 0, 0)):
            Box(T, D, H)
        with Locations((0, 0, H / 2)):
            for x, y in [(-15, -8), (-15, 8), (15, -8), (15, 8)]:
                with Locations((x, y, 0)):
                    Hole(1.6, depth=T + 3)
    return p.part


# ── L-bracket (40×20×40 mm, 3 mm walls) ──────────────────────────────────────
def make_bracket_l():
    W, D, H, T = 40, 20, 40, 3
    with BuildPart() as p:
        # Vertical face
        with Locations((-W / 2 + T / 2, 0, 0)):
            Box(T, D, H)
        # Horizontal base
        with Locations((0, 0, -H / 2 + T / 2)):
            Box(W, D, T)
        # M3 holes on vertical face
        with Locations((-W / 2, 0, 0)):
            for z, y in [(-10, -5), (-10, 5), (10, -5), (10, 5)]:
                with Locations((0, y, z)):
                    Hole(1.6, depth=T + 2)
        # M3 holes on base
        with Locations((0, 0, -H / 2)):
            for x, y in [(-10, -5), (-10, 5), (10, -5), (10, 5)]:
                with Locations((x, y, 0)):
                    Hole(1.6, depth=T + 2)
    return p.part


# ── 2020 Extrusion 200 mm ─────────────────────────────────────────────────────
def make_extrusion_200():
    with BuildPart() as p:
        Box(20, 20, 200)
        # T-slot channels on 4 faces (simplified as rectangular grooves)
        for axis, offset in [
            ((1, 0, 0), (10.5, 0, 0)),
            ((-1, 0, 0), (-10.5, 0, 0)),
            ((0, 1, 0), (0, 10.5, 0)),
            ((0, -1, 0), (0, -10.5, 0)),
        ]:
            with Locations(offset):
                Box(3.5, 3.5, 200, mode=Mode.SUBTRACT)
        # Centre bore
        Cylinder(2.5, 200, mode=Mode.SUBTRACT)
        # Corner chamfers along Z
        chamfer(
            p.part.edges().filter_by(Axis.Z),
            length=1,
        )
    return p.part


# ── Base plate 100×100 mm ─────────────────────────────────────────────────────
def make_base_plate():
    W, D, H = 100, 100, 3
    with BuildPart() as p:
        Box(W, D, H)
        # M3 holes on 30 mm grid
        for x in [-30, 0, 30]:
            for y in [-30, 0, 30]:
                with Locations((x, y, H / 2)):
                    Hole(1.6, depth=H)
        chamfer(p.part.edges().filter_by(Axis.Z), length=1)
    return p.part


# ── ESP32 S3 DevKit PCB (65×30×2 mm) ─────────────────────────────────────────
def make_esp32():
    W, D, H = 65, 30, 2
    with BuildPart() as p:
        Box(W, D, H)
        # M2 mounting holes
        for x, y in [(-28.95, -11.5), (-28.95, 11.5), (28.95, -11.5), (28.95, 11.5)]:
            with Locations((x, y, H / 2)):
                Hole(1.0, depth=H)
        # USB-C port pocket
        with Locations((W / 2 - 1, 0, H / 2)):
            Box(9, 7, H + 1, mode=Mode.SUBTRACT)
    return p.part


# ── LiPo 2S 1200 mAh (68×35×14 mm) ──────────────────────────────────────────
def make_lipo():
    W, D, H = 68, 35, 14
    with BuildPart() as p:
        Box(W, D, H)
        chamfer(p.part.edges().filter_by(Axis.Z), length=1.5)
        # XT30 connector pocket on one end
        with Locations((0, D / 2, 0)):
            Box(12, 8, 8, mode=Mode.SUBTRACT)
    return p.part


# ── Parallel gripper (50×40×60 mm) ───────────────────────────────────────────
def make_gripper():
    W, D, H = 50, 40, 60
    with BuildPart() as p:
        # Body
        with Locations((0, 0, -H / 4)):
            Box(W, D, H * 0.55)
        # Left finger
        with Locations((-W / 4, 0, H * 0.22)):
            Box(8, 12, H * 0.44)
        # Right finger
        with Locations((W / 4, 0, H * 0.22)):
            Box(8, 12, H * 0.44)
        # Wrist mount holes
        with Locations((0, 0, -H / 2)):
            for x, y in [(-10, -10), (-10, 10), (10, -10), (10, 10)]:
                with Locations((x, y, 0)):
                    Hole(1.6, depth=5)
    return p.part


if __name__ == "__main__":
    print(f"Generating STL files → {OUT}\n")

    tasks = [
        ("feetech_sts3215",       make_servo_large),
        ("waveshare_st3020",      make_servo_large),   # same form factor
        ("feetech_scs0009",       make_servo_mini),
        ("bracket_u_small",       make_bracket_u_small),
        ("bracket_u_large",       make_bracket_u_large),
        ("bracket_l_medium",      make_bracket_l),
        ("extrusion_2020_200",    make_extrusion_200),
        ("base_plate_100",        make_base_plate),
        ("esp32_s3_dev",          make_esp32),
        ("lipo_2s_1200",          make_lipo),
        ("gripper_parallel_mini", make_gripper),
    ]

    ok, fail = 0, 0
    for filename, fn in tasks:
        try:
            save(fn(), filename)
            ok += 1
        except Exception as e:
            print(f"  ✗  {filename}: {e}")
            fail += 1

    print(f"\n{ok} generated, {fail} failed.  Output: {OUT}")
