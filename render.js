const canvas = document.getElementById("canvas");
let graph = new Graph();

// global viz state used by main.js + render.js
window.vizState = {
  visited: new Set(),
  frontier: new Set(),
  path: new Set(),            // nodes on final path
  mstEdges: new Set(),
  activeEdge: null,
  startNode: null,
  endNode: null,
  tin: [],      // DFS entry times
  tout: [],     // DFS exit times
  level: [],    // BFS levels
  currentAlgo: null,
  pqTop: [],    // Dijkstra / A* heap top
  visitedF: new Set(),  // forward search (bidirectional A*)
  visitedB: new Set(),  // backward search (bidirectional A*)
  hideCircles: false,
  hideWeights: false,

  // NEW edge-sets for coloring
  pathEdges: new Set(),      // edges on final path
  exploredEdges: new Set(),  // edges explored in single-direction algos
  exploredF: new Set(),      // edges explored by forward search (A*2)
  exploredB: new Set(),      // edges explored by backward search (A*2)
};

// helper to canonicalize an undirected edge
function edgeKey(u, v) {
  return u < v ? `${u}-${v}` : `${v}-${u}`;
}

// for edge creation
let edgeStartNodeId = null;

// hit test: find node under click
function getNodeAtPosition(x, y) {
  const R = 14;
  const R2 = R * R;
  for (const n of graph.nodes) {
    if (!n) continue;  // skip deleted nodes
    const dx = x - n.x;
    const dy = y - n.y;
    if (dx * dx + dy * dy <= R2) {
      return n;
    }
  }
  return null;
}

// --- Event listeners: left-click = add node / add edge, right-click = delete node ---
canvas.addEventListener("click", handleLeftClick);
canvas.addEventListener("contextmenu", handleRightClick);

// LEFT CLICK: add node OR create edge
function handleLeftClick(e) {
  const pt = canvas.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const svgP = pt.matrixTransform(canvas.getScreenCTM().inverse());

  const hitNode = getNodeAtPosition(svgP.x, svgP.y);

  if (hitNode) {
    // clicked on an existing node: handle edge start/end
    if (edgeStartNodeId === null) {
      // start a new edge
      edgeStartNodeId = hitNode.id;
    } else if (edgeStartNodeId === hitNode.id) {
      // clicked same node again -> cancel
      edgeStartNodeId = null;
    } else {
      // create an edge between edgeStartNodeId and hitNode.id
      const u = edgeStartNodeId;
      const v = hitNode.id;
      const nu = graph.nodes[u];
      const nv = graph.nodes[v];
      const dx = nu.x - nv.x;
      const dy = nu.y - nv.y;
      const w = Math.sqrt(dx * dx + dy * dy); // Euclidean weight

      graph.addEdge(u, v, w);
      edgeStartNodeId = null;
    }
  } else {
    // no node hit -> add a new node
    const id = graph.addNode(svgP.x, svgP.y);
    edgeStartNodeId = null;

    // ensure tin/tout/level arrays are long enough
    if (vizState.tin.length <= id) {
      vizState.tin.length = id + 1;
      vizState.tout.length = id + 1;
    }
    if (vizState.level.length <= id) {
      vizState.level.length = id + 1;
    }
  }

  drawGraph();
}

