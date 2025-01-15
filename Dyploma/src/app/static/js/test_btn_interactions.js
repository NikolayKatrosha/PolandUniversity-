/***************************************************
 * File: src/app/static/js/test_btn_interactions.js
 *
 * 1) Extended functionality for buttons: Analysis, Advanced Stats, Batch Testing
 * 2) Logic for opening/closing modals (analysis-modal, advanced-stats-modal, batch-menu, etc.)
 * 3) Logic for the "Start" button in batch-menu — launching algorithm batch tests
 * 4) Logic for "Big Test"
 * 5) All adjustments:
 *    - 6 algorithms on one chart
 *    - "Brute Force" up to 10 points and "Brute Force Theoretical" (>10) separately
 *      (for n=2..10 the theoretical approach matches the practical one)
 *    - If distance=0 => fallback (points in mid-air) and retry
 *    - Simulated Annealing requires >= 4 points
 *    - Big Test limited to 30 points
 ***************************************************/

document.addEventListener('DOMContentLoaded', function() {

  // -------------------------------------------------------------------------
  // 0) Global variables
  // -------------------------------------------------------------------------
  if (!window._batchResults) {
    window._batchResults = [];
  }
  if (!window._bigTestResults) {
    window._bigTestResults = [];
  }

  // Color map for 6 algorithms (Brute Force = brown)
  const ALGO_COLORS = {
    "Christofides Algorithm": "purple",
    "Greedy Algorithm":       "green",
    "Nearest Neighbor":       "blue",
    "Simulated Annealing":    "red",
    "2-opt Heuristic":        "orange",
    "Brute Force":            "brown"
  };

  // -------------------------------------------------------------------------
  // 1) Helper functions
  // -------------------------------------------------------------------------

  // Geodesic distance (in meters)
  function computeDistanceLatLon(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180.0;
    const dLon = (lon2 - lon1) * Math.PI / 180.0;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI/180.0) * Math.cos(lat2 * Math.PI/180.0) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Factorial using BigInt
  function factorial(n) {
    if (n < 2n) return 1n;
    let res = 1n;
    for (let i = 2n; i <= n; i++) {
      res *= i;
    }
    return res;
  }

  // -------------------------------------------------------------------------
  // 2) Buttons: Analysis, Advanced Stats, Batch Testing
  // -------------------------------------------------------------------------
  const showRouteDataBtn = document.getElementById('show-route-data-btn');
  showRouteDataBtn?.addEventListener('click', function() {
    if (typeof allAlgoResults !== 'undefined') {
      populateRouteAnalysisTable(allAlgoResults);
    }
    const analysisModal = document.getElementById('analysis-modal');
    if (analysisModal) analysisModal.classList.add('open');
  });

  const analysisBtn2 = document.getElementById('analysis-btn-2');
  analysisBtn2?.addEventListener('click', function() {
    if (typeof allAlgoResults !== 'undefined') {
      fillAdvancedStats(allAlgoResults);
    }
    const advModal = document.getElementById('advanced-stats-modal');
    if (advModal) advModal.classList.add('open');
  });

  const batchTestingBtn = document.getElementById('batch-testing-btn');
  batchTestingBtn?.addEventListener('click', function() {
    const batchMenu = document.getElementById('batch-menu');
    if (batchMenu) batchMenu.classList.add('open');
  });

  // -------------------------------------------------------------------------
  // 3) Slider / Checkboxes (Brute Force & SA)
  // -------------------------------------------------------------------------
  const algoContainer      = document.querySelector('.algo-container');
  const batchPointsSlider  = document.getElementById('batch-points-slider');
  const batchPointsValue   = document.getElementById('batch-points-value');

  if (algoContainer) {
    algoContainer.querySelectorAll('input[name="batch-algos"]')
      .forEach((cb) => {
        cb.addEventListener('change', clampSliderToAlgoConstraints);
      });
  }
  if (batchPointsSlider && batchPointsValue) {
    batchPointsSlider.addEventListener('input', function() {
      batchPointsValue.textContent = this.value;
      clampSliderToAlgoConstraints();
    });
  }

  function isBruteForceChecked() {
    if (!algoContainer) return false;
    const cbs = algoContainer.querySelectorAll('input[name="batch-algos"]');
    for (let i=0; i<cbs.length; i++){
      if (cbs[i].value==="Brute Force" && cbs[i].checked) return true;
    }
    return false;
  }
  function isSimulatedAnnealingChecked() {
    if (!algoContainer) return false;
    const cbs = algoContainer.querySelectorAll('input[name="batch-algos"]');
    for (let i=0; i<cbs.length; i++){
      if (cbs[i].value==="Simulated Annealing" && cbs[i].checked) return true;
    }
    return false;
  }

  // BF => max=10, SA => min=4, globally => 2..30
  function clampSliderToAlgoConstraints() {
    if (!batchPointsSlider || !batchPointsValue) return;
    let minVal = 2;
    let maxVal = 15;  // example: 15 (or 30 if needed)
    if (isBruteForceChecked()) {
      maxVal = 10;
    }
    if (isSimulatedAnnealingChecked()) {
      minVal = 4;
    }
    batchPointsSlider.min = minVal.toString();
    batchPointsSlider.max = maxVal.toString();
    let curr = parseInt(batchPointsSlider.value, 10);
    if (curr < minVal) curr = minVal;
    if (curr > maxVal) curr = maxVal;
    batchPointsSlider.value = curr;
    batchPointsValue.textContent = curr.toString();
  }

  // -------------------------------------------------------------------------
  // 4) Closing modals (Analysis, Advanced Stats, batch-menu)
  // -------------------------------------------------------------------------
  const analysisClose = document.getElementById('analysis-close');
  analysisClose?.addEventListener('click', ()=> {
    document.getElementById('analysis-modal')?.classList.remove('open');
  });
  const advancedStatsClose = document.getElementById('advanced-stats-close');
  advancedStatsClose?.addEventListener('click', ()=> {
    document.getElementById('advanced-stats-modal')?.classList.remove('open');
  });
  const batchCloseBtn = document.getElementById('batch-close-btn');
  batchCloseBtn?.addEventListener('click', ()=> {
    document.getElementById('batch-menu')?.classList.remove('open');
  });

  // -------------------------------------------------------------------------
  // 5) "Start" button (batch-start-btn) => run batch tests
  // -------------------------------------------------------------------------
  const batchStartBtn = document.getElementById('batch-start-btn');
  batchStartBtn?.addEventListener('click', async function() {
    const batchMenu = document.getElementById('batch-menu');
    if (batchMenu) batchMenu.classList.remove('open');

    const numPoints = parseInt(batchPointsSlider?.value || "5", 10);
    const repeats   = parseInt(document.getElementById('batch-repeats')?.value || "3", 10);

    let selectedAlgos=[];
    if (algoContainer) {
      algoContainer.querySelectorAll('input[name="batch-algos"]:checked')
        .forEach(cb => selectedAlgos.push(cb.value));
    }
    if (selectedAlgos.length===0) {
      alert('No algorithms selected.');
      return;
    }

    window._batchResults = [];
    showLoadingOverlay();

    const progContainer = document.getElementById('loading-progress-container');
    if (progContainer) progContainer.style.display='block';
    const fillEl = document.getElementById('loading-progress-fill');
    const textEl = document.getElementById('loading-progress-text');
    if (fillEl) fillEl.style.width = '0%';
    if (textEl) textEl.textContent = `0 / ${repeats}`;

    for (let r=1; r<=repeats; r++) {
      let attempts=0;
      while(true) {
        attempts++;
        let selResp = await fetch('/select_random_points', {
          method:'POST',
          headers:{ 'Content-Type':'application/json'},
          body: JSON.stringify({ count: numPoints })
        }).then(rr=>rr.json());

        if (selResp.status!=='success') {
          console.error('Error /select_random_points:', selResp.message);
          break;
        }
        let runResp = await fetch('/run_all_algos', {
          method:'POST',
          headers:{ 'Content-Type':'application/json'},
          body: JSON.stringify({ algos: selectedAlgos })
        }).then(rr=>rr.json());
        if (runResp.status!=='success') {
          console.error('Error /run_all_algos:', runResp.message);
          break;
        }
        let resultsArr = runResp.results||[];
        let hasZeroDistance = false;
        for (let algoRes of resultsArr){
          if (algoRes.distance === 0 || algoRes.status !== 'success') {
            hasZeroDistance = true; 
            console.log(`[DEBUG] Iteration #${r}, algo=${algoRes.algorithm} => distance=0, retrying...`);
            break;
          }
        }
        if (!hasZeroDistance) {
          resultsArr.forEach(algoRes => {
            window._batchResults.push({
              repeatId: r,
              pointsN:  numPoints,
              algorithm: algoRes.algorithm,
              distance:  algoRes.distance,
              time:      algoRes.time,
              compute_time_sec: algoRes.compute_time_sec,
              num_nodes: algoRes.num_nodes,
              ordered_points: algoRes.ordered_points||[]
            });
          });
          break;
        } else {
          console.warn(`(r=${r}) Attempt #${attempts} => distance=0 => re-try`);
          if (attempts>=150) {
            console.error(`(r=${r}) Gave up after 150 attempts!`);
            break;
          }
        }
      } // while

      if (textEl) textEl.textContent=`${r} / ${repeats}`;
      if (fillEl) {
        let pct = (r/repeats)*100;
        fillEl.style.width = pct.toFixed(0)+'%';
      }
    }

    alert(`Batch done! We have ${window._batchResults.length} total results.`);
    document.getElementById('batch-results-menu')?.style.setProperty('display','block');
    hideLoadingOverlay();
    if (progContainer) progContainer.style.display='none';
  });


  // -------------------------------------------------------------------------
  // 6) Buttons in #batch-results-menu
  // -------------------------------------------------------------------------
  const btnGraphs = document.getElementById('batch-graphs-btn');
  const btnInfo   = document.getElementById('batch-info-btn');
  const btnTable  = document.getElementById('batch-table-btn');
  const btnSave   = document.getElementById('batch-save-btn');
  const modalCloseBtn = document.getElementById('graphsModal-close');
  modalCloseBtn?.addEventListener('click', ()=> {
    document.getElementById('graphsModal')?.style.setProperty('display','none');
  });

  btnGraphs?.addEventListener('click', function(){
    const dataArr = window._batchResults||[];
    if (dataArr.length===0) {
      alert('No batch results to plot!');
      return;
    }
    document.getElementById('graphsModal')?.style.setProperty('display','block');
    drawBatchGraphs(dataArr);
  });

  btnInfo?.addEventListener('click', function(){
    if (!window._batchResults || window._batchResults.length === 0) {
      alert('No batch results yet.');
      return;
    }
  
    // Group results by iteration
    let iterationGroups = {};
    window._batchResults.forEach(item => {
      const it = item.repeatId;
      if (!iterationGroups[it]) {
        iterationGroups[it] = [];
      }
      iterationGroups[it].push(item);
    });
  
    let totalDist = 0;
    let totalCount = 0;
  
    // For each iteration, check if any algo has distance=0
    for (let itKey in iterationGroups) {
      let arrI = iterationGroups[itKey];
      let hasZero = arrI.some(x => x.distance === 0);
  
      if (!hasZero) {
        arrI.forEach(x => {
          totalDist += x.distance;
          totalCount++;
        });
      } else {
        console.log(`Skipping iteration #${itKey} (it has 0-dist for some algo)`);
      }
    }
  
    let avg = (totalCount > 0) ? totalDist / totalCount : 0;
    alert(`Average distance (m) ignoring zero-dist iterations: ${avg.toFixed(1)}\n` +
          `We used ${totalCount} valid results in total.`);
  });
  

  btnTable?.addEventListener('click', function(){
    const tableModal = document.getElementById('batch-table-modal');
    if (!tableModal) {
      console.error('#batch-table-modal not found.');
      return;
    }
    const tbody = document.getElementById('batch-table-tbody');
    if (!tbody) return;
    tbody.innerHTML='';

    const dataArr = window._batchResults||[];
    if (dataArr.length===0){
      let tr=document.createElement('tr');
      let td=document.createElement('td');
      td.colSpan=8;
      td.textContent='No data found. Please run Start first.';
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      // Group by iteration
      let grouped = {};
      dataArr.forEach(obj => {
        let iteration = obj.repeatId;
        if (!grouped[iteration]) grouped[iteration] = [];
        grouped[iteration].push(obj);
      });
      let allIts = Object.keys(grouped).map(x=>parseInt(x,10)).sort((a,b)=>a-b);

      allIts.forEach(iter=> {
        let arrI = grouped[iter];
        let rowSpanCount = arrI.length;
        arrI.forEach((obj,index)=> {
          let tr = document.createElement('tr');
          if (index===0){
            let tdIt = document.createElement('td');
            tdIt.textContent = `Iteration #${iter}`;
            tdIt.rowSpan     = rowSpanCount;
            tdIt.style.fontWeight    = 'bold';
            tdIt.style.backgroundColor='#f9f9f9';
            tdIt.style.verticalAlign='middle';
            tr.appendChild(tdIt);
          }

          let tdIndex = document.createElement('td');
          tdIndex.textContent = (index+1).toString();
          tdIndex.style.textAlign='center';
          tr.appendChild(tdIndex);

          let tdAlgo = document.createElement('td');
          tdAlgo.textContent = obj.algorithm||'';
          tr.appendChild(tdAlgo);

          let fallbackDistance = obj.distance||0;
          if (fallbackDistance===0){
            // fallback attempt
            const coordsArr = obj.ordered_points_coords||[];
            if (coordsArr && coordsArr.length>1){
              let first = coordsArr[0], last= coordsArr[coordsArr.length-1];
              fallbackDistance = computeDistanceLatLon(
                first.lat, first.lon,
                last.lat,  last.lon
              );
            }
          }
          let tdDist=document.createElement('td');
          tdDist.textContent=(fallbackDistance/1000).toFixed(2);
          tr.appendChild(tdDist);

          let tdTime=document.createElement('td');
          tdTime.textContent=(obj.time||0).toFixed(1);
          tr.appendChild(tdTime);

          let tdNodes=document.createElement('td');
          tdNodes.textContent=obj.num_nodes||'-';
          tr.appendChild(tdNodes);

          let tdCompute=document.createElement('td');
          tdCompute.textContent=(obj.compute_time_sec||0).toFixed(3);
          tr.appendChild(tdCompute);

          if (index===0){
            let tdAct=document.createElement('td');
            tdAct.rowSpan=rowSpanCount;
            tdAct.style.verticalAlign='middle';

            let btn=document.createElement('button');
            btn.textContent='Show Iter #'+iter;
            btn.style.backgroundColor='#f08080';
            btn.style.fontWeight='600';
            btn.addEventListener('click', function(){
              document.getElementById('batch-table-modal')?.classList.remove('open');
              let all=window._batchResults||[];
              let resultsForIter=all.filter(r=>r.repeatId===iter);
              let routeColors=["purple","blue","green","red","orange","brown"];
              resultsForIter.forEach((res,i2)=>{
                res.color=routeColors[i2 % routeColors.length];
              });
              window.allAlgoResults=resultsForIter;
              console.log('[DEBUG] show iteration =>', resultsForIter);
              if (resultsForIter.length>0){
                showAlgoRouteTest(resultsForIter[0]);
              }
              const panel=document.getElementById('test-route-info-panel');
              if (panel) panel.style.display='block';
            });
            tdAct.appendChild(btn);
            tr.appendChild(tdAct);
          }
          tbody.appendChild(tr);
        });
        // separator
        let emptyTr=document.createElement('tr');
        let emptyTd=document.createElement('td');
        emptyTd.colSpan=8;
        emptyTd.style.backgroundColor='#ddd';
        emptyTd.style.height='3px';
        emptyTr.appendChild(emptyTd);
        tbody.appendChild(emptyTr);
      });
    }
    tableModal.classList.add('open');
  });

  btnSave?.addEventListener('click', function(){
    if (!window._batchResults||window._batchResults.length===0){
      alert('No data to save. Please run Start first.');
      return;
    }
    let csv='Index,Algorithm,Distance,Time,Nodes,ComputeTimeSec\n';
    window._batchResults.forEach((obj,idx)=>{
      csv += `${idx+1},${obj.algorithm},${obj.distance},${obj.time},${obj.num_nodes},${obj.compute_time_sec}\n`;
    });
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download='batch_results.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  const tableCloseBtn=document.getElementById('batch-table-close');
  tableCloseBtn?.addEventListener('click',()=>{
    document.getElementById('batch-table-modal')?.classList.remove('open');
  });


  // -------------------------------------------------------------------------
  // 7) Big Test (max n=30) — also can retry if distance=0
  // -------------------------------------------------------------------------
  const bigTestBtn       = document.getElementById('big-test-btn');
  const bigTestMenu      = document.getElementById('big-test-menu');
  const bigTestCloseBtn  = document.getElementById('big-test-close-btn');
  const bigTestStartBtn  = document.getElementById('big-test-start-btn');
  const bigTestRepeatsSlider= document.getElementById('big-test-repeats-slider');
  const bigTestRepeatsValue = document.getElementById('big-test-repeats-value');

  bigTestBtn?.addEventListener('click', ()=> {
    bigTestMenu?.classList.add('open');
  });
  bigTestCloseBtn?.addEventListener('click', ()=> {
    if (bigTestMenu) {
      bigTestMenu.style.display='none';
    }
  });
  bigTestRepeatsSlider?.addEventListener('input', function(){
    if (bigTestRepeatsValue) {
      bigTestRepeatsValue.textContent=this.value;
    }
  });
  bigTestStartBtn?.addEventListener('click', async function() {
    if (!bigTestMenu) return;
    bigTestMenu.style.display='none';

    const bigRepeats = parseInt(bigTestRepeatsSlider?.value||"50",10);
    let selectedAlgos=[];
    if (algoContainer) {
      let cbs= algoContainer.querySelectorAll('input[name="batch-algos"]:checked');
      cbs.forEach(cb => selectedAlgos.push(cb.value));
    }
    if (selectedAlgos.length===0){
      alert('No algorithms selected.');
      return;
    }
    window._bigTestResults=[];

    showLoadingOverlay();
    const progContainer = document.getElementById('loading-progress-container');
    if (progContainer) progContainer.style.display='block';
    const fillEl = document.getElementById('loading-progress-fill');
    const textEl = document.getElementById('loading-progress-text');
    if (fillEl) fillEl.style.width='0%';

    // example up to 30 points
    const maxPoints = 30; 
    let totalOps = (maxPoints - 1)*bigRepeats;  // if n=2..30 => 29 * bigRepeats
    let doneOps=0;

    for (let n=2; n<=maxPoints; n++){
      const BF_THRESHOLD=10;
      const SA_MIN=4;
      let filtered = selectedAlgos.filter(a=>{
        if (a==="Brute Force" && n>BF_THRESHOLD) return false;
        if (a==="Simulated Annealing" && n<SA_MIN) return false;
        return true;
      });
      for (let r=1; r<=bigRepeats; r++){

        // "while(true) => if distance=0 => retry"
        let attempts=0;
        while(true) {
          attempts++;
          let selResp = await fetch('/select_random_points', {
            method:'POST',
            headers:{ 'Content-Type':'application/json'},
            body: JSON.stringify({ count:n })
          }).then(rr=>rr.json());
          if (selResp.status!=='success') {
            console.error('Error /select_random_points:', selResp.message);
            break;
          }

          let runAllResp = await fetch('/run_all_algos', {
            method:'POST',
            headers:{ 'Content-Type':'application/json'},
            body: JSON.stringify({ algos: filtered })
          }).then(rr=>rr.json());
          if (runAllResp.status!=='success') {
            console.error('Error /run_all_algos:', runAllResp.message);
            break;
          }

          let arr = runAllResp.results||[];
          let hasZero = false;
          for (let ar of arr) {
            if (ar.status==='success' && ar.distance===0) {
              hasZero = true;
              console.warn(`[DEBUG] BigTest (n=${n},r=${r}) attempt=${attempts} => distance=0 => re-try`);
              break;
            }
          }

          if (!hasZero) {
            // All good => store in _bigTestResults
            arr.forEach(ar=>{
              window._bigTestResults.push({
                pointsN:   n,
                iteration: r,
                algorithm: ar.algorithm,
                distance:  ar.distance,
                time:      ar.time,
                compute_time_sec: ar.compute_time_sec,
                expansions: ar.expansions||0,
                ratio:      ar.heuristic_ratio||1.0,
                num_nodes:  ar.num_nodes||n
              });
            });
            break;
          }
          else {
            // Keep trying until attempts=150
            if (attempts>=150) {
              console.error(`(n=${n}, r=${r}) Gave up after 150 attempts!`);
              break;
            }
          }
        } // while(true)

        doneOps++;
        let fraction= doneOps/totalOps;
        if (fillEl) fillEl.style.width=(fraction*100).toFixed(1)+'%';
        if (textEl) textEl.textContent=`${doneOps} / ${totalOps}`;
      } // for r
    } // for n

    hideLoadingOverlay();
    if (progContainer) progContainer.style.display='none';
    alert(`Big Test done!\nWe have ${window._bigTestResults.length} total records in _bigTestResults.`);

    let modal = document.getElementById('graphsModal');
    if (modal) modal.style.display='block';
    drawBigTestGraph(window._bigTestResults);
  });

  // -------------------------------------------------------------------------
  // 8) drawBatchGraphs / drawBigTestGraph
  // -------------------------------------------------------------------------

  // Standard chart (batchResults)
  function drawBatchGraphs(batchResults) {
    const chartDiv = document.getElementById('scatter-plot-container');
    if (!chartDiv) return;
    if (!batchResults || batchResults.length===0) {
      chartDiv.innerHTML='<h4 style="color:red">No results to show</h4>';
      return;
    }

    // Group data by algorithm
    let grouped = {};
    batchResults.forEach(item=>{
      let algo = item.algorithm;
      if (!grouped[algo]) grouped[algo] = [];
      grouped[algo].push(item);
    });
    for (let algoName in grouped) {
      grouped[algoName].sort((a,b)=>(a.distance||0)-(b.distance||0));
    }

    let allTraces = [];
    let algoNames = Object.keys(grouped);
    algoNames.forEach(aName=>{
      let arr = grouped[aName];
      let xVals = arr.map((_,i)=>i);
      let distVals = arr.map(o=>o.distance||0);
      let timeVals = arr.map(o=>o.compute_time_sec||0);

      let barTrace = {
        x: xVals,
        y: distVals,
        name: aName+" dist",
        type:'bar',
        yaxis:'y',
        marker:{ color:ALGO_COLORS[aName]||'gray', opacity:0.6},
        visible:true
      };
      let lineTrace = {
        x: xVals,
        y: timeVals,
        name: aName+" time",
        type:'scatter',
        mode:'lines+markers',
        yaxis:'y2',
        marker:{ color:ALGO_COLORS[aName]||'gray'},
        line:{ color:ALGO_COLORS[aName]||'gray'},
        visible:true
      };
      allTraces.push(barTrace, lineTrace);
    });

    let layout = {
      title:'Common Chart: Distance & Time (sorted by distance)',
      xaxis:{ title:'Index' },
      yaxis:{ title:'Distance (m)', side:'left'},
      yaxis2:{title:'Compute Time (s)', overlaying:'y', side:'right'},
      barmode:'group',
      legend:{ orientation:'h'},
      margin:{ t:60, l:50, r:50, b:60 }
    };

    Plotly.newPlot(chartDiv, allTraces, layout);
    createAlgoCheckboxes(algoNames,false);
  }

  /**
   * drawBigTestGraph: up to 30 points
   * - BF real => n<=10
   * - BF theoretical => n>10 (up to 16 or so)
   */
  function drawBigTestGraph(bigData) {
    const chartDiv = document.getElementById('scatter-plot-container');
    if (!chartDiv) return;
    if (!bigData || bigData.length===0) {
      chartDiv.innerHTML='<h4 style="color:red">No big test results to show.</h4>';
      return;
    }

    // Group: { algo => { n => [time,...] } }
    let grouped={};
    bigData.forEach(item=>{
      let algo = item.algorithm;
      let n    = item.pointsN;
      let t    = item.compute_time_sec||0; 
      if (!grouped[algo]) grouped[algo]={};
      if (!grouped[algo][n]) grouped[algo][n]=[];
      grouped[algo][n].push(t);
    });

    let traces=[];
    let algoNames=Object.keys(grouped).sort();

    algoNames.forEach(aName=>{
      if (aName === "Brute Force") {
        // Brute Force real: n = 2..10
        let dictBF = grouped["Brute Force"];
        let realX = [], realY = [];
        for (let n = 2; n <= 10; n++) {
          if (dictBF[n]) {
            let arrTimes = dictBF[n];
            let avgTime = arrTimes.reduce((acc, val) => acc + val, 0) / arrTimes.length;
            realX.push(n);
            realY.push(avgTime);
          }
        }
        if (realX.length > 0) {
          traces.push({
            x: realX,
            y: realY,
            mode: 'lines+markers',
            name: 'Brute Force',
            line: { color: ALGO_COLORS["Brute Force"] || 'brown' },
            marker: { color: ALGO_COLORS["Brute Force"] || 'brown' },
            visible: true
          });
        }

        // Brute Force theoretical for n>10 up to n=15
        let maxN = 15;
        if (realX.length > 0) {
          let lastN = realX[realX.length - 1]; // typically 10
          let lastTime = realY[realY.length - 1]; // time for n=10
          let scale = 1;

          let factLastN = factorial(BigInt(lastN));
          let factLastNnum = Number(factLastN);
          if (factLastNnum !== 0) {
            scale = lastTime / factLastNnum;
          }

          let theoryX = [...realX];
          let theoryY = [...realY];

          for (let i = lastN+1; i <= maxN; i++){
            let valFact = factorial(BigInt(i));
            let valFactNum = Number(valFact);
            let valScaled  = scale * valFactNum;
            // cap if needed
            let yCapped = (valScaled>16)? 16 : valScaled;
            theoryX.push(i);
            theoryY.push(yCapped);
          }

          traces.push({
            x: theoryX,
            y: theoryY,
            mode: 'lines+markers',
            name: 'Brute Force Theoretical',
            line: { color: 'black', dash: 'dash' },
            marker: { color: 'black' },
            visible: true
          });
        }
      }
      else {
        // other algorithms
        let dictN= grouped[aName];
        let nKeys= Object.keys(dictN).map(x=>parseInt(x,10)).sort((a,b)=>a-b);
        let xVals=[], yVals=[];
        nKeys.forEach(nn=>{
          let arrTimes= dictN[nn];
          let avg= arrTimes.reduce((acc,val)=>acc+val,0)/arrTimes.length;
          xVals.push(nn);
          yVals.push(avg);
        });
        traces.push({
          x: xVals,
          y: yVals,
          mode:'lines+markers',
          name: aName,
          line:{ color:ALGO_COLORS[aName]||'gray'},
          marker:{ color:ALGO_COLORS[aName]||'gray'},
          visible:true
        });
      }
    });

    let layout = {
      title: 'Big Test: Compute Time vs. #Points (up to 30, BF<=16)',
      xaxis: { title: 'Number of points (n)', dtick:1 },
      yaxis: { title: 'Avg compute time (s)' },
      legend:{ orientation:'h' }
    };
    Plotly.newPlot(chartDiv, traces, layout);

    // Create checkboxes
    let finalNames=[];
    algoNames.forEach(aName=>{
      if (aName==="Brute Force"){
        finalNames.push("Brute Force");
        finalNames.push("Brute Force Theoretical");
      } else {
        finalNames.push(aName);
      }
    });
    createAlgoCheckboxes(finalNames,true);
  }

  // -------------------------------------------------------------------------
  // 9) createAlgoCheckboxes & toggleAlgoTraces
  // -------------------------------------------------------------------------
  function createAlgoCheckboxes(algoNames, isBigTest){
    let container = document.getElementById('algo-checkbox-container');
    if (!container) return;
    container.innerHTML='';

    algoNames.forEach(aName=>{
      let label=document.createElement('label');
      label.style.marginRight='12px';

      let cb=document.createElement('input');
      cb.type='checkbox';
      cb.checked=true;
      cb.addEventListener('change', function(){
        toggleAlgoTraces(aName, this.checked);
      });

      label.appendChild(cb);
      label.appendChild(document.createTextNode(' '+aName));
      container.appendChild(label);
    });
  }

  function toggleAlgoTraces(aName, isVisible) {
    let chartDiv = document.getElementById('scatter-plot-container');
    if (!chartDiv || !chartDiv.data) return;
    chartDiv.data.forEach(trace => {
      if (trace.name === aName) {
        trace.visible = isVisible ? true : 'legendonly';
      }
    });
    Plotly.redraw(chartDiv);
  }

  // -------------------------------------------------------------------------
  // populateRouteAnalysisTable, fillAdvancedStats
  // -------------------------------------------------------------------------
  function populateRouteAnalysisTable(results){
    let tbody = document.getElementById('route-data-tbody');
    if (!tbody) return;
    tbody.innerHTML='';
    if (!results || results.length===0){
      let tr = document.createElement('tr');
      let td = document.createElement('td');
      td.colSpan=6;
      td.textContent='No route analysis data found.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    results.forEach(r=>{
      let tr=document.createElement('tr');

      let tdAlgo=document.createElement('td');
      tdAlgo.textContent=r.algorithm||'-';
      tr.appendChild(tdAlgo);

      let distanceKM=(r.distance||0)/1000;
      if (distanceKM===0){
        // fallback
        const arr=r.ordered_points_coords||[];
        if (arr && arr.length>1){
          let first=arr[0], last=arr[arr.length-1];
          let fallback=computeDistanceLatLon(first.lat, first.lon, last.lat, last.lon);
          distanceKM=fallback/1000;
        }
      }
      let tdDist=document.createElement('td');
      tdDist.textContent=distanceKM.toFixed(2);
      tr.appendChild(tdDist);

      let tdTime=document.createElement('td');
      tdTime.textContent=(r.time||0).toFixed(1);
      tr.appendChild(tdTime);

      let tdCount=document.createElement('td');
      let cntPoints=(r.ordered_points && r.ordered_points.length)? r.ordered_points.length:0;
      tdCount.textContent=cntPoints;
      tr.appendChild(tdCount);

      let tdNodes=document.createElement('td');
      tdNodes.textContent=r.num_nodes||'-';
      tr.appendChild(tdNodes);

      let tdExec=document.createElement('td');
      tdExec.textContent=(r.compute_time_sec||0).toFixed(3);
      tr.appendChild(tdExec);

      tbody.appendChild(tr);
    });
  }

  function fillAdvancedStats(results){
    let placeholder = document.getElementById('advanced-stats-placeholder');
    if (!placeholder) return;
    placeholder.innerHTML='';
    if (!results || results.length===0){
      placeholder.textContent='No advanced stats data.';
      return;
    }
    let p=document.createElement('p');
    p.style.whiteSpace='pre-wrap';
    p.textContent='Advanced Stats:\n';

    let totalDist=0; 
    let cnt=0;
    results.forEach(rr=>{
      if (rr.distance){
        totalDist += rr.distance;
        cnt++;
      }
    });
    let avgDist=(cnt>0)? totalDist/cnt : 0;
    p.textContent += `Average distance (all algos) = ${(avgDist/1000).toFixed(2)} km\n`;
    p.textContent += `Number of results: ${results.length}\n`;
    placeholder.appendChild(p);
  }

}); // end DOMContentLoaded


/***********************************************
 * showAlgoRouteTest — example function
 ***********************************************/
function showAlgoRouteTest(algoResult) {
  console.log('[DEBUG showAlgoRouteTest] =>', algoResult);

  // 1) Clear testRouteGroup before drawing a new route
  testRouteGroup.clearLayers();

  // 2) If this is a VRP route (multiple routes), draw them
  if (algoResult.vrp_routes) {
    algoResult.vrp_routes.forEach((rObj, index) => {
      let color = rObj.color || 'purple';
      // Lines
      let polyline = L.polyline(rObj.coordinates, {
        color: color,
        weight: 4,
        opacity: 0.8,
      });
      polyline.addTo(testRouteGroup);

      // Markers
      rObj.ordered_points.forEach((pointId, idx) => {
        // Search lat/lon in testSelectedPoints (or algoResult.ordered_points_coords)
        const found = testSelectedPoints.find(sp => sp.id === pointId.toString());
        if (!found) return;
        let markerIcon = L.divIcon({
          html: `<div style="border:2px solid black; background-color:${color};
                       border-radius:50%; width:24px; height:24px; color:#fff;
                       display:flex; align-items:center; justify-content:center;
                       font-weight:bold;">${idx+1}</div>`,
          className: '',
          iconSize: [24,24],
          iconAnchor: [12,12]
        });
        L.marker([found.lat, found.lon], { icon: markerIcon })
          .addTo(testRouteGroup);
      });
    });

  } else {
    // 3) Otherwise, assume TSP route:
    //   (main_route_coordinates + return_route_coordinates)
    let color = algoResult.color || 'purple';

    // Main route
    if (algoResult.main_route_coordinates && algoResult.main_route_coordinates.length > 1) {
      let mainPolyline = L.polyline(algoResult.main_route_coordinates, {
        color: color,
        weight: 4,
        opacity: 0.8
      });
      mainPolyline.addTo(testRouteGroup);
    }

    // Return route
    if (algoResult.return_route_coordinates && algoResult.return_route_coordinates.length > 1) {
      let retPolyline = L.polyline(algoResult.return_route_coordinates, {
        color: 'black',
        weight: 4,
        opacity: 0.8,
        dashArray: '10,10'
      });
      retPolyline.addTo(testRouteGroup);
    }

    // Markers
    if (algoResult.ordered_points_coords && algoResult.ordered_points_coords.length > 0) {
      // Draw from algoResult.ordered_points_coords
      algoResult.ordered_points_coords.forEach((pt, idx) => {
        let c = (idx === 0) ? 'green' : 'orange';
        let f = (idx === 0) ? 'lime'  : 'yellow';
        let iconHtml = `<div style="border:1px solid ${c}; background-color:${f};
                                  border-radius:50%; width:24px; height:24px;
                                  display:flex; align-items:center; justify-content:center;
                                  font-weight:bold;">${idx+1}</div>`;
        let icon = L.divIcon({
          html: iconHtml,
          className: '',
          iconSize: [24,24],
          iconAnchor: [12,12]
        });
        L.marker([pt.lat, pt.lon], { icon: icon })
          .addTo(testRouteGroup);
      });
    } 
    else if (algoResult.ordered_points) {
      // If coords are missing => look in testSelectedPoints
      algoResult.ordered_points.forEach((nid, idx) => {
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
        L.marker([sp.lat, sp.lon], { icon })
          .addTo(testRouteGroup);
      });
    }
  }

  // 4) Fit map bounds to show the full route
  let allCoords = [];
  if (algoResult.main_route_coordinates) {
    allCoords = allCoords.concat(algoResult.main_route_coordinates);
  }
  if (algoResult.return_route_coordinates) {
    allCoords = allCoords.concat(algoResult.return_route_coordinates);
  }
  if (algoResult.vrp_routes) {
    // Collect coords from each vrp_route
    algoResult.vrp_routes.forEach(r => {
      if (r.coordinates) {
        allCoords = allCoords.concat(r.coordinates);
      }
    });
  }
  if (allCoords.length > 1) {
    testMap.fitBounds(allCoords);
  }

  // 5) Update the route info panel if present
  updateTestRouteInfoPanel(algoResult);
  // or simply alert if needed
  // alert('Showing route for: ' + (algoResult.algorithm||'???'));
}


/************************************************
 * showLoadingOverlay / hideLoadingOverlay
 ************************************************/
function showLoadingOverlay(){
  const ov = document.getElementById('loading-overlay');
  if (ov) ov.style.display = 'block';
  document.body.classList.add('loading');
}
function hideLoadingOverlay(){
  const ov = document.getElementById('loading-overlay');
  if (ov) ov.style.display = 'none';
  document.body.classList.remove('loading');
}

/*
 Explanation: "why the theoretical BF doesn’t extend from n=0":
 - For n=0 or n=1 the TSP is not meaningful (no route).
 - Big Test typically collects data from n=2.
 - So the plot starts at n=2.
*/
