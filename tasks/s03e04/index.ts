import { getCentralUrl, getCentralDataUrl } from "../../src/url.js";
import { postRequest, getRequest } from "../../src/api.js";
import { OpenAIService } from "../../src/openai.service.js";
import { sendReport } from "../../src/report.js";
import { extractFromTags } from "../../src/utils.js";
import { createAnalyzeAndNormalizePrompt } from "./analyze-normalize.prompt.js";
import { createBarbaraLocationPrompt } from "./barbara-location.prompt.js";

const openaiService = new OpenAIService();

interface DatabaseRequest {
    task: string;
    apikey: string;
    query: string;
}

interface DatabaseResponse {
    reply?: any[];
    error?: string;
    message?: string;
    code?: number;
}

/**
 * Query the places endpoint
 * @param query - Name or city to search for
 * @returns Database response with places data
 */
async function queryPlaces(query: string): Promise<DatabaseResponse> {
    const placesUrl = getCentralUrl('places');
    const requestBody: DatabaseRequest = {
        task: "places",
        apikey: process.env.AI_DEVS_API_KEY!,
        query
    };

    return await postRequest<DatabaseRequest, DatabaseResponse>(placesUrl, requestBody);
}

/**
 * Query the people endpoint
 * @param query - Name or city to search for
 * @returns Database response with people data
 */
async function queryPeople(query: string): Promise<DatabaseResponse> {
    const peopleUrl = getCentralUrl('people');
    const requestBody: DatabaseRequest = {
        task: "people",
        apikey: process.env.AI_DEVS_API_KEY!,
        query
    };

    return await postRequest<DatabaseRequest, DatabaseResponse>(peopleUrl, requestBody);
}

/**
 * Search for information across both places and people endpoints
 * @param query - Name or city to search for
 * @returns Combined results from both endpoints
 */
async function searchAll(query: string): Promise<{places: DatabaseResponse, people: DatabaseResponse}> {
    const [placesResult, peopleResult] = await Promise.all([
        queryPlaces(query),
        queryPeople(query)
    ]);

    return {
        places: placesResult,
        people: peopleResult
    };
}

/**
 * Fetch a file from the dane endpoint
 * @param filename - Name of the file to fetch (e.g., "barbara.txt")
 * @returns File content as string
 */
async function fetchFile(filename: string): Promise<string> {
    const fileUrl = getCentralUrl(filename);
    return await getRequest<string>(fileUrl);
}

/**
 * Analyze text content to extract and normalize places and names in one step
 * @param content - Text content to analyze
 * @returns Object containing normalized places, names, and mapping
 */
async function analyzeAndNormalizeContent(content: string): Promise<{places: string[], names: string[], mapping: any}> {
    const prompt = createAnalyzeAndNormalizePrompt(content);

    try {
        const response = await openaiService.getChatResponse(prompt);
        const jsonStr = extractFromTags(response, 'result');
        const result = JSON.parse(jsonStr || '{}');
        return {
            places: result.places || [],
            names: result.names || [],
            mapping: result.mapping || {}
        };
    } catch (error) {
        console.error('Error analyzing and normalizing content with LLM:', error);
        return { places: [], names: [], mapping: {} };
    }
}

/**
 * Analyze collected data to determine where Barbara is
 * @param originalResults - Original results from database queries (placeResults and peopleResults)
 * @param barbaraFileContent - Original content from barbara.txt file
 * @returns Barbara's likely location
 */
async function determineBarbararLocation(originalResults: { placeResults: any[], peopleResults: any[] }, barbaraFileContent: string): Promise<string> {
    const prompt = createBarbaraLocationPrompt(originalResults, barbaraFileContent);

    try {
        const response = await openaiService.getChatResponse(prompt);
        const locationMatch = response.match(/<result>(.*?)<\/result>/s);
        const location = locationMatch ? locationMatch[1].trim() : response.trim();
        
        return location;
    } catch (error) {
        console.error('Error determining Barbara\'s location:', error);
        return 'Unable to determine location';
    }
}

/**
 * Extract places and people from database query results
 * @param data - Database response data
 * @returns Object containing extracted places and people
 */
function extractPlacesAndPeopleFromResults(data: any): {places: string[], people: string[]} {
    const places = new Set<string>();
    const people = new Set<string>();
    
    try {
        if (!data || !Array.isArray(data)) {
            return { places: [], people: [] };
        }
        
        for (const item of data) {
            try {
                // Extract places from various possible fields
                if (item.place && typeof item.place === 'string') places.add(item.place.toLowerCase().trim());
                if (item.city && typeof item.city === 'string') places.add(item.city.toLowerCase().trim());
                if (item.location && typeof item.location === 'string') places.add(item.location.toLowerCase().trim());
                if (item.town && typeof item.town === 'string') places.add(item.town.toLowerCase().trim());
                
                // Extract people names from various possible fields
                if (item.name && typeof item.name === 'string') people.add(item.name.toLowerCase().trim());
                if (item.person && typeof item.person === 'string') people.add(item.person.toLowerCase().trim());
                if (item.firstname && item.lastname && typeof item.firstname === 'string' && typeof item.lastname === 'string') {
                    people.add(`${item.firstname} ${item.lastname}`.toLowerCase().trim());
                }
                if (item.firstname && typeof item.firstname === 'string') people.add(item.firstname.toLowerCase().trim());
                if (item.lastname && typeof item.lastname === 'string') people.add(item.lastname.toLowerCase().trim());
            } catch (itemError) {
                console.error('Error processing item:', itemError, 'Item:', item);
                // Continue processing other items
                continue;
            }
        }
    } catch (error) {
        console.error('Error extracting places and people from results:', error);
        return { places: [], people: [] };
    }
    
    return { 
        places: Array.from(places).filter(p => p.length > 0), 
        people: Array.from(people).filter(p => p.length > 0) 
    };
}

