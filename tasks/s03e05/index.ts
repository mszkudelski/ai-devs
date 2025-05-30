import { getCentralUrl } from "../../src/url.js";
import { postRequest } from "../../src/api.js";
import { sendReport } from "../../src/report.js";
import { Neo4jService, ConnectionData } from "../../src/services/neo4j.service.js";

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

interface UserData {
    id: string;
    username: string;
    access_level: string;
    is_active: string;
    lastlog: string;
}

async function queryDatabase(query: string): Promise<DatabaseResponse> {
    const requestBody: DatabaseRequest = {
        task: "database",
        apikey: process.env.AI_DEVS_API_KEY!,
        query
    };

    return await postRequest<DatabaseRequest, DatabaseResponse>(dbUrl, requestBody);
}

async function getConnectionsTable(): Promise<ConnectionData[]> {
    console.log('Getting connections table content...');
    const result = await queryDatabase("SELECT * FROM connections");
    console.log('Connections table data:', result.reply);
    return result.reply as ConnectionData[];
}

async function getUsersTable(): Promise<UserData[]> {
    console.log('Getting users table content...');
    const result = await queryDatabase("SELECT * FROM users");
    console.log('Users table data:', result.reply);
    return result.reply as UserData[];
}

async function createGraphDatabase(connections: ConnectionData[]): Promise<any[]> {
    // Neo4j connection details - you may need to adjust these
    const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const neo4jUsername = process.env.NEO4J_USERNAME || 'neo4j';
    const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';

    const neo4jService = new Neo4jService(neo4jUri, neo4jUsername, neo4jPassword);

    try {
        // Clear existing data
        await neo4jService.clearDatabase();

        // Create the graph from connections data
        await neo4jService.batchCreateConnections(connections);

        // Find shortest path between users Rafał and Barbara
        console.log('Finding shortest path between Rafał and Barbara...');
        const paths = await neo4jService.findShortestPath('Rafał', 'Barbara');
        console.log('Shortest path:', paths);
        return paths;

    } finally {
        await neo4jService.close();
    }
}

async function executeTask() {
    console.log('Starting s03e05 task...');
    
    const connectionsData = await getConnectionsTable();
    const usersData = await getUsersTable();
    
    if (usersData.length > 0) {
        console.log('Finding IDs for Rafał and Barbara...');
        const rafalData = usersData.find(user => user.username === 'Rafał');
        const barbaraData = usersData.find(user => user.username === 'Barbara');
        
        if (rafalData && barbaraData) {
            console.log(`Found: Rafał - ID ${rafalData.id}, Barbara - ID ${barbaraData.id}`);
            
            // Create graph database from connections and find shortest path
            const neo4jService = new Neo4jService(
                process.env.NEO4J_URI || 'bolt://localhost:7687', 
                process.env.NEO4J_USERNAME || 'neo4j', 
                process.env.NEO4J_PASSWORD || 'password'
            );
            
            try {
                // Clear existing data
                await neo4jService.clearDatabase();
                
                // Create the graph from connections data
                await neo4jService.batchCreateConnections(connectionsData);
                
                // Find the shortest path between Rafał and Barbara
                console.log(`Finding shortest path between Rafał (${rafalData.id}) and Barbara (${barbaraData.id})...`);
                const shortestPath = await neo4jService.findShortestPath(rafalData.id, barbaraData.id);
                console.log('Shortest path:', shortestPath);
                
                // Extract the user IDs from the path
                const nodeIds = shortestPath.length > 0 ? shortestPath[0].nodeIds : [];
                
                if (nodeIds && nodeIds.length > 0) {
                    // The list of user IDs in the path should be our result
                    console.log('Path user IDs:', nodeIds);
                    
                    // Convert IDs to usernames
                    const pathUsernames = nodeIds.map(id => {
                        const user = usersData.find(user => user.id === id);
                        return user ? user.username : id;
                    });
                    
                    // Join usernames with comma
                    const pathUsernamesString = pathUsernames.join(',');
                    console.log('Path usernames:', pathUsernamesString);
                    console.log('Submitting report...');
                    await sendReport('connections', pathUsernamesString);
                    
                    return nodeIds;
                } else {
                    console.error('No path found between users');
                    return null;
                }
            } finally {
                await neo4jService.close();
            }
        } else {
            console.error('Could not find users Rafał and/or Barbara in the users table');
            return null;
        }
    } else {
        // If no users table, try querying directly for users by name
        console.log('No users table found or empty. Trying direct approach...');
        
        // Create graph database from connections
        const shortestPath = await createGraphDatabase(connectionsData);
        
        // Extract the user IDs from the path
        const nodeIds = shortestPath.length > 0 ? shortestPath[0].nodeIds : [];
        
        if (nodeIds && nodeIds.length > 0) {
            console.log('Path user IDs:', nodeIds);
            
            // In this direct approach case, we're using the IDs themselves as usernames
            const pathUsernamesString = nodeIds.join(',');
            console.log('Path usernames:', pathUsernamesString);
            console.log('Submitting report...');
            await sendReport('connections', pathUsernamesString);
            
            return nodeIds;
        } else {
            console.error('No path found between users');
            return null;
        }
    }
}

executeTask();
