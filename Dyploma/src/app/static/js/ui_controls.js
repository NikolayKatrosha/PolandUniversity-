//
// File: src/app/static/js/ui_controls.js
//
// This file handles UI logic: page switching (map / about-author / about-project / test),
// showing/hiding side panels, menus, loading overlays, etc.
//

// Global variables (example)
var currentProblemMode = 'TSP'; // or 'VRP'
var vrpRoutes = []; // VRP routes array, for example: [{ truckId, color, coords }]

// Show/hide content sections
function showContent(section) {
    var contentMap = document.getElementById('content-map');
    var contentAboutAuthor = document.getElementById('content-about-author');
    var contentAboutProject = document.getElementById('content-about-project');
    var contentTest = document.getElementById('content-test');

    // Hide everything first
    if (contentMap) contentMap.style.display = 'none';
    if (contentAboutAuthor) contentAboutAuthor.style.display = 'none';
    if (contentAboutProject) contentAboutProject.style.display = 'none';
    if (contentTest) contentTest.style.display = 'none';

    // Now show the selected section
    if (section === 'map' && contentMap) {
        contentMap.style.display = 'block';
        showMenu();
    } else if (section === 'about-project' && contentAboutProject) {
        contentAboutProject.style.display = 'block';
        showMenu();
    } else if (section === 'about-author' && contentAboutAuthor) {
        contentAboutAuthor.style.display = 'block';
        showMenu();
    } else if (section === 'test' && contentTest) {
        contentTest.style.display = 'block';
        showMenu();
        // If we have testMap, we can invalidate its size so it displays properly
        if (typeof testMap !== 'undefined' && testMap) {
            setTimeout(function(){
                testMap.invalidateSize();
            }, 100);
        }
    }
}

// Hide the main navigation menu
function hideMenu() {
    var nav = document.querySelector('nav');
    if (nav) nav.style.display = 'none';
}

// Show the main navigation menu
function showMenu() {
    var nav = document.querySelector('nav');
    if (nav) nav.style.display = 'block';
}

/**
 * Hide various interface elements (like a sidebar) when the route is displayed.
 * This can help create a cleaner layout once the route is generated.
 */
function hideInterface() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.display = 'none';

    // If the current mode is TSP
    if (currentProblemMode === 'TSP') {
        // Clear certain layers if needed
        edgeLayerGroup.clearLayers();
        markersClusterGroup.clearLayers();
        neighborLayerGroup.clearLayers();
        selectedLayerGroup.clearLayers();

        // Notice: we do NOT clear routeLayerGroup here, so the route remains visible
        // routeLayerGroup.clearLayers(); // Removed to keep the route visible
    } else {
        // VRP: we could decide to clear or not clear
    }

    // Mark that the route is displayed
    isRouteDisplayed = true;

    // Show the "Back" (clear-route) button
    var clearRouteButton = document.getElementById('clear-route');
    if (clearRouteButton) clearRouteButton.style.display = 'block';
}

/**
 * Restore interface elements after we reset or go back
 */
function restoreInterface() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.display = 'block';

    var clearRouteButton = document.getElementById('clear-route');
    if (clearRouteButton) clearRouteButton.style.display = 'none';

    var routeInfo = document.getElementById('route-info');
    if (routeInfo) routeInfo.style.display = 'none';

    isRouteDisplayed = false;

    // If TSP, we can reload edges/nodes
    if (currentProblemMode === 'TSP') {
        updateEdges();
        updateNodes();
    } else {
        // VRP scenario, if needed
    }

    updateLegend();
}

// Show the loading overlay
function showLoadingOverlay() {
    var loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'block';
}

