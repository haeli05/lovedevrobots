"""
Expand the parts catalogue toward 500+ parts.
Generates new Part entries and appends to frontend/src/lib/catalogue.ts
and writes individual JSON files to catalogue/parts/.

Run from repo root: python3 scripts/expand_catalogue.py
"""

import json
from pathlib import Path
from datetime import date

OUT_CATALOGUE_TS = Path(__file__).parent.parent / "frontend/src/lib/catalogue_new_parts.ts"
OUT_PARTS_DIR = Path(__file__).parent.parent / "catalogue/parts_expanded"
OUT_PARTS_DIR.mkdir(parents=True, exist_ok=True)

today = date.today().isoformat()

# ── helpers ────────────────────────────────────────────────────────────────────

def ts_mount(id, pos, connector, is_joint=False, axis=None, limits=None):
    m = {
        "id": id,
        "position": pos,
        "orientation": [0, 0, 0, 1],
        "connector": connector,
        "is_joint": is_joint,
    }
    if is_joint and axis:
        m["joint_axis"] = axis
    if is_joint and limits:
        m["joint_limits_deg"] = limits
    return m

def make_part(sku, name, category, description, tags, supplier, price_usd,
              lead_days, weight_g, dims_mm, connector, specs_extra=None,
              is_servo=False, torque_nm=0, voltage_v=6.0, protocol="pwm",
              max_rpm=60, shaft_mm=None, mesh="stl/esp32_s3_dev.stl",
              cad_url=None, extra_mounts=None, joint_axis=None, joint_limits=None):
    specs = {"weight_g": weight_g, "dims_mm": dims_mm, **({} if specs_extra is None else specs_extra)}
    if is_servo:
        specs.update({"torque_nm": torque_nm, "voltage_v": voltage_v,
                       "protocol": protocol, "max_rpm": max_rpm})
    if shaft_mm:
        specs["shaft_mm"] = shaft_mm

    mounts = [ts_mount("base", [0, 0, 0], connector, is_joint=False)]
    if is_servo:
        mounts.append(ts_mount("horn", [0, 0, dims_mm[2]], connector,
                               is_joint=True, axis=joint_axis or [0, 0, 1],
                               limits=joint_limits or [-180, 180]))
    if extra_mounts:
        mounts.extend(extra_mounts)

    return {
        "sku": sku,
        "name": name,
        "category": category,
        "description": description,
        "tags": tags,
        "supplier": supplier,
        "price_usd": price_usd,
        "lead_time_days": lead_days,
        "mesh_url": mesh,
        "cad_url": cad_url,
        "specs": specs,
        "mount_points": mounts,
    }

def write_json(part):
    path = OUT_PARTS_DIR / f"{part['sku']}.json"
    with open(path, "w") as f:
        json.dump(part, f, indent=2)

def emit(part, out_file):
    """Write one TypeScript Part entry."""
    sku = part["sku"]
    name = part["name"]
    cat = part["category"]
    desc = part["description"].replace('"', '\\"')
    tags = part["tags"]
    sup = part["supplier"]
    price = part["price_usd"]
    lead = part["lead_time_days"]
    mesh = part["mesh_url"]
    cad = part.get("cad_url")
    specs = part["specs"]
    mounts = part["mount_points"]

    tags_str = ", ".join(f'"{t}"' for t in tags)
    lines = []
    lines.append(f"  {{")
    lines.append(f'    sku: "{sku}",')
    lines.append(f'    name: "{name}",')
    lines.append(f'    category: "{cat}",')
    lines.append(f'    description: "{desc}",')
    lines.append(f"    tags: [{tags_str}],")
    lines.append(f'    supplier: "{sup}",')
    lines.append(f"    price_usd: {price},")
    lines.append(f"    lead_time_days: {lead},")
    lines.append(f'    mesh_url: "{mesh}",')
    cad_str = f'"{cad}"' if cad else 'null'
    lines.append(f"    cad_url: {cad_str},")

    specs_lines = []
    for k, v in specs.items():
        if isinstance(v, list):
            specs_lines.append(f"      {k}: [{v[0]}, {v[1]}, {v[2]}]")
        elif isinstance(v, str):
            specs_lines.append(f'      {k}: "{v}"')
        else:
            specs_lines.append(f"      {k}: {v}")

    lines.append(f"    specs: {{")
    lines.append(",\n".join(specs_lines))
    lines.append(f"    }},")

    mounts_lines = []
    for m in mounts:
        mp = (f'      id: "{m["id"]}", position: [{m["position"][0]}, {m["position"][1]}, {m["position"][2]}], '
              f'orientation: [{m["orientation"][0]}, {m["orientation"][1]}, {m["orientation"][2]}, {m["orientation"][3]}], '
              f'connector: "{m["connector"]}", is_joint: {str(m["is_joint"]).lower()}')
        if m.get("joint_axis"):
            mp += f', joint_axis: [{m["joint_axis"][0]}, {m["joint_axis"][1]}, {m["joint_axis"][2]}]'
        if m.get("joint_limits_deg"):
            mp += f', joint_limits_deg: [{m["joint_limits_deg"][0]}, {m["joint_limits_deg"][1]}]'
        mounts_lines.append(f"      {{{mp}}}")

    lines.append(f"    mount_points: [")
    lines.append(",\n".join(mounts_lines))
    lines.append(f"    ],")
    lines.append(f"  }},")
    lines.append("")

    out_file.write("\n".join(lines))

# ── part generators ───────────────────────────────────────────────────────────

parts = []

# ════════════════════════════════════════════════════════════════════════════════
# SERVOS — Shenzhen/Aliexpress sourced
# ════════════════════════════════════════════════════════════════════════════════

# Lewansoul LX-16A series (very popular in Shenzhen hobby robotics)
parts.append(make_part(
    "LX16A_12V", "Lewansoul LX-16A Serial Bus Servo (12V)",
    "servo",
    "12V serial bus servo, 16.5 kg.cm, daisy-chainable via half-duplex TTL. Dominant choice for LeRobot-compatible Shenzhen arms.",
    ["servo","serial","daisy-chain","lerobot","12v","half-duplex","lewansoul"],
    "Lewansoul / 1688", 9.50, 10,
    weight_g=65, dims_mm=[40, 20, 40], connector="m3_4hole_20x20",
    is_servo=True, torque_nm=1.62, voltage_v=12.0, protocol="serial_ttl",
    max_rpm=55, shaft_mm=25,
    joint_limits=[-180, 180]))

parts.append(make_part(
    "LX16A_5V", "Lewansoul LX-16A Serial Bus Servo (5V)",
    "servo",
    "5V variant of the LX-16A serial bus servo. Same torque and protocol, lower voltage input.",
    ["servo","serial","daisy-chain","lerobot","5v","half-duplex","lewansoul"],
    "Lewansoul / 1688", 9.50, 10,
    weight_g=65, dims_mm=[40, 20, 40], connector="m3_4hole_20x20",
    is_servo=True, torque_nm=1.62, voltage_v=5.0, protocol="serial_ttl",
    max_rpm=55, shaft_mm=25,
    joint_limits=[-180, 180]))

parts.append(make_part(
    "LX15AH", "Lewansoul LX-15H High-Torque Serial Servo",
    "servo",
    "20 kg.cm high-torque serial bus servo. Half-duplex TTL. Popular upgrade for arms that need more lifting force.",
    ["servo","serial","high-torque","daisy-chain","lerobot","arm","20kg","lwansoul"],
    "Lewansoul / 1688", 13.00, 10,
    weight_g=95, dims_mm=[45, 23, 42], connector="m3_4hole_20x20",
    is_servo=True, torque_nm=1.96, voltage_v=12.0, protocol="serial_ttl",
    max_rpm=45, shaft_mm=25,
    joint_limits=[-180, 180]))

parts.append(make_part(
    "LX824H", "Lewansoul LX-824HV Digital Servo",
    "servo",
    "20 kg.cm HV digital servo. PWM control. High voltage input (7.2–12V) for industrial-style robotics.",
    ["servo","digital","pwm","high-torque","20kg","hv","lerobot"],
    "Lewansoul / 1688", 12.50, 10,
    weight_g=90, dims_mm=[44, 22, 42], connector="m3_4hole_20x20",
    is_servo=True, torque_nm=1.96, voltage_v=12.0, protocol="pwm",
    max_rpm=50, shaft_mm=25,
    joint_limits=[-120, 120]))

# JX Servo series (PDI, popular budget digital servos)
parts.append(make_part(
    "JX_PDI_6225MG", "JX PDI-6225MG Digital Servo",
    "servo",
    "25 kg.cm digital servo. PWM. Metal gears. Good mid-range for arms.",
    ["servo","digital","pwm","metal-gear","25kg","mid-range"],
    "JX Servo / Aliexpress", 8.00, 12,
    weight_g=75, dims_mm=[40, 20, 40], connector="m3_4hole_20x20",
    is_servo=True, torque_nm=2.45, voltage_v=7.4, protocol="pwm",
    max_rpm=50, shaft_mm=25,
    joint_limits=[-120, 120]))

parts.append(make_part(
    "JX_PDI_5010", "JX PDI-5010 Digital Servo",
    "servo",
    "10 kg.cm digital servo. Compact. PWM. Good for wrist joints and compact builds.",
    ["servo","digital","pwm","compact","10kg","wrist","jx"],
    "JX Servo / Aliexpress", 6.00, 12,
    weight_g=50, dims_mm=[35, 15, 32], connector="m3_4hole_20x20",
    is_servo=True, torque_nm=0.98, voltage_v=6.0, protocol="pwm",
    max_rpm=60, shaft_mm=20,
    joint_limits=[-90, 90]))

# RDrive servos (Shenzhen RDrive series)
parts.append(make_part(
    "RDRIVE_S6701", "RDrive S6701 Digital Servo",
    "servo",
    "10 kg.cm digital servo, metal gears. PWM. Widely available on Aliexpress.",
    ["servo","digital","pwm","metal-gear","10kg","budget"],
    "RDrive / Aliexpress", 7.00, 12,
    weight_g=65, dims_mm=[40, 20, 38], connector="m3_4hole_20x20",
    is_servo=True, torque_nm=0.98, voltage_v=6.0, protocol="pwm",
    max_rpm=55, shaft_mm=25,
    joint_limits=[-90, 90]))

