//
// File: src/app/static/js/test_interactions.js
//
// This file manages logic related to the test map (Test Mode):
//   - Load/Reset a test city (with a possible 5-second delay)
//   - Select random points (e.g., 5, 10, 15, 20)
//   - Run all algorithms in test mode
//   - Display TSP/VRP results on the testMap
//   - Some parts were moved to test_btn_interactions.js
//

/* Global variables for the test-map scenario */
var lastTestLoadedCity   = null;
var testSelectedMarkers  = [];
var testSelectedPoints   = [];
var showTestEdgesAndNodes= false; // "Show All Nodes" checkbox
var allAlgoResults       = [];
var currentAlgoIndex     = 0;
var routeColors          = ["purple","blue","green","red","orange","brown"];

// We hide the loading overlay initially
hideLoadingOverlay();

/** Clear all test-map layers */
function clearAllTestLayers() {
    testMarkersAutoGroup.clearLayers();
    testEdgeLayerGroup.clearLayers();
    testSelectedLayerGroup.clearLayers();
    testRouteGroup.clearLayers();
}

// Minimum load time for demonstration in test mode
var minLoadTimeMsTest = 5000; // 5 seconds

// Attach a dummy handler to "Run All Algos" when there's no data
function dummyAlgosHandler() {
    alert('Please select points again before running algorithms!');
}

// Real function to run all algorithms
function runAllAlgosTest() {
    showLoadingOverlay();
    fetch('/run_all_algos',{
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({})
    })
    .then(r=>r.json())
    .then(data=>{
        hideLoadingOverlay();
        if (data.status==='success') {
            allAlgoResults = data.results || [];
            currentAlgoIndex = 0;
            allAlgoResults.forEach((res,i)=>{
                res.color = routeColors[i % routeColors.length];
            });
            if (allAlgoResults.length>0) {
                showAlgoRouteTest(allAlgoResults[currentAlgoIndex]);
            } else {
                alert('No algorithms returned');
            }
        } else {
            alert('Error: '+ data.message);
        }
    })
    .catch(err=>{
        hideLoadingOverlay();
        console.error('Error runAllAlgosTest (test):', err);
        alert('An error occurred while running all algos (test).');
    });
}

/** Attach the real handler to "Run All Algos" button */
function attachRunAllAlgos() {
    const runAllAlgosBtn = document.getElementById('run-all-algos');
    if (!runAllAlgosBtn) return;

    // Remove dummy
    runAllAlgosBtn.removeEventListener('click', dummyAlgosHandler);
    // Remove any existing real
    runAllAlgosBtn.removeEventListener('click', runAllAlgosTest);

    // Attach real
    runAllAlgosBtn.addEventListener('click', runAllAlgosTest);
}

/** Detach the real handler from "Run All Algos" and attach dummy */
function detachRunAllAlgos() {
    const runAllAlgosBtn = document.getElementById('run-all-algos');
    if (!runAllAlgosBtn) return;

    runAllAlgosBtn.removeEventListener('click', runAllAlgosTest);
    runAllAlgosBtn.removeEventListener('click', dummyAlgosHandler);

    runAllAlgosBtn.addEventListener('click', dummyAlgosHandler);
}

