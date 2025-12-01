class Graph {
  constructor() {
    this.nodes = [];          // {id, x, y}
    this.edges = [];          // {u, v, w}
    this.adj = new Map();     // id -> [{v, w}, ...]
  }

  addNode(x, y) {
    const id = this.nodes.length;
    this.nodes.push({ id, x, y });
    this.adj.set(id, []);
    return id;
  }

  addEdge(u, v, w) {
    this.edges.push({ u, v, w });
    // undirected
    this.adj.get(u).push({ v, w });
    this.adj.get(v).push({ v: u, w });
  }
}
