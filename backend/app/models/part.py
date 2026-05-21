"""Core data models for parts, mount points, and assemblies.

Coordinate convention: Z-up, X-forward, units = mm, kg, seconds.
Do not change this. The entire pipeline (URDF, STEP, viewer) assumes it.
"""

from typing import Literal

from pydantic import BaseModel, Field

Quaternion = tuple[float, float, float, float]  # (x, y, z, w)
Vec3 = tuple[float, float, float]


class MountPoint(BaseModel):
    """A typed connection point on a part.

    Two parts only connect if their `connector` strings match exactly.
    See catalogue/connectors.yaml for the registry of valid connector types.
    """

    id: str = Field(..., description="Unique within the part, e.g. 'base', 'horn', 'output_left'")
    position: Vec3 = Field(..., description="mm, in part's local frame")
    orientation: Quaternion = Field(
        default=(0.0, 0.0, 0.0, 1.0),
        description="Quaternion (x,y,z,w). Z-axis points 'outward' from the mount.",
    )
    connector: str = Field(..., description="Connector type, e.g. 'servo_horn_25T'")
    is_joint: bool = Field(default=False, description="True if this is an actuated joint axis")
    joint_axis: Vec3 | None = Field(
        default=None, description="If is_joint, axis of rotation in local frame"
    )
    joint_limits_deg: tuple[float, float] | None = None


PartCategory = Literal[
    "servo",
    "bracket",
    "frame",
    "controller",
    "gripper",
    "sensor",
    "wheel",
    "motor",
    "battery",
    "misc",
]


class PartSpecs(BaseModel):
    """Free-form specs. Common keys by category:

    servo: torque_nm, weight_g, voltage_v, protocol ('serial'|'pwm'|'can')
    bracket/frame: weight_g, material, dims_mm
    controller: weight_g, ports (list), power_w
    gripper: max_payload_g, stroke_mm, weight_g
    battery: voltage_v, capacity_mah, weight_g
    """

    model_config = {"extra": "allow"}

    weight_g: float = Field(..., description="Required for all parts — feasibility solver needs it")


class Part(BaseModel):
    sku: str
    name: str
    category: PartCategory
    mount_points: list[MountPoint]
    specs: PartSpecs
    mesh_url: str = Field(..., description="STL path or URL for viewer")
    cad_url: str | None = Field(default=None, description="STEP path/URL if available")
    supplier: str = Field(default="TBD")
    price_usd: float
    lead_time_days: int = 14
    tags: list[str] = Field(default_factory=list)
    description: str = ""


class Connection(BaseModel):
    """An edge in the assembly tree connecting two parts via mount points."""

    parent_instance_id: str | None = Field(
        default=None, description="Instance ID of the parent (unambiguous even with duplicate SKUs)"
    )
    parent_sku: str
    parent_mount: str
    child_sku: str
    child_mount: str
    child_instance_id: str = Field(
        ..., description="Stable ID for this instance — there can be N copies of same SKU"
    )


class AssemblyNode(BaseModel):
    """A part instance in the assembly tree."""

    instance_id: str
    sku: str
    world_position: Vec3 = (0.0, 0.0, 0.0)
    world_orientation: Quaternion = (0.0, 0.0, 0.0, 1.0)


class Assembly(BaseModel):
    """User's robot. Tree of part instances connected via typed mount points."""

    id: str
    name: str = "Untitled robot"
    root_instance_id: str | None = None
    nodes: dict[str, AssemblyNode] = Field(default_factory=dict)  # instance_id -> node
    connections: list[Connection] = Field(default_factory=list)
    description: str = ""

    @property
    def total_weight_g(self) -> float:
        # Implementation in services/assembler.py — needs parts catalogue
        raise NotImplementedError("Use AssemblerService.compute_weight(assembly)")
