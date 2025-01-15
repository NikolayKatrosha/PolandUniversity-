#=====================================================
# File: /src/app/routes.py
#=====================================================

import random
import math
import networkx as nx
from shapely.geometry import box
from geopy.geocoders import Nominatim
from flask import (
    request, jsonify, render_template,
    Blueprint, redirect, url_for
)

# Our internal modules
from src.core import graph_service
from src.core.algorithms import calculate_route

# Create a Blueprint for the main application routes.
routes_bp = Blueprint("routes_bp", __name__)

@routes_bp.route('/', endpoint='home_page')
def home_page():
    """
    Redirect to '/map' as the default landing page.
    """
    return redirect(url_for('routes_bp.map_page'))

@routes_bp.route('/map', endpoint='map_page')
def map_page():
    """
    Renders the main map interface (map.html).
    
    - Clears any previously selected points
    - Provides a dropdown list of available cities
    - Provides a dropdown list of available TSP algorithms
    """
    graph_service.selected_points.clear()

    algorithms = [
        'Christofides Algorithm',
        'Greedy Algorithm',
        'Nearest Neighbor',
        'Simulated Annealing',
        '2-opt Heuristic',
        'Brute Force'
    ]
    return render_template(
        'map.html',
        cities=graph_service.city_options.keys(),
        algorithms=algorithms
    )

@routes_bp.route('/author', endpoint='author_page')
def author_page():
    """
    Displays information about the author (about_author.html).
    """
    return render_template('about_author.html')

@routes_bp.route('/project', endpoint='project_page')
def project_page():
    """
    Displays information about the project (about_project.html).
    """
    return render_template('about_project.html')


@routes_bp.route('/load_city', methods=['POST'])
def load_city_route():
    """
    Loads the selected city graph into memory and clears the selected points.
    JSON body should contain 'city' which matches a key in city_options.
    """
    data = request.get_json()
    city_name = data.get('city')
    if city_name and (city_name in graph_service.city_options):
        city_filename = graph_service.city_options[city_name]
        if graph_service.load_graph(city_filename):
            graph_service.current_city = city_name
            graph_service.selected_points.clear()
            return jsonify({'status': 'success'})
    return jsonify({'status': 'error'})


@routes_bp.route('/get_edges_in_bounds', methods=['POST'])
def get_edges_in_bounds():
    """
    Returns a list of edges that lie within the current map bounding box.

    The frontend sends a bounding box (north, south, east, west) and zoom level.
    If the zoom is below a certain threshold, we return an empty list for performance.
    Otherwise, we filter the edges_gdf based on intersection with the bounding box.
    """
    if graph_service.edges_gdf is None:
        return jsonify([])

    req = request.get_json()
    bounds = req['bounds']
    zoom = req['zoom']

    # For very low zoom, we skip returning edges (empty).
    if zoom < 2:
        return jsonify([])

    # Construct a shapely box for the bounding area.
    bbox = box(bounds['west'], bounds['south'], bounds['east'], bounds['north'])
    # Filter the edges to only those that intersect with the bounding box.
    edges_in_bounds = graph_service.edges_gdf[
        graph_service.edges_gdf.intersects(bbox)
    ]

    edges_list = []
    for _, row in edges_in_bounds.iterrows():
        # The geometry is typically a LineString. We extract its coordinates.
        coords = [(pt[1], pt[0]) for pt in row['geometry'].coords]
        edges_list.append({'coords': coords})
    return jsonify(edges_list)


@routes_bp.route('/get_nodes_in_bounds', methods=['POST'])
def get_nodes_in_bounds():
    """
    Returns a list of nodes that lie within the current map bounding box.
    Similar logic to get_edges_in_bounds but for nodes_gdf.
    """
    if graph_service.nodes_gdf is None:
        return jsonify([])

    req = request.get_json()
    bounds = req['bounds']
    zoom = req['zoom']

    if zoom < 2:
        return jsonify([])

    bbox = box(bounds['west'], bounds['south'], bounds['east'], bounds['north'])
    nodes_in_bounds = graph_service.nodes_gdf[
        graph_service.nodes_gdf.intersects(bbox)
    ]

    nodes_list = []
    for node_id, row in nodes_in_bounds.iterrows():
        nodes_list.append({
            'id': str(node_id),
            'lat': row['y'],
            'lon': row['x']
        })
    return jsonify(nodes_list)


@routes_bp.route('/select_point', methods=['POST'])
def select_point_route():
    """
    Adds a node to the list of user-selected points (used for TSP or VRP routes).
    
    We enforce a hard limit (HARD_LIMIT) on the total number of points
    to prevent extremely large computations. 
    """
    if graph_service.G is None:
        return jsonify({'status': 'error', 'message': 'Graph not loaded'})

    HARD_LIMIT = 22
    WARNING_THRESHOLD = 10

    if len(graph_service.selected_points) >= HARD_LIMIT:
        return jsonify({
            'status': 'error',
            'message': f'Max {HARD_LIMIT} points allowed.'
        })

    data = request.get_json()
    node_id = str(data['id'])
    lat = data['lat']
    lon = data['lon']

    # Check if this node is already selected.
    existing = next(
        (p for p in graph_service.selected_points if p['id'] == node_id),
        None
    )
    if existing:
        return jsonify({'status': 'error','message':'Point already selected'})

    graph_service.selected_points.append({'id': node_id, 'lat': lat, 'lon': lon})
    # If we exceed WARNING_THRESHOLD, we may return a warning to the user.
    if len(graph_service.selected_points) == (WARNING_THRESHOLD + 1):
        return jsonify({
            'status': 'success',
            'action': 'selected',
            'warning': f'You have selected more than {WARNING_THRESHOLD} points. Some algorithms might be slow.'
        })
    return jsonify({'status': 'success','action': 'selected'})


