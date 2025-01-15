#=====================================================
# File: /src/core/algorithms.py
#=====================================================

import itertools
import math
import random
import networkx as nx

def calculate_route(G, node_ids, algorithm, num_trucks=1):
    """
    High-level interface for running either a TSP or VRP algorithm
    based on the number of trucks (num_trucks).

    Args:
        G (nx.DiGraph): The loaded OSMnx graph.
        node_ids (list): The list of selected node IDs (strings).
        algorithm (str): The name of the chosen algorithm.
        num_trucks (int): The number of vehicles (1 => TSP, >1 => VRP).

    Returns:
        dict: A dictionary describing the result of the calculation.
              'status': 'success' or 'error'
              'ordered_points': ...
              'total_distance': ...
              etc.
    """
    if G is None:
        return {'status': 'error', 'message': 'Graph not loaded'}
    if len(node_ids) < 2:
        return {'status': 'error', 'message': 'Select at least two points'}

    if num_trucks == 1:
        # TSP scenario
        return calculate_tsp_route(G, node_ids, algorithm)
    else:
        # VRP scenario
        if algorithm == 'Clarke & Wright Savings':
            return calculate_vrp_route_clarke_wright(G, node_ids, num_trucks)
        else:
            return {
                'status': 'error',
                'message': 'Selected VRP algorithm not supported'
            }


def calculate_tsp_route(G, node_ids, algorithm):
    """
    Constructs a complete subgraph for the selected nodes using shortest path lengths,
    and runs the desired TSP algorithm on that subgraph.

    Args:
        G (nx.DiGraph): The main city graph.
        node_ids (list): A list of node IDs (strings).
        algorithm (str): The name of the TSP algorithm to apply.

    Returns:
        dict: The result of building the TSP route, including geometry.
    """
    # Build a complete directed subgraph (using shortest paths).
    complete_graph = nx.DiGraph()
    for u, v in itertools.permutations(node_ids, 2):
        try:
            dist = nx.shortest_path_length(G, int(u), int(v), weight='length')
        except nx.NetworkXNoPath:
            return {
                'status': 'partial_success',
                'message': f'No path between {u} and {v}',
                'ordered_points': node_ids,
                'total_distance': None,
                'travel_time': None,
                'num_nodes_in_route': 0
            }
        complete_graph.add_edge(u, v, weight=dist)

    # Depending on the chosen algorithm, run the TSP procedure.
    if algorithm == 'Christofides Algorithm':
        undirected = complete_graph.to_undirected()
        tsp_route = nx.approximation.traveling_salesman_problem(
            undirected, weight='weight', cycle=False
        )
        # Rotate the route so that tsp_route[0] == node_ids[0].
        start_index = tsp_route.index(node_ids[0])
        tsp_route = tsp_route[start_index:] + tsp_route[:start_index]

    elif algorithm == 'Greedy Algorithm':
        tsp_route = greedy_tsp(complete_graph, start=node_ids[0])

    elif algorithm == 'Nearest Neighbor':
        tsp_route = nearest_neighbor_tsp(complete_graph, start=node_ids[0])

    elif algorithm == 'Simulated Annealing':
        if len(node_ids) < 5:
            return {
                'status': 'error',
                'message': 'Simulated Annealing requires at least 5 points.'
            }
        tsp_route = simulated_annealing_tsp(complete_graph, start=node_ids[0])

    elif algorithm == '2-opt Heuristic':
        initial_route = node_ids.copy()
        tsp_route = two_opt(complete_graph, initial_route)

    elif algorithm == 'Brute Force':
        tsp_route = brute_force_tsp(complete_graph, start=node_ids[0])

    else:
        return {
            'status': 'error',
            'message': 'Unknown algorithm'
        }

    # Build the final geometry and distances from the TSP route.
    return build_tsp_response(G, tsp_route)


