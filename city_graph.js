function loadDefaultCityGraph() {
    graph = new Graph();
  
    const svg = document.getElementById("canvas");
    let W = svg.clientWidth;
    let H = svg.clientHeight;
  
    // Fallback if clientWidth/Height is 0 on first load
    if (!W || !H) {
      W = 800;
      H = 500;
    }
  
    const NUM_NODES = 230; // tweak 200–300 as you like
  
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
  
    // 1) Place nodes randomly over almost the whole window
    // keep a little margin (40px) so they’re not on the border
    const marginX = 40;
    const marginY = 40;
  
    for (let i = 0; i < NUM_NODES; i++) {
      const x = marginX + Math.random() * (W - 2 * marginX);
      const y = marginY + Math.random() * (H - 2 * marginY);
      const id = graph.addNode(x, y);
      nodeIds.push(id);
    }
  
    // 2) Ensure connectivity: build a random spanning tree
    // each node i>0 connects to one random previous node j<i
    for (let i = 1; i < NUM_NODES; i++) {
      const u = nodeIds[i];
      const v = nodeIds[Math.floor(Math.random() * i)];
      addEdgeAuto(u, v);
    }
  
    // 3) Add local “street” edges based on distance threshold
    const R = Math.min(W, H) * 0.18; // connection radius
  
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
  
        // connect fairly often if they’re close
        if (dist < R && Math.random() < 0.35) {
          addEdgeAuto(u, v);
        }
      }
    }
  
    // 4) Add a few long “expressway / flyover” edges
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
  