// DOMContentLoaded logic for test mode
document.addEventListener('DOMContentLoaded', function() {

    // Add testSelectedLayerGroup and testRouteGroup to testMap if available
    if (typeof testMap !== 'undefined' && testMap) {
        testSelectedLayerGroup.addTo(testMap);
        testRouteGroup.addTo(testMap);
    }

    // Possibly hide the #clear-route button on the test-map
    var clearRouteBtn = document.getElementById('clear-route');
    if (clearRouteBtn) {
        clearRouteBtn.style.display = 'none';
    }

    // Buttons for selecting random points: 5,10,15,20
    var test5Btn  = document.getElementById('test-5');
    var test10Btn = document.getElementById('test-10');
    var test15Btn = document.getElementById('test-15');
    var test25Btn = document.getElementById('test-20');

    if (test5Btn)  test5Btn.addEventListener('click', () => selectRandomPointsTest(5));
    if (test10Btn) test10Btn.addEventListener('click', () => selectRandomPointsTest(10));
    if (test15Btn) test15Btn.addEventListener('click', () => selectRandomPointsTest(15));
    if (test25Btn) test25Btn.addEventListener('click', () => selectRandomPointsTest(20));

    // "Load City" in test mode
    var loadCityTestBtn = document.getElementById('load-city-test');
    if (loadCityTestBtn) {
        loadCityTestBtn.addEventListener('click', function(){
            var citySel = document.getElementById('city-select-test');
            if (!citySel) return alert('city-select-test not found!');
            var cityName = citySel.value;
            if (!cityName) return alert('Please select a city for test!');

            var loadStartTimeTest = Date.now();
            showLoadingOverlay();

            fetch('/load_city', {
                method:'POST',
                headers:{ 'Content-Type':'application/json' },
                body: JSON.stringify({ city: cityName })
            })
            .then(r=>r.json())
            .then(data=>{
                var elapsed = Date.now() - loadStartTimeTest;
                var remain = minLoadTimeMsTest - elapsed;

                function finishLoadProcessTest() {
                    if (data.status==='success') {
                        clearAllTestLayers();
                        testSelectedMarkers=[];
                        testSelectedPoints =[];
                        lastTestLoadedCity = cityName;
                        setTestMapCenter(cityName);
                        alert('City loaded for test: '+ cityName);
                    } else {
                        alert('Failed to load city (test).');
                    }
                }

                if (remain <= 0) {
                    hideLoadingOverlay();
                    finishLoadProcessTest();
                } else {
                    setTimeout(function(){
                        hideLoadingOverlay();
                        finishLoadProcessTest();
                    }, remain);
                }
            })
            .catch(err=>{
                console.error('Error load city (test):', err);
                var elapsed = Date.now() - loadStartTimeTest;
                var remain = minLoadTimeMsTest - elapsed;

                function finishLoadProcessTest() {
                    alert('Error load city (test).');
                }

                if (remain <= 0) {
                    hideLoadingOverlay();
                    finishLoadProcessTest();
                } else {
                    setTimeout(function(){
                        hideLoadingOverlay();
                        finishLoadProcessTest();
                    }, remain);
                }
            });
        });
    }

    // "Reset City" in test mode
    var resetCityTestBtn = document.getElementById('reset-city-test');
    if (resetCityTestBtn) {
        resetCityTestBtn.addEventListener('click', function(){
            showLoadingOverlay();
            fetch('/clear_selected_points',{
                method:'POST',
                headers:{ 'Content-Type':'application/json' }
            })
            .then(()=>{
                hideLoadingOverlay();
                clearAllTestLayers();
                testSelectedMarkers=[];
                testSelectedPoints =[];

                var c = lastTestLoadedCity || 'San Francisco';
                setTestMapCenter(c);
                alert('Test city was reset.');
            })
            .catch(err=>{
                hideLoadingOverlay();
                console.error('Error reset test city:', err);
                alert('Error reset test city');
            });
        });
    }

    // "Show All Nodes" checkbox
    var showAllNodesCheckbox = document.getElementById('show-all-nodes-test-checkbox');
    if (showAllNodesCheckbox) {
        showAllNodesCheckbox.checked = false;
        showTestEdgesAndNodes = false;
        showAllNodesCheckbox.addEventListener('change', function(){
            showTestEdgesAndNodes = this.checked;
            if (!showTestEdgesAndNodes) {
                testEdgeLayerGroup.clearLayers();
                testMarkersAutoGroup.clearLayers();
            } else {
                updateEdgesTest();
                updateNodesTest();
            }
        });
    }

    // "Run All Algos" in test mode
    attachRunAllAlgos(); // attach real by default

    // Next/Prev/Back in #test-route-info-panel
    var prevBtn = document.getElementById('test-route-prev');
    var nextBtn = document.getElementById('test-route-next');
    if (prevBtn) {
        prevBtn.style.display='none';
        prevBtn.addEventListener('click', function(){
            if (allAlgoResults.length<2) return;
            currentAlgoIndex = (currentAlgoIndex - 1 + allAlgoResults.length) % allAlgoResults.length;
            showAlgoRouteTest(allAlgoResults[currentAlgoIndex]);
        });
    }
    if (nextBtn) {
        nextBtn.style.display='none';
        nextBtn.addEventListener('click', function(){
            if (allAlgoResults.length<2) return;
            currentAlgoIndex = (currentAlgoIndex + 1) % allAlgoResults.length;
            showAlgoRouteTest(allAlgoResults[currentAlgoIndex]);
        });
    }

    var backBtn = document.getElementById('test-route-back');
    if (backBtn) {
      backBtn.addEventListener('click', function() {
        // 1) Clear the route from the map
        testRouteGroup.clearLayers();

        // 2) Hide the legend
        var legendTest = document.getElementById('legend-test');
        if (legendTest) legendTest.style.display = 'none';
        isRouteDisplayed = false;

        // 3) Hide the "Route Information" panel
        var infoPanel = document.getElementById('test-route-info-panel');
        if (infoPanel) infoPanel.style.display = 'none';

        // 4) Clear selected points (markers)
        testSelectedLayerGroup.clearLayers();
        testSelectedMarkers = [];
        testSelectedPoints  = [];

        // 5) Clear the "Selected Points" list in the sidebar
        var ul = document.getElementById('selected-points-list-test');
        if (ul) ul.innerHTML = '';

        // 6) Reset any algorithmic results
        if (typeof allAlgoResults !== 'undefined') {
          allAlgoResults = [];
        }
        if (typeof currentAlgoIndex !== 'undefined') {
          currentAlgoIndex = 0;
        }
        if (typeof window._batchResults !== 'undefined') {
          window._batchResults = [];
        }

        // 7) Detach the real "Run All Algos" and attach a dummy
        detachRunAllAlgos();

        // 8) Hide the bottom panel if needed
        var bottomPanel = document.getElementById('bottom-panel');
        if (bottomPanel) bottomPanel.style.display = 'none';

        // 9) Hide the "Back" button itself
        backBtn.style.display = 'none';
      });
    }

    var bottomPanel = document.getElementById('bottom-panel');
    if (bottomPanel) {
        bottomPanel.style.display = 'flex';
    }

    // "Close" button in #batch-results-menu
    const closeBtn = document.getElementById('batch-panel-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        const batchMenu = document.getElementById('batch-results-menu');
        if (batchMenu) {
          batchMenu.style.display = 'none'; 
        }
      });
    }
});

