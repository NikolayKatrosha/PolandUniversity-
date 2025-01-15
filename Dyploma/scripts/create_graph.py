#=====================================================
# File: /scripts/create_graph.py
#=====================================================

import os
import osmnx as ox
import json
import logging

# Configure basic logging settings for displaying informational messages.
# INFO level means that informational messages and errors will be displayed.
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Determine the path of the JSON config file relative to this script.
# base_dir points to the "scripts" directory since __file__ is /scripts/create_graph.py
base_dir = os.path.dirname(__file__)
config_path = os.path.join(base_dir, "..", "src", "config", "cities_config.json")
# Normalize the path to handle any OS-level path differences.
config_path = os.path.normpath(config_path)

def load_cities_config(filepath: str) -> dict:
    """
    Load city configurations from a JSON file containing mappings
    from city names to their corresponding GraphML filenames.

    Args:
        filepath (str): Path to the JSON file with city configurations.

    Returns:
        dict: A dictionary where each key is a city name and the value
              is the associated GraphML filename.

    Raises:
        FileNotFoundError: If the specified JSON file does not exist.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Configuration file {filepath} not found.")

    with open(filepath, 'r', encoding='utf-8') as file:
        return json.load(file)

def create_and_save_graph(city_name: str, filename: str, directory: str) -> None:
    """
    Download a street network graph from OpenStreetMap for a specified city,
    then save it in GraphML format to a designated directory.

    - The function uses OSMnx to fetch the city's road network. 
    - This network is then saved to a .graphml file on disk.

    Args:
        city_name (str): The textual name of the city (e.g., 'San Francisco, California, USA').
        filename (str): The target filename for the GraphML file (e.g., 'SanFrancisco.graphml').
        directory (str): The path to the directory in which the .graphml file will be saved.

    Returns:
        None
    """
    logger.info(f"Downloading graph for {city_name}...")
    try:
        # Use osmnx to retrieve the drive network from the city using the city_name query.
        G = ox.graph_from_place(city_name, network_type='drive')
        logger.info(f"Graph for {city_name} downloaded.")
    except Exception as e:
        logger.error(f"Error downloading graph for {city_name}: {e}")
        return

    # Ensure the directory exists or create it if it does not.
    if not os.path.exists(directory):
        logger.info(f"Directory {directory} does not exist. Creating it...")
        os.makedirs(directory)

    # Construct the full file path for saving the GraphML file.
    filepath = os.path.join(directory, filename)
    logger.info(f"Saving graph to {filepath}...")
    try:
        # OSMnx provides a function to save the graph in GraphML format.
        ox.save_graphml(G, filepath)
        logger.info("Graph saved successfully.")
    except Exception as e:
        logger.error(f"Error saving graph to {filepath}: {e}")

if __name__ == '__main__':
    # The directory where .graphml files are to be saved. 
    # In this project structure, 'cities' is assumed to be at the project root level.
    directory = 'cities'

    # Attempt to load the city->filename mappings from the JSON configuration file.
    try:
        cities = load_cities_config(config_path)
    except FileNotFoundError as e:
        logger.error(e)
        exit(1)

    # For each city, call create_and_save_graph to download and store the relevant graph.
    for city_name, filename in cities.items():
        logger.info(f"Processing {city_name}...")
        create_and_save_graph(city_name, filename, directory)