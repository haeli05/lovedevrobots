"""Tests for connector compatibility checks."""

from app.models import MountPoint, Part, PartSpecs
from app.services.assembler import AssemblerService
from app.services.catalogue import CatalogueService


def make_part(sku: str, mounts: list[MountPoint]) -> Part:
    return Part(
        sku=sku,
        name=sku,
        category="misc",
        mount_points=mounts,
        specs=PartSpecs(weight_g=10),
        mesh_url="stl/test.stl",
        price_usd=1.0,
    )


def test_matching_connectors_are_compatible():
    a = make_part(
        "A",
        [MountPoint(id="out", position=(0, 0, 0), connector="servo_horn_25T")],
    )
    b = make_part(
        "B",
        [MountPoint(id="in", position=(0, 0, 0), connector="servo_horn_25T")],
    )
    cat = CatalogueService({"A": a, "B": b})
    asm = AssemblerService(cat)
    ok, reason = asm.check_compatibility(a, "out", b, "in")
    assert ok is True
    assert reason == "ok"


def test_mismatched_connectors_are_rejected():
    a = make_part(
        "A",
        [MountPoint(id="out", position=(0, 0, 0), connector="servo_horn_25T")],
    )
    b = make_part(
        "B",
        [MountPoint(id="in", position=(0, 0, 0), connector="m3_4hole_20x20")],
    )
    cat = CatalogueService({"A": a, "B": b})
    asm = AssemblerService(cat)
    ok, reason = asm.check_compatibility(a, "out", b, "in")
    assert ok is False
    assert "Connector mismatch" in reason
