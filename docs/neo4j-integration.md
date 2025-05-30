# Neo4j Graph Database Integration

This document explains how to use the Neo4j integration for analyzing connections data from the AI_devs task.

## Prerequisites

1. **Neo4j Database**: You need a running Neo4j instance. You can either:
   - Install Neo4j Desktop: https://neo4j.com/download/
   - Run Neo4j using Docker: `docker run -p 7474:7474 -p 7687:7687 neo4j`
   - Use Neo4j Aura (cloud): https://neo4j.com/cloud/aura/

2. **Environment Configuration**: Copy `.env.example` to `.env` and update the Neo4j credentials:
   ```bash
   NEO4J_URI=bolt://localhost:7687
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=your_password
   AI_DEVS_API_KEY=your_api_key
   ```

## Features

### Neo4jService Methods

The `Neo4jService` class provides the following functionality:

#### Basic Operations
- `clearDatabase()` - Removes all nodes and relationships
- `createUser(userId)` - Creates a single user node
- `createConnection(user1Id, user2Id)` - Creates a connection between two users
- `batchCreateConnections(connections)` - Efficiently creates multiple connections

#### Analysis Methods
- `getNetworkStats()` - Returns network statistics (total users, avg/max/min connections)
- `findMostConnectedUsers(limit)` - Finds users with the most connections
- `getUserConnections(userId)` - Gets all direct connections for a user
- `findShortestPath(fromUserId, toUserId)` - Finds shortest path between two users
- `findAllPaths(fromUserId, toUserId, maxDepth)` - Finds all paths within a depth limit

## Usage Examples

### 1. Running the S03E05 Task with Graph Creation

```bash
npm run start --dir=s03e05
```

This will:
1. Fetch connections data from the API
2. Create a Neo4j graph database
3. Populate it with users and connections
4. Show network statistics and analysis
5. Submit the result to AI_devs

### 2. Running the Graph Analysis Demo

```bash
npm run neo4j-graph-demo
```

This comprehensive demo will:
- Load connections data from the API
- Create and populate the graph database
- Show network statistics
- Find most connected users
- Demonstrate shortest path finding
- Show user-specific connections
- Perform advanced graph analysis

### 3. Using Neo4j Browser for Visualization

After running either script, you can visualize the graph using Neo4j Browser:

1. Open http://localhost:7474 in your web browser
2. Connect using your Neo4j credentials
3. Run these Cypher queries:

```cypher
// Show a sample of the graph (limit to 100 nodes for performance)
MATCH (n:User)-[r:CONNECTED_TO]-(m:User) 
RETURN n, r, m 
LIMIT 100

// Find the most connected user
MATCH (u:User)-[:CONNECTED_TO]-(connected:User)
WITH u, count(connected) as connectionCount
RETURN u.id as userId, connectionCount
ORDER BY connectionCount DESC
LIMIT 1

// Find shortest path between two specific users
MATCH (start:User {id: "43"}), (end:User {id: "92"})
MATCH path = shortestPath((start)-[:CONNECTED_TO*]-(end))
RETURN path, length(path) as pathLength

// Find users with only one connection (leaf nodes)
MATCH (u:User)-[:CONNECTED_TO]-(connected:User)
WITH u, count(connected) as connectionCount
WHERE connectionCount = 1
RETURN u.id as userId, connectionCount

// Find potential communities (users with many shared connections)
MATCH (u1:User)-[:CONNECTED_TO]-(shared:User)-[:CONNECTED_TO]-(u2:User)
WHERE u1.id < u2.id  // Avoid duplicates
WITH u1, u2, count(shared) as sharedConnections
WHERE sharedConnections > 1
RETURN u1.id, u2.id, sharedConnections
ORDER BY sharedConnections DESC
LIMIT 10
```

## Graph Analysis Insights

The Neo4j integration enables various types of network analysis:

### 1. **Centrality Analysis**
- **Degree Centrality**: Users with the most direct connections
- **Betweenness Centrality**: Users who act as bridges between different parts of the network

### 2. **Path Analysis**
- **Shortest Paths**: Find the minimum number of hops between any two users
- **All Paths**: Discover multiple ways users might be connected
- **Network Diameter**: Understand how "wide" the network is

### 3. **Community Detection**
- **Leaf Nodes**: Users with only one connection (potentially new or inactive)
- **Bridge Users**: Highly connected users who might be important connectors
- **Shared Connections**: Users who have many mutual connections

### 4. **Network Health**
- **Connectivity**: Whether the graph is fully connected
- **Distribution**: How connections are distributed across users
- **Clustering**: How densely connected different parts of the network are

## Advanced Queries

Here are some advanced Cypher queries you can run:

```cypher
// Find the network diameter (longest shortest path)
MATCH (u1:User), (u2:User)
WHERE u1.id < u2.id
MATCH path = shortestPath((u1)-[:CONNECTED_TO*]-(u2))
RETURN MAX(length(path)) as networkDiameter

// Find triangles (groups of 3 mutually connected users)
MATCH (a:User)-[:CONNECTED_TO]-(b:User)-[:CONNECTED_TO]-(c:User)-[:CONNECTED_TO]-(a)
WHERE a.id < b.id < c.id
RETURN a.id, b.id, c.id
LIMIT 10

// Find the most central user (highest betweenness centrality approximation)
MATCH (u:User)
MATCH (start:User), (end:User)
WHERE start.id < end.id AND start <> u AND end <> u
MATCH path = shortestPath((start)-[:CONNECTED_TO*]-(end))
WHERE u IN nodes(path)
WITH u, count(*) as pathsThrough
RETURN u.id, pathsThrough
ORDER BY pathsThrough DESC
LIMIT 5
```

## Troubleshooting

### Common Issues

1. **Connection Failed**: Make sure Neo4j is running and credentials are correct
2. **Out of Memory**: For large datasets, consider increasing Neo4j memory settings
3. **Slow Queries**: Use `LIMIT` clauses and consider creating indexes for large datasets

### Creating Indexes for Better Performance

```cypher
// Create index on User ID for faster lookups
CREATE INDEX user_id_index FOR (u:User) ON (u.id)

// Show all indexes
SHOW INDEXES
```

## Data Model

The graph uses a simple data model:

- **Nodes**: `(:User {id: string})` - Represents each user
- **Relationships**: `[:CONNECTED_TO]` - Represents connections between users

This model is undirected (connections work both ways) and unweighted (all connections are equal).

## Next Steps

You can extend this integration to:

1. Add user properties (name, metadata, etc.)
2. Add relationship properties (connection strength, timestamp, etc.)
3. Implement more sophisticated community detection algorithms
4. Add real-time updates to the graph
5. Integrate with graph visualization libraries like D3.js or vis.js
