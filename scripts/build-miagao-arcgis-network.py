#!/usr/bin/env python3
"""Build a Miagao-only road and bridge GeoJSON from the local DPWH archive."""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ARCGIS_ROOT = Path(__file__).resolve().parents[2] / "nep/data_sources/arcgis_dpwh/archive/selected"
ROAD_LAYER = "road_condition/layers/Road_Condition_with_No_Assessment_FeatureServer_0-ba559ab9"
BRIDGE_LAYER = "bridge_inventory/layers/Detailed_Bridge_Inventory_Final_FeatureServer_1-72c1d1a7"


def utm51_to_lonlat(x: float, y: float) -> tuple[float, float]:
    """Convert WGS84 / UTM zone 51N (EPSG:32651) to longitude, latitude."""
    a = 6378137.0
    ecc_sq = 0.00669437999014
    k0 = 0.9996
    ecc_prime_sq = ecc_sq / (1 - ecc_sq)
    x -= 500000.0
    m = y / k0
    mu = m / (a * (1 - ecc_sq / 4 - 3 * ecc_sq**2 / 64 - 5 * ecc_sq**3 / 256))
    e1 = (1 - math.sqrt(1 - ecc_sq)) / (1 + math.sqrt(1 - ecc_sq))
    j1 = 3 * e1 / 2 - 27 * e1**3 / 32
    j2 = 21 * e1**2 / 16 - 55 * e1**4 / 32
    j3 = 151 * e1**3 / 96
    j4 = 1097 * e1**4 / 512
    fp = (
        mu
        + j1 * math.sin(2 * mu)
        + j2 * math.sin(4 * mu)
        + j3 * math.sin(6 * mu)
        + j4 * math.sin(8 * mu)
    )
    sin_fp = math.sin(fp)
    cos_fp = math.cos(fp)
    tan_fp = math.tan(fp)
    c1 = ecc_prime_sq * cos_fp**2
    t1 = tan_fp**2
    n1 = a / math.sqrt(1 - ecc_sq * sin_fp**2)
    r1 = a * (1 - ecc_sq) / (1 - ecc_sq * sin_fp**2) ** 1.5
    d = x / (n1 * k0)
    lat = fp - (n1 * tan_fp / r1) * (
        d**2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * ecc_prime_sq) * d**4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * ecc_prime_sq - 3 * c1**2)
        * d**6
        / 720
    )
    lon = math.radians(123) + (
        d
        - (1 + 2 * t1 + c1) * d**3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * ecc_prime_sq + 24 * t1**2)
        * d**5
        / 120
    ) / cos_fp
    return math.degrees(lon), math.degrees(lat)


def point_in_ring(point: tuple[float, float], ring: list[list[float]]) -> bool:
    x, y = point
    inside = False
    for i in range(len(ring) - 1):
        x1, y1 = ring[i][:2]
        x2, y2 = ring[i + 1][:2]
        if (y1 > y) != (y2 > y):
            cross_x = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < cross_x:
                inside = not inside
    return inside


def polygon_contains(point: tuple[float, float], coordinates: list[list[list[float]]]) -> bool:
    return bool(coordinates) and point_in_ring(point, coordinates[0]) and not any(
        point_in_ring(point, hole) for hole in coordinates[1:]
    )


def in_miagao(point: tuple[float, float], boundaries: list[dict[str, Any]]) -> bool:
    lon, lat = point
    for boundary in boundaries:
        geometry = boundary["geometry"]
        polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
        for polygon in polygons:
            if polygon_contains((lon, lat), polygon):
                return True
    return False


def simplify(points: list[list[float]], tolerance: float = 8.0) -> list[list[float]]:
    """Ramer-Douglas-Peucker simplification in the source UTM coordinates."""
    if len(points) <= 2:
        return points
    start, end = points[0], points[-1]
    dx, dy = end[0] - start[0], end[1] - start[1]
    denominator = dx * dx + dy * dy
    best_distance = -1.0
    best_index = 0
    for index, point in enumerate(points[1:-1], 1):
        if denominator:
            t = max(0.0, min(1.0, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / denominator))
            projection = (start[0] + t * dx, start[1] + t * dy)
        else:
            projection = (start[0], start[1])
        distance = math.hypot(point[0] - projection[0], point[1] - projection[1])
        if distance > best_distance:
            best_distance = distance
            best_index = index
    if best_distance <= tolerance:
        return [start, end]
    left = simplify(points[: best_index + 1], tolerance)
    right = simplify(points[best_index:], tolerance)
    return left[:-1] + right


