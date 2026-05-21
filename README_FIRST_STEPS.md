# After you drop this into ~/Developer/lovedevrobots

```bash
cd ~/Developer/lovedevrobots
git init && git add . && git commit -m "chore: initial scaffold"
```

## Open in Claude Code

```bash
claude code .
```

Claude Code will auto-read `CLAUDE.md` and pick up project context.

## Suggested first prompt to Claude Code

> Read CLAUDE.md and docs/ROADMAP.md. We're starting Week 1. Help me:
> 1. Set up the backend with `uv` and confirm `uvicorn app.main:app --reload` runs cleanly with the 2 sample parts loading.
> 2. Set up the frontend with `pnpm` and confirm `pnpm dev` shows the 3-column layout with the empty 3D viewer.
> 3. Write `scripts/tag_part.py` — an interactive CLI that loads an STL file, lets me click mount points in a basic viewer, picks a connector type from connectors.yaml, and saves the JSON.
>
> Don't write physics or simulation. Don't add custom geometry. Catalogue-only.

## Things to set up yourself

- Anthropic API key in `backend/.env`
- `uv` installed (https://docs.astral.sh/uv/)
- `pnpm` installed (`npm i -g pnpm`)
- A few STL files from GrabCAD or manufacturer sites, dropped into `catalogue/stl/`
