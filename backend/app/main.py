"""FastAPI app entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import agent, assembly, exports, parts
from app.services.catalogue import CatalogueService


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load catalogue from disk on startup
    app.state.catalogue = CatalogueService.load_from_disk("catalogue/parts")
    yield


app = FastAPI(title="lovedevrobots", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parts.router, prefix="/api/parts", tags=["parts"])
app.include_router(assembly.router, prefix="/api/assembly", tags=["assembly"])
app.include_router(agent.router, prefix="/api/agent", tags=["agent"])
app.include_router(exports.router, prefix="/api/exports", tags=["exports"])


@app.get("/health")
async def health():
    return {"status": "ok"}
