/* File: src/app/static/js/map_init.js */

// --------------------------------------
// Global variables for the MAIN map
// --------------------------------------
var map, markersClusterGroup, edgeLayerGroup, neighborLayerGroup, selectedLayerGroup, routeLayerGroup;
var selectedMarkers = [];
var selectedPoints = [];
var showNeighbors = false;
var isRouteDisplayed = false;

// Initialization of the MAIN map
(function initMainMap() {
    var mapElement = document.getElementById('map');
    if (!mapElement) return;

    map = L.map('map', { zoomControl: false }).setView([37.7749, -122.4194], 13);

    // Additional panes for displaying routes
    map.createPane('mainRoutePane');
    map.getPane('mainRoutePane').style.zIndex = 399;
    map.createPane('returnRoutePane');
    map.getPane('returnRoutePane').style.zIndex = 399;

    // OSM layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(map);

    // Fullscreen button
    L.control.fullscreen({ position: 'topright' }).addTo(map);

    // Marker clustering (markersClusterGroup)
    markersClusterGroup = L.markerClusterGroup({
        disableClusteringAtZoom: 18,
        maxClusterRadius: 100,
        chunkedLoading: true
    });
    map.addLayer(markersClusterGroup);

    edgeLayerGroup     = L.layerGroup().addTo(map);
    neighborLayerGroup = L.layerGroup().addTo(map);
    selectedLayerGroup = L.layerGroup().addTo(map);
    routeLayerGroup    = L.layerGroup().addTo(map);

    setMapCenter('San Francisco');
    updateEdges();
    updateNodes();

    map.on('moveend', debounce(function() {
        updateEdges();
        updateNodes();
    }, 300));
})();

/** Set the center of the main map */
function setMapCenter(cityName) {
    var cityCenters = {
        'San Francisco': [37.7749, -122.4194],
        'Los Angeles':   [34.0522, -118.2437],
        'New York':      [40.7128, -74.0060],
        'Wroclaw':       [51.1078852, 17.0385376]
    };
    var center = cityCenters[cityName] || [37.7749, -122.4194];
    map.setView(center, 13);
}

// Show blue lines only if zoom >= 17
function updateEdges() {
    if (isRouteDisplayed) return;

    var bounds = map.getBounds();
    var zoom   = map.getZoom();
    if (zoom < 17) {
        edgeLayerGroup.clearLayers();
        return;
    }

    var data = {
        bounds: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east:  bounds.getEast(),
            west:  bounds.getWest()
        },
        zoom: zoom
    };

    fetch('/get_edges_in_bounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(edges => {
        edgeLayerGroup.clearLayers();
        edges.forEach(edge => {
            var coords = edge.coords;
            var polyline = L.polyline(coords, {
                color:  'blue',
                weight: 2,
                opacity: 0.7
            });
            polyline.addTo(edgeLayerGroup);
        });
    })
    .catch(err => console.error('Error fetching edges:', err));
}

// Show nodes if zoom >= 2 (or your chosen threshold)
function updateNodes() {
    if (isRouteDisplayed) return;

    var bounds = map.getBounds();
    var zoom   = map.getZoom();
    if (zoom < 2) {
        markersClusterGroup.clearLayers();
        return;
    }

    var data = {
        bounds: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east:  bounds.getEast(),
            west:  bounds.getWest()
        },
        zoom: zoom
    };

    fetch('/get_nodes_in_bounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(nodes => {
        markersClusterGroup.clearLayers();
        nodes.forEach(node => {
            var isSelected = selectedMarkers.some(function(m) {
                return m.nodeId === node.id;
            });
            if (isSelected) return;

            var marker = L.circleMarker([node.lat, node.lon], {
                radius: 8,
                color: 'red'
            });
            marker.nodeId = node.id;
            marker.on('click', function() {
                selectPoint(node.id, node.lat, node.lon);
            });
            marker.bindPopup(`Node ID: ${node.id}`);
            markersClusterGroup.addLayer(marker);
        });
    })
    .catch(err => console.error('Error fetching nodes:', err));
}

/** Debounce utility */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}


// ==========================
// ====== TEST MAP PART =====
// ==========================
var showTestEdgesAndNodes = false;  // controlled by a checkbox

var testMap,
    testMarkersAutoGroup,
    testEdgeLayerGroup,
    testSelectedLayerGroup,
    testRouteGroup;