def calculate_vrp_route_clarke_wright(G, node_ids, num_trucks):
    """
    Classic Clarke & Wright Savings algorithm for VRP with a single depot
    and multiple clients. Limited demonstration only.

    Args:
        G (nx.DiGraph): The loaded city graph.
        node_ids (list): The list of node IDs (first is depot).
        num_trucks (int): The number of vehicles (routes).

    Returns:
        dict: A dictionary with 'vrp_routes', 'total_distance', etc.
    """
    depot = node_ids[0]
    clients = node_ids[1:]

    distance = {}
    # Pre-calculate distances from depot->client, client->depot, and client->client.
    for c in clients:
        try:
            distance[(depot, c)] = nx.shortest_path_length(G, int(depot), int(c), weight='length')
        except nx.NetworkXNoPath:
            return {
                'status': 'partial_success',
                'message': f'No path from depot={depot} to {c}',
                'vrp_routes': [], 'total_distance': None,
                'travel_time': None, 'num_nodes_in_route': 0
            }
        try:
            distance[(c, depot)] = nx.shortest_path_length(G, int(c), int(depot), weight='length')
        except nx.NetworkXNoPath:
            return {
                'status': 'partial_success',
                'message': f'No path from {c} back to depot={depot}',
                'vrp_routes': [], 'total_distance': None,
                'travel_time': None, 'num_nodes_in_route': 0
            }

    for i in clients:
        for j in clients:
            if i != j:
                try:
                    distance[(i, j)] = nx.shortest_path_length(G, int(i), int(j), weight='length')
                except nx.NetworkXNoPath:
                    return {
                        'status': 'partial_success',
                        'message': f'No path between clients {i} and {j}',
                        'vrp_routes': [], 'total_distance': None,
                        'travel_time': None, 'num_nodes_in_route': 0
                    }

    # Build the savings list: savings = dist(depot,i) + dist(depot,j) - dist(i,j)
    savings_list = []
    for i in clients:
        for j in clients:
            if i != j:
                s = distance[(depot, i)] + distance[(depot, j)] - distance[(i, j)]
                savings_list.append((i, j, s))

    # Sort by descending savings.
    savings_list.sort(key=lambda x: x[2], reverse=True)

    # Initially, each client is in its own route.
    routes = []
    route_of = {}
    for c in clients:
        routes.append([c])
        route_of[c] = len(routes) - 1

    def can_merge(r1, r2, i, j):
        # Merge if the end of route r1 is i, the start of route r2 is j, and r1 != r2
        if routes[r1][-1] == i and routes[r2][0] == j and r1 != r2:
            return True
        return False

    # Try to merge routes using savings.
    for (i, j, _) in savings_list:
        r1 = route_of[i]
        r2 = route_of[j]
        if r1 != r2 and can_merge(r1, r2, i, j):
            routes[r1].extend(routes[r2])
            for node_c in routes[r2]:
                route_of[node_c] = r1
            routes[r2] = []

    # Remove empty routes
    routes = [r for r in routes if r]

    # If the number of routes is larger than num_trucks, take only the first ones.
    if len(routes) > num_trucks:
        routes = routes[:num_trucks]

    # Build geometry and compute the final distance
    all_vrp_nodes = set()
    vrp_routes = []
    total_distance = 0
    colors = ['#FF0000', '#00FF00', '#0000FF', '#FF00FF', '#00FFFF']
    average_speed = 50  # For a simplistic time estimate in km/h

    for i, route_part in enumerate(routes):
        # The route: depot -> route_part -> depot
        full_route = [depot] + route_part + [depot]
        coords_list, dist_val = build_coords_from_route(G, full_route)
        if dist_val is None:
            return {
                'status': 'partial_success',
                'message': 'No path in some segment of VRP route',
                'vrp_routes': [], 'total_distance': None,
                'travel_time': None,
                'num_nodes_in_route': 0
            }
        total_distance += dist_val
        vrp_routes.append({
            'truck_id': i + 1,
            'color': colors[i % len(colors)],
            'coordinates': coords_list,
            'ordered_points': route_part
        })

        # Collect unique nodes in this route
        route_nodes = []
        for k in range(len(full_route) - 1):
            segm = nx.shortest_path(G, int(full_route[k]), int(full_route[k + 1]), weight='length')
            route_nodes.extend(segm[:-1])
        route_nodes.append(int(full_route[-1]))
        all_vrp_nodes.update(route_nodes)

    travel_time = total_distance / 1000 / average_speed * 60  # minutes
    num_nodes_in_route = len(all_vrp_nodes)

    return {
        'status': 'success',
        'vrp_routes': vrp_routes,
        'total_distance': total_distance,
        'travel_time': travel_time,
        'num_nodes_in_route': num_nodes_in_route
    }


