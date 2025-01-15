#=====================================================
# File: /src/app/app.py
#=====================================================

import sys
import os
import logging
from flask import Flask

# Optionally append the project root directory to sys.path for module resolution if needed.
# This allows imports from the src package without relative import issues.
sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
)

# Importing our Flask blueprints and core services.
from src.app.routes import routes_bp
from src.app.test_routes import test_bp
from src.core import graph_service

# Configure logging level for debugging messages.
logging.basicConfig(level=logging.DEBUG)

# Create the main Flask application instance.
app = Flask(__name__)

# Register the main routes blueprint.
app.register_blueprint(routes_bp)

# Register the test routes blueprint (used for batch testing, advanced stats, etc.).
app.register_blueprint(test_bp)

if __name__ == '__main__':
    # Optionally load a default city upon startup, to ensure we have a graph loaded.
    first_city = next(iter(graph_service.city_options), None)
    if first_city:
        city_filename = graph_service.city_options[first_city]
        if graph_service.load_graph(city_filename):
            graph_service.current_city = first_city
            logging.info(f"Loaded default city: {first_city}")
        else:
            logging.warning("Failed to load the default city.")
    else:
        logging.warning("No cities found in city_options.json!")

    # Run the Flask development server with debugging enabled.
    app.run(debug=True)
