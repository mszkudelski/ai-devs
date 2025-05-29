export function extractFromTags(response: string, tag: string): string {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
    const match = response.match(regex);
    return match ? match[1].trim() : response.trim();
}
