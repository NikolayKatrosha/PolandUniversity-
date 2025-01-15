#=====================================================
# File: /src/core/graph_service.py
#=====================================================

import os
import osmnx as ox
from shapely.geometry import box
import json
import logging
from typing import Dict, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global cache to store graphs, preventing repeated loading.
graph_cache = {}

def load_city_options() -> Dict[str, str]:
    """
    Loads a dictionary of city options from a JSON file.
    Each entry: { "CityName": "GraphFilename.graphml" }

    Returns:
        Dict[str, str]: A dictionary of city->filename mappings, or an empty dict on failure.
    """
    base_dir = os.path.dirname(__file__)  
    config_path = os.path.join(base_dir, "..", "config", "city_options.json")
    config_path = os.path.normpath(config_path)

    if not os.path.exists(config_path):
        logger.error(f"City options file {config_path} not found.")
        return {}

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            city_options = json.load(f)
            if not isinstance(city_options, dict):
                raise ValueError("City options JSON must be a dictionary.")
            if not city_options:
                logger.warning("City options file is empty. No cities available.")
                return {}

            # Validate that each key and value is a string.
            for city, filename in city_options.items():
                if not isinstance(city, str) or not isinstance(filename, str):
                    raise ValueError(f"Invalid entry: {city} -> {filename}, both must be strings.")
            return city_options
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"Invalid city options file: {e}")
        return {}

# Load the dictionary of city options into a global variable.
city_options = load_city_options()

# Global variables for the current application state:
G = None               # Main directed graph (osmnx graph)
nodes_gdf = None       # GeoDataFrame for nodes
edges_gdf = None       # GeoDataFrame for edges
current_city = None    # Current city name
selected_points = []   # User-selected points on the map

def load_graph(city_filename: str) -> bool:
    """
    Loads a .graphml file from the 'cities' directory and initializes global variables.
    If the graph is already cached, it reuses it.

    Args:
        city_filename (str): The filename for the city's .graphml file.

    Returns:
        bool: True on success, False on failure.
    """
    global G, nodes_gdf, edges_gdf

    # Basic sanity checks to avoid unsafe filenames.
    if not isinstance(city_filename, str) or not city_filename.strip() or ".." in city_filename or "/" in city_filename:
        logger.error("Invalid or potentially unsafe city filename provided.")
        return False

    # If this city graph is cached, reuse it.
    if city_filename in graph_cache:
        logger.info(f"Using cached graph for {city_filename}")
        G, nodes_gdf, edges_gdf = graph_cache[city_filename]
        return True

    filepath = os.path.join('cities', city_filename)
    if os.path.exists(filepath):
        logger.info(f"Loading graph from file {filepath}...")
        try:
            # Load the graph from the GraphML file.
            G = ox.load_graphml(filepath)

            # If the graph is undirected, convert it to a directed version.
            if not G.is_directed():
                G = G.to_directed()

            # Create GeoDataFrames for nodes and edges.
            nodes_gdf, edges_gdf = ox.graph_to_gdfs(G)

            # Optional check for 'maxspeed' column in edges.
            if 'maxspeed' in edges_gdf.columns:
                total_edges = len(edges_gdf)
                edges_with_maxspeed = edges_gdf['maxspeed'].notna().sum()
                logger.info(f"[MAXSPEED CHECK] Total edges: {total_edges}")
                logger.info(f"[MAXSPEED CHECK] Edges with maxspeed: {edges_with_maxspeed}")
                logger.info(f"[MAXSPEED CHECK] Edges without maxspeed: {total_edges - edges_with_maxspeed}")
            else:
                logger.info("[MAXSPEED CHECK] 'maxspeed' column not found in edges_gdf.")

            # Store in cache to avoid reloading later.
            graph_cache[city_filename] = (G, nodes_gdf, edges_gdf)
            logger.info("Graph loaded successfully.")
            return True
        except Exception as e:
            logger.error(f"Failed to load graph from {filepath}: {e}")
            return False
    else:
        logger.error(f"Graph file {filepath} not found.")
        return False

def reset_state() -> None:
    """
    Resets global state variables, clearing the loaded graph
    and any city-specific metadata.
    """
    global G, nodes_gdf, edges_gdf, current_city, selected_points
    G = None
    nodes_gdf = None
    edges_gdf = None
    current_city = None
    selected_points = []
    logger.info("Global state variables have been reset.")
