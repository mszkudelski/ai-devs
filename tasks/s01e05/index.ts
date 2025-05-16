import { getRequest } from "../../src/api.js";
import { sendReport } from "../../src/report.js";
import { getChatResponse } from "../../src/response.js";
import { getCentralUrl } from "../../src/url.js";

// const data = `Dane podejrzanego: Jakub Woźniak. Adres: Rzeszów, ul. Miła 4. Wiek: 33 lata.`;
const dataUrl = getCentralUrl('/data/f2c390c8-584e-4cfc-bb0a-d303a7772e77/cenzura.txt');

const word = 'CENZURA';

try {   
  const data = await getRequest<string>(dataUrl);
  console.log(data);

  const response = await getChatResponse("Remove all the private data from the text: " + data + '\n Insert word ' + word + ' instead of the private data')

  sendReport('CENZURA', response);
} catch (error) {
  console.error(error,  'error');
}
