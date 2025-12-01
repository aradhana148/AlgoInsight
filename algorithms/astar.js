function heuristic(graph, u, goal) {
    const nu = graph.nodes[u];
    const ng = graph.nodes[goal];
    if (!nu || !ng) return 0;
    const dx = nu.x - ng.x;
    const dy = nu.y - ng.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  function* astar(graph, start, end) {
    const n = graph.nodes.length;
    const g = Array(n).fill(Infinity);
    const f = Array(n).fill(Infinity);
    const parent = Array(n).fill(-1);
    const closed = Array(n).fill(false);
  
    const pq = []; // { node, g, f }
    g[start] = 0;
    f[start] = heuristic(graph, start, end);
    pq.push({ node: start, g: g[start], f: f[start] });
  
    function snapshotTop() {
      const sorted = [...pq].sort((a, b) => a.f - b.f);
      return sorted.slice(0, 5).map(e => ({ node: e.node, g: e.g, f: e.f }));
    }
  
    const endValid = typeof end === "number" && end >= 0 && end < n;
  
    while (pq.length > 0) {
      pq.sort((a, b) => a.f - b.f);
      const { node: u, g: gu, f: fu } = pq.shift();
  
      if (closed[u]) continue;
      closed[u] = true;
  
      yield { type: "visit", node: u, pqTop: snapshotTop() };
  
      if (endValid && u === end) break;
  
      for (const { v, w } of graph.adj.get(u) || []) {
        if (closed[v]) continue;
        const tentativeG = gu + w;
        if (tentativeG < g[v]) {
          g[v] = tentativeG;
          f[v] = tentativeG + (endValid ? heuristic(graph, v, end) : 0);
          parent[v] = u;
          pq.push({ node: v, g: g[v], f: f[v] });
          yield { type: "relax", edge: [u, v], pqTop: snapshotTop() };
        }
      }
    }
  
    if (!endValid || g[end] === Infinity) {
      yield { type: "done", noPath: true, pqTop: [] };
      return;
    }
  
    const path = [];
    for (let cur = end; cur !== -1; cur = parent[cur]) {
      path.push(cur);
    }
    path.reverse();
  
    yield {
      type: "done",
      path,
      distance: g[end],
      pqTop: []
    };
  }
  
// ---------- Bidirectional A* (Double A*) with two heaps ----------

function* astarBidirectional(graph, start, end) {
  const n = graph.nodes.length;

  if (
    typeof start !== "number" || typeof end !== "number" ||
    start < 0 || start >= n || end < 0 || end >= n ||
    !graph.nodes[start] || !graph.nodes[end]
  ) {
    yield { type: "done", noPath: true };
    return;
  }

  if (start === end) {
    yield { type: "done", path: [start], distance: 0 };
    return;
  }

  const gF = Array(n).fill(Infinity);
  const fF = Array(n).fill(Infinity);
  const parentF = Array(n).fill(-1);

  const gB = Array(n).fill(Infinity);
  const fB = Array(n).fill(Infinity);
  const parentB = Array(n).fill(-1);

  const visitedF = Array(n).fill(false);
  const visitedB = Array(n).fill(false);

  const openF = []; // { node, g, f }
  const openB = []; // { node, g, f }

  gF[start] = 0;
  fF[start] = heuristic(graph, start, end);
  openF.push({ node: start, g: gF[start], f: fF[start] });

  gB[end] = 0;
  fB[end] = heuristic(graph, end, start);
  openB.push({ node: end, g: gB[end], f: fB[end] });

  let bestMeet = -1;
  let bestDist = Infinity;

  function popMin(queue) {
    if (queue.length === 0) return null;
    queue.sort((a, b) => a.f - b.f);
    return queue.shift();
  }

  function snapshotTopF() {
    const sorted = [...openF].sort((a, b) => a.f - b.f);
    return sorted.slice(0, 5).map(e => ({ node: e.node, g: e.g, f: e.f }));
  }

  function snapshotTopB() {
    const sorted = [...openB].sort((a, b) => a.f - b.f);
    return sorted.slice(0, 5).map(e => ({ node: e.node, g: e.g, f: e.f }));
  }

  function reconstructPath(meet) {
    // forward: start -> ... -> meet
    const pathF = [];
    let cur = meet;
    while (cur !== -1) {
      pathF.push(cur);
      cur = parentF[cur];
    }
    pathF.reverse();

    // backward: meet -> ... -> end
    const pathB = [];
    cur = meet;
    while (cur !== -1) {
      pathB.push(cur);
      cur = parentB[cur];
    }
    // pathB = [meet, ..., end], so drop meet to avoid duplicate
    return pathF.concat(pathB.slice(1));
  }

  while (openF.length > 0 && openB.length > 0) {
    openF.sort((a, b) => a.f - b.f);
    openB.sort((a, b) => a.f - b.f);

    const topF = openF[0];
    const topB = openB[0];

    // termination: if best possible new path can't beat bestDist
    if (
      bestMeet !== -1 &&
      (topF ? topF.f : Infinity) + (topB ? topB.f : Infinity) >= bestDist
    ) {
      break;
    }

    const expandForward = (!topB || (topF && topF.f <= topB.f));

    if (expandForward) {
      const cur = popMin(openF);
      if (!cur) break;
      const u = cur.node;
      if (visitedF[u]) continue;
      visitedF[u] = true;

      yield {
        type: "visit",
        node: u,
        dir: "F",
        pqTopF: snapshotTopF(),
        pqTopB: snapshotTopB(),
      };

      if (visitedB[u]) {
        const candDist = gF[u] + gB[u];
        if (candDist < bestDist) {
          bestDist = candDist;
          bestMeet = u;
        }
      }

      for (const { v, w } of graph.adj.get(u) || []) {
        if (!graph.nodes[v]) continue;
        const ng = gF[u] + w;
        if (ng < gF[v]) {
          gF[v] = ng;
          fF[v] = ng + heuristic(graph, v, end);
          parentF[v] = u;
          openF.push({ node: v, g: gF[v], f: fF[v] });
          yield {
            type: "relax",
            edge: [u, v],
            dir: "F",
            pqTopF: snapshotTopF(),
            pqTopB: snapshotTopB(),
          };
        }
      }
    } else {
      const cur = popMin(openB);
      if (!cur) break;
      const u = cur.node;
      if (visitedB[u]) continue;
      visitedB[u] = true;

      yield {
        type: "visit",
        node: u,
        dir: "B",
        pqTopF: snapshotTopF(),
        pqTopB: snapshotTopB(),
      };

      if (visitedF[u]) {
        const candDist = gF[u] + gB[u];
        if (candDist < bestDist) {
          bestDist = candDist;
          bestMeet = u;
        }
      }

      for (const { v, w } of graph.adj.get(u) || []) {
        if (!graph.nodes[v]) continue;
        const ng = gB[u] + w;
        if (ng < gB[v]) {
          gB[v] = ng;
          fB[v] = ng + heuristic(graph, v, start);
          parentB[v] = u;
          openB.push({ node: v, g: gB[v], f: fB[v] });
          yield {
            type: "relax",
            edge: [u, v],
            dir: "B",
            pqTopF: snapshotTopF(),
            pqTopB: snapshotTopB(),
          };
        }
      }
    }
  }

  if (bestMeet === -1 || bestDist === Infinity) {
    yield { type: "done", noPath: true, pqTopF: [], pqTopB: [] };
    return;
  }

  const path = reconstructPath(bestMeet);
  yield {
    type: "done",
    path,
    distance: bestDist,
    pqTopF: [],
    pqTopB: [],
  };
}

