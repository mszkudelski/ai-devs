import dotenv from 'dotenv';

dotenv.config();


export const getUrl = (url: string) => {
  return 'https://' + process.env.DOMAIN+ url;
};

export const getCentralUrl = (url: string) => {
  return 'https://c3ntrala.' + process.env.DOMAIN + url;
};

export const getCentralDataUrl = (url: string) => {
  return 'https://c3ntrala.' + process.env.DOMAIN + '/data/' + process.env.AI_DEVS_API_KEY + '/' + url;
};

export const reportUrl = getCentralUrl('/report');
