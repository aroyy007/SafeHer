"""
SafeHer — Safety Scorer
==========================
Computes safety scores for road segments using the SafetiPin-inspired
composite formula with weights from published academic literature.

Weights (from SafetiPin paper: Viswanath & Basu 2015):
  - 0.35 × lighting score
  - 0.40 × incident density score (from CrimeDataBD KDE)
  - 0.25 × road type score

Road type safety mapping based on walkability analysis:
  - footway/pedestrian: safest (0.95/0.90)
  - residential: moderate (0.70)
  - primary/trunk: dangerous for pedestrians (0.30/0.15)

This module is used by:
  1. precompute/build_graph.py — to score all edges offline
  2. routing/pathfinder.py — for real-time edge weight lookups
"""

import math
import logging
from typing import Dict, Tuple, Optional

logger = logging.getLogger("safeher.safety_scorer")


# =====================================================
# SAFETIPIN-INSPIRED WEIGHT CONFIGURATION
# =====================================================
# Source: "SafetiPin: an innovative mobile app to collect data on
#          women's safety in Indian cities" — Viswanath & Basu, 2015
#          Gender & Development, 23(1). DOI: 10.1080/13552074.2015.1013669
# =====================================================

SAFETY_WEIGHTS = {
    "lighting": 0.35,
    "incident_density": 0.40,
    "road_type": 0.25,
}

# Road type safety scores (higher = safer for walking)
ROAD_TYPE_SAFETY: Dict[str, float] = {
    "footway": 0.95,
    "pedestrian": 0.90,
    "cycleway": 0.85,
    "path": 0.80,
    "living_street": 0.78,
    "steps": 0.75,
    "residential": 0.70,
    "service": 0.65,
    "unclassified": 0.60,
    "tertiary": 0.55,
    "tertiary_link": 0.55,
    "secondary": 0.45,
    "secondary_link": 0.45,
    "primary": 0.30,
    "primary_link": 0.30,
    "trunk": 0.15,
    "trunk_link": 0.15,
    "motorway": 0.05,
    "motorway_link": 0.05,
}

# Default safety score for unknown road types
DEFAULT_ROAD_SAFETY = 0.50


def compute_lighting_score(lit_tag: Optional[str]) -> float:
    """
    Convert OSM 'lit' tag to a safety score.

    OSM lit values:
      "yes" → well lit (1.0)
      "sunset" → lit only at certain times (0.6)
      "no" → explicitly unlit (0.2)
      None/missing → unknown, assume unlit (0.25)
          Conservative assumption: better to over-estimate danger

    Returns:
        float between 0.0 and 1.0
    """
    if lit_tag == "yes":
        return 1.0
    elif lit_tag == "sunset":
        return 0.6
    elif lit_tag == "no":
        return 0.2
    else:
        # Unknown/missing → conservative: assume unlit
        return 0.25


def compute_road_type_score(highway_tag) -> float:
    """
    Convert OSM 'highway' tag to a safety score.

    Args:
        highway_tag: str or list (OSM sometimes returns lists for multi-tagged edges)

    Returns:
        float between 0.0 and 1.0
    """
    if highway_tag is None:
        return DEFAULT_ROAD_SAFETY

    # OSM sometimes returns a list for edges with multiple highway tags
    if isinstance(highway_tag, list):
        highway_tag = highway_tag[0] if highway_tag else "unclassified"

    return ROAD_TYPE_SAFETY.get(str(highway_tag), DEFAULT_ROAD_SAFETY)


def compute_incident_score(density: float, max_density: float) -> float:
    """
    Convert KDE crime density to a safety score.

    Higher density = LOWER safety score (inverted).

    Args:
        density: raw KDE density value at this point
        max_density: maximum density in the training data (for normalization)

    Returns:
        float between 0.0 and 1.0 (1.0 = safest)
    """
    if max_density <= 0:
        return 0.5  # No data → neutral

    normalized = min(density / max_density, 1.0)
    return 1.0 - normalized


def compute_composite_safety(
    lighting_score: float,
    incident_score: float,
    road_type_score: float,
) -> float:
    """
    Compute the composite SafetiPin-inspired safety score.

    Args:
        lighting_score: 0-1 (1 = well lit)
        incident_score: 0-1 (1 = no nearby incidents)
        road_type_score: 0-1 (1 = dedicated footway)

    Returns:
        Composite safety score 0-1 (1 = safest)
    """
    score = (
        SAFETY_WEIGHTS["lighting"] * lighting_score +
        SAFETY_WEIGHTS["incident_density"] * incident_score +
        SAFETY_WEIGHTS["road_type"] * road_type_score
    )
    return max(score, 0.01)  # Never zero — prevents division-by-zero in cost calc


def safety_to_cost(safety_score: float, length_meters: float) -> float:
    """
    Convert safety score to edge cost for A* pathfinding.

    Formula: cost = length × (2.0 - safety)

    This means:
      - A perfectly safe segment (safety=1.0) costs 1× its length
      - A completely unsafe segment (safety=0.0) costs 2× its length
      - The algorithm naturally avoids unsafe segments by finding lower-cost paths

    Args:
        safety_score: 0-1 composite safety score
        length_meters: physical length of the edge in meters

    Returns:
        Edge cost for A* weight calculation
    """
    return length_meters * (2.0 - safety_score)


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate the great-circle distance between two points in meters.
    Used for approximate distance calculations (hotspot proximity, etc.)
    """
    R = 6_371_000  # Earth radius in meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)

    a = (
        math.sin(d_phi / 2) ** 2 +
        math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c
