"""Catalogue service. POC uses JSON files on disk; v1 swaps to Postgres."""

import json
from pathlib import Path

from app.models import Part


class CatalogueService:
    def __init__(self, parts: dict[str, Part]):
        self.parts = parts

    @classmethod
    def load_from_disk(cls, parts_dir: str) -> "CatalogueService":
        path = Path(parts_dir)
        parts: dict[str, Part] = {}
        if not path.exists():
            return cls(parts)
        for json_file in path.glob("*.json"):
            with open(json_file) as f:
                data = json.load(f)
            part = Part.model_validate(data)
            parts[part.sku] = part
        return cls(parts)

    def get(self, sku: str) -> Part | None:
        return self.parts.get(sku)

    def search(
        self,
        query: str | None = None,
        category: str | None = None,
        max_results: int = 10,
    ) -> list[Part]:
        # POC: dumb substring + category filter. v1: pgvector semantic search.
        results = list(self.parts.values())
        if category:
            results = [p for p in results if p.category == category]
        if query:
            q = query.lower()
            results = [
                p
                for p in results
                if q in p.name.lower()
                or q in p.description.lower()
                or any(q in t.lower() for t in p.tags)
            ]
        return results[:max_results]

    def all_skus(self) -> list[str]:
        return list(self.parts.keys())
