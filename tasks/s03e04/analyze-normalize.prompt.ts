/**
 * Prompt for analyzing text content to extract and normalize places and names
 * @param content - Text content to analyze
 * @returns Formatted prompt string
 */
export function createAnalyzeAndNormalizePrompt(content: string): string {
    const template = [
        "Analyze the following text and extract all places and people's names, then normalize them for database queries.",
        "",
        "Step 1: Extract entities",
        "- Identify all geographical locations (cities, countries, regions, landmarks, addresses, etc.)",
        "- Identify all people's names (first names, last names, full names, nicknames, etc.)",
        "- Don't miss any mentions, including partial names or references",
        "- Consider different forms of the same name/place",
        "- Your result should be list on single words.",
        "- If person is mentioned with full name, split it into individual words.",
        "",
        "Step 2: Normalize for API queries",
        "PLACES API requirements:",
        "- Query should contain only CAPITAL LETTERS (A-Z)",
        "- Convert Polish characters: ą→A, ć→C, ę→E, ł→L, ń→N, ó→O, ś→S, ź→Z, ż→Z",
        "- Remove any spaces, numbers, or special characters",
        "",
        "PEOPLE API requirements:",
        "- Query should be just ONE WORD in CAPITAL LETTERS (A-Z)",
        "- Convert Polish characters the same way",
        "- Split full names into individual words",
        "- Remove any spaces, numbers, or special characters",
        "",
        "Data should be in denominator.",
        "All the names and places should be in Polish language.",
        "",
        "Text to analyze:",
        content,
        "",
        "Place your analysis in tag <thinking> and final result in tag <result>.",
        "",
        "Return valid JSON with extracted and normalized data:",
        "{",
        '  "places": ["NORMALIZED_PLACE1", "NORMALIZED_PLACE2"],',
        '  "names": ["NAME1", "NAME2", "NAME3"],',
        '  "mapping": {',
        '    "places": {',
        '      "NORMALIZED_PLACE1": "Original Place 1",',
        '      "NORMALIZED_PLACE2": "Original Place 2"',
        '    },',
        '    "names": {',
        '      "NAME1": {"original": "Original Name Part", "fullName": "Full Original Name"},',
        '      "NAME2": {"original": "Another Part", "fullName": "Full Original Name"}',
        '    }',
        '  }',
        "}"
    ];
    
    return template.join('\n');
}
