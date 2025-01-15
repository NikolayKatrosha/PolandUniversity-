// File: src/app/static/js/map_interactions.js
// -------------------------------------
// Logic related to the main map:
//  - Load/Reset City
//  - Select/Deselect points
//  - Calculate TSP/VRP
//  - Toggle neighbors display
//  - Address search (geocoding)
// -------------------------------------

// Global variables for the main map
var lastLoadedCity   = null;
var currentProblemMode = 'TSP';
var showNeighbors    = false; 
var selectedMarkers  = [];
var selectedPoints   = [];
var isRouteDisplayed = false;

/** 
 * 5-second wait for city loading demonstration
 */
var minLoadTimeMs = 5000; // 5000 ms
var loadStartTime = 0;    // stores the load start time

// Example algorithm lists
var tspAlgos = [
  'Christofides Algorithm',
  'Greedy Algorithm',
  'Nearest Neighbor',
  'Simulated Annealing',
  '2-opt Heuristic',
  'Brute Force'
];
var vrpAlgos = [
  'Clarke & Wright Savings'
];

// Switch handlers for TSP / VRP:
function updateAlgorithmList() {
    var algoSelect   = document.getElementById('algorithm-select');
    var numTrucksSel = document.getElementById('num-trucks');
    var problemTSP   = document.getElementById('problem-tsp');
    var problemVRP   = document.getElementById('problem-vrp');

    if (!algoSelect || !problemTSP || !problemVRP) return;
    algoSelect.innerHTML = '';

    if (problemTSP.checked) {
        currentProblemMode = 'TSP';
        if (numTrucksSel) numTrucksSel.style.display = 'none';
        tspAlgos.forEach(function(algo) {
            var opt = document.createElement('option');
            opt.value = algo;
            opt.textContent = algo;
            algoSelect.appendChild(opt);
        });
    } else if (problemVRP.checked) {
        currentProblemMode = 'VRP';
        if (numTrucksSel) numTrucksSel.style.display = 'inline-block';
        vrpAlgos.forEach(function(algo) {
            var opt = document.createElement('option');
            opt.value = algo;
            opt.textContent = algo;
            algoSelect.appendChild(opt);
        });
    }
}

// ============= "Load City" button =============
var loadCityBtn = document.getElementById('load-city');
if (loadCityBtn) {
    loadCityBtn.addEventListener('click', function() {
        var citySel = document.getElementById('city-select');
        if (!citySel) return alert('City select not found!');
        var cityName = citySel.value;
        if (!cityName) return alert('Please select a city.');

        // Mark the start time of loading
        loadStartTime = Date.now();
        showLoadingOverlay();

        fetch('/load_city', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city: cityName })
        })
        .then(r => r.json())
        .then(data => {
            // Elapsed time
            var elapsed = Date.now() - loadStartTime;
            var remain = minLoadTimeMs - elapsed;

            // Function to call after the minimum wait time has passed
            function finishLoadProcess() {
                if (data.status === 'success') {
                    lastLoadedCity = cityName;
                    clearAllLayers();
                    selectedMarkers = [];
                    selectedPoints  = [];
                    updateSelectedPoints();

                    setMapCenter(cityName);
                    updateEdges(); 
                    updateNodes();
                    restoreInterface();
                } else {
                    alert(data.message || 'Failed to load city');
                }
            }

            // If less than 5 seconds passed, wait the remaining time
            if (remain <= 0) {
                hideLoadingOverlay();
                finishLoadProcess();
            } else {
                setTimeout(function() {
                    hideLoadingOverlay();
                    finishLoadProcess();
                }, remain);
            }
        })
        .catch(err => {
            console.error('Error load city:', err);
            alert('An error occurred while loading city.');

            var elapsed = Date.now() - loadStartTime;
            var remain = minLoadTimeMs - elapsed;
            if (remain <= 0) {
                hideLoadingOverlay();
            } else {
                setTimeout(function(){
                    hideLoadingOverlay();
                }, remain);
            }
        });
    });
}

// ============= "Reset City" button =============
var resetCityBtn = document.getElementById('reset-city');
if (resetCityBtn) {
    resetCityBtn.addEventListener('click', function() {
        showLoadingOverlay();
        fetch('/clear_selected_points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(() => {
            hideLoadingOverlay();
            clearAllLayers();
            selectedMarkers = [];
            selectedPoints  = [];

            var cityToCenter = lastLoadedCity || 'San Francisco';
            setMapCenter(cityToCenter);
            updateEdges();
            updateNodes();
            updateSelectedPoints();
            restoreInterface();
        })
        .catch(err => {
            hideLoadingOverlay();
            console.error('Error resetting city:', err);
            alert('An error occurred while resetting the city.');
        });
    });
}

