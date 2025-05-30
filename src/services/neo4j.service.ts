import neo4j, { Driver, Session, Result } from 'neo4j-driver';

export interface ConnectionData {
    user1_id: string;
    user2_id: string;
}

export class Neo4jService {
    private driver: Driver;

    constructor(uri: string, username: string, password: string) {
        this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
    }

    async runQuery(cypher: string, params: Record<string, any> = {}): Promise<Result> {
        const session: Session = this.driver.session();
        try {
            return await session.run(cypher, params);
        } finally {
            await session.close();
        }
    }

    async clearDatabase(): Promise<void> {
        console.log('Clearing Neo4j database...');
        await this.runQuery('MATCH (n) DETACH DELETE n');
        console.log('Database cleared');
    }

    async batchCreateConnections(connections: ConnectionData[]): Promise<void> {
        console.log(`Creating ${connections.length} connections in Neo4j...`);
        
        const cypher = `
            UNWIND $connections AS conn
            MERGE (u1:User {id: conn.user1_id})
            MERGE (u2:User {id: conn.user2_id})
            MERGE (u1)-[:CONNECTED_TO]-(u2)
        `;
        await this.runQuery(cypher, { connections });
        console.log('Connections created successfully');
    }

    async findShortestPath(fromUserId: string, toUserId: string): Promise<any[]> {
        const cypher = `
            MATCH (start:User {id: $fromUserId}), (end:User {id: $toUserId})
            MATCH path = shortestPath((start)-[:CONNECTED_TO*]-(end))
            RETURN path, length(path) as pathLength, [node in nodes(path) | node.id] as nodeIds
        `;
        const result = await this.runQuery(cypher, { fromUserId, toUserId });
        return result.records.map(record => ({
            path: record.get('path'),
            length: record.get('pathLength'),
            nodeIds: record.get('nodeIds')
        }));
    }

    async close(): Promise<void> {
        await this.driver.close();
    }
}