parts.append(make_part(
    "RDRIVE_RDS3115", "RDrive RDS3115 Digital Servo",
    "servo",
    "15 kg.cm digital servo, metal gears. PWM. Good for shoulder joints in mid-size arms.",
    ["servo","digital","pwm","metal-gear","15kg","shoulder","arm"],
    "RDrive / Aliexpress", 9.50, 12,
    weight_g=75, dims_mm=[40, 20, 40], connector="m3_4hole_20x20",
    is_servo=True, torque_nm=1.47, voltage_v=7.4, protocol="pwm",
    max_rpm=50, shaft_mm=25,
    joint_limits=[-120, 120]))

# SpringRC (popular in humanoid robots)
parts.append(make_part(
    "SPRINGRC_SM_S4303M", "SpringRC SM-S4303M Digital Servo",
    "servo",
    "3.7 kg.cm standard servo. Metal gears. PWM. Used in PhantomX and similar humanoids.",
    ["servo","digital","pwm","metal-gear","humanoid","phantomx","springrc"],
    "SpringRC / Aliexpress", 7.50, 12,
    weight_g=60, dims_mm=[41, 20, 38], connector="m3_4hole_20x20",
    is_servo=True, torque_nm=0.36, voltage_v=6.0, protocol="pwm",
    max_rpm=58, shaft_mm=25,
    joint_limits=[-90, 90]))

parts.append(make_part(
    "SPRINGRC_SM_S4315M", "SpringRC SM-S4315M High-Torque Servo",
    "servo",
    "15 kg.cm metal gear servo. PWM. Standard choice for hexapod and quadruped leg joints.",
    ["servo","digital","pwm","metal-gear","15kg","hexapod","quadruped","springrc"],
    "SpringRC / Aliexpress", 15.00, 12,
    weight_g=80, dims_mm=[41, 21, 40], connector="m3_4hole_20x20",
    is_servo=True, torque_nm=1.47, voltage_v=6.0, protocol="pwm",
    max_rpm=50, shaft_mm=25,
    joint_limits=[-120, 120]))

# Robotis Dynamixel AX/MX series
parts.append(make_part(
    "DYNAMIXEL_AX12A", "Dynamixel AX-12A Smart Servo",
    "servo",
    "1.5 N.m smart servo, TTL/RS485, daisy-chainable. First-generation Dynamixel. Still popular for educational robots.",
    ["servo","dynamixel","smart","ttl","rs485","daisy-chain","educational"],
    "Robotis", 49.00, 5,
    weight_g=45, dims_mm=[32, 50, 32], connector="m3_4hole_20x20",
    is_servo=True, torque_nm=1.5, voltage_v=12.0, protocol="serial_ttl",
    max_rpm=59, shaft_mm=25,
    joint_limits=[-300, 300]))

parts.append(make_part(
    "DYNAMIXEL_AX18A", "Dynamixel AX-18A Smart Servo",
    "servo",
    "1.8 N.m smart servo, faster than AX-12A. TTL/RS485. For high-speed robot applications.",
    ["servo","dynamixel","smart","ttl","rs485","high-speed","educational"],
    "Robotis", 59.00, 5,
    weight_g=55, dims_mm=[32, 50, 32], connector="m3_4hole_20x20",
    is_servo=True, torque_nm=1.8, voltage_v=12.0, protocol="serial_ttl",
    max_rpm=85, shaft_mm=25,
    joint_limits=[-300, 300]))

parts.append(make_part(
    "DYNAMIXEL_MX64AT", "Dynamixel MX-64AT",
    "servo",
    "5.2 N.m high-torque smart servo, 12V TTL. Half-duplex. For large arms and humanoid torsos.",
    ["servo","dynamixel","high-torque","smart","ttl","arm","humanoid","large"],
    "Robotis", 299.00, 5,
    weight_g=135, dims_mm=[40, 62, 40], connector="m3_4hole_30x30",
    is_servo=True, torque_nm=5.2, voltage_v=12.0, protocol="serial_ttl",
    max_rpm=50, shaft_mm=25,
    joint_limits=[-360, 360]))

parts.append(make_part(
    "DYNAMIXEL_XL330M288", "Dynamixel XL330-M288 (USB variant)",
    "servo",
    "0.52 N.m compact smart servo with USB and TTL interfaces. Lightweight. Same physical as XL330-T288.",
    ["servo","dynamixel","smart","usb","ttl","compact","lightweight"],
    "Robotis", 24.90, 5,
    weight_g=18, dims_mm=[20, 34, 26], connector="m3_4hole_20x20",
    is_servo=True, torque_nm=0.52, voltage_v=5.0, protocol="serial_ttl",
    max_rpm=130, shaft_mm=20,
    joint_limits=[-180, 180]))

# Pololu MA series (Shenzhen-made but sold globally)
parts.append(make_part(
    "POLOLU_MA_S3302", "Pololu MA-S3302 High-Torque Servo",
    "servo",
    "3.3 kg.cm metal gear standard servo. PWM. Pololu-branded, Shenzhen-sourced.",
    ["servo","pwm","metal-gear","standard","pololu"],
    "Pololu", 8.90, 10,
    weight_g=45, dims_mm=[41, 20, 36], connector="m3_4hole_20x20",
    is_servo=True, torque_nm=0.32, voltage_v=6.0, protocol="pwm",
    max_rpm=57, shaft_mm=25,
    joint_limits=[-90, 90]))

parts.append(make_part(
    "POLOLU_MICRO_MG91A", "Pololu Micro MG91A Gearmotor",
    "servo",
    "1.5 kg.cm micro metal gear servo. PWM. For gripper fingers, pan-tilt cameras, small mechanisms.",
    ["servo","micro","pwm","metal-gear","gripper","pan-tilt","pololu"],
    "Pololu", 7.50, 10,
    weight_g=30, dims_mm=[23, 12, 27], connector="m3_4hole_20x20",
    is_servo=True, torque_nm=0.15, voltage_v=5.0, protocol="pwm",
    max_rpm=62, shaft_mm=20,
    joint_limits=[-90, 90]))

# Hiwonder serial servos (Shenzhen manufacturer, compatible with LX-16A)
parts.append(make_part(
    "HIWONDER_LX_SERVO12V", "Hiwonder LX-Servo 12V Serial Bus",
    "servo",
    "12V serial bus servo. Protocol-compatible with Lewansoul LX-16A. 16 kg.cm. Metal gears.",
    ["servo","serial","daisy-chain","hiwonder","compatible","12v"],
    "Hiwonder / 1688", 9.00, 10,
    weight_g=65, dims_mm=[40, 20, 40], connector="m3_4hole_20x20",
    is_servo=True, torque_nm=1.57, voltage_v=12.0, protocol="serial_ttl",
    max_rpm=55, shaft_mm=25,
    joint_limits=[-180, 180]))

# ════════════════════════════════════════════════════════════════════════════════
# FRAME — Aluminum Extrusions (all standard lengths & profiles)
# ════════════════════════════════════════════════════════════════════════════════

extrusion_defs = [
    # profile, length_mm, weight_per_mm_g
    ("2020", 50,  0.323),
    ("2020", 75,  0.323),
    ("2020", 100, 0.323),
    ("2020", 150, 0.323),
    ("2020", 200, 0.323),
    ("2020", 250, 0.323),
    ("2020", 300, 0.323),
    ("2020", 400, 0.323),
    ("2020", 500, 0.323),
    ("2040", 50,  0.481),
    ("2040", 100, 0.481),
    ("2040", 150, 0.481),
    ("2040", 200, 0.481),
    ("2040", 300, 0.481),
    ("2040", 400, 0.481),
    ("2040", 500, 0.481),
    ("3030", 50,  0.550),
    ("3030", 100, 0.550),
    ("3030", 150, 0.550),
    ("3030", 200, 0.550),
    ("3030", 300, 0.550),
    ("3030", 400, 0.550),
    ("3030", 500, 0.550),
    ("4040", 100, 0.700),
    ("4040", 200, 0.700),
    ("4040", 300, 0.700),
    ("4040", 400, 0.700),
    ("4040", 500, 0.700),
]

profile_dims = {
    "2020": (20, 20),
    "2040": (20, 40),
    "3030": (30, 30),
    "4040": (40, 40),
}

for profile, length, g_per_mm in extrusion_defs:
    w, h = profile_dims[profile]
    weight = round(length * g_per_mm)
    mesh_for_profile = {
        "2020": "stl/extrusion_2020_200.stl",
        "2040": "stl/extrusion_2020_200.stl",
        "3030": "stl/extrusion_2020_200.stl",
        "4040": "stl/extrusion_2020_200.stl",
    }
    parts.append(make_part(
        f"EXTRUSION_{profile}_{length}",
        f"{profile} Aluminum Extrusion {length}mm",
        "frame",
        f"V-slot {profile} aluminum extrusion, {length}mm. M4 T-slot compatible with goBILDA and Actobotics systems.",
        ["frame","extrusion",profile.lower(),"aluminum","v-slot","structural",f"{length}mm"],
        "1688 generic", round(2.5 + length * 0.015, 2), 5,
        weight, [w, h, length],
        f"extrusion_{profile.lower()}_end",
        specs_extra={"profile": profile, "material": "6063 aluminum", "slot_mm": 6},
        mesh=mesh_for_profile[profile]))

# Base plates in various sizes
for size in [100, 150, 200, 250, 300]:
    weight = round(3 * size * size / 10000 * 2700 / 1000, 0)  # 3mm Al, density 2.7g/cm³
    parts.append(make_part(
        f"BASE_PLATE_{size}",
        f"Robot Base Plate {size}×{size}mm",
        "frame",
        f"{size}×{size}mm ×3mm aluminum plate. M3 holes on 30mm grid. Standard structural mounting plate.",
        ["frame","base","plate","aluminum","mounting",f"{size}mm"],
        "1688 generic", round(5 + size * 0.05, 2), 7,
        weight, [size, size, 3],
        "m3_4hole_30x30",
        specs_extra={"material": "6061 aluminum", "thickness_mm": 3, "hole_grid_mm": 30},
        mesh="stl/base_plate_100.stl"))

