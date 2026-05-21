# Roadmap — POC (4 weeks)

Goal: demo-able tool where someone types "build me a 4-DOF arm with a gripper under $400 BOM" and gets a rotating 3D assembly + downloadable STEP/URDF + BOM CSV.

## Week 1 — Foundations

- [ ] Parts schema (Pydantic models) + JSON storage
- [ ] Connector type registry (`catalogue/connectors.yaml`)
- [ ] Tag 30 parts with mount points (use `scripts/tag_part.py`)
  - 6 servos, 8 brackets, 4 frames, 3 controllers, 3 grippers, 2 wheels, 2 motors, 2 batteries
- [ ] Source STL files (manufacturer sites + GrabCAD)
- [ ] Backend skeleton: FastAPI, parts endpoints, catalogue loading
- [ ] Frontend skeleton: Next.js app, blank R3F scene, parts list sidebar

## Week 2 — Assembler

- [ ] `build123d` assembler: takes assembly tree, returns positioned parts
- [ ] Mount-point matching logic + compatibility checks
- [ ] STEP exporter (build123d native)
- [ ] STL exporter (per-part + combined)
- [ ] URDF generator (from assembly tree)
- [ ] First end-to-end test: hand-coded 4-DOF arm assembly → valid STEP + URDF

## Week 3 — Agent

- [ ] Claude Opus 4.7 integration with tool calls
- [ ] All 7 agent tools implemented (see CLAUDE.md)
- [ ] Feasibility validator (payload, torque, COG, power)
- [ ] Chat UI in frontend
- [ ] First AI-driven build: agent assembles arm from natural language

## Week 4 — Polish + Export UX

- [ ] R3F viewer: positioned assembly, click-to-inspect, explode view
- [ ] Joint animation (sweep through range of motion on hover)
- [ ] Export menu: STEP, URDF (zipped with meshes), STL, GLB, BOM CSV
- [ ] BOM with prices, lead times, supplier (mocked Shenzhen pricing for POC)
- [ ] Demo script + 60-second screen recording
- [ ] Deploy to staging (Vercel + Railway or Fly.io)

## After POC — validation phase

- Send to 10 SF hardware founders (HAX, Bolt, AlleyCorp portfolios)
- Send to 3 Shenzhen contacts for BOM realism check
- Iterate based on feedback before committing to v1

## v1 scope (not in POC)

- Real Shenzhen integration with at least one supplier
- Generative custom brackets (Trellis or Hunyuan3D)
- Mujoco WASM physics preview
- User accounts + saved assemblies
- Stripe checkout
- White-label deployment for one incubator partner
