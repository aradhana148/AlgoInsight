
/**
 * Yen's K-Shortest Paths Algorithm
 * 
 * @param {Graph} graph 
 * @param {number} start 
 * @param {number} end 
 * @param {number} K 
 */
function* yen(graph, start, end, K = 5) {
    // Store the K shortest paths: [{ path: [], dist: number }]
    const A = [];

    // Potential K-th shortest paths: [{ path: [], dist: number }]
    const B = [];

    // Helper to get distance of a path
    // Since edges might be removed, we might need original weights. 
    // However, for Yen's, we calculate cost as we go.
    // Actually, standard Yen's uses the costs found by Dijkstra.

    // 1. Determine the shortest path from start to end (A[0])
    const dIt = dijkstra(graph, start, end);
    let firstPathRes = null;

    // Proxy the iterator to show visualization
    while (true) {
        const res = dIt.next();
        if (res.done) break;
        yield res.value; // Show Dijkstra visualization
        if (res.value.type === "done" && !res.value.noPath) {
            firstPathRes = res.value;
        }
    }

    if (!firstPathRes) {
        yield { type: "done", noPath: true };
        return;
    }

    A.push({ path: firstPathRes.path, dist: firstPathRes.distance });

    // Notify UI about the first path
    yield {
        type: "yen-path-found",
        k: 1,
        path: firstPathRes.path,
        dist: firstPathRes.distance
    };

    // 2. Iterate for k = 1 to K-1
    for (let k = 1; k < K; k++) {
        // The previous shortest path is A[k-1]
        const prevPath = A[k - 1].path;

        // Iterate over spur nodes (all nodes in prevPath except the last one)
        for (let i = 0; i < prevPath.length - 1; i++) {
            const spurNode = prevPath[i];
            const rootPath = prevPath.slice(0, i + 1); // Path from start to spurNode

            // Calculate root path distance
            let rootPathDist = 0;
            for (let r = 0; r < rootPath.length - 1; r++) {
                const u = rootPath[r];
                const v = rootPath[r + 1];
                // Find edge weight u->v
                const edges = graph.adj.get(u);
                const e = edges.find(edge => edge.v === v);
                if (e) rootPathDist += e.w;
            }

            // --- REMOVE EDGES ---
            const removedEdges = []; // Stores { u, v, w, indexInU }

            // (a) Remove edges that are part of previously found shortest paths (A)
            // which share the same root path.
            for (const p of A) {
                const pPath = p.path;
                // Check if pPath starts with rootPath
                if (pPath.length > i + 1 && arrayEquals(rootPath, pPath.slice(0, i + 1))) {
                    // Remove edge (spurNode -> next node in pPath)
                    const u = spurNode;
                    const v = pPath[i + 1];

                    removeEdge(graph, u, v, removedEdges);
                }
            }

            // (b) Remove nodes in rootPath (except spurNode) to ensure loop-free
            // Actually Yen's usually says remove nodes in rootPath from graph.
            // But standard way is just not going back to them.
            // We can simulate this by marking them as visited/used in Dijkstra
            // or effectively removing all edges to/from them.
            // Removing edges is cleaner for the graph class we have.
            const removedNodesEdges = []; // Store edges for removed nodes to restore later
            for (let j = 0; j < i; j++) {
                const nodeToRemove = rootPath[j];
                // Remove all edges connected to nodeToRemove
                // But doing this efficiently means we need to find them.
                // Or simpler: just modify Dijkstra to ignore these nodes?
                // Modifying Dijkstra is harder since we rely on the existing generator.
                // So we will remove edges from the graph structure.
                disconnectNode(graph, nodeToRemove, removedNodesEdges);
            }

            // --- CALCULATE SPUR PATH ---
            // Search from spurNode to end
            const spurIt = dijkstra(graph, spurNode, end);
            let spurRes = null;

            // We might want to visualize this searching process too, but it might get very noisy.
            // User request: "while doing each dijkstra, just show that in the graph"
            // So yes, we yield values.
            while (true) {
                const res = spurIt.next();
                if (res.done) break;
                // augment result to indicate we are searching for K-th path
                res.value.message = `Searching for candidate path... (k=${k + 1}, spur=${spurNode})`;
                yield res.value;
                if (res.value.type === "done" && !res.value.noPath) {
                    spurRes = res.value;
                }
            }

            if (spurRes) {
                const spurPath = spurRes.path;
                const totalPath = [...rootPath.slice(0, -1), ...spurPath];
                const totalDist = rootPathDist + spurRes.distance;

                // Add to B if unique
                let isUnique = true;
                for (const b of B) {
                    if (arrayEquals(b.path, totalPath)) {
                        isUnique = false;
                        break;
                    }
                }
                // Also check if existing in A (though theoretically shouldn't happen if logic is correct)
                for (const aVal of A) {
                    if (arrayEquals(aVal.path, totalPath)) {
                        isUnique = false;
                        break;
                    }
                }

                if (isUnique) {
                    B.push({ path: totalPath, dist: totalDist });
                }
            }

            // --- RESTORE EDGES ---
            restoreEdges(graph, removedEdges);
            restoreNodeEdges(graph, removedNodesEdges);
        }

        if (B.length === 0) break;

        // Sort B by distance
        B.sort((a, b) => a.dist - b.dist);

        // Move shortest from B to A
        const bestPath = B.shift();
        A.push(bestPath);

        yield {
            type: "yen-path-found",
            k: k + 1,
            path: bestPath.path,
            dist: bestPath.dist
        };
    }

    // Done
    yield { type: "done", message: `Found ${A.length} paths.` };
}

