//
// File: src/app/static/js/batch_testing.js
//
// Logic related to batch tests:
//   - launching tests in a loop (startBatchTesting, updateBatchProgress),
//   - selectRandomPointsTestAsync, runSpecificAlgosAsync, etc.
//
// This file can hold pieces from "test_interactions.js" specifically related
// to batch testing, not single-run scenarios.
//

async function startBatchTesting(minPts, maxPts, repeats, algos) {

    let totalIterations = repeats; 
    let iterationCount = 0;
    let batchResults = [];

    // Example loop for the specified number of repeats
    for (let r = 1; r <= repeats; r++) {
        // 1) First, call /select_random_points
        let selectPointsResp = await fetch('/select_random_points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count: minPts })
        }).then(r => r.json());

        if (selectPointsResp.status !== 'success') {
            console.error('Error in /select_random_points:', selectPointsResp.message);
            continue;
        }

        // Our random points (ID + lat + lon)
        let currentRandPoints = selectPointsResp.points;  
        // Example: [ { id:'12345', lat:..., lon:... }, ... ]

        // 2) Run /run_all_algos
        let runAlgosResp = await fetch('/run_all_algos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ algos })  // or your chosen structure
        }).then(r => r.json());

        if (runAlgosResp.status === 'success') {
            let resultsArr = runAlgosResp.results || [];

            // Insert the piece of code that adds "ordered_points_coords" 
            // to each result if needed.
            resultsArr.forEach(algoRes => {
                // Check if it's TSP and has "ordered_points"
                if (algoRes.ordered_points) {
                    // Create an array storing ID, lat, lon
                    algoRes.ordered_points_coords = algoRes.ordered_points.map(nodeId => {
                        let found = currentRandPoints.find(p => p.id === nodeId);
                        if (found) {
                            return {
                                id:   nodeId,
                                lat:  found.lat,
                                lon:  found.lon
                            };
                        } else {
                            return null;
                        }
                    }).filter(Boolean);
                }
            });

            // 3) Now resultsArr has algoRes.ordered_points_coords.
            // We store these results in the global array (as needed).
            window._batchResults.push(...resultsArr);

        } else {
            console.error('Error in /run_all_algos:', runAlgosResp.message);
        }
    }

    // After finishing, hide the overlay or show a message
    hideLoadingOverlay();
    alert(`Batch done!\nCollected ${batchResults.length} results in _batchResults.`);

    // Put the result into the global variable
    window._batchResults = batchResults;
    
    // Display the batch results menu if needed
    const batchResultsMenu = document.getElementById('batch-results-menu');
    if (batchResultsMenu) {
        batchResultsMenu.style.display = 'block';
    }
}

function updateBatchProgress(current, total) {
    const fraction = current / total;
    const percent  = Math.floor(fraction * 100);

    let bar = document.getElementById('loading-progress-fill');
    if (bar) {
        bar.style.width = percent + '%';
    }

    let textEl = document.getElementById('loading-progress-text');
    if (textEl) {
        textEl.textContent = `${current} / ${total}`; 
    }
}
  

function selectRandomPointsTestAsync(count) {
    return new Promise((resolve, reject) => {
        showLoadingOverlay();
        fetch('/select_random_points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count })
        })
        .then(r => r.json())
        .then(data => {
            hideLoadingOverlay();
            if (data.status === 'success') {
                clearAllTestLayers();
                testSelectedMarkers = [];
                testSelectedPoints = [];

                data.points.forEach((p, idx) => {
                    // ...draw markers, fill testSelectedPoints, etc.
                });
                updateSelectedPointsListTest();
                resolve();
            } else {
                alert('Error: ' + (data.message || 'no msg'));
                reject(new Error(data.message));
            }
        })
        .catch(err => {
            hideLoadingOverlay();
            console.error('Error selecting random points:', err);
            reject(err);
        });
    });
}

function runSpecificAlgosAsync(algos) {
    return new Promise((resolve, reject) => {
        showLoadingOverlay();
        // Example call to "/run_all_algos":
        fetch('/run_all_algos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        })
        .then(r => r.json())
        .then(data => {
            hideLoadingOverlay();
            if (data.status === 'success') {
                let results = data.results || [];
                // Filter only the selected algorithms
                let filtered = results.filter(res => algos.includes(res.algorithm));
                resolve(filtered);
            } else {
                alert('Error: ' + data.message);
                reject(new Error(data.message));
            }
        })
        .catch(err => {
            hideLoadingOverlay();
            console.error('Error runAllAlgosTest:', err);
            reject(err);
        });
    });
}
