function* bfs(graph, start, end) {
    const n = graph.nodes.length;
    const visited = Array(n).fill(false);
    const parent = Array(n).fill(-1);
    const level = Array(n).fill(-1);
  
    const endValid = typeof end === "number" && end >= 0 && end < n;
  
    // ---------- CASE 1: no end => full graph traversal ----------
    if (!endValid) {
      function* bfsFrom(source) {
        if (!graph.nodes[source]) return;
        const q = [];
        visited[source] = true;
        level[source] = 0;
        q.push(source);
  
        while (q.length > 0) {
          const u = q.shift();
          yield { type: "visit", node: u, level: [...level] };
  
          for (const { v } of graph.adj.get(u) || []) {
            if (!visited[v] && graph.nodes[v]) {
              visited[v] = true;
              parent[v] = u;
              level[v] = level[u] + 1;
              q.push(v);
              yield { type: "discover", edge: [u, v], level: [...level] };
            }
          }
        }
      }
  
      // BFS starting from chosen start
      if (graph.nodes[start]) {
        yield* bfsFrom(start);
      }
      // Then other components
      for (let i = 0; i < n; i++) {
        if (!visited[i] && graph.nodes[i]) {
          yield* bfsFrom(i);
        }
      }
  
      yield { type: "done", level: [...level] };
      return;
    }
  
    // ---------- CASE 2: end is given => BFS from start only ----------
    const q = [];
    visited[start] = true;
    level[start] = 0;
    q.push(start);
  
    while (q.length > 0) {
      const u = q.shift();
      yield { type: "visit", node: u, level: [...level] };
  
      if (u === end) break;
  
      for (const { v } of graph.adj.get(u) || []) {
        if (!visited[v]) {
          visited[v] = true;
          parent[v] = u;
          level[v] = level[u] + 1;
          q.push(v);
          yield { type: "discover", edge: [u, v], level: [...level] };
        }
      }
    }
  
    if (!visited[end]) {
      // No path from start to end
      yield { type: "done", noPath: true, level: [...level] };
      return;
    }
  
    const path = [];
    for (let cur = end; cur !== -1; cur = parent[cur]) {
      path.push(cur);
    }
    path.reverse();
  
    yield { type: "done", path, level: [...level] };
  }
  
  
  function* dfs(graph, start, end) {
    const n = graph.nodes.length;
    const visited = Array(n).fill(false);
    const parent = Array(n).fill(-1);
    const tin = Array(n).fill(-1);
    const tout = Array(n).fill(-1);
    let timer = 0;
  
    const endValid = typeof end === "number" && end >= 0 && end < n;
    let foundEnd = false;
  
    function* dfsRec(u) {
      visited[u] = true;
      tin[u] = timer++;
      yield { type: "visit", node: u, tin: [...tin], tout: [...tout] };
  
      if (endValid && u === end) {
        tout[u] = timer++;
        yield { type: "exit", node: u, tin: [...tin], tout: [...tout] };
        foundEnd = true;
        return;
      }
  
      for (const { v } of graph.adj.get(u) || []) {
        if (!visited[v]) {
          parent[v] = u;
          yield { type: "discover", edge: [u, v], tin: [...tin], tout: [...tout] };
          yield* dfsRec(v);
          if (endValid && foundEnd) return;
        }
      }
  
      tout[u] = timer++;
      yield { type: "exit", node: u, tin: [...tin], tout: [...tout] };
    }
  
    // ---------- CASE 1: no end => full graph DFS ----------
    if (!endValid) {
      if (graph.nodes[start]) {
        yield* dfsRec(start);
      }
      for (let i = 0; i < n; i++) {
        if (!visited[i] && graph.nodes[i]) {
          yield* dfsRec(i);
        }
      }
      yield { type: "done", tin: [...tin], tout: [...tout] };
      return;
    }
  
    // ---------- CASE 2: end given => DFS from start only ----------
    if (graph.nodes[start]) {
      yield* dfsRec(start);
    }
  
    if (!visited[end]) {
      // No path from start to end
      yield { type: "done", noPath: true, tin: [...tin], tout: [...tout] };
      return;
    }
  
    const path = [];
    for (let cur = end; cur !== -1; cur = parent[cur]) {
      path.push(cur);
    }
    path.reverse();
  
    yield { type: "done", path, tin: [...tin], tout: [...tout] };
  }
  