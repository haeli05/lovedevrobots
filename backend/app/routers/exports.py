"""STEP/URDF/STL/BOM exporters. TODO: Week 2-4."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/{assembly_id}/step")
async def export_step(assembly_id: str):
    return {"todo": "Week 2"}


@router.get("/{assembly_id}/urdf")
async def export_urdf(assembly_id: str):
    return {"todo": "Week 2"}


@router.get("/{assembly_id}/bom.csv")
async def export_bom(assembly_id: str):
    return {"todo": "Week 4"}