// RIGHT CLICK: delete node
function handleRightClick(e) {
  e.preventDefault(); // prevent browser context menu

  const pt = canvas.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const svgP = pt.matrixTransform(canvas.getScreenCTM().inverse());

  const hitNode = getNodeAtPosition(svgP.x, svgP.y);
  if (!hitNode) return;

  const id = hitNode.id;

  // 1. Remove edges touching this node
  graph.edges = graph.edges.filter(edge => edge.u !== id && edge.v !== id);

  // 2. Fix adjacency: remove this node's list and remove it from others
  graph.adj.delete(id);
  for (const [nodeId, list] of graph.adj.entries()) {
    graph.adj.set(
      nodeId,
      list.filter(nei => nei.v !== id)
    );
  }

  // 3. Mark node as deleted (keep index/id stable)
  graph.nodes[id] = null;

  // 4. Clean up vizState: remove this node from all sets
  vizState.visited.delete(id);
  vizState.frontier.delete(id);
  vizState.path.delete(id);
  vizState.visitedF.delete(id); // clear bidirectional forward
  vizState.visitedB.delete(id); // clear bidirectional backward
  if (vizState.startNode === id) vizState.startNode = null;
  if (vizState.endNode === id) vizState.endNode = null;

  // clear tin/tout/level for this node (if present)
  if (vizState.tin[id] !== undefined) vizState.tin[id] = -1;
  if (vizState.tout[id] !== undefined) vizState.tout[id] = -1;
  if (vizState.level[id] !== undefined) vizState.level[id] = -1;

  // 5. Remove MST / active edges involving this node
  const newMstEdges = new Set();
  for (const key of vizState.mstEdges) {
    const [aStr, bStr] = key.split("-");
    const a = parseInt(aStr, 10);
    const b = parseInt(bStr, 10);
    if (a !== id && b !== id) newMstEdges.add(key);
  }
  vizState.mstEdges = newMstEdges;

  if (vizState.activeEdge) {
    const [aStr, bStr] = vizState.activeEdge.split("-");
    const a = parseInt(aStr, 10);
    const b = parseInt(bStr, 10);
    if (a === id || b === id) vizState.activeEdge = null;
  }

  // reset edge creation if we deleted the "start" node
  if (edgeStartNodeId === id) edgeStartNodeId = null;

  drawGraph();
}