var testSelectedMarkers = [];
var testSelectedPoints  = [];

(function initTestMap() {
    var testMapElement = document.getElementById('map-test');
    if (!testMapElement) return;

    testMap = L.map('map-test', { zoomControl: false }).setView([37.7749, -122.4194], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(testMap);

    L.control.fullscreen({ position: 'topright' }).addTo(testMap);

    testMarkersAutoGroup = L.markerClusterGroup({
        disableClusteringAtZoom: 18,
        maxClusterRadius: 100,
        chunkedLoading: true
    });
    testMap.addLayer(testMarkersAutoGroup);

    testEdgeLayerGroup     = L.layerGroup().addTo(testMap);
    testSelectedLayerGroup = L.layerGroup().addTo(testMap);
    testRouteGroup         = L.layerGroup().addTo(testMap);

    testMap.on('moveend', debounce(function() {
        if (showTestEdgesAndNodes) {
            updateEdgesTest();
            updateNodesTest();
        } else {
            testEdgeLayerGroup.clearLayers();
            testMarkersAutoGroup.clearLayers();
        }
    }, 300));
})();

/** Automatically load edges (testMap) */
function updateEdgesTest() {
    var zoom = testMap.getZoom();
    testEdgeLayerGroup.clearLayers();

    var bounds = testMap.getBounds();
    var data = {
        bounds: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east:  bounds.getEast(),
            west:  bounds.getWest()
        },
        zoom: zoom
    };

    fetch('/get_edges_in_bounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(r => r.json())
    .then(edges => {
        testEdgeLayerGroup.clearLayers();
        edges.forEach(edge => {
            var coords = edge.coords;
            var polyline = L.polyline(coords, {
                color:  'blue',
                weight: 2,
                opacity: 0.7
            });
            polyline.addTo(testEdgeLayerGroup);
        });
    })
    .catch(err => console.error('Error fetching test edges:', err));
}

/** Automatically load nodes (testMap) */
function updateNodesTest() {
    var zoom = testMap.getZoom();
    testMarkersAutoGroup.clearLayers();

    var bounds = testMap.getBounds();
    var data = {
        bounds: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east:  bounds.getEast(),
            west:  bounds.getWest()
        },
        zoom: zoom
    };

    fetch('/get_nodes_in_bounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(r => r.json())
    .then(nodes => {
        testMarkersAutoGroup.clearLayers();
        nodes.forEach(node => {
            var marker = L.circleMarker([node.lat, node.lon], {
                radius: 6,
                color: 'green'
            });
            marker.nodeId = node.id;
            testMarkersAutoGroup.addLayer(marker);
        });
    })
    .catch(err => console.error('Error fetching test nodes:', err));
}

/**
 * showAlgoRouteTest — draws TSP/VRP routes on the test map
 * This may be called from test_interactions.js
 */
function showAlgoRouteTest(algoResult) {
    // Clear existing testRouteGroup
    testRouteGroup.clearLayers();

    // Suppose algoResult has:
    // {
    //   algorithm: "Nearest Neighbor",
    //   color: "#FF0000",
    //   coordinates: [...],  // array of lat-lon
    //   ...
    // }
    // Below is an example of drawing polylines
    var coords = algoResult.main_route_coordinates || [];
    if (coords.length > 0) {
        var polyline = L.polyline(coords, {
            color: algoResult.color || 'magenta',
            weight: 4,
            opacity: 0.8
        });
        polyline.addTo(testRouteGroup);

        testMap.fitBounds(polyline.getBounds());
    }

    // If there is "ordered_points", draw markers
    if (algoResult.ordered_points && Array.isArray(algoResult.ordered_points)) {
        algoResult.ordered_points.forEach(function(pId, idx) {
            // Look up lat/lon in testSelectedPoints
            var sp = testSelectedPoints.find(x => x.id === pId.toString());
            if (!sp) return;
            // Color/icon
            var icon = L.divIcon({
                html: `<div style="background-color:${algoResult.color || 'magenta'};
                                   border:2px solid black;border-radius:50%;
                                   width:24px;height:24px;display:flex;
                                   align-items:center;justify-content:center;
                                   color:white; font-weight:bold;">${idx+1}</div>`,
                className: '',
                iconSize: [24,24],
                iconAnchor: [12,12]
            });
            var mark = L.marker([sp.lat, sp.lon], { icon: icon });
            mark.addTo(testRouteGroup);
        });
    }
}