def build_coords_from_route(G, route):
    """
    Builds the lat-lon coordinates by traversing shortest paths between consecutive points in 'route'.
    Returns the coordinate list and the sum of all edge lengths, or ([], None) if a path is missing.

    Args:
        G (nx.DiGraph): The city graph.
        route (list): A list of node IDs in visiting order.

    Returns:
        (list, float): ( [ [lat,lon], [lat,lon], ... ], total_distance ),
                       or ([], None) on failure.
    """
    import networkx as nx

    full_nodes = []
    for i in range(len(route) - 1):
        try:
            segm = nx.shortest_path(G, int(route[i]), int(route[i + 1]), weight='length')
        except nx.NetworkXNoPath:
            return ([], None)
        full_nodes.extend(segm[:-1])
    full_nodes.append(int(route[-1]))

    coords = []
    dist_val = 0
    for i in range(len(full_nodes) - 1):
        u = full_nodes[i]
        v = full_nodes[i + 1]
        data = G.get_edge_data(u, v)
        if data is None:
            return ([], None)
        # In MultiDiGraph, an edge can have multiple keys. We pick the first (0) if present.
        edge_info = data[0] if 0 in data else data[next(iter(data))]
        length_edge = edge_info.get('length', 0)
        dist_val += length_edge
        if 'geometry' in edge_info:
            c = list(edge_info['geometry'].coords)
            coords.extend(c)
        else:
            coords.append((G.nodes[u]['x'], G.nodes[u]['y']))
            coords.append((G.nodes[v]['x'], G.nodes[v]['y']))

    # Remove consecutive duplicates
    coords = [c for i, c in enumerate(coords) if i == 0 or c != coords[i - 1]]
    coords_latlon = [[lat, lon] for (lon, lat) in coords]

    if len(coords) == 0:
        return ([], None)
    return (coords_latlon, dist_val)


