#=====================================================
# File: /src/app/utils.py
#=====================================================

from functools import wraps
from flask import jsonify
from src.core import graph_service

def require_graph_loaded(f):
    """
    Decorator that ensures a graph is loaded (graph_service.G is not None)
    before the wrapped route is executed.
    If no graph is loaded, returns a JSON error response and HTTP 400 status.
    """
    @wraps(f)
    def wrapper(*args, **kwargs):
        if graph_service.G is None:
            return jsonify({'status': 'error', 'message': 'Graph not loaded'}), 400
        return f(*args, **kwargs)
    return wrapper