/**
 * selectRandomPointsTest(count) - randomly selects 'count' points and adds them on the test map
 */
function selectRandomPointsTest(count) {
    showLoadingOverlay();
    fetch('/select_random_points',{
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ count })
    })
    .then(r=>r.json())
    .then(data=>{
        hideLoadingOverlay();
        if (data.status==='success') {
            clearAllTestLayers();
            testSelectedMarkers=[];
            testSelectedPoints =[];

            data.points.forEach((p, idx)=>{
                var color = (idx===0) ? 'green' : 'orange';
                var fillc = (idx===0) ? 'lime'  : 'yellow';
                var icon = L.divIcon({
                    html: `<div style="border:1px solid ${color}; background-color:${fillc};
                                   border-radius:50%; width:16px; height:16px;"></div>`,
                    className:'', iconSize:[16,16], iconAnchor:[8,8]
                });
                var marker = L.marker([p.lat, p.lon], { icon });
                marker.nodeId = p.id.toString();
                marker.addTo(testSelectedLayerGroup);

                testSelectedMarkers.push(marker);
                testSelectedPoints.push({
                    id:p.id.toString(),
                    lat:p.lat,
                    lon:p.lon,
                    marker
                });
            });
            updateSelectedPointsListTest();
        } else {
            alert('Error: ' + (data.message || 'no message'));
        }
    })
    .catch(err=>{
        hideLoadingOverlay();
        console.error('Error selecting random points (test):', err);
        alert('Error selecting random points (test).');
    });
}

/** Updates the sidebar list of selected test points */
function updateSelectedPointsListTest() {
    var ul = document.getElementById('selected-points-list-test');
    if (!ul) return;
    ul.innerHTML='';
    testSelectedPoints.forEach((p) => {
        var li = document.createElement('li');
        li.textContent = `ID:${p.id}, Lat:${p.lat.toFixed(5)}, Lon:${p.lon.toFixed(5)}`;
        ul.appendChild(li);
    });
}

