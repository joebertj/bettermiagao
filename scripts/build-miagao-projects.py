#!/usr/bin/env python3
"""Create the Miagao title-matched project snapshot from ODV's integrated data."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def title_barangays(title: str, barangays: list[str]) -> list[str]:
    """Return exact barangay-name mentions; do not infer location from context."""
    text = re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()
    found = []
    for name in barangays:
        phrase = re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()
        if phrase and re.search(rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])", text):
            found.append(name)
    return [
        name for name in found
        if not any(
            len(other) > len(name)
            and normalized(name) in normalized(other)
            and re.search(
                rf"(?<![a-z0-9]){re.escape(re.sub(r'[^a-z0-9]+', ' ', other.lower()).strip())}(?![a-z0-9])",
                text,
            )
            for other in found
        )
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("odv_json", type=Path, help="Path to integrated-project-data.json")
    parser.add_argument(
        "--psgc-jsonl",
        type=Path,
        help="Optional ODV PSGC locations JSONL; used to tag exact Miagao barangay-name mentions",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "src/data/miagao-projects.json",
    )
    args = parser.parse_args()
    source = json.loads(args.odv_json.read_text(encoding="utf-8"))
    rows = [
        row
        for row in source.get("projects", [])
        if "miagao" in normalized(str(row.get("name", "")))
    ]
    if args.psgc_jsonl:
        locations = [json.loads(line) for line in args.psgc_jsonl.read_text(encoding="utf-8").splitlines() if line.strip()]
        barangays = [
            row["name"] for row in locations
            if row.get("level") == "barangay" and row.get("parent_code") == "0603030000"
        ]
        for row in rows:
            row["titleBarangays"] = title_barangays(str(row.get("name", "")), barangays)
    rows.sort(key=lambda row: (row.get("year", 0), row.get("name", ""), row.get("source", "")))
    payload = {
        "title": "Publicly listed DPWH project rows with Miagao title matches",
        "generatedAt": "2026-11-10",
        "scope": (
            "Rows from ODV integrated project data whose project title contains the locality name "
            "Miagao or Miag-ao after punctuation normalization. This title search can omit projects "
            "listed only by barangay or another locality and can include corridor or district-wide "
            "works whose full physical footprint needs confirmation."
        ),
        "sourceDataset": "ODV integrated-project-data.json",
        "locationReference": "PSGC names where titleBarangays is present; title mentions only, not surveyed project footprints",
        "sourceUrl": "https://research.bettergov.ph/static/nep-preview/integrated-project-data.json",
        "proposalNote": (
            "FY2027 records are from the House General Appropriations Bill, 3rd-reading extract. "
            "They are proposals, not enacted appropriations or verified completed work."
        ),
        "count": len(rows),
        "projects": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    proposal_rows = [row for row in rows if row.get("year") == 2027]
    amount = sum(row.get("amountPesos", 0) for row in proposal_rows)
    print(f"Wrote {len(rows)} title matches to {args.output}")
    print(f"FY2027 House 3rd-reading rows: {len(proposal_rows)} · PHP {amount:,}")


if __name__ == "__main__":
    main()
