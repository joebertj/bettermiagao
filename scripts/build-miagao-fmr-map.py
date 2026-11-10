#!/usr/bin/env python3
"""Export FY2027 Miagao FMR endpoint pairs for the Glance map."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = (
    Path(__file__).resolve().parents[2]
    / "open-data-visualization/static/nep-preview/connectivity-fmr-road.json"
)
DEFAULT_OUTPUT = ROOT / "public/data/miagao-fmr-proposals.geojson"


def point_in_ring(point: list[float], ring: list[list[float]]) -> bool:
    x, y = point
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        if (y1 > y) != (y2 > y):
            crossing_x = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < crossing_x:
                inside = not inside
    return inside


def in_boundary(point: list[float], boundaries: list[dict[str, Any]]) -> bool:
    for feature in boundaries:
        geometry = feature["geometry"]
        polygons = (
            [geometry["coordinates"]]
            if geometry["type"] == "Polygon"
            else geometry["coordinates"]
        )
        for polygon in polygons:
            if point_in_ring(point, polygon[0]) and not any(
                point_in_ring(point, hole) for hole in polygon[1:]
            ):
                return True
    return False


def distance_m(a: list[float], b: list[float]) -> float:
    mean_lat = math.radians((a[1] + b[1]) / 2)
    dx = (b[0] - a[0]) * 111_320 * math.cos(mean_lat)
    dy = (b[1] - a[1]) * 110_574
    return math.hypot(dx, dy)


def boundary_crossing(
    inside_point: list[float], outside_point: list[float], boundaries: list[dict[str, Any]]
) -> list[float]:
    inside = inside_point
    outside = outside_point
    for _ in range(24):
        middle = [(inside[0] + outside[0]) / 2, (inside[1] + outside[1]) / 2]
        if in_boundary(middle, boundaries):
            inside = middle
        else:
            outside = middle
    return inside


def clip_line(line: list[list[float]], boundaries: list[dict[str, Any]]) -> list[list[list[float]]]:
    """Clip a source endpoint connector to the municipal boundary for display."""
    runs: list[list[list[float]]] = []
    current: list[list[float]] = []
    for start, end in zip(line, line[1:]):
        steps = max(1, math.ceil(distance_m(start, end) / 20))
        samples = [
            [start[0] + (end[0] - start[0]) * i / steps,
             start[1] + (end[1] - start[1]) * i / steps]
            for i in range(steps)
        ] + [end]
        for sample in samples:
            inside = in_boundary(sample, boundaries)
            if inside:
                if not current:
                    current = [sample]
                elif current[-1] != sample:
                    current.append(sample)
            elif current:
                crossing = boundary_crossing(current[-1], sample, boundaries)
                current.append(crossing)
                if len(current) >= 2:
                    runs.append(current)
                current = []
        if current and len(current) >= 2:
            # Keep a run only through this sampled source path; a following
            # segment may continue it, so it remains open until then.
            pass
    if len(current) >= 2:
        runs.append(current)
    return runs


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    source = json.loads(args.source.read_text(encoding="utf-8"))
    boundaries = json.loads(
        (ROOT / "public/data/miagao-barangay-boundaries.geojson").read_text(
            encoding="utf-8"
        )
    )["features"]

    candidates = [
        row
        for row in source.get("projects", [])
        if "miagao" in row.get("title", "").lower()
        or "miag-ao" in row.get("title", "").lower()
    ]
    features = []
    skipped_without_coordinates = 0
    for row in candidates:
        route_parts = row.get("routeParts") or []
        if not route_parts:
            skipped_without_coordinates += 1
            continue
        clipped_parts = [
            run
            for line in route_parts
            for run in clip_line(line, boundaries)
            if len(run) >= 2
        ]
        if not clipped_parts:
            continue
        geometry = (
            {"type": "LineString", "coordinates": clipped_parts[0]}
            if len(clipped_parts) == 1
            else {"type": "MultiLineString", "coordinates": clipped_parts}
        )
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "kind": "fmrProposal",
                    "name": row["title"],
                    "projectId": row.get("id"),
                    "amountPesos": row.get("amountPesos"),
                    "fundingYear": 2027,
                    "stage": "HGAB 3rd reading proposal",
                    "sourcePage": row.get("sourcePage"),
                    "sourceRowId": row.get("id"),
                    "coordinateBasis": row.get("coordinateBasis"),
                    "displayNote": (
                        "Clipped source endpoint connector; straight line between "
                        "printed endpoints, not a surveyed project alignment."
                    ),
                },
                "geometry": geometry,
            }
        )

    metadata = {
        "source": "ODV connectivity-fmr-road.json",
        "stage": "FY2027 House General Appropriations Bill, 3rd-reading proposal",
        "coordinateMeaning": (
            "Straight connectors between printed FMR endpoints, clipped to "
            "Miagao barangay boundaries for display; not surveyed alignments."
        ),
        "candidateRows": len(candidates),
        "mappedRows": len(features),
        "skippedRowsWithoutEndpointCoordinates": skipped_without_coordinates,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(
            {"type": "FeatureCollection", "metadata": metadata, "features": features},
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