@routes_bp.route('/deselect_point', methods=['POST'])
def deselect_point():
    """
    Removes a node from the list of selected points if it exists there.
    """
    if graph_service.G is None:
        return jsonify({'status':'error','message':'Graph not loaded'})

    data = request.get_json()
    node_id = str(data['id'])
    existing = next(
        (p for p in graph_service.selected_points if p['id'] == node_id),
        None
    )
    if existing:
        graph_service.selected_points.remove(existing)
        return jsonify({'status':'success','action':'deselected'})
    return jsonify({'status':'error','message':'Point was not selected'})


@routes_bp.route('/get_selected_points', methods=['GET'])
def get_selected_points_route():
    """
    Returns the list of currently selected points as JSON.
    """
    return jsonify(graph_service.selected_points)


@routes_bp.route('/clear_selected_points', methods=['POST'])
def clear_selected_points_route():
    """
    Clears the list of selected points. Useful if the user changes cities or resets the map.
    """
    graph_service.selected_points.clear()
    return jsonify({'status':'success'})


@routes_bp.route('/select_random_points', methods=['POST'])
def select_random_points():
    """
    Randomly picks a given number of nodes from the currently loaded graph
    and marks them as selected. This is used for quick testing.
    """
    if graph_service.G is None:
        return jsonify({'status':'error','message':'Graph not loaded'})

    data = request.get_json()
    count = data.get('count', 10)
    nodes = list(graph_service.G.nodes())
    if count > len(nodes):
        return jsonify({'status':'error','message':'Not enough nodes in graph'})

    graph_service.selected_points.clear()
    chosen = random.sample(nodes, count)
    points_list = []
    for n in chosen:
        lat = graph_service.G.nodes[n]['y']
        lon = graph_service.G.nodes[n]['x']
        node_id = str(n)
        graph_service.selected_points.append({'id':node_id,'lat':lat,'lon':lon})
        points_list.append({'id':node_id,'lat':lat,'lon':lon})

    return jsonify({'status':'success','points':points_list})


@routes_bp.route('/geocode', methods=['POST'])
def geocode():
    """
    Uses Nominatim to geocode a given address string into lat/lon coordinates.
    Returns an error JSON if the address is not found or if the graph is not loaded.
    """
    if graph_service.G is None:
        return jsonify({'status':'error','message':'Graph not loaded'})

    data = request.get_json()
    address = data.get('address', '')
    geolocator = Nominatim(user_agent="map_app")

    if not address.strip():
        return jsonify({'error':'No address provided'})

    location = geolocator.geocode(address)
    if location:
        return jsonify({'lat': location.latitude, 'lon': location.longitude})
    else:
        return jsonify({'error': 'Address not found'})


@routes_bp.route('/calculate_route', methods=['POST'])
def calculate_route_route():
    """
    Compute a TSP or VRP route based on the selected node IDs and the chosen algorithm.
    The JSON body should contain:
      - node_ids: list of node IDs
      - algorithm: a string specifying which algorithm to use
      - num_trucks: if VRP is supported, how many vehicles to deploy
    """
    if graph_service.G is None:
        return jsonify({'status':'error','message':'Graph not loaded'})

    data = request.get_json()
    node_ids = [str(n) for n in data['node_ids']]
    algo = data.get('algorithm', 'Christofides Algorithm')
    num_trucks = int(data.get('num_trucks', 1))

    result = calculate_route(
        graph_service.G,
        node_ids,
        algo,
        num_trucks=num_trucks
    )
    return jsonify(result)


@routes_bp.route('/get_neighbors', methods=['POST'])
def get_neighbors_route():
    """
    Return a list of neighbors for a given node_id, including:
      - latitude
      - longitude
      - distance (edge length)
    This is helpful for debugging or for a visual 'show neighbors' feature.
    """
    data = request.get_json()
    node_id = data.get('id')

    if graph_service.G is None:
        return jsonify([])

    node_id_int = int(node_id)
    neighbors_data = []
    if node_id_int in graph_service.G:
        # For each neighbor in the adjacency list of the current node
        for nbr in graph_service.G[node_id_int]:
            # Each edge might have multiple attributes; we usually pick the first edge key [0] in a MultiDiGraph.
            edge_info = graph_service.G[node_id_int][nbr][0]
            dist = edge_info.get('length', 0.0)
            nbr_lat = graph_service.G.nodes[nbr]['y']
            nbr_lon = graph_service.G.nodes[nbr]['x']
            neighbors_data.append({
                'lat': nbr_lat,
                'lon': nbr_lon,
                'distance': dist
            })

    return jsonify(neighbors_data)