# ════════════════════════════════════════════════════════════════════════════════
# BRACKETS — goBILDA and generic structural
# ════════════════════════════════════════════════════════════════════════════════

# More goBILDA U-channels
for holes, length_mm in [(3, 120), (7, 240), (11, 392)]:
    parts.append(make_part(
        f"GOBILDA_U_CHANNEL_{holes}H",
        f"goBILDA 1120 U-Channel {holes}-Hole ({length_mm}mm)",
        "bracket",
        f"goBILDA aluminum U-channel, {length_mm}mm ({holes} holes on 8mm grid). Connects structural elements.",
        ["bracket","gobilda","u-channel","structural","aluminum","ftc",f"{holes}h"],
        "goBILDA", round(5 + holes * 1.5, 2), 5,
        round(holes * 6.5), [length_mm, 24, 24],
        "gobilda_m4_8mm",
        specs_extra={"material": "6061 aluminum", "hole_grid_mm": 8},
        mesh="stl/bracket_u_large.stl"))

# goBILDA flat brackets
for config in [("1x4", 104, 28, 3, 6), ("2x4", 104, 56, 3, 12),
               ("1x6", 152, 28, 3, 8), ("2x6", 152, 56, 3, 16),
               ("1x8", 200, 28, 3, 10), ("2x8", 200, 56, 3, 20)]:
    cfg, w_mm, d_mm, t_mm, weight = config
    parts.append(make_part(
        f"GOBILDA_FLAT_{cfg.replace('x','x')}",
        f"goBILDA 1100 Flat Bracket {cfg}",
        "bracket",
        f"goBILDA flat aluminum bracket {w_mm}×{d_mm}mm. M4 holes on 8mm grid. {cfg} configuration.",
        ["bracket","gobilda","flat","aluminum","ftc",cfg],
        "goBILDA", round(3 + t_mm, 2), 5,
        weight, [w_mm, d_mm, t_mm],
        "gobilda_m4_8mm",
        specs_extra={"material": "6061 aluminum"},
        mesh="stl/bracket_l_medium.stl"))

# goBILDA hub blocks
for holes in [3, 4, 5, 6]:
    size_mm = holes * 8
    parts.append(make_part(
        f"GOBILDA_HUB_BLOCK_{holes}x",
        f"goBILDA 1300 Hub Block {holes}× ({size_mm}mm)",
        "bracket",
        f"goBILDA aluminum hub block, {size_mm}mm cubic. M4 grid on all sides for multi-direction connections.",
        ["bracket","gobilda","hub","block","multi-direction","structural"],
        "goBILDA", round(3 + holes * 1.5, 2), 5,
        round(holes * 5 + 2), [size_mm, size_mm, size_mm],
        "gobilda_m4_8mm",
        specs_extra={"material": "6061 aluminum", "hole_grid_mm": 8},
        mesh="stl/bracket_u_small.stl"))

# goBILDA gussets and angle brackets
for config in [("ANGLE_2x2", 56, 56, 3, 9), ("ANGLE_2x4", 104, 56, 3, 14),
               ("GUSSET_TRIANGLE", 40, 40, 3, 5)]:
    sku_suffix, w_mm, d_mm, t_mm, weight = config
    parts.append(make_part(
        f"GOBILDA_{sku_suffix}",
        f"goBILDA {sku_suffix.replace('_',' ')}",
        "bracket",
        f"goBILDA aluminum bracket, {w_mm}×{d_mm}mm ×{t_mm}mm. Structural reinforcement bracket.",
        ["bracket","gobilda","aluminum","structural","angle","gusset"],
        "goBILDA", round(3 + t_mm * 0.5, 2), 5,
        weight, [w_mm, d_mm, t_mm],
        "gobilda_m4_8mm",
        specs_extra={"material": "6061 aluminum"},
        mesh="stl/bracket_l_medium.stl"))

# Generic C-brackets
for size in ["small", "medium", "large"]:
    dims = {"small": (35, 20, 35), "medium": (50, 25, 50), "large": (75, 30, 75)}[size]
    weight = {"small": 12, "medium": 18, "large": 28}[size]
    price = {"small": 3.00, "medium": 3.80, "large": 5.50}[size]
    parts.append(make_part(
        f"BRACKET_C_{size.upper()}",
        f"C-Bracket {size.title()} ({dims[0]}mm)",
        "bracket",
        f"C-shaped aluminum bracket for servo body to structural connection. {dims[0]}×{dims[1]}×{dims[2]}mm.",
        ["bracket","c-bracket","aluminum","servo","arm"],
        "1688 generic", price, 7,
        weight, dims,
        "m3_4hole_20x20",
        specs_extra={"material": "6061 aluminum"},
        mesh="stl/bracket_l_medium.stl"))

# L-brackets
for size in [(40, 40, 3, 14), (60, 60, 4, 25), (80, 80, 4, 35)]:
    w, h, t, weight = size
    parts.append(make_part(
        f"BRACKET_L_{w}x{h}",
        f"L-Bracket {w}×{h}mm",
        "bracket",
        f"Aluminum L-bracket {w}×{h}mm ×{t}mm. M3 bolt holes on both faces.",
        ["bracket","l-bracket","aluminum","structural","90deg"],
        "1688 generic", round(2.5 + w * 0.05, 2), 7,
        weight, [w, h, t],
        "m3_4hole_20x20",
        specs_extra={"material": "6061 aluminum"},
        mesh="stl/bracket_l_medium.stl"))

# ════════════════════════════════════════════════════════════════════════════════
# MOTORS — stepper, DC gearmotor, BLDC
# ════════════════════════════════════════════════════════════════════════════════

# NEMA 17 steppers — all standard lengths
for body_mm in [28, 34, 40, 45, 48, 60]:
    torque = {"28": 0.18, "34": 0.28, "40": 0.46, "45": 0.58, "48": 0.65, "60": 1.0}[str(body_mm)]
    current = {"28": 0.9, "34": 1.2, "40": 1.7, "45": 1.8, "48": 2.0, "60": 2.5}[str(body_mm)]
    price = {"28": 4.00, "34": 5.00, "40": 8.00, "45": 10.00, "48": 11.00, "60": 14.00}[str(body_mm)]
    shaft = 5 if body_mm <= 40 else 8
    parts.append(make_part(
        f"NEMA17_{body_mm}MM",
        f"NEMA 17 Stepper Motor ({body_mm}mm body)",
        "motor",
        f"Bipolar stepper, {body_mm}mm body, {torque:.2f} N.m holding torque. Standard NEMA 17 frame.",
        ["motor","stepper","nema17","bipolar","arm","linear","cnc"],
        "Generic / Aliexpress", price, 10,
        round(200 + body_mm * 5), [42, 42, body_mm],
        "m3_4hole_30x30",
        is_servo=False, shaft_mm=shaft,
        specs_extra={"voltage_v": 12.0, "torque_nm": torque, "current_a": current,
                     "step_deg": 1.8, "phase_resistance_ohm": 2.5},
        mesh="stl/feetech_sts3215.stl",
        extra_mounts=[ts_mount("shaft", [21, 21, body_mm + 5], f"shaft_d_{shaft}mm",
                               is_joint=True, axis=[0, 0, 1], limits=[-36000, 36000])]))

# NEMA 23 steppers (larger robots)
for body_mm in [47, 56, 76]:
    torque = {"47": 1.9, "56": 2.8, "76": 4.5}[str(body_mm)]
    current = {"47": 3.0, "56": 3.5, "76": 4.5}[str(body_mm)]
    shaft = 8 if body_mm <= 56 else 10
    parts.append(make_part(
        f"NEMA23_{body_mm}MM",
        f"NEMA 23 Stepper Motor ({body_mm}mm body)",
        "motor",
        f"Bipolar stepper, {body_mm}mm body, {torque} N.m. For larger CNC machines and heavy robot arms.",
        ["motor","stepper","nema23","heavy-duty","cnc","arm","linear"],
        "Generic / Aliexpress", round(18 + (body_mm - 47) * 3, 2), 10,
        round(400 + body_mm * 15), [57, 57, body_mm],
        "m3_4hole_30x30",
        is_servo=False, shaft_mm=shaft,
        specs_extra={"voltage_v": 24.0, "torque_nm": torque, "current_a": current,
                     "step_deg": 1.8, "phase_resistance_ohm": 1.1},
        mesh="stl/feetech_sts3215.stl",
        extra_mounts=[ts_mount("shaft", [28.5, 28.5, body_mm + 5], f"shaft_d_{shaft}mm",
                               is_joint=True, axis=[0, 0, 1], limits=[-36000, 36000])]))

# DC gearmotors (various sizes, D-shaft output)
dc_motors = [
    ("12GA370_100RPM", "DC Gearmotor 12GA-370 (100 RPM)", 60, [20, 20, 65], 6, 0.30, 4.50, "pwm"),
    ("12GA370_300RPM", "DC Gearmotor 12GA-370 (300 RPM)", 50, [20, 20, 65], 6, 0.18, 4.00, "pwm"),
    ("25GA370_50RPM",  "DC Gearmotor 25GA-370 (50 RPM)",  100, [37, 37, 80], 6, 0.80, 7.00, "pwm"),
    ("37GA520_50RPM",  "DC Gearmotor 37GA-520 (50 RPM)",  180, [37, 37, 100], 8, 2.20, 10.00, "pwm"),
    ("GA12_N20_3V",    "Micro DC Gearmotor N20 3V",       20, [12, 12, 26], 3, 0.01, 2.50, "pwm"),
    ("GA12_N30_6V",    "Micro DC Gearmotor N30 6V",       35, [16, 16, 36], 4, 0.04, 3.50, "pwm"),
    ("GA12_020_12V",   "DC Gearmotor 020 12V 200RPM",    80, [25, 25, 72], 6, 0.40, 5.00, "pwm"),
    ("GA37_555_100RPM","DC Gearmotor 555 12V 100RPM",   220, [37, 37, 90], 8, 1.50, 9.50, "pwm"),
]