// Helper: check array equality
function arrayEquals(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

// Helper: remove directed edge u->v from graph adjacency temporarily
// We only remove from u's adjacency list because Dijkstra reads u's neighbors.
// Since existing graph is undirected (addEdge adds both ways), we must be careful.
// Yen's works on directed graphs usually. For undirected, we treat u->v as directed edge to block.
// But if we block u->v, we might still allow v->u? 
// In Undirected Yen's, blocking u-v usually means blocking the edge entirely.
function removeEdge(graph, u, v, storage) {
    // Remove u -> v
    const adjU = graph.adj.get(u);
    const indexU = adjU.findIndex(e => e.v === v);
    if (indexU !== -1) {
        const edgeStats = adjU[indexU];
        adjU.splice(indexU, 1);
        storage.push({ u, v, val: edgeStats, from: 'u' });
    }

    // Remove v -> u (Since it's undirected graph per implementation? checking graph.js...)
    // graph.js addEdge does: adj.get(u).push({v, w}); adj.get(v).push({v: u, w});
    // So yes, it is undirected.
    // If we traverse u->v in path A, we block edge {u,v}. This means v cannot go to u either?
    // Standard Yen's on undirected graphs blocks the edge in both directions.
    const adjV = graph.adj.get(v);
    const indexV = adjV.findIndex(e => e.v === u);
    if (indexV !== -1) {
        const edgeStats = adjV[indexV];
        adjV.splice(indexV, 1);
        storage.push({ u: v, v: u, val: edgeStats, from: 'v' });
    }
}

function restoreEdges(graph, storage) {
    // Restore in reverse order to maintain indices logic if possible, 
    // but since we just push back, order doesn't strictly matter for correctness of list content.
    while (storage.length > 0) {
        const item = storage.pop();
        graph.adj.get(item.u).push(item.val);
    }
}

function disconnectNode(graph, u, storage) {
    // Remove all edges from u
    // AND remove all edges pointing to u from neighbors
    // This is expensive but necessary for "removing node"

    // 1. edges from u
    const neighbors = [...graph.adj.get(u)]; // copy
    graph.adj.set(u, []); // clear u's edges

    storage.push({ u, neighbors });

    // 2. edges to u from neighbors
    for (const edge of neighbors) {
        const v = edge.v;
        const adjV = graph.adj.get(v);
        const idx = adjV.findIndex(e => e.v === u);
        if (idx !== -1) {
            const val = adjV[idx];
            adjV.splice(idx, 1);
            storage.push({ target: v, val, type: 'incoming' });
        }
    }
}

function restoreNodeEdges(graph, storage) {
    // restore in reverse
    for (let i = storage.length - 1; i >= 0; i--) {
        const item = storage[i];
        if (item.type === 'incoming') {
            graph.adj.get(item.target).push(item.val);
        } else {
            graph.adj.set(item.u, item.neighbors);
        }
    }
}
