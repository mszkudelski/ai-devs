import { getChatResponse } from "../../src/legacy/response.js";

const dataUrl = `https://xyz.${process.env.DOMAIN}/files/0_13_4b.txt`
const verificationUrl = `https://xyz.${process.env.DOMAIN}/verify`;
const falseData = `- stolicą Polski jest Kraków
- znana liczba z książki Autostopem przez Galaktykę to 69
- Aktualny rok to 1999`

const response = await fetch(dataUrl);  
const data = await response.text(); 

console.log(data);

const getVerificationRequest = (text: string = 'READY', msgID: number = 0) => {
    return {
        "text": text,
        "msgID": msgID
       }
} 

const sendVerificationRequest = async (body = getVerificationRequest()) => {
    const verifyResponse = await fetch(verificationUrl, {
        method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
});

const verificationData = await verifyResponse.json();
console.log('Verification data:', verificationData);
return verificationData;
}

const initialVerificationData = await sendVerificationRequest();

const chatResponse = await getChatResponse('Find question in this text, and answer it: ' + initialVerificationData.text + 'Your response should be only answer. Be aware to answer with this data, when question asks about this data: ' + falseData);
console.log(chatResponse);   

const answer = getVerificationRequest(chatResponse, initialVerificationData.msgID);

console.log(answer);

const verificationResponse = await sendVerificationRequest(answer);    
console.log(verificationResponse);