for sku_suffix, name, weight, dims, shaft, torque, price, protocol in dc_motors:
    parts.append(make_part(
        f"MOTOR_DC_{sku_suffix}",
        name,
        "motor",
        f"DC gearmotor, {dims[0]}mm barrel, {shaft}mm D-shaft output. Standard for wheeled robots and drive trains.",
        ["motor","dc","gearmotor","d-shaft","wheeled","mobile","drive"],
        "Generic / Aliexpress", price, 12,
        weight, dims,
        "m3_generic",
        is_servo=False, shaft_mm=shaft,
        specs_extra={"voltage_v": 12.0, "max_rpm": 200, "torque_nm": torque, "protocol": protocol},
        mesh="stl/feetech_sts3215.stl",
        extra_mounts=[ts_mount("shaft", [dims[0]/2, dims[1]/2, dims[2]], f"shaft_d_{shaft}mm",
                               is_joint=True, axis=[0, 0, 1], limits=[-36000, 36000])]))

# BLDC hub motors for omnidirectional platforms
bldc_hubs = [
    ("HUB_BLDC_4INCH", "BLDC Hub Motor 4-inch", 450, [100, 100, 50], 8, 5.0, 45.00),
    ("HUB_BLDC_6INCH", "BLDC Hub Motor 6-inch", 700, [150, 150, 65], 8, 10.0, 65.00),
    ("HUB_BLDC_8INCH", "BLDC Hub Motor 8-inch", 1000, [200, 200, 80], 10, 18.0, 85.00),
]

for sku_suffix, name, weight, dims, shaft, torque, price in bldc_hubs:
    parts.append(make_part(
        f"MOTOR_{sku_suffix}",
        name,
        "motor",
        f"Brushless DC hub motor, {dims[0]}mm wheel diameter. Integrated tire. For omnidirectional robot platforms.",
        ["motor","bldc","hub","wheel","omni","mobile","holonomic","direct-drive"],
        "Generic / Aliexpress", price, 14,
        weight, dims,
        "m3_generic",
        is_servo=False, shaft_mm=shaft,
        specs_extra={"voltage_v": 24.0, "torque_nm": torque, "type": "bldc", "rated_w": 250},
        mesh="stl/bracket_u_small.stl",
        extra_mounts=[ts_mount("shaft", [dims[0]/2, dims[1]/2, dims[2]], f"shaft_d_{shaft}mm",
                               is_joint=True, axis=[0, 0, 1], limits=[-36000, 36000])]))

# ════════════════════════════════════════════════════════════════════════════════
# CONTROLLERS — SBCs and microcontrollers
# ════════════════════════════════════════════════════════════════════════════════

controllers = [
    ("ESP32_DEVKIT_V1",   "ESP32-DevKit v1 (ESP-WROOM-32)",      "controller", 40,  [54, 28, 13], "esp32","wifi","bluetooth","iot","low-cost",       "Espressif / Generic", 6.00, 7),
    ("ESP32_S3_DEVKIT",   "ESP32-S3-DevKitC-1",                 "controller", 45,  [54, 28, 13], "esp32s3","wifi","ble","vision","usb-otg",         "Espressif / Generic", 8.00, 7),
    ("ESP32_C3_MINI",      "ESP32-C3-MINI-1 (RISC-V)",            "controller", 20,  [27, 18, 3],  "esp32c3","wifi","risc-v","ble","ultra-low-power", "Espressif / Generic", 5.00, 7),
    ("ESP32_S2_MINI",      "ESP32-S2-MINI-1",                    "controller", 25,  [27, 18, 3],  "esp32s2","wifi","lcd","touch","low-power",         "Espressif / Generic", 4.50, 7),
    ("RASPBERRY_PI_ZERO2W","Raspberry Pi Zero 2 W",               "controller", 25,  [65, 30, 12], "raspberry-pi","linux","wifi","bluetooth","arm64","compute-module", "Raspberry Pi Found.", 20.00, 10),
    ("RASPBERRY_PI_ZERO_W","Raspberry Pi Zero W",                 "controller", 18,  [65, 30, 11], "raspberry-pi","linux","wifi","bluetooth","armv6","budget",        "Raspberry Pi Found.", 12.00, 10),
    ("BEAGLEBONE_BLACK",   "BeagleBone Black",                   "controller", 40,  [86, 54, 20], "beaglebone","linux","pru","gpio","analog","sbc","industrial",  "BeagleBoard.org", 65.00, 14),
    ("ODROID_C4",          "Odroid C4 (Cortex-A55 4-core)",      "controller", 40,  [92, 59, 22], "odroid","linux","sbc","4k","hdmi","amlogic",           "Hardkernel", 55.00, 14),
    ("SIFIVE_HIFIVE1",     "SiFive HiFive1 (RISC-V FE310)",      "controller", 20,  [69, 51, 12], "risc-v","sifive","open-source","32bit","mcu","esci",        "SiFive", 29.00, 14),
    ("STM32F405RGT6",      "STM32F4 Black Pill (STM32F405)",      "controller", 30,  [52, 25, 10], "stm32","cortex-m4","mcu","foc","servo-driver","embedded","Generic / Aliexpress", 5.00, 10),
    ("STM32F103C8T6",      "STM32F103C8T6 Blue Pill",            "controller", 25,  [52, 25, 10], "stm32","cortex-m3","mcu","budget","servo-driver"," Generic / Aliexpress", 3.50, 10),
    ("NUCLEO_F401RE",      "STM32 Nucleo-F401RE",                "controller", 35,  [82, 53, 12], "stm32","nucleo","cortex-m4","arduino-shields","mbed","education",   "STMicroelectronics", 15.00, 7),
    ("LATTICE_ICESTICK",    "Lattice iCE40 FPGA Breakout",        "controller", 15,  [50, 20, 8],  "fpga","ice40","open-source","verilog","logic","education",       "Lattice", 22.00, 14),
    ("NEOVARIO_K210",      "K210 RISC-V AI Module (Sipeed Maix)", "controller", 35,  [30, 35, 10], "k210","risc-v","ai","edge","vision","vision-unit","maix","Sipeed", 15.00, 10),
    ("NVIDIA_JETSON_ORIN_NANO","NVIDIA Jetson Orin Nano 4GB",    "controller", 100, [100, 79, 29], "jetson","nvidia","gpu","ai","orin","inference","ros2","edge","powerful", "NVIDIA", 199.00, 21),
    ("JETSON_NANO_8GB",    "NVIDIA Jetson Nano 8GB",             "controller", 150, [100, 79, 29], "jetson","nvidia","gpu","inference","vision","ros2","edge","8gb",  "NVIDIA", 179.00, 21),
]

for (sku, name, cat, weight, dims, *tags_and_supplier_price) in controllers:
    # tags_and_supplier_price format: [tags list], supplier, price, lead_days
    tags = tags_and_supplier_price[0]
    supplier = tags_and_supplier_price[1]
    price = tags_and_supplier_price[2]
    lead = tags_and_supplier_price[3]
    mount_conn = "controller_mount_pi" if "raspberry" in " ".join(tags) else \
                "controller_mount_esp32_devkit" if "esp32" in " ".join(tags) else \
                "controller_mount_arduino" if any(x in tags for x in ["arduino", "nucleo", "stm32"]) else \
                "m3_generic"

    parts.append(make_part(
        f"CONTROLLER_{sku}",
        name, cat,
        f"{name}. Popular for robotics and embedded applications.",
        tags + ["controller", "sbc", "mcu"],
        supplier, price, lead,
        weight, dims,
        mount_conn,
        specs_extra={"power_w": round(3 + weight * 0.1, 1)} if cat == "controller" else None,
        mesh="stl/esp32_s3_dev.stl"))

# Motor drivers
motor_drivers = [
    ("L298N_DUAL_HBRIDGE",  "L298N Dual H-Bridge",              "controller", 30,  [43, 32, 27], "l298n","h-bridge","2-channel","12v","2a","pwm", "Generic / Aliexpress", 3.50, 7),
    ("TB6612FNG_DUAL",      "TB6612FNG Dual Motor Driver",       "controller", 15,  [25, 20, 3],  "tb6612fng","h-bridge","2-channel","pwm","i2c","3.3v","5v", "Pololu / Generic", 5.00, 7),
    ("DRV8833_DUAL",        "DRV8833 Dual H-Bridge",           "controller", 12,  [25, 20, 3],  "drv8833","h-bridge","2-channel","pwm","1.5a","3.3v",          "Pololu / Generic", 3.00, 7),
    ("DRV8825_STEPPER",     "DRV8825 Stepper Driver",          "controller", 8,   [20, 15, 3],  "drv8825","stepper","driver","1/32 microstep","12-36v","2.5a",   "Generic / Aliexpress", 2.00, 7),
    ("TMC2208_UART",        "TMC2208 Stepper Driver (UART)",    "controller", 10,  [25, 15, 3],  "tmc2208","stepper","driver","stealthchop","uart","quiet","2a",     "Trinamic / Generic", 4.00, 7),
    ("TMC2209_UART",        "TMC2209 Stepper Driver (UART)",   "controller", 11,  [25, 15, 3],  "tmc2209","stepper","driver","stallguard","uart","quiet","2.5a",   "Trinamic / Generic", 5.00, 7),
    ("L9935_SINGLE",        "L9935 Single H-Bridge Driver",    "controller", 12,  [25, 20, 3],  "l9935","h-bridge","single-channel","pwm","7-28v","5a","automotive",  "STMicroelectronics", 4.50, 7),
    ("PCA9685_16CH_PWM",    "PCA9685 16-Channel PWM/Servo Driver","controller", 8, [32, 36, 4],  "pca9685","pwm","servo-driver","16-channel","i2c","5v","12-bit",      "Adafruit / Generic", 3.00, 7),
    ("POLOLU_VNH5019",      "Pololu VNH5019 Dual Motor Driver", "controller", 35,  [40, 30, 9],  "vnh5019","h-bridge","2-channel","12v","30a","current-sense",  "Pololu", 28.00, 7),
    ("POLOLU_SM83_ESC",     "Pololu Simple Motor Controller 18v15","controller", 25, [50, 30, 12], "smc","speed-controller","brushed","18v","15a","rc-signal",      "Pololu", 49.00, 7),
]

