/**
 * Prompt for determining Barbara's location based on collected data
 * @param originalResults - Original results from database queries (placeResults and peopleResults)
 * @param barbaraFileContent - Original content from barbara.txt file
 * @returns Formatted prompt string
 */
export function createBarbaraLocationPrompt(
    originalResults: { placeResults: any[], peopleResults: any[] }, 
    barbaraFileContent: string
): string {
    const placesData = originalResults.placeResults.map((place: any, index: number) => 
        `${index + 1}. Place: ${place.place} (originally: ${place.originalPlace})\n   Query Result: ${JSON.stringify(place.result)}`
    ).join('\n');
    
    const peopleData = originalResults.peopleResults.map((person: any, index: number) => 
        `${index + 1}. Person: ${person.name} (originally: ${person.originalName}, full: ${person.fullName})\n   Query Result: ${JSON.stringify(person.result)}`
    ).join('\n');

    const template = [
        "Analyze the following data collected about people and places to determine where Barbara is currently located.",
        "",
        "You need to analyze all the information about people and places to find connections and clues about Barbara's whereabouts. You should:",
        "",
        "## Instructions",
        "",
        "1. Look for direct mentions of Barbara",
        "2. Analyze connections between people and places",
        "3. Follow the trail of information to determine her current location",
        "4. Consider time sequences and relationships between people",
        "5. Look for the most recent or relevant information about Barbara's location",
        "6. Take note about Barbara into consideration",
        "",
        "## About data",
        "",
        "The data contains information about various people and places. You need to connect the dots to find where Barbara is.",
        "1. Places data is about people who were seen in those places.",
        "2. People data is about places where those people were seen or mentioned.",
        "",
        "Here is the collected data:",
        "",
        "## NOTE ABOUT BARBARA:",
        barbaraFileContent,
        "",
        "## PLACES WITH DATA:",
        placesData,
        "",
        "## PEOPLE WITH DATA:",
        peopleData,
        "",
        "## Analysis",
        "",
        "Based on this information, analyze the connections between people and places. Look for:",
        "- Direct mentions of Barbara",
        "- People who might have met Barbara",
        "- Places where Barbara might have been seen",
        "- Recent information about her whereabouts",
        "- Logical connections between the people and places",
        "",
        "## Result format",
        "",
        "Place your analysis in tag <thinking> and final result in tag <result>.",
        "",
        "Provide Barbara's most likely current location as a single place name. Result should be single word - place/location."
    ];
    
    return template.join('\n');
}
