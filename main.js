// assumes graph, drawGraph, vizState, edgeKey are already defined globally

let currentStart = null;
let currentEnd = null;
let currentAnimationTimer = null;

function stopAnimation() {
  if (currentAnimationTimer) {
    clearTimeout(currentAnimationTimer);
    currentAnimationTimer = null;
  }
}

const algoSelect = document.getElementById("algoSelect");
const startInput = document.getElementById("startNode");
const endInput = document.getElementById("endNode");
const runBtn = document.getElementById("runBtn");
const resetBtn = document.getElementById("resetBtn");
const clearBtn = document.getElementById("clearBtn");
const statusView = document.getElementById("statusView");
const pqView = document.getElementById("pqView");   // for heap display
const toggleNodesBtn = document.getElementById("toggleNodesBtn");
const toggleWeightsBtn = document.getElementById("toggleWeightsBtn");


// loadDefaultCityGraph is now loaded from city_graph.js


// ------------------ STATUS + PQ RENDERING ------------------ //

function renderStatus() {
  if (!statusView) return;
  const text = vizState.status || "";
  statusView.textContent = text;

  // Hide if empty
  statusView.style.display = text.trim() ? "block" : "none";
}

// render the top of the heap(s) into #pqView
function renderPQ() {
  if (!pqView) return;

  const algo = vizState.currentAlgo;
  const pqTop = vizState.pqTop || [];
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


// ------------------ ALGO SELECT CHANGE ------------------ //

algoSelect.onchange = () => {
  stopAnimation();
  const algo = algoSelect.value;

  // Toggle K input for Yen
  const kContainer = document.getElementById("yenKContainer");
  if (kContainer) {
    kContainer.style.display = (algo === "yen") ? "block" : "none";
  }

  vizState.tin = [];
  vizState.tout = [];
  vizState.level = [];
  vizState.pqTop = [];
  vizState.pqTopF = [];
  vizState.pqTopB = [];
  vizState.currentAlgo = algo;
  vizState.status = "";
  vizState.visitedF.clear();
  vizState.visitedB.clear();

  // 🔵 clear edge overlays when switching algorithms
  if (vizState.pathEdges) vizState.pathEdges.clear();
  if (vizState.exploredEdges) vizState.exploredEdges.clear();
  if (vizState.exploredF) vizState.exploredF.clear();
  if (vizState.exploredB) vizState.exploredB.clear();

  renderStatus();
  renderPQ();
  drawGraph();

  const yenContainer = document.getElementById("yenPathButtons");
  if (yenContainer) yenContainer.innerHTML = "";
};


// ------------------ RUN BUTTON ------------------ //

runBtn.onclick = () => {
  stopAnimation();
  const algo = algoSelect.value;
  vizState.currentAlgo = algo;

  currentStart = parseInt(startInput.value, 10);

  if (Number.isNaN(currentStart) || currentStart < 0 || currentStart >= graph.nodes.length) {
    alert("Invalid start node");
    return;
  }

  // ---- handle end node depending on algorithm ----
  const endRaw = endInput.value.trim();

  if (algo === "dijkstra" || algo === "astar" || algo === "astar2" || algo === "yen") {
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
  vizState.endNode = (algo === "mst" || currentEnd === -1 || currentEnd === null)
    ? null
    : currentEnd;

  // Clear DFS/BFS annotations when not used
  if (algo !== "dfs") {
    vizState.tin = [];
    vizState.tout = [];
  }
  if (algo !== "bfs") {
    vizState.level = [];
  }

  // Clear PQ info when not Dijkstra/A* / A*2
  if (algo !== "dijkstra" && algo !== "astar" && algo !== "astar2") {
    vizState.pqTop = [];
    vizState.pqTopF = [];
    vizState.pqTopB = [];
  }

  // Clear bidirectional visited state
  vizState.visitedF.clear();
  vizState.visitedB.clear();

  // 🔵 clear edge overlays for a fresh run
  if (vizState.pathEdges) vizState.pathEdges.clear();
  if (vizState.exploredEdges) vizState.exploredEdges.clear();
  if (vizState.exploredF) vizState.exploredF.clear();
  if (vizState.exploredB) vizState.exploredB.clear();

  // Clear status for new run
  vizState.status = "";
  // Clear Yen buttons for new run
  const yenContainer = document.getElementById("yenPathButtons");
  if (yenContainer) yenContainer.innerHTML = "";

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
  } else if (algo === "yen") {
    const kInput = document.getElementById("yenK");
    let kVal = parseInt(kInput.value, 10);
    if (Number.isNaN(kVal) || kVal < 2 || kVal > 5) {
      alert("K must be between 2 and 5");
      return;
    }
    it = yen(graph, currentStart, currentEnd, kVal);
  }

  if (it) runAnimation(it);
};


// ------------------ RESET BUTTON ------------------ //

resetBtn.onclick = () => {
  stopAnimation();
  // rebuild the default random city graph
  loadDefaultCityGraph();

  // clear vizState overlays
  vizState.visited.clear();
  vizState.frontier.clear();
  vizState.path.clear();
  vizState.mstEdges.clear();
  vizState.activeEdge = null;
  vizState.startNode = null;
  vizState.endNode = null;

  vizState.tin = [];
  vizState.tout = [];
  vizState.level = [];
  vizState.pqTop = [];
  vizState.pqTopF = [];
  vizState.pqTopB = [];
  vizState.currentAlgo = null;
  vizState.status = "";
  vizState.visitedF.clear();
  vizState.visitedB.clear();

  // 🔵 also clear edge overlays
  if (vizState.pathEdges) vizState.pathEdges.clear();
  if (vizState.exploredEdges) vizState.exploredEdges.clear();
  if (vizState.exploredF) vizState.exploredF.clear();
  if (vizState.exploredB) vizState.exploredB.clear();

  const yenContainer = document.getElementById("yenPathButtons");
  if (yenContainer) yenContainer.innerHTML = "";

  renderStatus();
  renderPQ();
  drawGraph();
};


// ------------------ CLEAR BUTTON ------------------ //

if (clearBtn) {
  clearBtn.onclick = () => {
    stopAnimation();

    // Empty graph
    graph = new Graph();

    // clear vizState overlays
    vizState.visited.clear();
    vizState.frontier.clear();
    vizState.path.clear();
    vizState.mstEdges.clear();
    vizState.activeEdge = null;
    vizState.startNode = null;
    vizState.endNode = null;

    vizState.tin = [];
    vizState.tout = [];
    vizState.level = [];
    vizState.pqTop = [];
    vizState.pqTopF = [];
    vizState.pqTopB = [];
    vizState.currentAlgo = null;
    vizState.status = "";
    vizState.visitedF.clear();
    vizState.visitedB.clear();

    if (vizState.pathEdges) vizState.pathEdges.clear();
    if (vizState.exploredEdges) vizState.exploredEdges.clear();
    if (vizState.exploredF) vizState.exploredF.clear();
    if (vizState.exploredB) vizState.exploredB.clear();

    const yenContainer = document.getElementById("yenPathButtons");
    if (yenContainer) yenContainer.innerHTML = "";

    renderStatus();
    renderPQ();
    drawGraph();
  };
}


// ------------------ TOGGLE BUTTONS ------------------ //

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


// ------------------ ANIMATION LOOP ------------------ //

function runAnimation(iterator) {
  const speedSlider = document.getElementById("speedSlider");

  function step() {
    const res = iterator.next();
    if (res.done) {
      return;
    }

    animate(res.value);

    const sliderVal = Number(speedSlider.value);
    const minDelay = 0;
    const maxDelay = 1000;
    const delay = maxDelay - (sliderVal / 1000) * (maxDelay - minDelay);

    currentAnimationTimer = setTimeout(step, delay);
  }

  stopAnimation(); // ensure any previous is gone (double safety)
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

  // generic visited/frontier + edge exploration
  if (evt.type === "visit") {
    if (typeof evt.node === "number") {
      vizState.visited.add(evt.node);
      vizState.frontier.delete(evt.node);
    }
    vizState.activeEdge = null;
  } else if (evt.type === "relax" || evt.type === "discover") {
    const [u, v] = evt.edge;
    vizState.frontier.add(v);
    const key = edgeKey(u, v);

    // mark explored edges for coloring
    if (algo === "astar2" && evt.dir) {
      if (!vizState.exploredF) vizState.exploredF = new Set();
      if (!vizState.exploredB) vizState.exploredB = new Set();
      if (evt.dir === "F") {
        vizState.exploredF.add(key);
      } else if (evt.dir === "B") {
        vizState.exploredB.add(key);
      }
    } else {
      if (!vizState.exploredEdges) vizState.exploredEdges = new Set();
      vizState.exploredEdges.add(key);
    }

    vizState.activeEdge = key;
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
  } else if (evt.type === "yen-path-found") {
    // Creating a button for the found path
    const container = document.getElementById("yenPathButtons");
    if (container) {
      const btn = document.createElement("button");
      btn.className = "yen-path-btn";
      btn.textContent = `Path ${evt.k}: Dist ${evt.dist.toFixed(2)}`;
      btn.onclick = () => renderYenPath(evt.path, evt.dist, btn);
      container.appendChild(btn);
    }
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

    // 🔶 build node path set
    if (evt.path) {
      for (const node of evt.path) {
        vizState.path.add(node);
      }
    }

    // 🔶 build edge path set (for orange highlighting)
    if (!vizState.pathEdges) vizState.pathEdges = new Set();
    vizState.pathEdges.clear();
    if (evt.path && evt.path.length >= 2) {
      for (let i = 0; i + 1 < evt.path.length; i++) {
        const u = evt.path[i];
        const v = evt.path[i + 1];
        vizState.pathEdges.add(edgeKey(u, v));
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
      if (algoNow === "dijkstra" || algoNow === "astar" || algoNow === "astar2" || algoNow === "yen") {
        vizState.status = `No path from ${currentStart} to ${currentEnd}.`;
      } else if (algoNow === "bfs" || algoNow === "dfs") {
        vizState.status =
          `No path from ${currentStart} to ${currentEnd}. The graph might be disconnected.`;
      } else {
        vizState.status = "";
      }
    } else if (
      evt.distance != null &&
      (algoNow === "dijkstra" || algoNow === "astar" || algoNow === "astar2" || algoNow === "yen")
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

// ------------------ YEN PATH RENDERING ------------------ //
function renderYenPath(pathNodes, dist, btnElement) {
  // Highlight the button
  const allBtns = document.querySelectorAll(".yen-path-btn");
  allBtns.forEach(b => b.classList.remove("active"));
  if (btnElement) btnElement.classList.add("active");

  // Update vizState to show this path
  vizState.path.clear();
  vizState.pathEdges.clear();

  if (pathNodes && pathNodes.length > 0) {
    for (const node of pathNodes) {
      vizState.path.add(node);
    }
    for (let i = 0; i < pathNodes.length - 1; i++) {
      const u = pathNodes[i];
      const v = pathNodes[i + 1];
      vizState.pathEdges.add(edgeKey(u, v));
    }
  }

  vizState.status = `Selected Path Distance: ${dist.toFixed(2)}`;
  renderStatus();
  drawGraph();
}


// ------------------ SIDEBAR TOGGLE ------------------ //
const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
const sidebar = document.getElementById("sidebar");

function resizeGraphX() {
  const svg = document.getElementById("canvas");
  if (!svg) return;

  const currentW = svg.clientWidth;

  // If we don't have a previous width (from city_graph.js), set it now (first run)
  if (!window.lastGraphWidth) {
    window.lastGraphWidth = currentW;
    return;
  }

  // If width hasn't changed significantly, skip
  if (Math.abs(currentW - window.lastGraphWidth) < 2) return;

  const scale = currentW / window.lastGraphWidth;

  if (graph && graph.nodes) {
    graph.nodes.forEach(node => {
      if (node) {
        // Scale the X coordinate
        node.x = node.x * scale;
      }
    });

    // Update global width tracker
    window.lastGraphWidth = currentW;

    // Track the accumulated scale (approximate) or just current visual scale
    // We can just calculate current scale relative to base if we knew base.
    // But logicX is fixed. So existing nodes are fine.
    // For new nodes, we need to know "what is the current X expansion relative to logic world?"
    // If logic world is 1.0.
    // We can infer scale from a sample node if we want, but simplest is to track it.
    // Let's assume logic scale is 1.0 initially.
    if (!vizState.currentScaleX) vizState.currentScaleX = 1.0;
    vizState.currentScaleX *= scale;

    // Redraw the graph at new coordinates
    // Note: Edge weights are deliberately NOT updated to preserve logical structure
    // as per user request ("scale look wise, keep edge weights same").
    drawGraph();
  }
}

if (toggleSidebarBtn && sidebar) {
  toggleSidebarBtn.onclick = () => {
    sidebar.classList.toggle("collapsed");

    // Wait for the CSS transition (0.3s) to finish before resizing
    setTimeout(() => {
      resizeGraphX();
    }, 320);
  };
}
