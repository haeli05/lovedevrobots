"""Agent chat endpoint. TODO: Week 3."""
from fastapi import APIRouter

router = APIRouter()


@router.post("/chat")
async def chat():
    return {"todo": "Week 3 — Claude Opus 4.7 agent loop"}