def build_tsp_response(G, tsp_route):
    """
    After computing the TSP visiting order, build the geometry for the
    main route and the return path from the last node back to the start.

    Args:
        G (nx.DiGraph): The city graph.
        tsp_route (list): Ordered node IDs for the TSP route.

    Returns:
        dict: Contains the 'main_route_coordinates', 'return_route_coordinates',
              'ordered_points', 'total_distance', 'travel_time', and 'num_nodes_in_route'.
    """
    import networkx as nx

    main_full_nodes = []
    # Main route: tsp_route[i] -> tsp_route[i+1]
    for i in range(len(tsp_route) - 1):
        try:
            segm = nx.shortest_path(G, int(tsp_route[i]), int(tsp_route[i + 1]), weight='length')
        except nx.NetworkXNoPath:
            return {
                'status': 'partial_success',
                'message': f'No path between {tsp_route[i]} and {tsp_route[i+1]}',
                'main_route_coordinates': [],
                'return_route_coordinates': [],
                'ordered_points': tsp_route,
                'total_distance': None,
                'travel_time': None,
                'num_nodes_in_route': 0
            }
        main_full_nodes.extend(segm[:-1])
    main_full_nodes.append(int(tsp_route[-1]))

    main_coords = []
    main_dist = 0
    for i in range(len(main_full_nodes) - 1):
        u = main_full_nodes[i]
        v = main_full_nodes[i + 1]
        data = G.get_edge_data(u, v)
        if data is None:
            return {
                'status': 'partial_success',
                'message': f'Edge data not found between {u} and {v}',
                'main_route_coordinates': [],
                'return_route_coordinates': [],
                'ordered_points': tsp_route,
                'total_distance': None,
                'travel_time': None,
                'num_nodes_in_route': 0
            }
        edge_info = data[0] if 0 in data else data[next(iter(data))]
        main_dist += edge_info.get('length', 0)
        if 'geometry' in edge_info:
            c = list(edge_info['geometry'].coords)
            main_coords.extend(c)
        else:
            main_coords.append((G.nodes[u]['x'], G.nodes[u]['y']))
            main_coords.append((G.nodes[v]['x'], G.nodes[v]['y']))

    # Remove duplicates
    main_coords = [c for i, c in enumerate(main_coords) if i == 0 or c != main_coords[i - 1]]
    main_route_coordinates = [[lat, lon] for (lon, lat) in main_coords]

    # Return path: from tsp_route[-1] back to tsp_route[0]
    try:
        ret_path = nx.shortest_path(G, int(tsp_route[-1]), int(tsp_route[0]), weight='length')
    except nx.NetworkXNoPath:
        return {
            'status': 'partial_success',
            'message': f'No path from {tsp_route[-1]} back to {tsp_route[0]}',
            'main_route_coordinates': main_route_coordinates,
            'return_route_coordinates': [],
            'ordered_points': tsp_route,
            'total_distance': None,
            'travel_time': None,
            'num_nodes_in_route': 0
        }
    ret_nodes = []
    ret_nodes.extend(ret_path)

    ret_coords = []
    ret_dist = 0
    for i in range(len(ret_nodes) - 1):
        u = ret_nodes[i]
        v = ret_nodes[i + 1]
        data = G.get_edge_data(u, v)
        if data is None:
            return {
                'status': 'partial_success',
                'message': f'Edge data not found in return path {u}-{v}',
                'main_route_coordinates': main_route_coordinates,
                'return_route_coordinates': [],
                'ordered_points': tsp_route,
                'total_distance': None,
                'travel_time': None,
                'num_nodes_in_route': 0
            }
        edge_info = data[0] if 0 in data else data[next(iter(data))]
        ret_dist += edge_info.get('length', 0)
        if 'geometry' in edge_info:
            c = list(edge_info['geometry'].coords)
            ret_coords.extend(c)
        else:
            ret_coords.append((G.nodes[u]['x'], G.nodes[u]['y']))
            ret_coords.append((G.nodes[v]['x'], G.nodes[v]['y']))

    # Remove duplicates
    ret_coords = [c for i, c in enumerate(ret_coords) if i == 0 or c != ret_coords[i - 1]]
    return_route_coordinates = [[lat, lon] for (lon, lat) in ret_coords]

    total_distance = main_dist + ret_dist

    # Count unique nodes involved in main and return paths
    unique_main = set(main_full_nodes)
    unique_return = set(ret_nodes)
    all_unique = unique_main.union(unique_return)
    num_nodes_in_route = len(all_unique)

    average_speed = 50  # km/h
    travel_time = total_distance / 1000 / average_speed * 60  # minutes

    return {
        'status': 'success',
        'main_route_coordinates': main_route_coordinates,
        'return_route_coordinates': return_route_coordinates,
        'ordered_points': tsp_route,
        'total_distance': total_distance,
        'travel_time': travel_time,
        'num_nodes_in_route': num_nodes_in_route
    }


def nearest_neighbor_tsp(graph, start):
    """
    Simple Nearest Neighbor TSP approach on a complete graph:
    - Always pick the next closest unvisited vertex until none remain.

    Args:
        graph (nx.DiGraph): A complete graph (distance as weight).
        start (str): The node to start from.

    Returns:
        list: The visiting order of nodes (a simple path).
    """
    nodes = list(graph.nodes)
    path = [start]
    unvisited = set(nodes)
    unvisited.remove(start)
    current = start

    while unvisited:
        next_node = min(unvisited, key=lambda node: graph[current][node]['weight'])
        path.append(next_node)
        unvisited.remove(next_node)
        current = next_node

    return path


