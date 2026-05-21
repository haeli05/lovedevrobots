# lovedevrobots

**Lovable for robots.** Describe a robot in chat, get a valid 3D assembly, download STEP/URDF/BOM, ship from Shenzhen.

## What this is

An AI-powered robot builder. User describes what they want (text or photo) → LLM agent picks parts from a curated catalogue → parts snap together via typed mount points → user gets a real, manufacturable 3D model + bill of materials.

Phase 1 (this repo) is the design + export tool. Phase 2 wires up Shenzhen fulfillment.

## Architecture

```
┌─────────────────┐         ┌──────────────────────────────┐
│  Next.js + R3F  │ ◄─────► │  FastAPI + build123d         │
│  (frontend)     │         │  (backend)                   │
│                 │         │                              │
│  - Chat UI      │         │  - Claude Opus 4.7 agent     │
│  - 3D viewer    │         │  - Parts catalogue (Postgres)│
│  - Export menu  │         │  - Assembler                 │
└─────────────────┘         │  - Exporters (STEP/URDF/STL) │
                            └──────────────────────────────┘
```

## Core concepts

**Parts** have typed **mount points**. Two parts only connect if their connector types match. The agent's job is to pick parts and propose connections; the assembler validates and computes transforms.

**Outputs people actually want:**
- `.step` — universal CAD (SolidWorks, Fusion, Onshape)
- `.urdf` + meshes — robotics standard (ROS, Mujoco, Isaac)
- `.stl` — for 3D printing
- `.glb` — web/Blender/Unity
- `.csv` — bill of materials with prices and lead times

## Repo layout

```
backend/         FastAPI server, agent, assembler, exporters
frontend/        Next.js app, R3F viewer, chat UI
catalogue/       Parts SKUs, STL/STEP files, mount-point annotations
assemblies/      Saved user assemblies (JSON)
scripts/         Tagging tools, catalogue importers
docs/            Schema docs, agent tool reference
```

## Quick start

```bash
# Backend
cd backend
uv sync
uv run uvicorn app.main:app --reload

# Frontend
cd frontend
pnpm install
pnpm dev
```

Set `ANTHROPIC_API_KEY` in `backend/.env`.

## Status

Week 0 — scaffolding. See `docs/ROADMAP.md` for the 4-week POC plan.
