# CLAUDE.md

This file is read by Claude Code on every session. Keep it current.

## Project: lovedevrobots

AI-powered robot builder. User describes a robot → agent picks parts from catalogue → assembler validates and connects them via typed mount points → user downloads STEP/URDF/STL/BOM.

## Tech stack

- **Backend:** Python 3.11+, FastAPI, build123d (CAD), Anthropic SDK, Postgres (later — JSON files for POC)
- **Frontend:** Next.js 15, TypeScript, react-three-fiber, drei, Tailwind, shadcn/ui
- **Package managers:** `uv` for Python, `pnpm` for Node
- **Models:** Claude Opus 4.7 (orchestrator), Sonnet 4.6 (codegen), Haiku 4.5 (cheap subtasks)

## Core invariants (do not break)

1. **Mount-point typing is the contract.** Every part has typed connectors. Parts only connect if connector types match. No exceptions in v0 — even if the LLM is "sure" it should work.
2. **All coordinate frames are Z-up, X-forward.** Enforced at part-tagging time. URDF, STEP, and viewer all use the same convention.
3. **The agent never modifies parts.** It only selects from the catalogue and proposes connections. Custom parts (generated brackets, etc.) come in v1.
4. **Feasibility check is mandatory.** Before any assembly is "final," the validator runs: payload < weakest joint torque × moment arm, power budget, COG stability. The agent must call `validate_assembly` before returning.
5. **Every export must round-trip.** STEP imported into Onshape/Fusion must look right. URDF loaded into Mujoco must simulate without errors. Test both before shipping a new exporter.

## Code conventions

- Python: ruff + black, type hints everywhere, Pydantic v2 for schemas
- TS: strict mode, no `any`, zod for runtime validation
- Tests in `backend/tests/` and `frontend/__tests__/`
- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`)

## Agent tool definitions

The Claude agent has these tools available (defined in `backend/app/agent/tools.py`):

- `search_parts(query, category=None, max_results=10)` — semantic search over catalogue
- `get_part_details(sku)` — full specs + mount points
- `check_compatibility(part_a_sku, mount_a_id, part_b_sku, mount_b_id)` — bool + reason
- `add_part(sku, parent_sku=None, parent_mount=None, child_mount=None)` — adds to current assembly
- `get_assembly_state()` — tree + running BOM total + weight + DOF
- `validate_assembly()` — runs feasibility checks, returns errors or "ok"
- `finalize_assembly(name)` — locks the assembly, generates exports

## Parts schema

See `backend/app/models/part.py`. Summary:

```python
class Part:
    sku: str
    name: str
    category: Literal["servo","bracket","frame","controller","gripper","sensor","wheel","battery","misc"]
    mount_points: list[MountPoint]
    specs: dict  # torque_nm, weight_g, voltage_v, dims_mm, etc.
    mesh_url: str  # STL for viewer
    cad_url: str | None  # STEP if available
    supplier: str
    price_usd: float
    lead_time_days: int
```

`MountPoint`:
```python
class MountPoint:
    id: str  # "base", "horn", "input", "output_left", etc.
    position: tuple[float, float, float]  # mm, in part's local frame
    orientation: tuple[float, float, float, float]  # quaternion (x,y,z,w)
    connector: str  # "servo_horn_25T", "m3_4hole_20mm", "extrusion_2020_end", etc.
    is_joint: bool  # True if this mount represents an actuated joint
```

## Connector type registry

Maintained in `catalogue/connectors.yaml`. Adding a new connector type requires:
1. Entry in `connectors.yaml` with name, description, geometry constraints
2. At least 2 parts using it (one "male", one "female") or it's useless
3. Compatibility tests in `backend/tests/test_connectors.py`

## Workflow for Claude Code

When asked to add a feature:
1. Read this file + the relevant module
2. Check `docs/ROADMAP.md` for current week's scope
3. Write tests first when touching the assembler or exporters
4. Run `uv run pytest` and `pnpm test` before declaring done

When asked to add a new part:
1. Use `scripts/tag_part.py` (interactive mount-point tagger)
2. Validate with `scripts/validate_catalogue.py`
3. Add to `catalogue/parts/<sku>.json`

## What NOT to do

- Don't add physics simulation in POC. We do assembly correctness, not dynamics.
- Don't let the agent generate custom STL/STEP geometry. Catalogue-only in v0.
- Don't skip the feasibility validator to "make the demo work."
- Don't introduce a new connector type without two parts that use it.
- Don't change coordinate conventions. Z-up, X-forward, mm, kg, seconds.
