// nodes layer
        var rootNodeIds = [reqBody.nodeID],
          level = 1,
          visited_nodes = [];

        while (rootNodeIds.length > 0) {
          let next_root_ids = [];

          rootNodeIds.forEach(rootNodeId => {
            let next_level_ids = this.graph.edges
              .filter(edge => {
                // find next level node's id by edge. but filter what has visited.
                return (
                  !visited_nodes.includes(edge.source) &&
                  !visited_nodes.includes(edge.target) &&
                  (edge.source === rootNodeId || edge.target === rootNodeId)
                );
              })
              .map((
                edge //return the node's id
              ) => {
                if (edge.source === rootNodeId) {
                  return edge.target;
                }
                if (edge.target === rootNodeId) {
                  return edge.source;
                }
              });

            this.graph.nodes
              .filter(node => node.id === rootNodeId && !visited_nodes.includes(node.id))
              .forEach(node => {
                node.level = level;
              });

            next_root_ids.push(...next_level_ids);
          });

          // prepare for next level search
          visited_nodes = visited_nodes.concat(rootNodeIds);
          // console.log(level,next_root_ids,visited_nodes);
          level++;
          rootNodeIds = next_root_ids;
        }