// ============= "Show Neighbors" button =============
var toggleNeighborsBtn = document.getElementById('toggle-neighbors');
if (toggleNeighborsBtn) {
    toggleNeighborsBtn.addEventListener('click', function() {
        showNeighbors = !showNeighbors;
        if (showNeighbors) {
            this.textContent = 'Hide Neighbors';
            if (selectedMarkers.length > 0) {
                var lastNodeId = selectedMarkers[selectedMarkers.length - 1].nodeId;
                highlightNeighbors(lastNodeId); 
            }
        } else {
            this.textContent = 'Show Neighbors';
            neighborLayerGroup.clearLayers();
        }
    });
}

// ============= selectPoint (on node click) =============
function selectPoint(id, lat, lon) {
    if (isRouteDisplayed) return; // Disallow selection if a route is displayed
    fetch('/select_point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, lat, lon })
    })
    .then(r => r.json())
    .then(data => {
        if (data.status === 'success') {
            if (data.warning) alert(data.warning);

            // Create a divIcon
            var isFirst = (selectedMarkers.length === 0);
            var c = isFirst ? 'green' : 'orange';
            var f = isFirst ? 'lime'  : 'yellow';

            var iconHtml = `<div style="border:1px solid ${c}; background-color:${f};
                             border-radius:50%; width:16px; height:16px;"></div>`;
            var icon = L.divIcon({
                html: iconHtml, className: '', iconSize:[16,16], iconAnchor:[8,8]
            });
            var marker = L.marker([lat, lon], { icon: icon, zIndexOffset:2000 });
            marker.nodeId = id.toString();
            marker.bindPopup('Selected Node ID: ' + id);
            marker.addTo(selectedLayerGroup);

            selectedMarkers.push(marker);
            selectedPoints.push({ id: id.toString(), lat, lon, marker });

            // Double-click on marker => deselect
            marker.on('dblclick', function() {
                deselectPoint(id);
            });

            updateSelectedPoints();
            if (showNeighbors) highlightNeighbors(id);
        } else {
            alert(data.message);
        }
    })
    .catch(err => {
        console.error('Error selecting point:', err);
        alert('An error occurred while selecting the point.');
    });
}

// ============= deselectPoint =============
function deselectPoint(id) {
    fetch('/deselect_point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    })
    .then(r => r.json())
    .then(data => {
        if (data.status === 'success') {
            var idx = selectedMarkers.findIndex(m => m.nodeId === id.toString());
            if (idx !== -1) {
                selectedLayerGroup.removeLayer(selectedMarkers[idx]);
                selectedMarkers.splice(idx,1);
                selectedPoints.splice(idx,1);
            }
            updateSelectedPoints();

            if (showNeighbors && selectedMarkers.length>0) {
                highlightNeighbors(selectedMarkers[selectedMarkers.length - 1].nodeId);
            } else {
                neighborLayerGroup.clearLayers();
            }
        } else {
            alert(data.message);
        }
    })
    .catch(err => {
        console.error('Error deselecting point:', err);
        alert('An error occurred while deselecting the point.');
    });
}

// ============= Update the list of selected points (sidebar) =============
function updateSelectedPoints() {
    fetch('/get_selected_points')
    .then(r => r.json())
    .then(points => {
        var list = document.getElementById('selected-points-list');
        if (!list) return;
        list.innerHTML = '';
        points.forEach(function(p) {
            var li = document.createElement('li');
            li.textContent = `ID:${p.id}, Lat:${parseFloat(p.lat).toFixed(5)}, Lon:${parseFloat(p.lon).toFixed(5)}`;
            
            var btn = document.createElement('button');
            btn.textContent = 'Remove';
            btn.style.marginLeft = '10px';
            btn.addEventListener('click', function(){
                deselectPoint(p.id);
            });
            li.appendChild(btn);

            list.appendChild(li);
        });
    })
    .catch(err => console.error('Error updating selected points:', err));
}

// ============= Highlight neighbors =============
function highlightNeighbors(nodeId) {
    neighborLayerGroup.clearLayers();
    if (!showNeighbors) return;
    fetch('/get_neighbors', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ id: nodeId })
    })
    .then(r=>r.json())
    .then(neighbors => {
        neighbors.forEach(nbr => {
            var mk = L.circleMarker([nbr.lat, nbr.lon], {
                radius: 6, color: 'green', fillColor: 'lightgreen', fillOpacity:1
            });
            mk.bindPopup(`Distance: ${nbr.distance.toFixed(2)} m`);
            neighborLayerGroup.addLayer(mk);
        });
    })
    .catch(err => console.error('Error fetching neighbors:', err));
}