// Hide the loading overlay
function hideLoadingOverlay() {
    var loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

/**
 * Clear all layers: edges, markers, neighbors, selected points, route
 */
function clearAllLayers() {
    edgeLayerGroup.clearLayers();
    markersClusterGroup.clearLayers();
    neighborLayerGroup.clearLayers();
    selectedLayerGroup.clearLayers();
    routeLayerGroup.clearLayers();
}

/**
 * Update the legend in the bottom-right corner, or hide it.
 * This depends on whether a route is displayed and the problem mode (TSP/VRP).
 */
function updateLegend() {
    var legend = document.getElementById('legend');
    if (!legend) return;

    legend.style.display = 'none';
    legend.innerHTML = '';

    // If no route is displayed, no legend
    if (!isRouteDisplayed) {
        return;
    }

    if (currentProblemMode === 'TSP') {
        legend.style.display = 'block';
        var h4 = document.createElement('h4');
        h4.textContent = 'Route Legend';
        legend.appendChild(h4);

        var ul = document.createElement('ul');

        var liMain = document.createElement('li');
        var lineMain = document.createElement('span');
        lineMain.className = 'legend-line';
        lineMain.style.backgroundColor = 'purple';
        liMain.appendChild(lineMain);
        liMain.appendChild(document.createTextNode(' Main Route'));
        ul.appendChild(liMain);

        var liReturn = document.createElement('li');
        var lineReturn = document.createElement('span');
        lineReturn.className = 'legend-dashed-line';
        liReturn.appendChild(lineReturn);
        liReturn.appendChild(document.createTextNode(' Return Path'));
        ul.appendChild(liReturn);

        var liPoints = document.createElement('li');
        var iconPoint = document.createElement('span');
        iconPoint.className = 'legend-icon';
        iconPoint.style.backgroundColor = 'white';
        iconPoint.style.border = '1px solid black';
        iconPoint.textContent = '1';
        liPoints.appendChild(iconPoint);
        liPoints.appendChild(document.createTextNode(' Point Order'));
        ul.appendChild(liPoints);

        legend.appendChild(ul);

    } else if (currentProblemMode === 'VRP') {
        // If we have vrpRoutes, we could display them in the legend
        if (vrpRoutes.length > 0) {
            legend.style.display = 'block';
            var h4v = document.createElement('h4');
            h4v.textContent = 'VRP Routes';
            legend.appendChild(h4v);

            var ulv = document.createElement('ul');
            vrpRoutes.forEach(function(route) {
                var li = document.createElement('li');
                var line = document.createElement('span');
                line.className = 'legend-line';
                line.style.backgroundColor = route.color || 'purple';
                li.appendChild(line);
                li.appendChild(document.createTextNode(' Truck ' + route.truckId));
                ulv.appendChild(li);
            });
            legend.appendChild(ulv);
        }
    }
}

// Navigation menu links
var menuMap = document.getElementById('menu-map');
var menuAboutProject = document.getElementById('menu-about-project');
var menuAboutAuthor = document.getElementById('menu-about-author');
var menuTest = document.getElementById('menu-test');

if (menuMap) {
    menuMap.addEventListener('click', function(event) {
        event.preventDefault();
        showContent('map');
    });
}
if (menuAboutProject) {
    menuAboutProject.addEventListener('click', function(event) {
        event.preventDefault();
        showContent('about-project');
    });
}
if (menuAboutAuthor) {
    menuAboutAuthor.addEventListener('click', function(event) {
        event.preventDefault();
        showContent('about-author');
    });
}
if (menuTest) {
    menuTest.addEventListener('click', function(event) {
        event.preventDefault();
        showContent('test');
    });
}

// Document ready for an author page animation
document.addEventListener('DOMContentLoaded', function () {
    var aboutAuthorContent = document.getElementById('content-about-author');
    
    if (aboutAuthorContent) {
        var button = aboutAuthorContent.querySelector('.glowing-btn');
        var authorButtonContainer = document.getElementById('author-button-container');
        var authorInfo = document.getElementById('author-info');
        var cat = aboutAuthorContent.querySelector('.cat');

        if (button) {
            button.addEventListener('click', function () {
                authorButtonContainer.classList.remove('glow-active');
                void authorButtonContainer.offsetWidth;
                authorButtonContainer.classList.add('hide');

                authorButtonContainer.addEventListener('transitionend', function onTransitionEnd() {
                    authorButtonContainer.removeEventListener('transitionend', onTransitionEnd);
                    authorButtonContainer.style.display = 'none'; 
                    authorInfo.style.display = 'block';
                    setTimeout(function() {
                        authorInfo.classList.add('show');
                    }, 10);

                    if (cat) {
                        cat.style.display = 'block';
                    }
                    var lightButtonContainer = document.querySelector('.light-button-container');
                    if (lightButtonContainer) {
                        lightButtonContainer.style.display = 'flex';
                    }
                });
            });
        }
    }
});

// Simple example of a burger-style menu using jQuery
$(document).ready(function(){
    let menu = $('li:first-child'),
        menuButton = $('#menu-button'),
        mapLink = $('li:nth-child(2)'),
        aboutAuthorLink = $('li:nth-child(3)'),
        aboutProjectLink = $('li:nth-child(4)'),
        testLink = $('li:nth-child(5)');

    menu.on('click',() => {
        menuButton.toggleClass('active');
        if(menuButton.hasClass('active')){
            mapLink.animate({'left':'110px','opacity':'1','z-index':'8'},500);
            aboutAuthorLink.animate({'left':'210px','opacity':'1','z-index':'6'},500);
            aboutProjectLink.animate({'left':'310px','opacity':'1','z-index':'4'},500);
            testLink.animate({'left':'410px','opacity':'1','z-index':'2'},500);
        }
        else {
            mapLink.animate({'left':'0','opacity':'0'},500);
            aboutAuthorLink.animate({'left':'0','opacity':'0'},500);
            aboutProjectLink.animate({'left':'0','opacity':'0'},500);
            testLink.animate({'left':'0','opacity':'0'},500);
        }
    });

    $('#menu-map, #menu-about-author, #menu-about-project, #menu-test').on('click', function(e){
        e.preventDefault();

        if(menuButton.hasClass('active')){
            menuButton.removeClass('active');
            mapLink.animate({'left':'0','opacity':'0'},500);
            aboutAuthorLink.animate({'left':'0','opacity':'0'},500);
            aboutProjectLink.animate({'left':'0','opacity':'0'},500);
            testLink.animate({'left':'0','opacity':'0'},500);
        }
    });
});

/***************************************************
 * CSV Download & Show Graphs logic (batch testing)
 ***************************************************/
document.addEventListener('DOMContentLoaded', function() {
    var dlCsvBtn    = document.getElementById('batch-download-csv');
    var showGraphBtn= document.getElementById('batch-show-graphs');
    if (dlCsvBtn) {
        dlCsvBtn.addEventListener('click', function() {
            if (!window._batchResults || window._batchResults.length === 0) {
                alert('No batch results found.');
                return;
            }
            var csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "N_Points,Repeat,Algorithm,Distance,Time,ComputeTimeSec\n";
            window._batchResults.forEach(function(row) {
                csvContent += `${row.pointsN},${row.repeatId},"${row.algorithm}",${row.distance},${row.time},${row.compute_time_sec}\n`;
            });
            var encodedUri = encodeURI(csvContent);
            var tempLink = document.createElement("a");
            tempLink.setAttribute("href", encodedUri);
            tempLink.setAttribute("download", "batch_results.csv");
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);
        });
    }

    if (showGraphBtn) {
        showGraphBtn.addEventListener('click', function() {
            if (!window._batchResults || window._batchResults.length === 0) {
                alert('No batch results found for graphs.');
                return;
            }
            var graphModal = document.getElementById('graphsModal');
            if (graphModal) {
                graphModal.style.display = 'block';
            }
            drawBatchGraphs(window._batchResults);
        });
    }
});

// Additional show/hide overlay if needed
function showLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.display = 'block';
    }
    document.body.classList.add('loading');
}
  
function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    document.body.classList.remove('loading');
}