function drawGraph() {
  canvas.innerHTML = "";

  const algo = vizState.currentAlgo;

  // ---- Draw edges + weight labels ----
  graph.edges.forEach(e => {
    const n1 = graph.nodes[e.u];
    const n2 = graph.nodes[e.v];
    if (!n1 || !n2) return; // skip edges with deleted endpoints

    const key = edgeKey(e.u, e.v);

    let stroke = "#555";
    let width = 2;

    const inPath = vizState.pathEdges && vizState.pathEdges.has(key);

    if (inPath) {
      // final shortest path edges: ORANGE
      stroke = "#f5a623";
      width = 4;
    } else if (algo === "mst" && vizState.mstEdges.has(key)) {
      // MST edges (only in MST mode)
      stroke = "#f5a623";
      width = 3;
    } else if (algo === "astar2") {
      // bidirectional A*: edges colored by direction
      const inF = vizState.exploredF && vizState.exploredF.has(key);
      const inB = vizState.exploredB && vizState.exploredB.has(key);
      if (inF && inB) {
        stroke = "#ff00ff";      // both sides used this edge
        width = 3;
      } else if (inF) {
        stroke = "#3b82f6";      // forward side (blue)
        width = 3;
      } else if (inB) {
        stroke = "#22c55e";      // backward side (green)
        width = 3;
      }
    } else if (vizState.exploredEdges && vizState.exploredEdges.has(key)) {
      // single-direction explored edges: BLUE
      stroke = "#3b82f6";
      width = 3;
    }

    // highlight currently active edge slightly thicker
    if (vizState.activeEdge === key) {
      width += 1;
    }

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", n1.x);
    line.setAttribute("y1", n1.y);
    line.setAttribute("x2", n2.x);
    line.setAttribute("y2", n2.y);
    line.setAttribute("stroke", stroke);
    line.setAttribute("stroke-width", width);
    canvas.appendChild(line);

    // ---- Edge weight label (at midpoint) ----
    if (!vizState.hideWeights) {                // respect hideWeights
      const mx = (n1.x + n2.x) / 2;
      const my = (n1.y + n2.y) / 2;

      const weightLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
      weightLabel.setAttribute("x", mx);
      weightLabel.setAttribute("y", my - 4); // small offset above the line
      weightLabel.setAttribute("text-anchor", "middle");
      weightLabel.setAttribute("font-size", "10px");
      weightLabel.setAttribute("fill", "#ddd");
      weightLabel.setAttribute("paint-order", "stroke");
      weightLabel.setAttribute("stroke", "#000");
      weightLabel.setAttribute("stroke-width", "0.8");

      const roundedW = Math.round(e.w); // or e.w.toFixed(1)
      weightLabel.textContent = roundedW;

      canvas.appendChild(weightLabel);
    }
  });

  // ---- Draw nodes + labels ----
  graph.nodes.forEach(n => {
    if (!n) return; // skip deleted nodes

    const circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circ.setAttribute("cx", n.x);
    circ.setAttribute("cy", n.y);

    // big circle vs tiny point based on hideCircles
    const radius = vizState.hideCircles ? 3 : 14;
    circ.setAttribute("r", radius);

    let fill = "#4af";
    let stroke = "#111";
    let strokeWidth = 2;

    // coloring logic, including bidirectional A*
    if (vizState.path.has(n.id)) {
      fill = "#00ffff";
    } else if (vizState.startNode === n.id) {
      fill = "#00ff00";
    } else if (vizState.endNode === n.id) {
      fill = "#ff3333";
    } else if (algo === "astar2") {
      // bidirectional A* colors
      const inF = vizState.visitedF.has(n.id);
      const inB = vizState.visitedB.has(n.id);

      if (inF && inB) {
        fill = "#ff00ff";     // both directions met (purple)
      } else if (inF) {
        fill = "#ffd700";     // forward side (gold)
      } else if (inB) {
        fill = "#ff88ff";     // backward side (pink)
      } else if (vizState.frontier.has(n.id)) {
        fill = "#00cc88";     // frontier
      }
    } else {
      // normal coloring for single-direction algorithms
      if (vizState.visited.has(n.id)) {
        fill = "#ffd700";
      } else if (vizState.frontier.has(n.id)) {
        fill = "#00cc88";
      }
    }

    if (edgeStartNodeId === n.id) {
      stroke = "#ffffff";
      strokeWidth = 3;
    }

    circ.setAttribute("fill", fill);
    circ.setAttribute("stroke", stroke);
    circ.setAttribute("stroke-width", strokeWidth);
    canvas.appendChild(circ);

    // node id label (center)
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", n.x);
    label.setAttribute("y", n.y + 4);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "12px");
    label.setAttribute("fill", "#000");
    label.textContent = n.id;
    canvas.appendChild(label);

    // ---- Under-node info: DFS tin/tout OR BFS level ----
    if (algo === "dfs") {
      const tinArr = vizState.tin || [];
      const toutArr = vizState.tout || [];
      const tinVal = tinArr[n.id];
      const toutVal = toutArr[n.id];

      if (tinVal !== undefined && tinVal >= 0) {
        const tt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tt.setAttribute("x", n.x);
        tt.setAttribute("y", n.y + 22); // slightly below the node
        tt.setAttribute("text-anchor", "middle");
        tt.setAttribute("font-size", "10px");
        tt.setAttribute("fill", "#ddd");

        const toutText = (toutVal !== undefined && toutVal >= 0) ? toutVal : "_";
        tt.textContent = `${tinVal}/${toutText}`; // e.g. "3/8"

        canvas.appendChild(tt);
      }
    } else if (algo === "bfs") {
      const levelArr = vizState.level || [];
      const lvl = levelArr[n.id];

      if (lvl !== undefined && lvl >= 0) {
        const tt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tt.setAttribute("x", n.x);
        tt.setAttribute("y", n.y + 22); // same position
        tt.setAttribute("text-anchor", "middle");
        tt.setAttribute("font-size", "10px");
        tt.setAttribute("fill", "#ddd");
        tt.textContent = `L${lvl}`; // e.g., "L2"

        canvas.appendChild(tt);
      }
    }
  });
}