// ============= "Calculate Route" button =============
var calcRouteBtn = document.getElementById('calculate-route');
if (calcRouteBtn) {
    calcRouteBtn.addEventListener('click', function() {
        if (selectedMarkers.length < 2) {
            alert('Select at least two points!');
            return;
        }
        if (selectedMarkers.length > 50) {
            alert('Maximum 50 points allowed!');
            return;
        }

        // Show the "Back" button
        var clearRouteBtn = document.getElementById('clear-route');
        if (clearRouteBtn) clearRouteBtn.style.display = 'block';

        var nodeIds = selectedMarkers.map(m => m.nodeId);
        var algoSel = document.getElementById('algorithm-select');
        var algorithm = (algoSel && algoSel.value) ? algoSel.value : 'Christofides Algorithm';

        var problemTSP = document.getElementById('problem-tsp');
        var problemVRP = document.getElementById('problem-vrp');
        var numTrSel   = document.getElementById('num-trucks');
        var num_trucks = 1;
        if (problemVRP && problemVRP.checked && numTrSel) {
            num_trucks = parseInt(numTrSel.value,10) || 1;
        }

        showLoadingOverlay();
        fetch('/calculate_route', {
            method:'POST',
            headers:{ 'Content-Type':'application/json' },
            body: JSON.stringify({ node_ids: nodeIds, algorithm, num_trucks })
        })
        .then(r => r.json())
        .then(data => {
            hideLoadingOverlay();
            if (data.status === 'success') {
                if (data.warnings) data.warnings.forEach(w => alert(w));
                hideInterface(); 
                isRouteDisplayed = true;

                routeLayerGroup.clearLayers();
                selectedLayerGroup.clearLayers();

                if (data.vrp_routes) {
                    currentProblemMode = 'VRP';
                    // Draw VRP routes
                    drawVRPOnMap(data);
                } else {
                    currentProblemMode = 'TSP';
                    drawTSPOnMap(data);
                }

                // IMPORTANT: Show the legend on the main map
                showLegendMainMap();

            } else {
                alert('Error calculating route: ' + data.message);
            }
        })
        .catch(err => {
            console.error('Error calculating route:', err);
            hideLoadingOverlay();
            alert('An error occurred while calculating the route.');
        });
    });
}

// ============= "Back" button (clear-route) =============
var clearRouteBtn = document.getElementById('clear-route');
if (clearRouteBtn) {
    clearRouteBtn.addEventListener('click', function() {
        routeLayerGroup.clearLayers();
        selectedLayerGroup.clearLayers();
        selectedMarkers = [];
        selectedPoints  = [];
        var legendEl = document.getElementById('legend');
        if (legendEl) {
            legendEl.style.display = 'none';            
            legendEl.classList.remove('legend-icon');
        }
        fetch('/clear_selected_points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(() => {
            restoreInterface();
            updateSelectedPoints();
            if (legendEl) {
                legendEl.innerHTML = `<h4>Route Legend</h4><ul><li>
                      <span class="legend-line" style="background-color: purple;"></span>
                      Main Route</li><li>
                      <span class="legend-dashed-line" style="border-top: 2px dashed black;"></span>
                      Return Path</li><li>
                      <span class="legend-icon" style="background-color: white; border:1px solid black;">1</span>
                      Point Order</li></ul>`;
            }
        })
        .catch(err => {
            console.error('Error clearing route:', err);
            alert('An error occurred while clearing the route.');
        });
    });
}

// ============= Address search (geocoding) =============
var searchBtn = document.getElementById('search-button');
if (searchBtn) {
    searchBtn.addEventListener('click', function() {
        var addressInput = document.getElementById('search-input');
        if (!addressInput) return alert('Search input not found.');
        var address = addressInput.value;
        if (!address) return alert('Please enter an address.');

        showLoadingOverlay();
        fetch('/geocode', {
            method:'POST',
            headers:{ 'Content-Type':'application/json' },
            body: JSON.stringify({ address })
        })
        .then(r => r.json())
        .then(data => {
            hideLoadingOverlay();
            if (data.error) {
                alert(data.error);
            } else {
                map.setView([data.lat, data.lon], 15);
            }
        })
        .catch(err => {
            hideLoadingOverlay();
            console.error('Error geocoding address:', err);
            alert('An error occurred while geocoding the address.');
        });
    });
}

