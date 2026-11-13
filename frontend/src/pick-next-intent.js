// Explicit choices for deferring a picking line. Navigation never confirms a pick
// and "cancel" requires an additional yes/no confirmation in the UI.
const PHRASES={
 'en-IN':{later:['later','pick later','do it later','save for later'],skip:['skip','skip item','skip this item'],cancel:['cancel this item','remove this item','cancel item'],back:['back','keep this item','never mind'],next:['next item','next','next one','go to next item']},
 'hi-IN':{later:['बाद में','बाद में लेंगे','बाद में उठाऊंगा','बाद के लिए रखो'],skip:['स्किप','छोड़ दो','यह सामान छोड़ दो'],cancel:['इस सामान को रद्द करो','यह सामान हटाओ','आइटम रद्द करो'],back:['वापस','इसी सामान पर रहो'],next:['अगला सामान','अगला आइटम','अगला']},
 'hi-en':{later:['later','baad mein','baad me','baad mein lena','save for later','बाद में'],skip:['skip','skip item','is item ko skip karo','स्किप'],cancel:['cancel this item','item cancel karo','is item ko hatao','इस सामान को रद्द करो'],back:['back','wapas','वापस'],next:['next item','agla item','next','अगला सामान']},
 'te-IN':{later:['తర్వాత','తరువాత','తర్వాత తీసుకుంటాను','తర్వాత తీసుకుందాం','later'],skip:['స్కిప్','ఈ వస్తువును స్కిప్ చేయి','వదిలేయండి','skip'],cancel:['ఈ వస్తువును రద్దు చేయి','ఈ వస్తువును తొలగించు','ఐటమ్ రద్దు చేయి'],back:['వెనక్కి','ఈ వస్తువే ఉంచు'],next:['తదుపరి వస్తువు','తరవాతి వస్తువు','తరువాత వస్తువు','next item']}
};
const normalize=text=>String(text||'').normalize('NFC').toLocaleLowerCase().replace(/[.,!?।॥;:]/g,' ').trim().replace(/\s+/g,' ');
export function nextItemChoice(language,text){
 const phrase=normalize(text);
 if(!phrase)return null;
 const options=PHRASES[language]||PHRASES['en-IN'];
 return Object.entries(options).find(([,terms])=>terms.some(v=>normalize(v)===phrase))?.[0]||null;
}
export const nextItemPhrase=(language,action)=>(PHRASES[language]||PHRASES['en-IN'])[action]?.[0]||action;
export const nextItemUi=(language,key)=>{
 const copy={
  en:{question:'Would you like to pick this item later, skip it, or cancel it?',later:'Later',skip:'Skip',cancel:'Cancel item',back:'Keep item',confirmCancel:'Remove this item from active picking? It will remain unconfirmed in this worklist.',yes:'Yes, cancel item',no:'No, keep item',laterStatus:'Saved for later — not picked',skippedStatus:'Skipped — not picked',cancelledStatus:'Cancelled — not picked',retry:'Retry later item',laterRemaining:'Later items remain unconfirmed. Retry them when ready.',unknown:'Say Later, Skip or Cancel item, or use the buttons.'},
  hi:{question:'यह सामान बाद में उठाना है, छोड़ना है या रद्द करना है?',later:'बाद में',skip:'स्किप',cancel:'सामान रद्द करें',back:'इसी पर रहें',confirmCancel:'इस सामान को सक्रिय पिकिंग से हटाएँ? यह सूची में अपुष्ट रहेगा।',yes:'हाँ, रद्द करें',no:'नहीं, रखें',laterStatus:'बाद के लिए — पुष्टि नहीं हुई',skippedStatus:'छोड़ा गया — पुष्टि नहीं हुई',cancelledStatus:'रद्द — पुष्टि नहीं हुई',retry:'फिर कोशिश करें',laterRemaining:'बाद के लिए रखे सामान अभी अपुष्ट हैं। तैयार होने पर कोशिश करें।',unknown:'बाद में, स्किप या सामान रद्द करें बोलें।'},
  te:{question:'ఈ వస్తువును తర్వాత తీసుకోవాలా, స్కిప్ చేయాలా, రద్దు చేయాలా?',later:'తర్వాత',skip:'స్కిప్',cancel:'వస్తువును రద్దు చేయి',back:'ఇక్కడే ఉంచు',confirmCancel:'ఈ వస్తువును పికింగ్ నుండి తీసేయాలా? ఇది ఇంకా నిర్ధారించబడదు.',yes:'అవును, రద్దు',no:'వద్దు, ఉంచు',laterStatus:'తర్వాత కోసం — నిర్ధారించలేదు',skippedStatus:'స్కిప్ — నిర్ధారించలేదు',cancelledStatus:'రద్దు — నిర్ధారించలేదు',retry:'మళ్లీ ప్రయత్నించండి',laterRemaining:'తర్వాత కోసం ఉంచిన వస్తువులు ఇంకా నిర్ధారించలేదు. సిద్ధమైనప్పుడు ప్రయత్నించండి.',unknown:'తర్వాత, స్కిప్, లేదా వస్తువును రద్దు చేయి అనండి.'}
 };
 return (copy[language]||copy.en)[key]||copy.en[key]||key;
};
