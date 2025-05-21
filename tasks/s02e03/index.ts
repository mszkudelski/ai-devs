import { generateImage } from "../../src/legacy/dalle.js";
import { sendReport } from "../../src/report.js";
import { getCentralDataUrl, getCentralUrl } from "../../src/url.js";

const taskId = 'robotid'

const url = getCentralDataUrl(taskId + '.json');

const response = await fetch(url);
const data = await response.json();

console.log(data);

// Generate image using DALL-E
const imageUrl = await generateImage(data.description);
console.log('Generated image URL:', imageUrl);

// Send report with the image URL
const reportResponse = await sendReport(taskId, imageUrl);
console.log('Report response:', reportResponse);