for row in motor_drivers:
    sku_suffix, name, cat, weight, dims, *rest = row
    tags, supplier, price, lead = rest
    parts.append(make_part(
        f"DRIVER_{sku_suffix}",
        name, cat,
        f"{name}. {', '.join(tags)}.",
        tags + ["motor-driver", "controller"],
        supplier, price, lead,
        weight, dims,
        "m3_generic",
        specs_extra={"type": "motor-driver", "interfaces": tags},
        mesh="stl/esp32_s3_dev.stl"))

# ════════════════════════════════════════════════════════════════════════════════
# SENSORS — IMU, ToF, current, encoders, more cameras, more LiDAR
# ════════════════════════════════════════════════════════════════════════════════

sensors = [
    ("MPU6050_6DOF",       "MPU-6050 6-DoF IMU",               "sensor", 5,   [16, 22, 3],  "imu","6dof","gyro","accelerometer","i2c","mems","budget","aliexpress","Generic / Aliexpress", 1.50, 7),
    ("MPU9250_9DOF",       "MPU-9250 9-DoF IMU",               "sensor", 8,   [20, 22, 3],  "imu","9dof","gyro","accelerometer","magnetometer","i2c","fusion",       "Generic / Aliexpress", 3.00, 7),
    ("ICM20948_9DOF",      "ICM-20948 9-DoF IMU",               "sensor", 7,   [18, 22, 3],  "imu","9dof","i2c","spi","dual-i2c","magnetometer","high-accuracy",         "Generic / Aliexpress", 4.00, 7),
    ("BMI088_6DOF",        "BMI088 6-DoF IMU (High-G)",         "sensor", 8,   [20, 22, 3],  "imu","6dof","high-g","i2c","spi","accelerometer","gyro","industrial",     "Bosch / Generic", 12.00, 10),
    ("ADXL345_ACCEL",      "ADXL345 3-Axis Accelerometer",      "sensor", 3,   [15, 15, 2],  "accelerometer","3-axis","i2c","spi","±16g","low-power",                   "Analog Devices", 2.00, 7),
    ("LSM9DS1_9DOF",      "LSM9DS1 9-DoF IMU",                 "sensor", 7,   [20, 22, 3],  "imu","9dof","i2c","spi","magnetometer","gyro","accelerometer",         "STMicroelectronics", 8.00, 7),
    ("VL53L0X_TOF",        "VL53L0X ToF Sensor (2m)",           "sensor", 2,   [13, 18, 5],  "tof","distance","i2c","2m","accurate","laser",                             "STMicroelectronics", 4.00, 7),
    ("VL53L1X_TOF",        "VL53L1X ToF Sensor (4m)",           "sensor", 3,   [20, 18, 4],  "tof","distance","i2c","4m","long-range","laser",                             "STMicroelectronics", 7.00, 7),
    ("VL53L4CD_TOF",       "VL53L4CD ToF Sensor (1.3m)",        "sensor", 3,   [20, 18, 4],  "tof","distance","i2c","1.3m","fast","laser","multi-object",                    "STMicroelectronics", 5.50, 7),
    ("SR04_ULTRASONIC",    "HC-SR04 Ultrasonic Distance Sensor","sensor", 8,   [45, 20, 15], "ultrasonic","distance","gpio","4m","cheap","obstacle",                            "Generic / Aliexpress", 1.50, 7),
    ("US100_ULTRASONIC",   "US-100 Ultrasonic Sensor",          "sensor", 8,   [45, 20, 15], "ultrasonic","distance","gpio","uart","temperature-compensated","obstacle",      "Generic / Aliexpress", 2.00, 7),
    ("GP2Y0A21_IR",        "Sharp GP2Y0A21 IR Distance Sensor", "sensor", 5,   [30, 15, 13], "infrared","distance","analog","10-80cm","sharp","obstacle",                        "Sharp / Generic", 3.00, 7),
    ("GP2Y0A710KF_500CM",  "Sharp GP2Y0A710KF IR (100-500cm)", "sensor", 10,  [40, 20, 15], "infrared","long-range","analog","100-500cm","sharp","mobile-robot",               "Sharp / Generic", 12.00, 7),
    ("LIDAR_LD06",         "LDROBOT LD06 360° LiDAR (12m)",    "sensor", 100, [97, 97, 38], "lidar","360","slam","navigation","uart","12m","obstacle-avoidance",             "LDROBOT", 55.00, 10),
    ("LIDAR_YDLIDAR_X4",  "YDLIDAR X4 360° LiDAR (10m)",      "sensor", 90,  [94, 94, 36], "lidar","360","slam","navigation","uart","10m","ros2","budget",                   "YDLIDAR", 49.00, 10),
    ("LIDAR_SLAMTEC_RPLIDAR_A1", "RPLIDAR A1 360° LiDAR (12m)","sensor", 95,  [97, 97, 40], "lidar","360","slam","navigation","uart","12m","scan-rate-5.5hz",              "Slamtec", 69.00, 10),
    ("LIDAR_SLAMTEC_RPLIDAR_A2", "RPLIDAR A2 360° LiDAR (12m, 12Hz)","sensor", 95, [97, 97, 40], "lidar","360","slam","navigation","uart","12m","12hz","faster",              "Slamtec", 99.00, 10),
    ("REALSENSE_D455",     "Intel RealSense D455 Depth Camera","sensor", 75,  [90, 25, 25], "depth","stereo","realsense","intel","long-range","rgb-d","ros2","imu",            "Intel", 269.00, 14),
    ("REALSENSE_D415",     "Intel RealSense D415 Depth Camera","sensor", 60,  [90, 25, 20], "depth","stereo","realsense","intel","rgb-d","short-range","ros2",                 "Intel", 149.00, 14),
    ("ORBBEC_ASTRA",       "Orbbec Astra Depth Camera",        "sensor", 85,  [65, 65, 30], "depth","structured-light","rgb-d","short-range","astral","ros2","budget",        "Orbbec", 89.00, 10),
    ("DEPTH_CAM_WAVESHARE_D435I","Waveshare RPi Hq Camera IMX477 + ToF","sensor", 55, [50, 35, 20], "depth","rpi","imx477","stereo","ros2","raspberry-pi","hq-camera",         "Waveshare", 85.00, 14),
    ("CAM_ESP32_OV2640",   "ESP32-CAM OV2640",                 "sensor", 12,  [40, 27, 10], "camera","vision","ov2640","2mp","wifi","esp32","object-detection","alpr",          "Generic / Aliexpress", 8.00, 7),
    ("CAM_ESP32_OV5640",   "ESP32-CAM OV5640 (5MP)",           "sensor", 15,  [40, 27, 12], "camera","vision","ov5640","5mp","wifi","esp32","higher-resolution","streaming",    "Generic / Aliexpress", 12.00, 7),
    ("CAM_RPI_HQ_IMX477",  "Raspberry Pi HQ Camera IMX477",    "sensor", 30,  [38, 38, 18], "camera","vision","imx477","hq","12mp","raspberry-pi","cs-mount","csi",             "Raspberry Pi Found.", 50.00, 7),
    ("CAM_RPI_WIDE_IMX219","Raspberry Pi Camera v2 (IMX219)",  "sensor", 25,  [25, 23, 9],  "camera","vision","imx219","8mp","raspberry-pi","wide-angle","csi",                "Raspberry Pi Found.", 25.00, 7),
    ("CURRENT_ACS712_5A",  "ACS712 Current Sensor (±5A)",       "sensor", 5,   [30, 15, 3],  "current","sensor","acs712","analog","5a","current-sense","power-monitor",         "Generic / Aliexpress", 1.50, 7),
    ("CURRENT_ACS712_20A", "ACS712 Current Sensor (±20A)",     "sensor", 5,   [30, 15, 3],  "current","sensor","acs712","analog","20a","current-sense","power-monitor",        "Generic / Aliexpress", 2.00, 7),
    ("CURRENT_INA219",     "INA219 Current/Power Sensor",      "sensor", 3,   [20, 15, 3],  "current","power","i2c","ina219","ina226","12-bit","bus-voltage","shunt",             "Adafruit / Generic", 3.00, 7),
    ("PRESSURE_BMP280",    "BMP280 Barometric Pressure Sensor","sensor", 3,   [15, 15, 3],  "pressure","barometer","temperature","i2c","spi","altitude","weather",               "Bosch / Generic", 2.00, 7),
    ("ENCODER_AB_ROTARY",  "KY-040 Rotary Encoder (AB phase)", "sensor", 10,  [30, 30, 20], "encoder","rotary","quadrature","ab","gpio","ky-040","stepper-feedback",     "Generic / Aliexpress", 1.00, 7),
    ("ENCODER_MAGNETIC_AS5600","AS5600 Magnetic Encoder",       "sensor", 4,   [20, 20, 3],  "encoder","magnetic","i2c","12-bit","angle","as5600"," contactless","servo-feedback", "Generic / Aliexpress", 2.50, 7),
    ("ENCODER_MAGNETIC_AS5048A","AS5048A Magnetic Encoder",    "sensor", 4,   [20, 20, 3],  "encoder","magnetic","spi","14-bit","angle","as5048a","high-resolution",          "AMS / Generic", 4.00, 7),
    ("FORCE_FSR402",       "FSR402 Force Sensitive Resistor",  "sensor", 5,   [40, 40, 0.5],"force","fsr","resistive","grasp","contact","analog","gripper",               "Generic / Aliexpress", 2.50, 7),
    ("FORCE_LOADCELL_5KG", "Load Cell 5kg + HX711 Amplifier", "sensor", 50,  [80, 20, 20], "force","load-cell","hx711","5kg","weight","grasp","i2c","arduino",              "Generic / Aliexpress", 3.00, 7),
    ("TEMPERATURE_DS18B20","DS18B20 1-Wire Temperature Sensor","sensor", 3,  [10, 15, 6],  "temperature","1-wire","gpio","waterproof","ds18b20","thermal",                    "Maxim / Generic", 1.00, 7),
    ("TEMPERATURE_MAX31865","MAX31865 RTD Temperature Sensor", "sensor", 8,   [25, 20, 4],  "temperature","rtd","spi","pt100","pt1000","high-accuracy","industrial",             "Maxim / Generic", 8.00, 7),
    ("NEO6M_GPS",          "NEO-6M GPS Module",                "sensor", 10,  [35, 25, 8],  "gps","uart","1.5m-accuracy","mobile-robot","localization","outdoor",                "u-blox / Generic", 8.00, 7),
    ("NEO8M_GPS",          "NEO-8M GPS Module (RTK-ready)",    "sensor", 12,  [35, 25, 8],  "gps","uart","rtk","multi-band","mobile-robot","localization","outdoor",              "u-blox / Generic", 15.00, 7),
    ("HC_SR501_PIR",       "HC-SR501 PIR Motion Sensor",        "sensor", 5,   [32, 24, 17], "pir","motion","infrared","human-detect","gpio","low-power",                        "Generic / Aliexpress", 1.00, 7),
    ("TOF_VL53L0X_STANDALONE","VL53L0X ToF Sensor (breakout)", "sensor", 3,  [15, 18, 4],  "tof","distance","i2c","2m","laser","breakout","accurate",                         "STMicroelectronics", 5.00, 7),
    ("TOF_VL53L1X_STANDALONE","VL53L1X ToF Sensor (breakout)", "sensor", 4,  [20, 18, 4],  "tof","distance","i2c","4m","laser","breakout","long-range",                         "STMicroelectronics", 8.00, 7),
    ("REED_SWITCH",        "Reed Switch Sensor Module",        "sensor", 3,   [20, 15, 3],  "magnetic","reed","switch","gpio","contact","proximity",                            "Generic / Aliexpress", 0.80, 7),
    ("HALL_CURRENT_ACS712","ACS712 Hall Current Sensor (±5A)","sensor", 5,  [30, 15, 3],  "current","hall-effect","analog","5a","isolated","power-monitor",                   "Generic / Aliexpress", 2.00, 7),
]