def clip_path(path: list[list[float]], boundaries: list[dict[str, Any]]) -> list[list[list[float]]]:
    """Keep in-municipality runs, sampling long source segments every 25 m."""
    runs: list[list[list[float]]] = []
    current: list[list[float]] = []
    previous_inside = False
    for start, end in zip(path, path[1:]):
        distance = math.hypot(end[0] - start[0], end[1] - start[1])
        steps = max(1, math.ceil(distance / 25))
        samples = [
            [start[0] + (end[0] - start[0]) * i / steps,
             start[1] + (end[1] - start[1]) * i / steps]
            for i in range(steps)
        ] + [[end[0], end[1]]]
        for sample in samples:
            inside = in_miagao(utm51_to_lonlat(sample[0], sample[1]), boundaries)
            if inside:
                if not previous_inside and current:
                    if len(current) > 1:
                        runs.append(simplify(current))
                    current = []
                current.append(sample)
            elif previous_inside and len(current) > 1:
                runs.append(simplify(current))
                current = []
            previous_inside = inside
    if len(current) > 1:
        runs.append(simplify(current))
    return [run for run in runs if len(run) > 1]


def esri_line_features(path: Path, boundaries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    with path.open(encoding="utf-8") as source:
        for line in source:
            feature = json.loads(line)
            attrs = feature.get("attributes") or {}
            if str(attrs.get("PROVINCE", "")).strip().lower() != "iloilo":
                continue
            geometry = feature.get("geometry") or {}
            runs = []
            for source_path in geometry.get("paths") or []:
                if len(source_path) < 2:
                    continue
                clipped = clip_path(source_path, boundaries)
                for run in clipped:
                    coords = [list(utm51_to_lonlat(point[0], point[1])) for point in run]
                    if len(coords) > 1:
                        runs.append(coords)
            if not runs:
                continue
            line_geometry: dict[str, Any]
            if len(runs) == 1:
                line_geometry = {"type": "LineString", "coordinates": runs[0]}
            else:
                line_geometry = {"type": "MultiLineString", "coordinates": runs}
            result.append({
                "type": "Feature",
                "properties": {
                    "kind": "road",
                    "name": attrs.get("ROAD_NAME"),
                    "roadId": attrs.get("ROAD_ID"),
                    "roadClass": attrs.get("ROAD_SEC_CLASS"),
                    "condition": attrs.get("CONDITION"),
                    "lengthM": attrs.get("SEG_LENGTH"),
                },
                "geometry": line_geometry,
            })
    return result


def bridge_features(path: Path, boundaries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    with path.open(encoding="utf-8") as source:
        for line in source:
            feature = json.loads(line)
            attrs = feature.get("attributes") or {}
            if str(attrs.get("PROVINCE", "")).strip().lower() != "iloilo":
                continue
            geometry = feature.get("geometry") or {}
            if geometry.get("x") is None or geometry.get("y") is None:
                continue
            lonlat = utm51_to_lonlat(geometry["x"], geometry["y"])
            if not in_miagao(lonlat, boundaries):
                continue
            result.append({
                "type": "Feature",
                "properties": {
                    "kind": "bridge",
                    "name": attrs.get("BR_NAME"),
                    "bridgeId": attrs.get("BRIDGE_ID"),
                    "roadName": attrs.get("ROAD_NAME"),
                    "roadClass": attrs.get("ROAD_SEC_CLASS"),
                    "condition": attrs.get("CONDITION"),
                    "lengthM": attrs.get("BR_LENGTH"),
                },
                "geometry": {"type": "Point", "coordinates": list(lonlat)},
            })
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--arcgis-root", type=Path, default=DEFAULT_ARCGIS_ROOT)
    parser.add_argument("--output", type=Path, default=ROOT / "public/data/miagao-dpwh-transport-network.geojson")
    args = parser.parse_args()

    boundary_path = ROOT / "public/data/miagao-barangay-boundaries.geojson"
    boundaries = json.loads(boundary_path.read_text(encoding="utf-8"))["features"]
    road_dir = args.arcgis_root / ROAD_LAYER
    bridge_dir = args.arcgis_root / BRIDGE_LAYER
    roads = esri_line_features(road_dir / "features.jsonl", boundaries)
    bridges = bridge_features(bridge_dir / "features.jsonl", boundaries)
    metadata = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "coordinateSystem": "WGS84 longitude/latitude, converted from source EPSG:32651",
        "sourceNote": "Offline DPWH ArcGIS snapshots: Road Condition (database as of January 2026) and General Bridge Type/condition (database as of July 2026).",
        "scopeNote": "Features are clipped or filtered to the 3Q 2026 Miagao barangay boundary union. Road-condition geometry is sampled/clipped at approximately 25 m and simplified by 8 m for display.",
        "roadCount": len(roads),
        "bridgeCount": len(bridges),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"type": "FeatureCollection", "metadata": metadata, "features": roads + bridges}, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
