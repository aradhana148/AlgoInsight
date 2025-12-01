function* dijkstra(graph, start, end) {
  const n = graph.nodes.length;
  const dist = Array(n).fill(Infinity);
  const parent = Array(n).fill(-1);
  const used = Array(n).fill(false);

  const pq = []; // { node, dist }
  dist[start] = 0;
  pq.push({ node: start, dist: 0 });

  function snapshotTop() {
    const sorted = [...pq].sort((a, b) => a.dist - b.dist);
    return sorted.slice(0, 5).map(e => ({ node: e.node, dist: e.dist }));
  }

  while (pq.length > 0) {
    pq.sort((a, b) => a.dist - b.dist);
    const { node: u, dist: du } = pq.shift();
    if (used[u]) continue;
    used[u] = true;

    yield { type: "visit", node: u, pqTop: snapshotTop() };

    if (u === end) break;

    for (const { v, w } of graph.adj.get(u) || []) {
      if (used[v]) continue;
      const nd = du + w;
      if (nd < dist[v]) {
        dist[v] = nd;
        parent[v] = u;
        pq.push({ node: v, dist: nd });
        yield { type: "relax", edge: [u, v], pqTop: snapshotTop() };
      }
    }
  }

  const endValid = typeof end === "number" && end >= 0 && end < n;

  if (!endValid || dist[end] === Infinity) {
    // No path
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
    distance: dist[end],
    pqTop: []
  };
}