for row in sensors:
    sku_suffix, name, cat, weight, dims, *rest = row
    tags, supplier, price, lead = rest
    parts.append(make_part(
        f"SENSOR_{sku_suffix}",
        name, cat,
        f"{name}. {', '.join(tags)}.",
        tags + ["sensor"],
        supplier, price, lead,
        weight, dims,
        "m3_generic",
        specs_extra={"interface": "i2c" if "i2c" in tags else ("gpio" if "gpio" in tags else tags[0]),
                     "dims_mm": dims},
        mesh="stl/esp32_s3_dev.stl"))

# ════════════════════════════════════════════════════════════════════════════════
# POWER — batteries, BECs, regulators, power distribution
# ════════════════════════════════════════════════════════════════════════════════

power = [
    ("LIPO_1S_750MAH_JST",  "LiPo 1S 750mAh (3.7V) JST",      "battery", 20,  [45, 25, 7],  "1s","750mah","3.7v","jst","micro","lightweight", "Generic / Aliexpress", 5.00, 10),
    ("LIPO_2S_1000MAH_XT60","LiPo 2S 1000mAh (7.4V) XT60",   "battery", 80,  [70, 25, 15], "2s","1000mah","7.4v","xt60","medium","arm",                              "Generic / Aliexpress", 10.00, 10),
    ("LIPO_2S_2200MAH_XT60","LiPo 2S 2200mAh (7.4V) XT60",   "battery", 130, [110, 35, 18], "2s","2200mah","7.4v","xt60","medium","arm",                              "Generic / Aliexpress", 16.00, 10),
    ("LIPO_2S_5200MAH_XT60","LiPo 2S 5200mAh (7.4V) XT60",   "battery", 300, [140, 45, 25], "2s","5200mah","7.4v","xt60","large","mobile-robot",                               "Generic / Aliexpress", 28.00, 10),
    ("LIPO_3S_1000MAH_XT60","LiPo 3S 1000mAh (11.1V) XT60", "battery", 95,  [90, 30, 20], "3s","1000mah","11.1v","xt60","medium-power","high-voltage",                  "Generic / Aliexpress", 14.00, 10),
    ("LIPO_3S_3700MAH_XT60","LiPo 3S 3700mAh (11.1V) XT60", "battery", 230, [140, 45, 25], "3s","3700mah","11.1v","xt60","large","heavy-mobile",                             "Generic / Aliexpress", 32.00, 10),
    ("LIPO_4S_1300MAH_XT90","LiPo 4S 1300mAh (14.8V) XT90", "battery", 140, [80, 35, 30], "4s","1300mah","14.8v","xt90","high-voltage","power-dense",                      "Generic / Aliexpress", 25.00, 10),
    ("LIPO_4S_3000MAH_XT90","LiPo 4S 3000mAh (14.8V) XT90", "battery", 320, [150, 55, 40], "4s","3000mah","14.8v","xt90","large","heavy-mobile-robot",                         "Generic / Aliexpress", 48.00, 10),
    ("LIION_18650_3400MAH","Li-Ion 18650 3400mAh (3.7V)",   "battery", 50,  [18, 18, 65], "18650","li-ion","3400mah","3.7v"," unprotected","rechargeable",                "Panasonic / Generic", 8.00, 10),
    ("LIION_18650_2500MAH","Li-Ion 18650 2500mAh (3.7V)",   "battery", 45,  [18, 18, 65], "18650","li-ion","2500mah","3.7v"," unprotected","budget",                         "Sony / Generic", 5.00, 10),
    ("NIMH_AA_2500MAH",    "NiMH AA 2500mAh",                 "battery", 30,  [14, 14, 50], "nimh","aa","rechargeable","budget","low-current",                                 "Generic / Aliexpress", 2.00, 7),
    ("LIION_14500_1000MAH","Li-Ion 14500 1000mAh (3.7V)",   "battery", 25,  [14, 14, 50], "14500","li-ion","rechargeable","small","budget",                                   "Generic / Aliexpress", 3.00, 7),
]

for row in power:
    sku_suffix, name, cat, weight, dims, *rest = row
    tags, supplier, price, lead = rest
    connector = "xt90" if "4s" in tags or "xt90" in tags else \
                "xt60" if "2s" in tags or "xt60" in tags else \
                "jst-ph" if "1s" in tags else "generic"
    voltage = 3.7 if "1s" in tags else 7.4 if "2s" in tags else 11.1 if "3s" in tags else 14.8
    capacity_mah = float(tags[1].replace("mah","mah").replace("_","").split("_")[0]) if any(t.startswith("mah") for t in tags) else 1000
    parts.append(make_part(
        f"BATTERY_{sku_suffix}",
        name, cat,
        f"{name}. {', '.join(tags)}.",
        tags + ["battery", "power"],
        supplier, price, lead,
        weight, dims,
        "m3_generic",
        specs_extra={"voltage_v": voltage, "capacity_mah": capacity_mah, "connector": connector},
        mesh="stl/lipo_2s_1200.stl"))

# BECs and voltage regulators
becs = [
    ("BEC_5V_3A_UBEC",    "5V 3A UBEC (Universal BEC)",    "misc", 15, [30, 20, 10], "ubec","5v","3a","step-down","power","servo-bus",     "Generic / Aliexpress", 2.50, 7),
    ("BEC_5V_5A_LBEC",    "5V 5A LBEC (Low Dropout BEC)", "misc", 20, [40, 25, 12], "lbec","5v","5a","ldo","step-down","power","servo-bus",      "Generic / Aliexpress", 4.00, 7),
    ("BEC_6V_3A",         "6V 3A BEC (Servo voltage)",     "misc", 15, [30, 20, 10], "bec","6v","3a","step-down","power","servo-bus",         "Generic / Aliexpress", 2.50, 7),
    ("BEC_ADJUSTABLE_5A", "Adjustable BEC 5A (5-12V)",    "misc", 25, [45, 25, 12], "bec","adjustable","5a","step-down","power","wide-input",   "Generic / Aliexpress", 5.00, 7),
    ("DCDC_BUCK_5V_10A",  "DC-DC Buck Converter 5V 10A",  "misc", 20, [50, 30, 15], "dc-dc","buck","step-down","5v","10a","power","12-24v",   "Generic / Aliexpress", 3.00, 7),
    ("DCDC_BUCK_3V3_5A",  "DC-DC Buck Converter 3.3V 5A", "misc", 15, [40, 25, 12], "dc-dc","buck","3.3v","5a","step-down","power","5v-to-3.3v", "Generic / Aliexpress", 2.50, 7),
    ("DCDC_BOOST_12V_5A", "DC-DC Boost Converter 12V 5A", "misc", 25, [50, 30, 15], "dc-dc","boost","step-up","12v","5a","power","5v-to-12v",   "Generic / Aliexpress", 4.00, 7),
    ("POWER_DISTRIBUTION_6CH","Power Distribution Board 6CH","misc",30,[80,50,15],    "power-distribution","pdb","6-channel","bec","12v","24v","fusible", "Generic / Aliexpress", 8.00, 7),
]

for row in becs:
    sku_suffix, name, cat, weight, dims, *rest = row
    tags, supplier, price, lead = rest
    parts.append(make_part(
        f"POWER_{sku_suffix}",
        name, cat,
        f"{name}. {', '.join(tags)}.",
        tags + ["power","voltage-regulator"],
        supplier, price, lead,
        weight, dims,
        "m3_generic",
        specs_extra={"type": tags[0], "dims_mm": dims},
        mesh="stl/esp32_s3_dev.stl"))

# ════════════════════════════════════════════════════════════════════════════════
# WHEELS — mecanum, omni, rubber, track
# ════════════════════════════════════════════════════════════════════════════════

