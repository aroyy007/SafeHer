"""
SafeHer — Graph Precomputation Script
=======================================
Downloads OSM walk network for Chittagong, scores edges for safety,
and saves as a .graphml file.

Run this ONCE locally before deployment:
  python precompute/build_graph.py

Requires: osmnx, scikit-learn, networkx, geopandas, pandas
"""

import os
import time
import logging
import pandas as pd
import numpy as np

# Configure basic logging for script
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
logger = logging.getLogger("build_graph")

# Set OSMNx cache to speed up repeated runs
try:
    import osmnx as ox
    ox.settings.use_cache = True
    ox.settings.log_console = True
except ImportError:
    logger.error("OSMNx not installed. Please pip install osmnx networkx scikit-learn pandas geopandas")
    exit(1)

import networkx as nx
from sklearn.neighbors import KernelDensity

# Must run this script from the backend root dir
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routing.safety_scorer import compute_lighting_score, compute_road_type_score, compute_incident_score, compute_composite_safety, safety_to_cost
from core.config import get_settings


def load_crime_data(csv_path: str) -> pd.DataFrame:
    """Load and prepare CrimeDataBD."""
    if not os.path.exists(csv_path):
        logger.warning(f"Crime data missing at {csv_path}. Using empty dataset.")
        return pd.DataFrame(columns=["lat", "lng", "category"])

    try:
        df = pd.read_csv(csv_path)

        # Standardize column names based on known variations
        col_map = {}
        for col in df.columns:
            lower_col = col.lower()
            if "lat" in lower_col: col_map[col] = "lat"
            if "lon" in lower_col or "lng" in lower_col: col_map[col] = "lng"
            if "type" in lower_col or "cat" in lower_col: col_map[col] = "category"

        df = df.rename(columns=col_map)

        # Drop missing coordinates
        df = df.dropna(subset=["lat", "lng"])

        # Filter to Chittagong bounds
        settings = get_settings()
        df = df[
            (df["lat"] >= settings.BD_LAT_MIN) & (df["lat"] <= settings.BD_LAT_MAX) &
            (df["lng"] >= settings.BD_LNG_MIN) & (df["lng"] <= settings.BD_LNG_MAX)
        ]

        logger.info(f"Loaded {len(df)} crime incidents.")
        return df

    except Exception as e:
        logger.error(f"Failed to load crime data: {e}")
        return pd.DataFrame(columns=["lat", "lng", "category"])


def build_kde_model(df: pd.DataFrame):
    """Build KDE model for incident density scoring."""
    if len(df) < 10:
        logger.warning("Not enough crime data for KDE. Density scoring disabled.")
        return None, 0.0

    # Extract coordinates in radians for Haversine metric
    coords = np.radians(df[['lat', 'lng']].values)

    # Bandwidth ~ 500 meters (converted to radians)
    bandwidth = 500 / 6371000

    kde = KernelDensity(bandwidth=bandwidth, metric='haversine')
    kde.fit(coords)

    # Find max density (for normalization) by sampling the dataset points
    log_densities = kde.score_samples(coords)
    max_density = np.exp(np.max(log_densities))

    logger.info(f"KDE model built. Max density: {max_density:.6f}")
    return kde, max_density


def evaluate_edge_density(kde, max_density, lat: float, lng: float) -> float:
    """Get normalized density score for a single point."""
    if kde is None or max_density <= 0:
        return 0.5  # Neutral

    pt = np.radians([[lat, lng]])
    log_den = kde.score_samples(pt)
    den = np.exp(log_den[0])

    return compute_incident_score(den, max_density)


def main():
    start_time = time.time()
    settings = get_settings()
    output_path = settings.GRAPH_PATH

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # 1. Download Graph
    logger.info("Downloading Chittagong walk graph from OSM...")
    # Chittagong center: 22.3569, 91.7832
    # Radius: 5000m (5km)
    G = ox.graph_from_point(
        (22.3569, 91.7832),
        dist=5000,
        network_type='walk',
        simplify=True
    )
    logger.info(f"Graph downloaded: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

    # 2. Load Crime Data & Build KDE
    crime_path = "data/crimedatabd.csv"
    crime_df = load_crime_data(crime_path)
    kde, max_density = build_kde_model(crime_df)

    # 3. Score Edges
    logger.info("Scoring edges for safety...")
    scored_edges = 0

    for u, v, k, data in G.edges(keys=True, data=True):
        # Determine center point of edge for KDE evaluation
        if "geometry" in data:
            # If complex geometry, take middle point
            coords = list(data["geometry"].coords)
            mid_idx = len(coords) // 2
            mid_lng, mid_lat = coords[mid_idx]
        else:
            # Straight line edge
            mid_lat = (G.nodes[u]['y'] + G.nodes[v]['y']) / 2.0
            mid_lng = (G.nodes[u]['x'] + G.nodes[v]['x']) / 2.0

        # Compute component scores
        lighting_score = compute_lighting_score(data.get('lit'))
        road_type_score = compute_road_type_score(data.get('highway'))
        incident_score = evaluate_edge_density(kde, max_density, mid_lat, mid_lng)

        # Compute composite
        safety_score = compute_composite_safety(lighting_score, incident_score, road_type_score)

        # Compute A* cost
        length = float(data.get('length', 50.0))
        safety_cost = safety_to_cost(safety_score, length)

        # Attach to graph
        data['lighting_score'] = lighting_score
        data['road_type_score'] = road_type_score
        data['incident_score'] = incident_score
        data['safety_score'] = safety_score
        data['safety_cost'] = safety_cost

        # Drop geometry object before saving to GraphML (OSMNx compatibility)
        if 'geometry' in data:
            data['geometry'] = str(data['geometry'])

        scored_edges += 1
        if scored_edges % 10000 == 0:
            logger.info(f"  Scored {scored_edges} edges...")

    # 4. Save GraphML
    logger.info(f"Saving graph to {output_path}...")
    ox.save_graphml(G, output_path)

    elapsed = time.time() - start_time
    logger.info(f"Done in {elapsed:.1f}s. Saved {output_path}.")
    logger.info("This file should be committed to git so the web server doesn't need to rebuild it.")

if __name__ == "__main__":
    main()