/** setTestMapCenter(cityName) - set the test map center based on known city coords */
function setTestMapCenter(cityName) {
    var cityCenters = {
        'San Francisco': [37.7749, -122.4194],
        'Los Angeles':   [34.0522, -118.2437],
        'New York':      [40.7128, -74.0060],
        'Wroclaw':       [51.1078852, 17.0385376]
    };
    var center = cityCenters[cityName] || [37.7749, -122.4194];
    if (typeof testMap !== 'undefined') {
        testMap.setView(center, 13);
    }
}

/** Example function to draw TSP route on testMap */
function drawTSPTest(algoResult) {
    let mainColor = algoResult.color || 'purple';

    // Main route line
    if (algoResult.main_route_coordinates && algoResult.main_route_coordinates.length > 1) {
        let poly = L.polyline(algoResult.main_route_coordinates, {
            color: mainColor, weight:4, opacity:0.8
        });
        poly.addTo(testRouteGroup);
    }
    // Return route line
    if (algoResult.return_route_coordinates && algoResult.return_route_coordinates.length > 1) {
        let ret = L.polyline(algoResult.return_route_coordinates, {
            color: 'black', weight:4, opacity:0.8, dashArray:'10,10'
        });
        ret.addTo(testRouteGroup);
    }
    // Markers for ordered points
    if (algoResult.ordered_points_coords && algoResult.ordered_points_coords.length > 0) {
        algoResult.ordered_points_coords.forEach((pt, idx) => {
            let c = (idx === 0) ? 'green' : 'orange';
            let f = (idx === 0) ? 'lime'  : 'yellow';
            let iconHtml = `<div style="border:1px solid ${c}; background-color:${f};
                             border-radius:50%; width:24px; height:24px;
                             display:flex; align-items:center; justify-content:center;
                             font-weight:bold;">${idx+1}</div>`;
            let icon = L.divIcon({
                html: iconHtml, className:'', iconSize:[24,24], iconAnchor:[12,12]
            });
            L.marker([pt.lat, pt.lon], { icon }).addTo(testRouteGroup);
        });
    }
    else if (algoResult.ordered_points) {
        algoResult.ordered_points.forEach(function(nid, idx){
            let sp = testSelectedPoints.find(x => x.id === nid.toString());
            if (!sp) return;
            let c = (idx===0) ? 'green' : 'orange';
            let f = (idx===0) ? 'lime'  : 'yellow';
            let iconHtml = `<div style="border:1px solid ${c}; background-color:${f};
                             border-radius:50%; width:24px; height:24px; 
                             display:flex; align-items:center; justify-content:center;
                             font-weight:bold;">${idx+1}</div>`;
            let icon = L.divIcon({
                html: iconHtml, className:'', iconSize:[24,24], iconAnchor:[12,12]
            });
            L.marker([sp.lat, sp.lon], { icon }).addTo(testRouteGroup);
        });
    }
    // Fit map to the route bounds
    let coordsAll = [];
    if (algoResult.main_route_coordinates) {
        coordsAll = coordsAll.concat(algoResult.main_route_coordinates);
    }
    if (algoResult.return_route_coordinates) {
        coordsAll = coordsAll.concat(algoResult.return_route_coordinates);
    }
    if (coordsAll.length>1 && typeof testMap !== 'undefined') {
        testMap.fitBounds(L.latLngBounds(coordsAll));
    }
}