wheels = [
    ("MECANUM_3INCH_LEFT",  "Mecanum Wheel 3-inch Left",    "wheel", 120, [75, 75, 38], "mecanum","3-inch","holonomic","omnidirectional","d-shaft","left",     "Generic / Aliexpress", 12.00, 12),
    ("MECANUM_3INCH_RIGHT", "Mecanum Wheel 3-inch Right",   "wheel", 120, [75, 75, 38], "mecanum","3-inch","holonomic","omnidirectional","d-shaft","right",    "Generic / Aliexpress", 12.00, 12),
    ("MECANUM_4INCH_LEFT",  "Mecanum Wheel 4-inch Left",    "wheel", 200, [100, 100, 45], "mecanum","4-inch","holonomic","omnidirectional","d-shaft","left",   "Generic / Aliexpress", 18.00, 12),
    ("MECANUM_4INCH_RIGHT", "Mecanum Wheel 4-inch Right",  "wheel", 200, [100, 100, 45], "mecanum","4-inch","holonomic","omnidirectional","d-shaft","right",  "Generic / Aliexpress", 18.00, 12),
    ("MECANUM_5INCH_LEFT",  "Mecanum Wheel 5-inch Left",    "wheel", 350, [125, 125, 50], "mecanum","5-inch","holonomic","omnidirectional","d-shaft","left",   "Generic / Aliexpress", 25.00, 12),
    ("MECANUM_5INCH_RIGHT", "Mecanum Wheel 5-inch Right",   "wheel", 350, [125, 125, 50], "mecanum","5-inch","holonomic","omnidirectional","d-shaft","right",  "Generic / Aliexpress", 25.00, 12),
    ("OMNI_3INCH_4ROLLER", "Omni Wheel 3-inch 4-Roller",    "wheel", 80,  [75, 75, 30], "omni","3-inch","caster","omnidirectional","passive","d-shaft",             "Generic / Aliexpress", 8.00, 10),
    ("OMNI_4INCH_6ROLLER", "Omni Wheel 4-inch 6-Roller",    "wheel", 150, [100, 100, 38], "omni","4-inch","6-roller","omnidirectional","passive","d-shaft",          "Generic / Aliexpress", 14.00, 10),
    ("OMNI_5INCH_8ROLLER", "Omni Wheel 5-inch 8-Roller",    "wheel", 250, [125, 125, 45], "omni","5-inch","8-roller","omnidirectional","passive","d-shaft",          "Generic / Aliexpress", 20.00, 10),
    ("RUBBER_WHEEL_2INCH", "Rubber Wheel 2-inch (50mm)",     "wheel", 30,  [50, 50, 20],  "rubber","2-inch","differential","drive","traction","d-shaft",           "Generic / Aliexpress", 2.00, 10),
    ("RUBBER_WHEEL_3INCH", "Rubber Wheel 3-inch (75mm)",    "wheel", 50,  [75, 75, 28],  "rubber","3-inch","differential","drive","traction","d-shaft",           "Generic / Aliexpress", 3.50, 10),
    ("RUBBER_WHEEL_4INCH", "Rubber Wheel 4-inch (100mm)",   "wheel", 80,  [100, 100, 38], "rubber","4-inch","differential","drive","traction","d-shaft",           "Generic / Aliexpress", 5.00, 10),
    ("RUBBER_WHEEL_5INCH", "Rubber Wheel 5-inch (125mm)",   "wheel", 120, [125, 125, 45], "rubber","5-inch","differential","drive","traction","d-shaft",           "Generic / Aliexpress", 7.00, 10),
    ("TRACK_TANK_2INCH",   "Tank Track Set 2-inch (50mm)",  "wheel", 400, [120, 60, 30], "track","tank","2-inch","crawler","heavy","all-terrain","mobile-robot",      "Generic / Aliexpress", 18.00, 14),
    ("TRACK_TANK_3INCH",   "Tank Track Set 3-inch (75mm)",  "wheel", 600, [150, 75, 40], "track","tank","3-inch","crawler","heavy","all-terrain","mobile-robot",      "Generic / Aliexpress", 28.00, 14),
    ("TRACK_TANK_4INCH",   "Tank Track Set 4-inch (100mm)", "wheel", 900, [180, 90, 50], "track","tank","4-inch","crawler","heavy","all-terrain","mobile-robot",      "Generic / Aliexpress", 42.00, 14),
]

for row in wheels:
    sku_suffix, name, cat, weight, dims, *rest = row
    tags, supplier, price, lead = rest
    diameter = dims[0]
    bore = 6
    parts.append(make_part(
        f"WHEEL_{sku_suffix}",
        name, cat,
        f"{name}. {', '.join(tags)}.",
        tags + ["wheel","mobile-robot","drive"],
        supplier, price, lead,
        weight, dims,
        f"shaft_d_{bore}mm",
        specs_extra={"diameter_mm": diameter, "width_mm": dims[2], "bore_mm": bore},
        mesh="stl/bracket_u_small.stl"))

# ════════════════════════════════════════════════════════════════════════════════
# GRIPPERS — parallel, angular, vacuum, magnetic, finger kits
# ════════════════════════════════════════════════════════════════════════════════

grippers = [
    ("GRIPPER_PARALLEL_50MM_2F", "Parallel Gripper 2-Finger 50mm", "gripper", 45, [50, 30, 50], "parallel","2-finger","50mm","stroke","light-duty","servo","pick-place",         "1688 generic", 9.00, 10),
    ("GRIPPER_PARALLEL_75MM_2F", "Parallel Gripper 2-Finger 75mm", "gripper", 60, [60, 35, 55], "parallel","2-finger","75mm","stroke","medium","servo","pick-place",         "1688 generic", 12.00, 10),
    ("GRIPPER_PARALLEL_100MM_2F","Parallel Gripper 2-Finger 100mm","gripper", 80, [80, 40, 60], "parallel","2-finger","100mm","stroke","heavy","servo","pick-place",        "1688 generic", 15.00, 10),
    ("GRIPPER_ANGULAR_2F",       "Angular Gripper 2-Finger",      "gripper", 55, [55, 35, 50], "angular","2-finger","gripping","self-centering","servo","complex-geometry", "1688 generic", 12.00, 10),
    ("GRIPPER_VACUUM_1CH",       "Vacuum Gripper 1-Channel",      "gripper", 120, [60, 40, 40], "vacuum","1-channel","pick-place","smooth","non-porous","vacuum-pump",   "1688 generic", 25.00, 14),
    ("GRIPPER_VACUUM_2CH",       "Vacuum Gripper 2-Channel",      "gripper", 200, [80, 50, 50], "vacuum","2-channel","pick-place","smooth","non-porous","vacuum-pump",   "1688 generic", 38.00, 14),
    ("GRIPPER_MAGNETIC_25KG",    "Electromagnet 12V (25kg)",     "gripper", 200, [40, 40, 35], "electromagnet","magnetic","ferrous","25kg","holding","no-moving-parts",   "Generic / Aliexpress", 15.00, 12),
    ("GRIPPER_NEUMATIC_FINGERS", "Pneumatic Finger Kit 2-Finger", "gripper", 100, [60, 30, 40], "pneumatic","finger","air-driven","2-finger","fast","industrial",         "1688 generic", 35.00, 14),
    ("GRIPPER_SUCTION_CUP_30MM", "Suction Cup 30mm (single)",     "gripper", 20, [30, 30, 20], "suction","single","30mm","smooth-surface","vacuum","pick-place",           "1688 generic", 3.00, 10),
    ("GRIPPER_SUCTION_CUP_50MM", "Suction Cup 50mm (single)",    "gripper", 30, [50, 50, 25], "suction","single","50mm","smooth-surface","vacuum","pick-place",           "1688 generic", 4.50, 10),
    ("FINGER_KIT_2SG90",         "SG90 Finger Kit (2x SG90 + fingers)","gripper", 35, [40, 20, 30], "finger","kit","2-finger","sg90","light-duty","budget","gripper-kit",   "Generic / Aliexpress", 5.00, 10),
    ("FINGER_KIT_LX16A",         "LX-16A Finger Kit (2x LX-16A + fingers)","gripper", 100, [60, 30, 40], "finger","kit","2-finger","lx-16a","medium-duty","serial-bus","gripper-kit","Lewansoul / 1688", 20.00, 10),
]

for row in grippers:
    sku_suffix, name, cat, weight, dims, *rest = row
    tags, supplier, price, lead = rest
    mount_conn = "servo_horn_25T" if "servo" in tags else "m3_4hole_20x20"
    parts.append(make_part(
        f"GRIPPER_{sku_suffix}",
        name, cat,
        f"{name}. {', '.join(tags)}.",
        tags + ["gripper","end-effector"],
        supplier, price, lead,
        weight, dims,
        mount_conn,
        specs_extra={"dims_mm": dims},
        mesh="stl/gripper_parallel_mini.stl"))

# ════════════════════════════════════════════════════════════════════════════════
# MISC — fasteners, shafts, bearings, connectors as "misc"
# ════════════════════════════════════════════════════════════════════════════════

