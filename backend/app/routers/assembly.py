"""Assembly CRUD endpoints. TODO: Week 2."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_assemblies():
    return {"todo": "Week 2"}
