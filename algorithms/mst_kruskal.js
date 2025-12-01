class DSU {
    constructor(n) {
      this.parent = Array(n);
      this.rank = Array(n).fill(0);
      for (let i = 0; i < n; ++i) this.parent[i] = i;
    }
    find(x) {
      if (this.parent[x] !== x) {
        this.parent[x] = this.find(this.parent[x]);
      }
      return this.parent[x];
    }
    unite(a, b) {
      a = this.find(a);
      b = this.find(b);
      if (a === b) return false;
      if (this.rank[a] < this.rank[b]) [a, b] = [b, a];
      this.parent[b] = a;
      if (this.rank[a] === this.rank[b]) this.rank[a]++;
      return true;
    }
  }
  
  function* mstKruskal(graph) {
    const n = graph.nodes.length;
    const dsu = new DSU(n);
    const edges = [...graph.edges];
  
    // Sort by weight
    edges.sort((e1, e2) => e1.w - e2.w);
  
    const mstEdges = [];
  
    for (const e of edges) {
      const { u, v, w } = e;
      const ru = dsu.find(u);
      const rv = dsu.find(v);
  
      if (ru !== rv) {
        dsu.unite(ru, rv);
        mstEdges.push([u, v]);
        yield { type: "mst-add", edge: [u, v], weight: w, mstEdges: [...mstEdges] };
      } else {
        yield { type: "mst-skip", edge: [u, v], weight: w };
      }
    }
  
    yield { type: "done", mstEdges };
  }
  