misc = [
    ("SHAFT_D_3MM_100MM",      "D-Shaft 3mm × 100mm (Steel)",          "misc", 20,  [3, 3, 100], "shaft","d-shaft","3mm","steel","structural","D-shaft for small motors",    "Generic / Aliexpress", 0.50, 7),
    ("SHAFT_D_4MM_100MM",      "D-Shaft 4mm × 100mm (Steel)",          "misc", 25,  [4, 4, 100], "shaft","d-shaft","4mm","steel","structural","D-shaft for small motors",    "Generic / Aliexpress", 0.60, 7),
    ("SHAFT_D_5MM_100MM",      "D-Shaft 5mm × 100mm (Steel)",          "misc", 35,  [5, 5, 100], "shaft","d-shaft","5mm","steel","structural","D-shaft for NEMA17",         "Generic / Aliexpress", 0.80, 7),
    ("SHAFT_D_6MM_100MM",      "D-Shaft 6mm × 100mm (Steel)",          "misc", 50,  [6, 6, 100], "shaft","d-shaft","6mm","steel","structural","D-shaft for NEMA17/25GA",    "Generic / Aliexpress", 1.00, 7),
    ("SHAFT_D_8MM_100MM",      "D-Shaft 8mm × 100mm (Steel)",          "misc", 80,  [8, 8, 100], "shaft","d-shaft","8mm","steel","structural","D-shaft for NEMA23/37GA",    "Generic / Aliexpress", 1.50, 7),
    ("SHAFT_D_10MM_150MM",     "D-Shaft 10mm × 150mm (Steel)",         "misc", 150, [10, 10, 150],"shaft","d-shaft","10mm","steel","structural","D-shaft for large gearmotors","Generic / Aliexpress", 2.50, 7),
    ("COUPLING_5X8MM",         "Flexible Shaft Coupling 5mm×8mm",      "misc", 10,  [20, 15, 25], "coupling","shaft","flexible","5mm-to-8mm","motor-to-shaft",             "Generic / Aliexpress", 0.80, 7),
    ("COUPLING_6X8MM",         "Flexible Shaft Coupling 6mm×8mm",      "misc", 12,  [20, 15, 25], "coupling","shaft","flexible","6mm-to-8mm","motor-to-shaft",             "Generic / Aliexpress", 0.90, 7),
    ("BEARING_608ZZ",          "Ball Bearing 608ZZ (8×22×7mm)",        "misc", 8,   [22, 22, 7],  "bearing","608zz","ball-bearing","8mm","shielded","motor-shaft",              "Generic / Aliexpress", 0.30, 7),
    ("BEARING_6200ZZ",         "Ball Bearing 6200ZZ (10×30×9mm)",     "misc", 12,  [30, 30, 9],  "bearing","6200zz","ball-bearing","10mm","shielded","motor-shaft",             "Generic / Aliexpress", 0.50, 7),
    ("BEARING_6205ZZ",         "Ball Bearing 6205ZZ (25×52×15mm)",    "misc", 25,  [52, 52, 15], "bearing","6205zz","ball-bearing","25mm","shielded","heavy-duty",               "Generic / Aliexpress", 1.50, 7),
    ("COLLAR_5MM",             "Shaft Collar 5mm (Aluminum)",          "misc", 8,   [15, 15, 10], "collar","shaft","5mm","aluminum","locking","hub",                         "Generic / Aliexpress", 0.40, 7),
    ("COLLAR_6MM",             "Shaft Collar 6mm (Aluminum)",          "misc", 10,  [15, 15, 10], "collar","shaft","6mm","aluminum","locking","hub",                         "Generic / Aliexpress", 0.50, 7),
    ("COLLAR_8MM",             "Shaft Collar 8mm (Aluminum)",          "misc", 15,  [20, 20, 12], "collar","shaft","8mm","aluminum","locking","hub",                         "Generic / Aliexpress", 0.60, 7),
    ("SPACER_M3_10MM",         "M3 Hex Spacer Standoff 10mm (F-F)",  "misc", 3,   [6, 6, 10],  "spacer","m3","standoff","10mm","m3-thread","pcb-stacking",              "Generic / Aliexpress", 0.05, 7),
    ("SPACER_M3_15MM",         "M3 Hex Spacer Standoff 15mm (F-F)",  "misc", 4,   [6, 6, 15],  "spacer","m3","standoff","15mm","m3-thread","pcb-stacking",              "Generic / Aliexpress", 0.08, 7),
    ("SPACER_M3_20MM",         "M3 Hex Spacer Standoff 20mm (F-F)",  "misc", 5,   [6, 6, 20],  "spacer","m3","standoff","20mm","m3-thread","pcb-stacking",              "Generic / Aliexpress", 0.10, 7),
    ("SPACER_M3_30MM",         "M3 Hex Spacer Standoff 30mm (F-F)",  "misc", 6,   [6, 6, 30],  "spacer","m3","standoff","30mm","m3-thread","pcb-stacking",              "Generic / Aliexpress", 0.15, 7),
    ("PCB_MOUNTING_KIT_M3",    "PCB Mounting Kit (M3 screws + spacers)","misc", 15, [50, 50, 10], "pcb","m3","mounting-kit","hardware","assorted","esp32","pi",                "Generic / Aliexpress", 2.00, 7),
    ("ANDERSEN_PP_30A",        "Anderson PP30 Power Pole Connector",  "misc", 10,  [15, 10, 20], "connector","anderson","pp","30a","power","high-current","disconnect",         "Generic / Aliexpress", 1.50, 7),
    ("XT30_PAIRS",             "XT30 Connector Pair (Male+Female)",  "misc", 4,   [12, 8, 5],   "connector","xt30","5a","3.7-7.4v","mini","battery",                        "Generic / Aliexpress", 0.50, 7),
    ("XT60_PAIRS",             "XT60 Connector Pair (Male+Female)",  "misc", 8,   [15, 10, 8],  "connector","xt60","30a","7.4-14.8v","standard","battery",                    "Generic / Aliexpress", 0.70, 7),
    ("XT90_PAIRS",             "XT90 Connector Pair (Male+Female)",  "misc", 12,  [20, 12, 10], "connector","xt90","60a","14.8v+","high-power","battery",                       "Generic / Aliexpress", 1.20, 7),
    ("JST_XH_2PIN",            "JST-XH 2-Pin Connector (10 pairs)",  "misc", 3,   [20, 10, 3],  "connector","jst-xh","2-pin","3.7-7.4v","balance-connector","battery",    "Generic / Aliexpress", 0.30, 7),
    ("JST_PH_2PIN",            "JST-PH 2-Pin Connector (10 pairs)",  "misc", 2,   [15, 8, 3],   "connector","jst-ph","2-pin","i2c","servo","low-current",                    "Generic / Aliexpress", 0.20, 7),
    ("DGRS_3PIN_GROVE",        " Grove 3-Pin Cable (10 pairs)",         "misc", 5,   [30, 10, 5],  "connector","grove","3-pin","i2c","gpio","sensor","seeed",                   "Seeed / Generic", 1.00, 7),
    ("DGRS_4PIN_GROVE",        " Grove 4-Pin Cable (5 pairs)",          "misc", 4,   [30, 10, 5],  "connector","grove","4-pin","i2c","spi","uart","seeed",                       "Seeed / Generic", 1.00, 7),
    ("FERRITE_BEAD_10MM",      "Ferrite Bead Clip-on 10mm",           "misc", 5,   [10, 10, 10], "ferrite","emc","noise-suppression","emi","power-line",                     "Generic / Aliexpress", 0.20, 7),
    ("SERVO_EXTENSION_30CM",   "Servo Extension Cable 30cm",          "misc", 5,   [30, 5, 5],  "cable","servo","extension","30cm","3-pin","jr-connector",                "Generic / Aliexpress", 0.30, 7),
    ("SERVO_EXTENSION_50CM",   "Servo Extension Cable 50cm",          "misc", 8,   [50, 5, 5],  "cable","servo","extension","50cm","3-pin","jr-connector",                "Generic / Aliexpress", 0.50, 7),
    ("CABLE_22AWG_1M",         "22AWG Silicone Wire 1m (red+black)",  "misc", 10,  [5, 5, 1000], "wire","22awg","silicone","power","motor","high-flex",                     "Generic / Aliexpress", 0.50, 7),
    ("CABLE_18AWG_1M",         "18AWG Silicone Wire 1m (red+black)",  "misc", 15,  [5, 5, 1000], "wire","18awg","silicone","power","servo","high-current",                  "Generic / Aliexpress", 0.80, 7),
    ("CABLE_26AWG_1M",         "26AWG Silicone Wire 1m (various)",   "misc", 5,   [5, 5, 1000], "wire","26awg","silicone","signal","i2c","gpio","low-current",                "Generic / Aliexpress", 0.30, 7),
    ("NYLON_CABLE_TIE_100",    "Nylon Cable Tie 100mm (100pcs)",      "misc", 5,   [100, 5, 1],  "cable-tie","nylon","100mm","100pcs","organisation","misc",              "Generic / Aliexpress", 0.50, 7),
    ("HEAT_SHRINK_3MMSET",     "Heat Shrink Tubing Set 3mm (3m)",    "misc", 10,  [5, 5, 3000], "heat-shrink","cable","3mm","3m","colored","misc",                           "Generic / Aliexpress", 1.00, 7),
    ("SOLDERING_IRON_60W",     "Soldering Iron 60W (Adjustable)",    "misc", 150, [25, 25, 180], "soldering-iron","tool","60w","adjustable","temperature-controlled","tools","Generic / Aliexpress", 8.00, 10),
    ("MULTIMETER_DT830D",       "Multimeter DT830D",                  "misc", 100, [90, 70, 20], "multimeter","tool","budget","measurement","voltage","current","tools",        "Generic / Aliexpress", 3.00, 10),
    ("HOT_GLUE_GUN",           "Hot Glue Gun + Sticks",              "misc", 200, [25, 25, 150], "glue-gun","tool","hot-glue","prototyping","assembly","tools",                    "Generic / Aliexpress", 5.00, 10),
]

for row in misc:
    sku_suffix, name, cat, weight, dims, *rest = row
    tags, supplier, price, lead = rest
    parts.append(make_part(
        f"MISC_{sku_suffix}",
        name, cat,
        f"{name}. {', '.join(tags)}.",
        tags + ["misc","hardware"],
        supplier, price, lead,
        weight, dims,
        "m3_generic",
        specs_extra={"dims_mm": dims, "type": tags[0]},
        mesh="stl/esp32_s3_dev.stl"))

# ════════════════════════════════════════════════════════════════════════════════
# WRITE OUTPUTS
# ════════════════════════════════════════════════════════════════════════════════

with open(OUT_CATALOGUE_TS, "w") as f:
    f.write("// Auto-generated expanded catalogue parts\n// Generated: " + today + "\n\n")
    for part in parts:
        emit(part, f)

for part in parts:
    write_json(part)

ok = len(parts)
print(f"\nGenerated {ok} parts:")
counts: dict[str, int] = {}
for p in parts:
    counts[p["category"]] = counts.get(p["category"], 0) + 1
for cat, cnt in sorted(counts.items()):
    print(f"  {cat:15s}: {cnt}")
print(f"\nTS snippets → {OUT_CATALOGUE_TS}")
print(f"JSON files  → {OUT_PARTS_DIR}/")