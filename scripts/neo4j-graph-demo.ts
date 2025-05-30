import { Neo4jService, ConnectionData } from "../src/services/neo4j.service.js";
import { getCentralUrl } from "../src/url.js";
import { postRequest } from "../src/api.js";

const dbUrl = getCentralUrl('apidb');

interface DatabaseRequest {
    task: string;
    apikey: string;
    query: string;
}

interface DatabaseResponse {
    reply: any[];
    error?: string;
}

async function queryDatabase(query: string): Promise<DatabaseResponse> {
    const requestBody: DatabaseRequest = {
        task: "database",
        apikey: process.env.AI_DEVS_API_KEY!,
        query
    };

    return await postRequest<DatabaseRequest, DatabaseResponse>(dbUrl, requestBody);
}

async function getConnectionsData(): Promise<ConnectionData[]> {
    const result = await queryDatabase("SELECT * FROM connections");
    return result.reply as ConnectionData[];
}

async function demonstrateGraphQueries() {
    const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const neo4jUsername = process.env.NEO4J_USERNAME || 'neo4j';
    const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';

    const neo4jService = new Neo4jService(neo4jUri, neo4jUsername, neo4jPassword);

    try {
        console.log('🔗 Neo4j Graph Database Demo for Connections Analysis');
        console.log('====================================================');

        // Get connections data
        const connections = await getConnectionsData();
        console.log(`\n📊 Loaded ${connections.length} connections from database`);

        // Clear and populate the graph
        await neo4jService.clearDatabase();
        await neo4jService.batchCreateConnections(connections);

        // 1. Network Statistics
        console.log('\n📈 Network Statistics:');
        console.log('======================');
        const stats = await neo4jService.getNetworkStats();
        console.log(`Total Users: ${stats.totalUsers}`);
        console.log(`Average Connections per User: ${stats.avgConnections?.toFixed(2)}`);
        console.log(`Max Connections: ${stats.maxConnections}`);
        console.log(`Min Connections: ${stats.minConnections}`);

        // 2. Most Connected Users
        console.log('\n🌟 Top 10 Most Connected Users:');
        console.log('================================');
        const topUsers = await neo4jService.findMostConnectedUsers(10);
        topUsers.forEach((user, index) => {
            console.log(`${index + 1}. User ${user.userId}: ${user.connections} connections`);
        });

        // 3. Path Finding Examples
        if (topUsers.length >= 2) {
            const user1 = topUsers[0].userId;
            const user2 = topUsers[1].userId;
            
            console.log(`\n🗺️  Shortest Path Analysis between User ${user1} and User ${user2}:`);
            console.log('================================================================');
            
            const shortestPaths = await neo4jService.findShortestPath(user1, user2);
            if (shortestPaths.length > 0) {
                shortestPaths.forEach((pathInfo, index) => {
                    console.log(`Path ${index + 1}: Length = ${pathInfo.length} steps`);
                });
            } else {
                console.log('No path found between these users');
            }

            // All paths within 4 degrees
            console.log(`\n🔄 All Paths (max 4 degrees) between User ${user1} and User ${user2}:`);
            console.log('=====================================================================');
            
            const allPaths = await neo4jService.findAllPaths(user1, user2, 4);
            if (allPaths.length > 0) {
                allPaths.slice(0, 5).forEach((pathInfo, index) => {
                    console.log(`Path ${index + 1}: ${pathInfo.length} steps`);
                });
                if (allPaths.length > 5) {
                    console.log(`... and ${allPaths.length - 5} more paths`);
                }
            } else {
                console.log('No paths found within 4 degrees');
            }
        }

        // 4. User-specific connections
        if (topUsers.length > 0) {
            const userId = topUsers[0].userId;
            console.log(`\n👥 Direct Connections for User ${userId}:`);
            console.log('=========================================');
            
            const userConnections = await neo4jService.getUserConnections(userId);
            console.log(`User ${userId} is directly connected to:`);
            userConnections.slice(0, 10).forEach((connectedId, index) => {
                console.log(`  ${index + 1}. User ${connectedId}`);
            });
            if (userConnections.length > 10) {
                console.log(`  ... and ${userConnections.length - 10} more users`);
            }
        }

        // 5. Advanced graph analysis
        console.log('\n🔍 Advanced Graph Analysis:');
        console.log('============================');
        
        // Find users with exactly one connection (leaf nodes)
        const leafUsersQuery = `
            MATCH (u:User)-[:CONNECTED_TO]-(connected:User)
            WITH u, count(connected) as connectionCount
            WHERE connectionCount = 1
            RETURN u.id as userId, connectionCount
            LIMIT 10
        `;
        const leafUsersResult = await neo4jService.executeQuery(leafUsersQuery);
        const leafUsers = leafUsersResult.records.map(record => record.get('userId'));
        console.log(`Users with only 1 connection (first 10): [${leafUsers.join(', ')}]`);

        // Find potential bridge users (users whose removal would disconnect the graph)
        const bridgeAnalysisQuery = `
            MATCH (u:User)-[:CONNECTED_TO]-(connected:User)
            WITH u, count(connected) as connectionCount
            WHERE connectionCount >= 3
            RETURN u.id as userId, connectionCount
            ORDER BY connectionCount DESC
            LIMIT 5
        `;
        const bridgeResult = await neo4jService.executeQuery(bridgeAnalysisQuery);
        const potentialBridges = bridgeResult.records.map(record => 
            `User ${record.get('userId')} (${record.get('connectionCount')} connections)`
        );
        console.log(`Potential bridge users (highly connected): [${potentialBridges.join(', ')}]`);

        console.log('\n✅ Graph analysis complete!');
        console.log('\n💡 You can now use Neo4j Browser to visualize the graph:');
        console.log('   - Open http://localhost:7474 in your browser');
        console.log('   - Run: MATCH (n:User)-[r:CONNECTED_TO]-(m:User) RETURN n, r, m LIMIT 100');

    } catch (error) {
        console.error('Error during graph analysis:', error);
    } finally {
        await neo4jService.close();
    }
}

// Run the demo
demonstrateGraphQueries();