// ============= Functions for drawing routes =============
function drawVRPOnMap(data) {
    // data.vrp_routes = [ { truck_id, color, coordinates, ordered_points }, ... ]
    let allCoords = [];
    data.vrp_routes.forEach(routeObj => {
        var pl = L.polyline(routeObj.coordinates, {
            color: routeObj.color || 'purple',
            weight: 4,
            opacity: 0.8
        });
        pl.addTo(routeLayerGroup);
        allCoords = allCoords.concat(routeObj.coordinates);

        // Markers for VRP route
        routeObj.ordered_points.forEach((nid, idx) => {
            var sp = selectedPoints.find(sp => sp.id === nid.toString());
            if (!sp) return;
            var iconHtml = `<div style="background-color:${routeObj.color || 'purple'};
                               border:2px solid black; border-radius:50%;
                               width:32px; height:32px; display:flex; align-items:center; 
                               justify-content:center; color:#fff; font-weight:bold;">
                               ${idx+1}</div>`;
            var markerIcon = L.divIcon({
                html: iconHtml, className:'', iconSize:[32,32], iconAnchor:[16,16]
            });
            L.marker([sp.lat, sp.lon], { icon: markerIcon }).addTo(routeLayerGroup);
        });
    });
    if (allCoords.length>1) {
        var bounds = L.latLngBounds(allCoords);
        map.fitBounds(bounds);
    }

    var routeInfo = document.getElementById('route-info');
    if (routeInfo) {
        routeInfo.style.display = 'block';
        document.getElementById('route-distance').textContent = 
          'Total distance: ' + (data.total_distance / 1000).toFixed(2) + ' km';
        document.getElementById('route-time').textContent =
          'Estimated travel time: ' + data.travel_time.toFixed(1) + ' minutes';

        // Truck route listing
        var ul = document.getElementById('route-order-list');
        ul.innerHTML = '';
        data.vrp_routes.forEach(rObj => {
            var li = document.createElement('li');
            li.textContent = `Truck ${rObj.truck_id} route: ${rObj.ordered_points.join(', ')}`;
            ul.appendChild(li);
        });
    }
}

function drawTSPOnMap(data) {
    var mainCoords   = data.main_route_coordinates;
    var returnCoords = data.return_route_coordinates;

    var mainLine = L.polyline(mainCoords, {
        color: 'purple', weight:4, opacity:0.8
    });
    mainLine.addTo(routeLayerGroup);

    var retLine  = L.polyline(returnCoords, {
        color: 'black', weight:4, opacity:0.8, dashArray:'10,10'
    });
    retLine.addTo(routeLayerGroup);

    var full = mainCoords.concat(returnCoords);
    if (full.length>1) {
        var bounds = L.latLngBounds(full);
        map.fitBounds(bounds);
    }

    data.ordered_points.forEach((nid, idx) => {
        var sp = selectedPoints.find(sp => sp.id === nid.toString());
        if (!sp) return;
        var c = (idx === 0) ? 'green' : 'orange';
        var f = (idx === 0) ? 'lime'  : 'yellow';
        var iconHtml = `<div style="border:1px solid ${c}; background-color:${f};
                         border-radius:50%; width:24px; height:24px; 
                         display:flex;align-items:center;justify-content:center; 
                         font-weight:bold;">${idx+1}</div>`;
        var icon = L.divIcon({ html:iconHtml, className:'', iconSize:[24,24], iconAnchor:[12,12] });
        L.marker([sp.lat, sp.lon], { icon: icon }).addTo(routeLayerGroup);
    });

    var routeInfo = document.getElementById('route-info');
    if (routeInfo) {
        routeInfo.style.display = 'block';
        document.getElementById('route-distance').textContent =
          'Total distance: ' + (data.total_distance/1000).toFixed(2) + ' km';
        document.getElementById('route-time').textContent =
          'Estimated travel time: ' + data.travel_time.toFixed(1) + ' minutes';

        var ul = document.getElementById('route-order-list');
        ul.innerHTML = '';
        data.ordered_points.forEach((nid, i) => {
            var sp = selectedPoints.find(x => x.id === nid.toString());
            if (!sp) return;
            var li = document.createElement('li');
            li.textContent = `Point ${i+1}: ID ${sp.id}`;
            ul.appendChild(li);
        });
    }
}

// ============= Show the legend (main map) =============
function showLegendMainMap() {
    var legend = document.getElementById('legend');
    if (legend) {
        legend.style.display = 'block';
    }
}

// Link TSP/VRP radio buttons to updateAlgorithmList()
var problemTSP = document.getElementById('problem-tsp');
var problemVRP = document.getElementById('problem-vrp');
if (problemTSP && problemVRP) {
    problemTSP.addEventListener('change', updateAlgorithmList);
    problemVRP.addEventListener('change', updateAlgorithmList);
}

// Invoke immediately on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function(){
    updateAlgorithmList();
});
