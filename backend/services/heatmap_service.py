"""Build a privacy-preserving aggregate map from the canonical crime CSV."""

import csv
import logging
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

from core.config import get_settings

logger = logging.getLogger("safeher.heatmap_service")

EARTH_RADIUS_M = 6_371_000
GRID_CELL_DEGREES = 0.01
SOURCE_PATH = Path(__file__).resolve().parent.parent / "data" / "crimedatabd.csv"


def _distance_meters(lat: float, lng: float, center_lat: float, center_lng: float) -> float:
    lat1 = math.radians(lat)
    lat2 = math.radians(center_lat)
    delta_lat = lat2 - lat1
    delta_lng = math.radians(center_lng - lng)
    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lng / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(min(1.0, max(0.0, haversine))))


def _empty_collection(
    *,
    available: bool,
    message: str,
    radius_m: int,
    center_lat: float,
    center_lng: float,
) -> dict[str, Any]:
    return {
        "type": "FeatureCollection",
        "metadata": {
            "available": available,
            "source": "CrimeDataBD v4",
            "license": "CC BY-NC 4.0",
            "displayed_record_count": 0,
            "cell_count": 0,
            "coverage_center": {"latitude": center_lat, "longitude": center_lng},
            "coverage_radius_m": radius_m,
            "grid_cell_degrees": GRID_CELL_DEGREES,
            "approximate_cell_size_km": 1.0,
            "temporal_coverage": "Not provided by the source",
            "victim_gender_field": False,
            "message": message,
            "interpretation": "Approximate news-reported record counts; not a street-level risk or safety score.",
        },
        "features": [],
    }


@lru_cache(maxsize=1)
def get_heatmap_geojson() -> dict[str, Any]:
    """Return cached record counts aggregated into ~1 km Chattogram cells."""
    settings = get_settings()
    radius_m = settings.GRAPH_RADIUS_M

    if not SOURCE_PATH.is_file():
        logger.warning("CrimeDataBD CSV is unavailable; returning an empty heatmap.")
        return _empty_collection(
            available=False,
            message="CrimeDataBD source file is unavailable.",
            radius_m=radius_m,
            center_lat=settings.CTG_CENTER_LAT,
            center_lng=settings.CTG_CENTER_LNG,
        )

    cells: dict[tuple[int, int], int] = {}
    included_rows = 0
    try:
        with SOURCE_PATH.open("r", newline="", encoding="utf-8-sig") as source_file:
            rows = csv.DictReader(source_file)
            if not rows.fieldnames or not {"latitude", "longitude"}.issubset(rows.fieldnames):
                logger.warning("CrimeDataBD CSV is missing required coordinate columns.")
                return _empty_collection(
                    available=False,
                    message="CrimeDataBD coordinate columns are unavailable.",
                    radius_m=radius_m,
                    center_lat=settings.CTG_CENTER_LAT,
                    center_lng=settings.CTG_CENTER_LNG,
                )

            for row in rows:
                try:
                    lat = float(row["latitude"])
                    lng = float(row["longitude"])
                except (KeyError, TypeError, ValueError):
                    continue

                if not math.isfinite(lat) or not math.isfinite(lng):
                    continue
                if not (settings.BD_LAT_MIN <= lat <= settings.BD_LAT_MAX):
                    continue
                if not (settings.BD_LNG_MIN <= lng <= settings.BD_LNG_MAX):
                    continue
                if _distance_meters(lat, lng, settings.CTG_CENTER_LAT, settings.CTG_CENTER_LNG) > radius_m:
                    continue

                cell = (
                    math.floor(lat / GRID_CELL_DEGREES),
                    math.floor(lng / GRID_CELL_DEGREES),
                )
                cells[cell] = cells.get(cell, 0) + 1
                included_rows += 1
    except (OSError, csv.Error, UnicodeError):
        logger.warning("CrimeDataBD CSV could not be read; returning an empty heatmap.")
        return _empty_collection(
            available=False,
            message="CrimeDataBD source file could not be read.",
            radius_m=radius_m,
            center_lat=settings.CTG_CENTER_LAT,
            center_lng=settings.CTG_CENTER_LNG,
        )

    if not cells:
        collection = _empty_collection(
            available=True,
            message="No source records fall within the current Chattogram map coverage.",
            radius_m=radius_m,
            center_lat=settings.CTG_CENTER_LAT,
            center_lng=settings.CTG_CENTER_LNG,
        )
        return collection

    max_cell_count = max(cells.values())
    features = []
    for (lat_index, lng_index), count in sorted(cells.items()):
        cell_center_lat = (lat_index + 0.5) * GRID_CELL_DEGREES
        cell_center_lng = (lng_index + 0.5) * GRID_CELL_DEGREES
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [cell_center_lng, cell_center_lat],
            },
            "properties": {
                "record_count": count,
                "relative_density": round(count / max_cell_count, 4),
            },
        })

    return {
        "type": "FeatureCollection",
        "metadata": {
            "available": True,
            "source": "CrimeDataBD v4",
            "license": "CC BY-NC 4.0",
            "displayed_record_count": included_rows,
            "cell_count": len(features),
            "coverage_center": {
                "latitude": settings.CTG_CENTER_LAT,
                "longitude": settings.CTG_CENTER_LNG,
            },
            "coverage_radius_m": radius_m,
            "grid_cell_degrees": GRID_CELL_DEGREES,
            "approximate_cell_size_km": 1.0,
            "temporal_coverage": "Not provided by the source",
            "victim_gender_field": False,
            "interpretation": "Approximate news-reported record counts; not a street-level risk or safety score.",
        },
        "features": features,
    }