def greedy_tsp(graph, start):
    """
    Greedy TSP approach:
    - Repeatedly pick the minimal edge from the last added node to an unvisited node.
    - This is different from Nearest Neighbor in that some implementations
      consider all edges globally, but here we do a local approach.

    Args:
        graph (nx.DiGraph): The complete graph with distances.
        start (str): The node ID to start from.

    Returns:
        list: The visiting order of nodes.
    """
    nodes = list(graph.nodes)
    path = [start]
    unvisited = set(nodes)
    unvisited.remove(start)

    while unvisited:
        current = path[-1]
        next_node = min(unvisited, key=lambda v: graph[current][v]['weight'])
        path.append(next_node)
        unvisited.remove(next_node)

    return path


def two_opt(graph, node_ids, init_method='greedy'):
    """
    2-Opt TSP improvement procedure:
    - Start with a route (by default from a greedy approach).
    - Repeatedly check 2-edge swaps to see if they improve the total distance,
      stopping when no improvement can be found.

    Args:
        graph (nx.DiGraph): The complete graph with distances.
        node_ids (list): The list of node IDs to visit.
        init_method (str): Method of building the initial route (greedy or nearest, etc.).

    Returns:
        list: A route that is locally optimal under 2-Opt.
    """
    if init_method.lower().startswith('g'):
        route = greedy_tsp(graph, start=node_ids[0])
    else:
        route = nearest_neighbor_tsp(graph, start=node_ids[0])

    improved = True
    best = route[:]
    while improved:
        improved = False
        for i in range(1, len(best) - 2):
            for j in range(i + 1, len(best)):
                if j - i == 1:
                    continue
                new_route = best[:]
                new_route[i:j] = reversed(best[i:j])
                if calculate_route_length(graph, new_route) < calculate_route_length(graph, best):
                    best = new_route
                    improved = True
        route = best
    return best


def calculate_route_length(graph, route):
    """
    Computes the total distance of a route in the provided complete graph.

    Args:
        graph (nx.DiGraph): The complete graph with 'weight' edges.
        route (list): The order of nodes (strings or int) to traverse.

    Returns:
        float: Sum of all consecutive edge weights along the route.
    """
    total = 0
    for i in range(len(route) - 1):
        total += graph[route[i]][route[i + 1]]['weight']
    return total


def simulated_annealing_tsp(graph, start):
    """
    Simulated Annealing TSP approach:
    - Start with a random route (with 'start' as the first node).
    - Perform random 2-swap perturbations, occasionally accepting worse solutions
      according to the temperature schedule to escape local minima.

    Args:
        graph (nx.DiGraph): The complete graph.
        start (str): The starting node ID.

    Returns:
        list: The TSP route without repeating the start at the end.
    """
    nodes = list(graph.nodes)
    if start in nodes:
        nodes.remove(start)
    random.shuffle(nodes)
    route = [start] + nodes + [start]

    best_route = route
    best_dist = calculate_route_length(graph, best_route)
    T = 10000
    cooling = 0.003

    while T > 1:
        new_route = best_route[:]
        i = random.randint(1, len(new_route) - 3)
        j = random.randint(i + 1, len(new_route) - 2)
        new_route[i:j] = reversed(new_route[i:j])

        new_dist = calculate_route_length(graph, new_route)
        if new_dist < best_dist or random.random() < math.exp((best_dist - new_dist)/T):
            best_route = new_route
            best_dist = new_dist

        T *= (1 - cooling)

    # Remove the duplicated start at the end
    return best_route[:-1]


def brute_force_tsp(graph, start):
    """
    Brute Force TSP approach:
    - Generate all permutations of the other nodes,
    - Evaluate route [start] + perm + [start],
    - Pick the best one.

    Args:
        graph (nx.DiGraph): The complete graph of selected nodes.
        start (str): The node to start from.

    Returns:
        list: The best route found (excluding the repeated start at the end).
    """
    nodes = list(graph.nodes)
    if start in nodes:
        nodes.remove(start)
    min_len = float('inf')
    best_perm = None

    for perm in itertools.permutations(nodes):
        candidate = [start] + list(perm) + [start]
        length_ = calculate_route_length(graph, candidate)
        if length_ < min_len:
            min_len = length_
            best_perm = candidate

    if best_perm is None:
        return []
    return best_perm[:-1]  # Remove duplicate start at the end
