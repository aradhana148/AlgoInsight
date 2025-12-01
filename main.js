// assumes graph, drawGraph, vizState, edgeKey are already defined globally

let currentStart = null;
let currentEnd = null;

const algoSelect = document.getElementById("algoSelect");
const startInput = document.getElementById("startNode");
const endInput   = document.getElementById("endNode");
const runBtn     = document.getElementById("runBtn");
const resetBtn   = document.getElementById("resetBtn");
const statusView = document.getElementById("statusView");
const pqView     = document.getElementById("pqView");   // for heap display
const toggleNodesBtn   = document.getElementById("toggleNodesBtn");
const toggleWeightsBtn = document.getElementById("toggleWeightsBtn");


// ------------------ DEFAULT "CITY" GRAPH ------------------ //

function loadDefaultCityGraph() {
  // fresh graph
  graph = new Graph();

  const canvas = document.getElementById("canvas");
  let W = canvas.clientWidth;
  let H = canvas.clientHeight;

  // fallback if width/height is 0 on first load
  if (!W || !H) {
    W = 800;
    H = 500;
  }

  const NUM_NODES = 230;  // tweak if you want bigger/smaller
  const marginX = 40;
  const marginY = 40;

  const nodeIds = [];

  // helper: add edge with Euclidean weight
  function addEdgeAuto(u, v) {
    const nu = graph.nodes[u];
    const nv = graph.nodes[v];
    if (!nu || !nv) return;
    const dx = nu.x - nv.x;
    const dy = nu.y - nv.y;
    const w = Math.sqrt(dx * dx + dy * dy);
    graph.addEdge(u, v, w);
  }

  // 1) place nodes randomly over almost the whole window
  for (let i = 0; i < NUM_NODES; i++) {
    const x = marginX + Math.random() * (W - 2 * marginX);
    const y = marginY + Math.random() * (H - 2 * marginY);
    const id = graph.addNode(x, y);
    nodeIds.push(id);
  }

  // 2) ensure connectivity: random spanning tree
  // each node i>0 connects to one random previous node j<i
  for (let i = 1; i < NUM_NODES; i++) {
    const u = nodeIds[i];
    const v = nodeIds[Math.floor(Math.random() * i)];
    addEdgeAuto(u, v);
  }

  // 3) add local "street" edges based on distance
  const R = Math.min(W, H) * 0.18;  // connection radius

  for (let i = 0; i < NUM_NODES; i++) {
    const u = nodeIds[i];
    const nu = graph.nodes[u];
    if (!nu) continue;

    for (let j = i + 1; j < NUM_NODES; j++) {
      const v = nodeIds[j];
      const nv = graph.nodes[v];
      if (!nv) continue;

      const dx = nu.x - nv.x;
      const dy = nu.y - nv.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // fairly dense local roads if close
      if (dist < R && Math.random() < 0.35) {
        addEdgeAuto(u, v);
      }
    }
  }

  // 4) add a few long “expressway/flyover” edges
  const EXTRA_LONG_EDGES = 30;
  for (let k = 0; k < EXTRA_LONG_EDGES; k++) {
    const u = nodeIds[Math.floor(Math.random() * NUM_NODES)];
    const v = nodeIds[Math.floor(Math.random() * NUM_NODES)];
    if (u !== v) {
      addEdgeAuto(u, v);
    }
  }

  drawGraph();
}

// ------------------ STATUS + PQ RENDERING ------------------ //

function renderStatus() {
  if (!statusView) return;
  statusView.textContent = vizState.status || "";
}

