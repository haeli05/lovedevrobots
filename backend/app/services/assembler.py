"""Assembler service. Takes an Assembly + Catalogue → positioned 3D layout.

This is the core of the POC. Given the assembly tree (parts connected by
typed mount points), compute the world-space pose of every part instance.

Algorithm: BFS from root, compose transforms.

For each connection (parent, parent_mount, child, child_mount):
  - Parent's mount frame in world = parent_world × parent_mount_local
  - Child should attach such that child_mount aligns with parent_mount
    (Z-axes anti-parallel by convention — male into female)
  - child_world = parent_mount_world × flip_z × inverse(child_mount_local)
"""

from app.models import Assembly, Connection, MountPoint, Part
from app.services.catalogue import CatalogueService


class AssemblerError(Exception):
    pass


class IncompatibleMountsError(AssemblerError):
    pass


class AssemblerService:
    def __init__(self, catalogue: CatalogueService):
        self.catalogue = catalogue

    def check_compatibility(
        self,
        part_a: Part,
        mount_a_id: str,
        part_b: Part,
        mount_b_id: str,
    ) -> tuple[bool, str]:
        ma = self._get_mount(part_a, mount_a_id)
        mb = self._get_mount(part_b, mount_b_id)
        if ma.connector != mb.connector:
            return False, f"Connector mismatch: {ma.connector} != {mb.connector}"
        return True, "ok"

    def _get_mount(self, part: Part, mount_id: str) -> MountPoint:
        for m in part.mount_points:
            if m.id == mount_id:
                return m
        raise AssemblerError(f"Mount '{mount_id}' not found on part '{part.sku}'")

    def compute_poses(self, assembly: Assembly) -> Assembly:
        """Compute world poses for all nodes. Returns updated assembly.

        TODO: implement quaternion math. Use scipy.spatial.transform.Rotation
        or write minimal helpers. Tests in tests/test_assembler.py should
        cover: identity placement, simple chain, branching, multiple instances
        of same SKU.
        """
        raise NotImplementedError("Week 2 — see ROADMAP.md")

    def total_weight_g(self, assembly: Assembly) -> float:
        total = 0.0
        for node in assembly.nodes.values():
            part = self.catalogue.get(node.sku)
            if part is None:
                raise AssemblerError(f"Unknown SKU in assembly: {node.sku}")
            total += part.specs.weight_g
        return total

    def total_price_usd(self, assembly: Assembly) -> float:
        total = 0.0
        for node in assembly.nodes.values():
            part = self.catalogue.get(node.sku)
            if part is None:
                raise AssemblerError(f"Unknown SKU in assembly: {node.sku}")
            total += part.price_usd
        return total

    def validate_connections(self, assembly: Assembly) -> list[str]:
        """Run compatibility checks on every connection. Returns list of errors."""
        errors: list[str] = []
        for conn in assembly.connections:
            errors.extend(self._validate_connection(conn))
        return errors

    def _validate_connection(self, conn: Connection) -> list[str]:
        errors: list[str] = []
        parent = self.catalogue.get(conn.parent_sku)
        child = self.catalogue.get(conn.child_sku)
        if parent is None:
            errors.append(f"Unknown parent SKU: {conn.parent_sku}")
            return errors
        if child is None:
            errors.append(f"Unknown child SKU: {conn.child_sku}")
            return errors
        ok, reason = self.check_compatibility(
            parent, conn.parent_mount, child, conn.child_mount
        )
        if not ok:
            errors.append(
                f"{conn.parent_sku}.{conn.parent_mount} ↔ {conn.child_sku}.{conn.child_mount}: {reason}"
            )
        return errors