/** Example function to draw VRP routes on testMap */
function drawVRPTest(algoResult) {
    let allC = [];
    algoResult.vrp_routes.forEach(function(rObj, i){
        let col = rObj.color || algoResult.color || 'magenta';
        let pol = L.polyline(rObj.coordinates, { color:col, weight:4, opacity:0.8 });
        pol.addTo(testRouteGroup);
        allC = allC.concat(rObj.coordinates);

        rObj.ordered_points.forEach(function(nid, idx){
            let sp = testSelectedPoints.find(x => x.id === nid.toString());
            if (!sp) return;
            let iconHtml = `<div style="border:2px solid black; background-color:${col};
                             border-radius:50%; width:24px; height:24px; color:white; 
                             display:flex; align-items:center; justify-content:center; 
                             font-weight:bold;">${idx+1}</div>`;
            let icon = L.divIcon({
                html: iconHtml, className:'', iconSize:[24,24], iconAnchor:[12,12]
            });
            L.marker([sp.lat, sp.lon], { icon }).addTo(testRouteGroup);
        });
    });
    if (allC.length>1 && typeof testMap!=='undefined') {
        testMap.fitBounds(L.latLngBounds(allC));
    }
}

/** Update the info panel for a route in test mode */
function updateTestRouteInfoPanel(algoResult) {
    var panel    = document.getElementById('test-route-info-panel');
    var algoName = document.getElementById('test-route-algo-name');
    var distEl   = document.getElementById('test-route-distance');
    var timeEl   = document.getElementById('test-route-time');
    var orderEl  = document.getElementById('test-route-order');
    var prevBtn  = document.getElementById('test-route-prev');
    var nextBtn  = document.getElementById('test-route-next');

    if (!panel) return;
    panel.style.display='block';

    if (algoName && algoResult.algorithm) algoName.textContent = algoResult.algorithm;
    let distVal = parseFloat(algoResult.total_distance) || parseFloat(algoResult.distance) || 0;
    if (distEl) {
        distEl.textContent = 'Total distance: ' + (distVal / 1000).toFixed(2) + ' km';
    }
    var timeVal = parseFloat(algoResult.time) || 0;
    if (timeEl) {
        timeEl.textContent = 'Estimated time: ' + timeVal.toFixed(1) + ' min';
    }

    if (orderEl) {
        orderEl.innerHTML='';
        if (algoResult.ordered_points_coords && algoResult.ordered_points_coords.length > 0) {
            algoResult.ordered_points_coords.forEach((pt, i) => {
                let li = document.createElement('li');
                li.textContent = `Point ${i+1}: ID ${pt.id}`;
                orderEl.appendChild(li);
            });
        } else if (algoResult.ordered_points) {
            // TSP scenario
            algoResult.ordered_points.forEach(function(nid, idx){
                let sp = testSelectedPoints.find(x => x.id === nid.toString());
                if (!sp) return;
                let li = document.createElement('li');
                li.textContent = `Point ${idx+1}: ID ${sp.id}`;
                orderEl.appendChild(li);
            });
        } else if (algoResult.vrp_routes) {
            // VRP scenario
            let li = document.createElement('li');
            li.textContent = '(VRP) multiple routes...';
            orderEl.appendChild(li);
        }
    }

    if (allAlgoResults.length > 1) {
        if (prevBtn) prevBtn.style.display='inline-block';
        if (nextBtn) nextBtn.style.display='inline-block';
    } else {
        if (prevBtn) prevBtn.style.display='none';
        if (nextBtn) nextBtn.style.display='none';
    }
}

/** Show a basic legend for TSP on the test map */
function showLegendTest(color) {
    var legendDiv  = document.getElementById('legend-test');
    var legendList = document.getElementById('legend-test-list');
    if (!legendDiv || !legendList) return;
    legendDiv.style.display='block';
    legendList.innerHTML='';

    let mainCol = color || 'purple';
    let liMain = document.createElement('li');
    liMain.innerHTML= `
        <span style="display:inline-block; width:20px; height:4px;
                     background-color:${mainCol}; margin-right:5px;"></span>
        Main Route (${mainCol})
    `;
    legendList.appendChild(liMain);

    let liRet = document.createElement('li');
    liRet.innerHTML = `
        <span style="display:inline-block; width:20px; height:4px;
                     border-top:2px dashed black; margin-right:5px;"></span>
        Return Path (black, dashed)
    `;
    legendList.appendChild(liRet);

    let liPts = document.createElement('li');
    liPts.innerHTML = `
        <span style="display:inline-block; width:12px; height:12px;
                     border-radius:50%; border:1px solid orange;
                     background-color:yellow; margin-right:5px;"></span>
        Ordered Points
    `;
    legendList.appendChild(liPts);
}