// render the top of the heap(s) into #pqView
function renderPQ() {
  if (!pqView) return;

  const algo   = vizState.currentAlgo;
  const pqTop  = vizState.pqTop  || [];
  const pqTopF = vizState.pqTopF || [];
  const pqTopB = vizState.pqTopB || [];

  // Dijkstra / single A*
  if (algo === "dijkstra" || algo === "astar") {
    if (pqTop.length === 0) {
      pqView.innerHTML = "";
      return;
    }

    if (algo === "dijkstra") {
      let html = "<h3>Heap Top (Dijkstra)</h3>";
      html += "<table><tr><th>Node</th><th>Dist</th></tr>";
      for (const entry of pqTop) {
        html += `<tr><td>${entry.node}</td><td>${entry.dist.toFixed(2)}</td></tr>`;
      }
      html += "</table>";
      pqView.innerHTML = html;
    } else {
      let html = "<h3>Heap Top (A*)</h3>";
      html += "<table><tr><th>Node</th><th>g</th><th>f</th></tr>";
      for (const entry of pqTop) {
        html += `<tr><td>${entry.node}</td><td>${entry.g.toFixed(2)}</td><td>${entry.f.toFixed(2)}</td></tr>`;
      }
      html += "</table>";
      pqView.innerHTML = html;
    }
    return;
  }

  // Bidirectional A*
  if (algo === "astar2") {
    if (pqTopF.length === 0 && pqTopB.length === 0) {
      pqView.innerHTML = "";
      return;
    }

    let html = "<h3>Heaps (Bidirectional A*)</h3>";
    html += "<div style='display:flex; gap:8px; flex-wrap:wrap;'>";

    // forward heap
    html += "<div style='flex:1; min-width:120px;'>";
    html += "<h4 style='margin:4px 0;'>Forward</h4>";
    html += "<table><tr><th>Node</th><th>g</th><th>f</th></tr>";
    for (const entry of pqTopF) {
      html += `<tr><td>${entry.node}</td><td>${entry.g.toFixed(2)}</td><td>${entry.f.toFixed(2)}</td></tr>`;
    }
    html += "</table>";
    html += "</div>";

    // backward heap
    html += "<div style='flex:1; min-width:120px;'>";
    html += "<h4 style='margin:4px 0;'>Backward</h4>";
    html += "<table><tr><th>Node</th><th>g</th><th>f</th></tr>";
    for (const entry of pqTopB) {
      html += `<tr><td>${entry.node}</td><td>${entry.g.toFixed(2)}</td><td>${entry.f.toFixed(2)}</td></tr>`;
    }
    html += "</table>";
    html += "</div>";

    html += "</div>";

    pqView.innerHTML = html;
    return;
  }

  // other algorithms: clear heap
  pqView.innerHTML = "";
}

// when algorithm selection changes, clear annotations + status + heap
algoSelect.onchange = () => {
  const algo = algoSelect.value;
  vizState.tin      = [];
  vizState.tout     = [];
  vizState.level    = [];
  vizState.pqTop    = [];
  vizState.pqTopF   = [];
  vizState.pqTopB   = [];
  vizState.currentAlgo = algo;
  vizState.status   = "";
  vizState.visitedF.clear();
  vizState.visitedB.clear();
  renderStatus();
  renderPQ();
  drawGraph();
};

runBtn.onclick = () => {
  const algo = algoSelect.value;
  vizState.currentAlgo = algo;

  currentStart = parseInt(startInput.value, 10);

  if (Number.isNaN(currentStart) || currentStart < 0 || currentStart >= graph.nodes.length) {
    alert("Invalid start node");
    return;
  }

  // ---- handle end node depending on algorithm ----
  const endRaw = endInput.value.trim();

  if (algo === "dijkstra" || algo === "astar" || algo === "astar2") {
    // end is REQUIRED
    currentEnd = parseInt(endRaw, 10);
    if (Number.isNaN(currentEnd) || currentEnd < 0 || currentEnd >= graph.nodes.length) {
      alert("Invalid end node");
      return;
    }
  } else if (algo === "bfs" || algo === "dfs") {
    // end is OPTIONAL
    if (endRaw === "") {
      currentEnd = -1; // "no end" => full traversal mode
    } else {
      currentEnd = parseInt(endRaw, 10);
      if (Number.isNaN(currentEnd) || currentEnd < 0 || currentEnd >= graph.nodes.length) {
        alert("Invalid end node");
        return;
      }
    }
  } else if (algo === "mst") {
    currentEnd = null;
  }

  // reset visualization
  vizState.visited.clear();
  vizState.frontier.clear();
  vizState.path.clear();
  vizState.mstEdges.clear();
  vizState.activeEdge = null;
  vizState.startNode = algo === "mst" ? null : currentStart;
  vizState.endNode   = (algo === "mst" || currentEnd === -1 || currentEnd === null)
    ? null
    : currentEnd;

  // Clear DFS/BFS annotations when not used
  if (algo !== "dfs") {
    vizState.tin  = [];
    vizState.tout = [];
  }
  if (algo !== "bfs") {
    vizState.level = [];
  }

  // Clear PQ info when not Dijkstra/A* / A*2
  if (algo !== "dijkstra" && algo !== "astar" && algo !== "astar2") {
    vizState.pqTop  = [];
    vizState.pqTopF = [];
    vizState.pqTopB = [];
  }

  // Clear bidirectional visited state
  vizState.visitedF.clear();
  vizState.visitedB.clear();

  // Clear status for new run
  vizState.status = "";
  renderStatus();
  renderPQ();
  drawGraph();

  let it;
  if (algo === "dijkstra") {
    it = dijkstra(graph, currentStart, currentEnd);
  } else if (algo === "astar") {
    it = astar(graph, currentStart, currentEnd);
  } else if (algo === "astar2") {
    it = astarBidirectional(graph, currentStart, currentEnd);
  } else if (algo === "bfs") {
    it = bfs(graph, currentStart, currentEnd);
  } else if (algo === "dfs") {
    it = dfs(graph, currentStart, currentEnd);
  } else if (algo === "mst") {
    it = mstKruskal(graph);
  }

  if (it) runAnimation(it);
};