/**
 * Recursively query all places and people to build complete database
 * @param initialPlaces - Starting places to query
 * @param initialPeople - Starting people to query
 * @returns Object containing all query results
 */
async function queryAllRecursively(initialPlaces: string[], initialPeople: string[]): Promise<{
    placeResults: any[], 
    peopleResults: any[], 
    queriedPlaces: Set<string>, 
    queriedPeople: Set<string>
}> {
    const placeResults: any[] = [];
    const peopleResults: any[] = [];
    const queriedPlaces = new Set<string>();
    const queriedPeople = new Set<string>();
    
    // Queues for processing
    const placesToQuery = [...initialPlaces.map(p => p.toLowerCase().trim())];
    const peopleToQuery = [...initialPeople.map(p => p.toLowerCase().trim())];
    
    console.log(`Starting recursive queries with ${placesToQuery.length} places and ${peopleToQuery.length} people`);
    
    // Process all places and people recursively
    while (placesToQuery.length > 0 || peopleToQuery.length > 0) {
        
        // Process places queue
        while (placesToQuery.length > 0) {
            const place = placesToQuery.shift()!;
            
            // Skip if already queried
            if (queriedPlaces.has(place)) continue;
            
            try {
                console.log(`Querying place: ${place}`);
                queriedPlaces.add(place);
                const result = await queryPlaces(place);
                
                placeResults.push({ 
                    place, 
                    result,
                    queryType: 'place'
                });
                console.log(`Received results for place: ${place}`, result);
                
                // Extract new places and people from results
                if (result.message && typeof result.message === 'string') {
                    // Split the message string into individual names/places
                    const items = result.message.split(' ').map(item => item.toLowerCase().trim()).filter(item => item.length > 0);
                    
                    // For places query, the response contains people names
                    for (const person of items) {
                        if (!queriedPeople.has(person) && !peopleToQuery.includes(person)) {
                            peopleToQuery.push(person);
                        }
                    }
                }
                
                // Small delay to prevent overwhelming the API
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`Error querying place ${place}:`, error);
                // Continue with the loop even if this query failed
                continue;
            }
        }
        
        // Process people queue
        while (peopleToQuery.length > 0) {
            const person = peopleToQuery.shift()!;
            
            // Skip if already queried
            if (queriedPeople.has(person)) continue;
            
            try {
                console.log(`Querying person: ${person}`);
                queriedPeople.add(person);
                const result = await queryPeople(person);
                
                peopleResults.push({ 
                    person, 
                    result,
                    queryType: 'person'
                });

                console.log(`Received results for person: ${person}`, result);
                
                // Extract new places and people from results
                if (result.message && typeof result.message === 'string') {
                    // Split the message string into individual names/places
                    const items = result.message.split(' ').map(item => item.toLowerCase().trim()).filter(item => item.length > 0);
                    
                    // For people query, the response contains places
                    for (const place of items) {
                        if (!queriedPlaces.has(place) && !placesToQuery.includes(place)) {
                            placesToQuery.push(place);
                        }
                    }
                }
                
                // Small delay to prevent overwhelming the API
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`Error querying person ${person}:`, error);
                // Continue with the loop even if this query failed
                continue;
            }
        }
    }
    
    console.log(`Completed recursive queries. Total places queried: ${queriedPlaces.size}, Total people queried: ${queriedPeople.size}`);
    
    return { placeResults, peopleResults, queriedPlaces, queriedPeople };
}

/**
 * Main execution function
 */
async function example() {
    try {
        // Fetch the barbara.txt file
        const barbaraFile = await fetchFile("dane/barbara.txt");

        // Analyze and normalize the content to get initial places and people
        const normalized = await analyzeAndNormalizeContent(barbaraFile);
        console.log(`Found initial data - Places: ${normalized.places.length}, People: ${normalized.names.length}`);
        
        // Recursively query all places and people
        const { placeResults, peopleResults, queriedPlaces, queriedPeople } = await queryAllRecursively(
            normalized.places, 
            normalized.names
        );
        
        console.log(`Final results - Places queried: ${queriedPlaces.size}, People queried: ${queriedPeople.size}`);
        console.log(`Total place results: ${placeResults.length}, Total people results: ${peopleResults.length}`);
        
        // Determine Barbara's location using all collected data
        const barbaraLocation = await determineBarbararLocation({ placeResults, peopleResults }, barbaraFile);
        console.log(`Barbara's determined location: ${barbaraLocation}`);
        
        // Submit the answer
        await sendReport('loop', barbaraLocation);
        
        return {
            normalized,
            placeResults,
            peopleResults,
            barbaraLocation,
            totalPlacesQueried: queriedPlaces.size,
            totalPeopleQueried: queriedPeople.size
        };
        
    } catch (error) {
        console.error('Error during execution:', error);
    }
}

// Export functions for use in other modules
export { queryPlaces, queryPeople, searchAll, fetchFile, analyzeAndNormalizeContent, determineBarbararLocation, queryAllRecursively, extractPlacesAndPeopleFromResults };

// Run the main execution
example();