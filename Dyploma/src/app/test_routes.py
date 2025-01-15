
#=====================================================
# File: /src/app/test_routes.py
#=====================================================

import time
import random
import math
import networkx as nx
from flask import Blueprint, request, jsonify, render_template

# Decorator to ensure a graph is loaded before route execution
from src.app.utils import require_graph_loaded

# Core services and route calculation
from src.core import graph_service
from src.core.algorithms import calculate_route

test_bp = Blueprint("test_bp", __name__)

@test_bp.route('/test_mode', endpoint='test_page')
@require_graph_loaded
def test_mode():
    """
    Renders the test.html page used for random batch testing.

    - Clears previously selected points
    - Provides a list of TSP algorithms for selection
    - Allows random point selection for demonstration purposes
    """
    graph_service.selected_points.clear()

    algos = [
        'Christofides Algorithm',
        'Greedy Algorithm',
        'Nearest Neighbor',
        'Simulated Annealing',
        '2-opt Heuristic',
        'Brute Force'
    ]
    return render_template(
        'test.html',
        cities=graph_service.city_options.keys(),
        algorithms=algos
    )

@test_bp.route('/run_all_algos', methods=['POST'])
@require_graph_loaded
def run_all_algos():
    """
    Receives a list of chosen algorithms from the frontend and runs them all
    on the currently selected points in the loaded graph.

    Returns JSON with the result of each algorithm, including:
      - 'algorithm': name of the algorithm
      - 'distance': computed total distance
      - 'time': travel time
      - 'compute_time_sec': how long (in seconds) it took to compute
      - 'ordered_points': the visiting order of the route
    """
    data = request.get_json()
    chosen_algorithms = data.get('algos', [])

    # If no algorithms are specified, default to all recognized algorithms.
    if not chosen_algorithms:
        chosen_algorithms = [
            'Christofides Algorithm',
            'Greedy Algorithm',
            'Nearest Neighbor',
            'Simulated Annealing',
            '2-opt Heuristic',
            'Brute Force'
        ]

    HARD_LIMIT = 45      # Hard limit of number of points
    BF_THRESHOLD = 12    # If points exceed this threshold, disable Brute Force
    WARNING_THRESHOLD = 10
    SA_MIN_POINTS = 5    # Minimum points for Simulated Annealing to make sense

    node_ids = [p['id'] for p in graph_service.selected_points]
    cnt = len(node_ids)

    # 1) Check if too many points are selected
    if cnt > HARD_LIMIT:
        return jsonify({
            'status': 'error',
            'message': f'Max {HARD_LIMIT} points allowed.'
        })

    # 2) At least 2 points needed to make a route
    if cnt < 2:
        return jsonify({
            'status': 'error',
            'message': 'Select at least two points'
        })

    warns = []
    if cnt > WARNING_THRESHOLD:
        warns.append(
            f'Warning: more than {WARNING_THRESHOLD} points may be slow.'
        )

    # 3) Disable Brute Force if the number of points is too large
    if cnt > BF_THRESHOLD and 'Brute Force' in chosen_algorithms:
        chosen_algorithms.remove('Brute Force')
        warns.append(
            f'Brute Force disabled for more than {BF_THRESHOLD} points.'
        )

    # 4) Disable Simulated Annealing if fewer than SA_MIN_POINTS
    if cnt < SA_MIN_POINTS and 'Simulated Annealing' in chosen_algorithms:
        chosen_algorithms.remove('Simulated Annealing')
        warns.append(
            f'Simulated Annealing disabled for fewer than {SA_MIN_POINTS} points.'
        )

    partial_results = []
    for algo in chosen_algorithms:
        start_time = time.perf_counter()
        # Perform the route calculation for the current algorithm
        res = calculate_route(graph_service.G, node_ids, algo)
        end_time = time.perf_counter()
        compute_time_sec = round(end_time - start_time, 3)

        partial_results.append({
            'algorithm': algo,
            'res': res,
            'time_sec': compute_time_sec
        })

    # Among successful algorithms, find the minimum distance to compute ratio
    successful = [
        pr for pr in partial_results if pr['res']['status'] == 'success'
    ]
    min_dist = None
    if successful:
        # The minimal distance from all successful results
        min_dist = min(
            pr['res']['total_distance'] for pr in successful
            if pr['res'].get('total_distance') is not None
        )

    results = []
    for pr in partial_results:
        algo_name = pr['algorithm']
        r = pr['res']
        cts = pr['time_sec']

        if r['status'] == 'success':
            expansions = 0
            cnt_points = len(node_ids)

            # Hypothetical expansions count:
            # - Brute Force expansions might be factorial-based
            # - Nearest Neighbor expansions might be n * n
            if algo_name == 'Brute Force':
                expansions = 1
                if cnt_points > 1:
                    expansions = math.factorial(cnt_points - 1)
            elif algo_name == 'Nearest Neighbor':
                expansions = cnt_points * cnt_points

            ratio = 1.0
            dist_alg = r.get('total_distance', 0)
            if min_dist and min_dist > 0:
                ratio = round(dist_alg / min_dist, 3)

            results.append({
                'algorithm': algo_name,
                'status': 'success',
                'distance': dist_alg,
                'time': r.get('travel_time', 0),
                'num_nodes': r.get('num_nodes_in_route', 0),
                'ordered_points': r.get('ordered_points', []),
                'main_route_coordinates': r.get('main_route_coordinates', []),
                'return_route_coordinates': r.get('return_route_coordinates', []),
                'expansions': expansions,
                'heuristic_ratio': ratio,
                'compute_time_sec': cts
            })
        else:
            # If the result was an error, place an error entry in the final output
            results.append({
                'algorithm': algo_name,
                'status': 'error',
                'message': r.get('message', 'Error')
            })

    return jsonify({
        'status': 'success',
        'results': results,
        'warnings': warns
    })