resetBtn.onclick = () => {
  // rebuild the default random city graph
  loadDefaultCityGraph();

  // clear vizState overlays
  vizState.visited.clear();
  vizState.frontier.clear();
  vizState.path.clear();
  vizState.mstEdges.clear();
  vizState.activeEdge = null;
  vizState.startNode = null;
  vizState.endNode   = null;

  vizState.tin      = [];
  vizState.tout     = [];
  vizState.level    = [];
  vizState.pqTop    = [];
  vizState.pqTopF   = [];
  vizState.pqTopB   = [];
  vizState.currentAlgo = null;
  vizState.status   = "";
  vizState.visitedF.clear();
  vizState.visitedB.clear();
  renderStatus();
  renderPQ();
  drawGraph();
};

if (toggleNodesBtn) {
  toggleNodesBtn.onclick = () => {
    vizState.hideCircles = !vizState.hideCircles;
    drawGraph();
  };
}

if (toggleWeightsBtn) {
  toggleWeightsBtn.onclick = () => {
    vizState.hideWeights = !vizState.hideWeights;
    drawGraph();
  };
}


function runAnimation(iterator) {
  const speedSlider = document.getElementById("speedSlider");

  function step() {
    const res = iterator.next();
    if (res.done) {
      return;
    }

    animate(res.value);

    const sliderVal = Number(speedSlider.value);
    const minDelay = 50;
    const maxDelay = 1000;
    const delay = maxDelay - (sliderVal / 1000) * (maxDelay - minDelay);

    setTimeout(step, delay);
  }

  step();
}

function animate(evt) {
  // DFS tin/tout
  if (evt.tin) {
    vizState.tin = evt.tin;
  }
  if (evt.tout) {
    vizState.tout = evt.tout;
  }
  // BFS levels
  if (evt.level) {
    vizState.level = evt.level;
  }

  const algo = vizState.currentAlgo;

  // PQ snapshots
  if ((algo === "dijkstra" || algo === "astar") && evt.pqTop) {
    vizState.pqTop = evt.pqTop;
    renderPQ();
  } else if (algo === "astar2" && (evt.pqTopF || evt.pqTopB)) {
    vizState.pqTopF = evt.pqTopF || [];
    vizState.pqTopB = evt.pqTopB || [];
    renderPQ();
  }

  // generic visited/frontier
  if (evt.type === "visit") {
    if (typeof evt.node === "number") {
      vizState.visited.add(evt.node);
      vizState.frontier.delete(evt.node);
    }
    vizState.activeEdge = null;
  } else if (evt.type === "relax" || evt.type === "discover") {
    const [u, v] = evt.edge;
    vizState.frontier.add(v);
    vizState.activeEdge = edgeKey(u, v);
  } else if (evt.type === "mst-add") {
    const [u, v] = evt.edge;
    const key = edgeKey(u, v);
    vizState.mstEdges.add(key);
    vizState.activeEdge = key;
  } else if (evt.type === "mst-skip") {
    const [u, v] = evt.edge;
    vizState.activeEdge = edgeKey(u, v);
  } else if (evt.type === "exit") {
    vizState.activeEdge = null;
  }

  // extra visited marking for bidirectional A*
  if (algo === "astar2" && evt.type === "visit" && typeof evt.node === "number" && evt.dir) {
    if (evt.dir === "F") {
      vizState.visitedF.add(evt.node);
    } else if (evt.dir === "B") {
      vizState.visitedB.add(evt.node);
    }
  }

  if (evt.type === "done") {
    vizState.activeEdge = null;
    vizState.path.clear();

    if (evt.path) {
      for (const node of evt.path) {
        vizState.path.add(node);
      }
    }
    if (evt.mstEdges) {
      for (const [u, v] of evt.mstEdges) {
        vizState.mstEdges.add(edgeKey(u, v));
      }
    }

    // ---- Status message logic ----
    const algoNow = vizState.currentAlgo;

    if (evt.noPath) {
      if (algoNow === "dijkstra" || algoNow === "astar" || algoNow === "astar2") {
        vizState.status = `No path from ${currentStart} to ${currentEnd}.`;
      } else if (algoNow === "bfs" || algoNow === "dfs") {
        vizState.status =
          `No path from ${currentStart} to ${currentEnd}. The graph might be disconnected.`;
      } else {
        vizState.status = "";
      }
    } else if (
      evt.distance != null &&
      (algoNow === "dijkstra" || algoNow === "astar" || algoNow === "astar2")
    ) {
      vizState.status =
        `Shortest distance from ${currentStart} to ${currentEnd}: ${evt.distance.toFixed(2)}`;
    } else {
      vizState.status = "";
    }

    renderStatus();
    renderPQ(); // in case algorithm ends with empty heap
  }

  drawGraph();
}

// build a big default city graph on page load
window.addEventListener("load", () => {
  loadDefaultCityGraph();
});
