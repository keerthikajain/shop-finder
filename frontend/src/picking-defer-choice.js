// Navigation only. A worker's "next item" requests a choice; only an exact
// follow-up answer can defer a pick or request an explicit cancellation review.
// No phrase here confirms a pick, changes stock, or submits a report.
const COMMANDS={
 'en-IN':{
  later:['later','pick later','do this later','come back later'],
  skip:['skip','skip item','leave unconfirmed','skip this item'],
  cancel:['cancel item','remove this item','remove from picking list'],
  back:['back','keep this item','stay here','never mind']
 },
 'hi-IN':{
  later:['बाद में','बाद में करेंगे','इसे बाद में','बाद में लेना'],
  skip:['छोड़ दो','अभी छोड़ो','स्किप','स्किप करो'],
  cancel:['यह आइटम हटाओ','इस सामान को हटाओ','सामान रद्द करो'],
  back:['वापस','यहीं रहो','नहीं','रुको']
 },
 'hi-en':{
  later:['later','baad mein','bad me','baad mein karenge','बाद में','pick later'],
  skip:['skip','skip item','chhod do','छोड़ दो','स्किप करो'],
  cancel:['cancel item','item hatao','yeh item hatao','यह आइटम हटाओ'],
  back:['back','wapas','nahi','वापस']
 },
 'te-IN':{
  later:['తర్వాత','తర్వాత తీసుకుంటాను','తరువాత','తర్వాత చేస్తాను','later'],
  skip:['స్కిప్','ఇది వదిలేయండి','వదిలేయి','skip'],
  cancel:['ఈ వస్తువు తొలగించు','ఈ వస్తువు రద్దు చేయి','cancel item'],
  back:['వెనక్కి','ఇక్కడే ఉండు','వద్దు','back']
 }
};
const normalize=s=>String(s||'').normalize('NFC').toLocaleLowerCase().replace(/[.,!?।॥;:]/g,' ').trim().replace(/\s+/g,' ');
export function deferChoiceIntent(language,text){
 const value=normalize(text);
 if(!value)return null;
 const entries=COMMANDS[language]||COMMANDS['en-IN'];
 for(const choice of ['later','skip','cancel','back'])
  if(entries[choice].some(p=>normalize(p)===value))return choice;
 return null;
}
export const deferChoicePhrases=language=>{
 const c=COMMANDS[language]||COMMANDS['en-IN'];
 return Object.fromEntries(Object.entries(c).map(([k,phrases])=>[k,phrases[0]]));
};
