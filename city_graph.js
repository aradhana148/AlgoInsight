function loadDefaultCityGraph() {
  console.log('Recursive City Graph Loaded');
  graph = new Graph();

  const svg = document.getElementById("canvas");
  let W = svg.clientWidth;
  let H = svg.clientHeight;

  if (!W || !H) {
    W = 800;
    H = 500;
  }

  // 1. Recursive Rectangle Subdivision (BSP)
  const MIN_SIZE = 80; // Minimum width/height of a rectangle
  const rectangles = [];

  class Rectangle {
    constructor(x, y, w, h) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.nodes = []; // To store node IDs belonging to this rect
    }

    get center() {
      return { x: this.x + this.w / 2, y: this.y + this.h / 2 };
    }
  }

  function split(rect) {
    // Randomly decide to split horizontally or vertically
    // Bias towards splitting the longer dimension to keep squares
    let splitVertical = Math.random() < 0.5;
    if (rect.w > rect.h * 1.5) splitVertical = true;
    else if (rect.h > rect.w * 1.5) splitVertical = false;

    if (splitVertical) {
      // Split width
      if (rect.w < MIN_SIZE * 2) {
        rectangles.push(rect);
        return;
      }
      // Split point between 30% and 70%
      const splitX = rect.w * (0.3 + 0.4 * Math.random());
      const r1 = new Rectangle(rect.x, rect.y, splitX, rect.h);
      const r2 = new Rectangle(rect.x + splitX, rect.y, rect.w - splitX, rect.h);
      split(r1);
      split(r2);
    } else {
      // Split height
      if (rect.h < MIN_SIZE * 2) {
        rectangles.push(rect);
        return;
      }
      const splitY = rect.h * (0.3 + 0.4 * Math.random());
      const r1 = new Rectangle(rect.x, rect.y, rect.w, splitY);
      const r2 = new Rectangle(rect.x, rect.y + splitY, rect.w, rect.h - splitY);
      split(r1);
      split(r2);
    }
  }

  // Start with full screen (add small margin)
  const MARGIN = 20;
  split(new Rectangle(MARGIN, MARGIN, W - 2 * MARGIN, H - 2 * MARGIN));

  // 2. Generate Connected Graph inside each Rectangle
  rectangles.forEach(rect => {
    // Number of nodes proportional to area, or random 6-9
    const numNodes = Math.floor(Math.random() * 4) + 9;
    const localNodes = [];

    // Create nodes
    for (let i = 0; i < numNodes; i++) {
      const nx = rect.x + Math.random() * rect.w;
      const ny = rect.y + Math.random() * rect.h;
      // Keep away from edges lightly for aesthetics
      const padding = 0;
      const clampedX = Math.max(rect.x + padding, Math.min(rect.x + rect.w - padding, nx));
      const clampedY = Math.max(rect.y + padding, Math.min(rect.y + rect.h - padding, ny));

      const id = graph.addNode(clampedX, clampedY);
      rect.nodes.push(id);
      localNodes.push({ id, x: clampedX, y: clampedY });
    }

    // Ensure connectivity (b/w local nodes) - simple MST
    // 1. Calculate all pairwise distances
    const edges = [];
    for (let i = 0; i < localNodes.length; i++) {
      for (let j = i + 1; j < localNodes.length; j++) {
        const u = localNodes[i];
        const v = localNodes[j];
        const d = Math.hypot(u.x - v.x, u.y - v.y);
        edges.push({ u: u.id, v: v.id, w: d });
      }
    }
    // 2. Kruskal's or Prim's. Since N is tiny (3-6), we can just do Prim's-ish
    // or just sort edges and union-find.
    edges.sort((a, b) => a.w - b.w);

    const parent = new Map();
    const find = (i) => {
      if (!parent.has(i)) parent.set(i, i);
      if (parent.get(i) !== i) parent.set(i, find(parent.get(i)));
      return parent.get(i);
    }
    const union = (i, j) => {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) {
        parent.set(rootI, rootJ);
        return true;
      }
      return false;
    }

    let edgesCount = 0;
    for (let e of edges) {
      if (union(e.u, e.v)) {
        graph.addEdge(e.u, e.v, e.w);
        edgesCount++;
      }
    }

    // Optional: Add a few extra edges for cycles (city blocks)
    for (let e of edges) {
      // with small probability, add if not already added?
      // graph.addEdge checks duplicates? likely not or undirected.
      // let's just assume we want MST + 1 or 2.
      if (Math.random() < 0.2 && edgesCount < edges.length) { // naive check
        // check if edge already exists in graph? 
        // Graph class likely doesn't check, but UI handles it.
        // cleaner to just skip for now to keep it clean 'connected graph'
      }
    }

    // Add 1-2 extra random edges for loops if possible
    if (localNodes.length > 3) {
      // Find an edge not used in MST
      for (let e of edges) {
        if (find(e.u) === find(e.v)) { // actually they are all connected now
          // Just add one based on probability
          if (Math.random() < 0.15) {
            graph.addEdge(e.u, e.v, e.w);
          }
        }
      }
    }

  });

  // 3. Connect Adjacent Rectangles
  // Helper: check adjacency
  function getOverlap(aStart, aLen, bStart, bLen) {
    const start = Math.max(aStart, bStart);
    const end = Math.min(aStart + aLen, bStart + bLen);
    return Math.max(0, end - start);
  }

  for (let i = 0; i < rectangles.length; i++) {
    for (let j = i + 1; j < rectangles.length; j++) {
      const r1 = rectangles[i];
      const r2 = rectangles[j];

      // Check if they touch
      // Tolerance for float errors
      const tol = 1.0;

      let sharedBoundary = null; // {x, y} "center" of the shared line

      // Horizontal adjacency: right of r1 ~ left of r2
      if (Math.abs((r1.x + r1.w) - r2.x) < tol || Math.abs((r2.x + r2.w) - r1.x) < tol) {
        const overlap = getOverlap(r1.y, r1.h, r2.y, r2.h);
        if (overlap > 1) {
          const yStart = Math.max(r1.y, r2.y);
          const xCommon = (Math.abs((r1.x + r1.w) - r2.x) < tol) ? r2.x : r1.x;
          sharedBoundary = { x: xCommon, y: yStart + overlap / 2 };
        }
      }
      // Vertical adjacency
      else if (Math.abs((r1.y + r1.h) - r2.y) < tol || Math.abs((r2.y + r2.h) - r1.y) < tol) {
        const overlap = getOverlap(r1.x, r1.w, r2.x, r2.w);
        if (overlap > 1) {
          const xStart = Math.max(r1.x, r2.x);
          const yCommon = (Math.abs((r1.y + r1.h) - r2.y) < tol) ? r2.y : r1.y;
          sharedBoundary = { x: xStart + overlap / 2, y: yCommon };
        }
      }

      if (sharedBoundary) {
        // Find closest node in r1 to sharedBoundary and closest in r2
        const getClosest = (rect) => {
          let closestId = -1;
          let minD = Infinity;
          for (let nodeId of rect.nodes) {
            const n = graph.nodes[nodeId];
            const d = Math.hypot(n.x - sharedBoundary.x, n.y - sharedBoundary.y);
            if (d < minD) {
              minD = d;
              closestId = nodeId;
            }
          }
          return closestId;
        };

        const u = getClosest(r1);
        const v = getClosest(r2);

        if (u !== -1 && v !== -1) {
          const nU = graph.nodes[u];
          const nV = graph.nodes[v];
          const dist = Math.hypot(nU.x - nV.x, nU.y - nV.y);
          // Check if edge exists? Efficient graph assumes we don't duplicate too much.
          // We just add it.
          graph.addEdge(u, v, dist);
        }
      }
    }
  }

  // Set default start/end nodes
  const startInput = document.getElementById("startNode");
  const endInput = document.getElementById("endNode");
  if (startInput && endInput && graph.nodes.length > 0) {
    startInput.value = 0;
    endInput.value = graph.nodes.length - 1;
  }

  drawGraph();
}

