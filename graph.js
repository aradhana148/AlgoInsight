class Graph {
  constructor() {
    this.nodes = [];          // {id, x, y}
    this.edges = [];          // {u, v, w}
    this.adj = new Map();     // id -> [{v, w}, ...]
  }

  addNode(x, y, logicX, logicY) {
    const id = this.nodes.length;
    // If logicX/Y not provided, default to x/y (1:1 scale initially)
    const lx = (logicX !== undefined) ? logicX : x;
    const ly = (logicY !== undefined) ? logicY : y;
    this.nodes.push({ id, x, y, logicX: lx, logicY: ly });
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
