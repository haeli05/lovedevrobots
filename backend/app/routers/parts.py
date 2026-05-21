"""Parts catalogue endpoints."""

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/")
async def list_parts(request: Request, category: str | None = None, q: str | None = None):
    catalogue = request.app.state.catalogue
    return catalogue.search(query=q, category=category, max_results=100)


@router.get("/{sku}")
async def get_part(request: Request, sku: str):
    catalogue = request.app.state.catalogue
    part = catalogue.get(sku)
    if part is None:
        return {"error": f"Part not found: {sku}"}, 404
    return part
