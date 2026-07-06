"""
SafeHer — Dummy Heatmap Data
==============================
For hackathon demo purposes without a database.
This represents a few known risk hotspots in Chittagong.
"""

import json
import os

def create_demo_hotspots():
    os.makedirs("data", exist_ok=True)
    hotspots = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [91.8219, 22.3592]},
                "properties": {"id": "1", "category": "eve_teasing", "weight": 0.8}
            },
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [91.8315, 22.3651]},
                "properties": {"id": "2", "category": "unsafe_lighting", "weight": 0.6}
            },
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [91.8021, 22.3412]},
                "properties": {"id": "3", "category": "stalking", "weight": 0.9}
            }
        ]
    }
    with open("data/chittagong_incidents.geojson", "w") as f:
        json.dump(hotspots, f)

if __name__ == "__main__":
    create_demo_hotspots()
