// Strict, opt-in spoken actions for high-impact picking and owner review.
// No substring matching: a transcript must exactly match an approved command.
// Confirmations never bypass the existing authenticated backend validation.
const PHRASES={
 'en-IN':{
  report_send:["send report","submit report"],
  report_skip:["skip","not found elsewhere","unknown location"],
  help:["help","what can i say","what should i say"],
  back:["back","go back","previous step"],
  repeat:["repeat","say it again","repeat instructions"],
  stop:["stop","stop listening","pause voice"],
  undo:['undo last confirmation','undo last pick','undo confirmation'],
  original:['original location verified','found at recorded location','confirm original location'],
  unconfirmed:['location not confirmed','still unconfirmed','keep under review'],
  move:['confirm location change','save verified location'],
  review:['confirm review','save review'],
  preview:['review location change','review new shelf'],
  cancel:['cancel','stop','no']
 },
 'hi-IN':{
  report_send:["रिपोर्ट भेजो","रिपोर्ट जमा करो"],
  report_skip:["स्किप","नहीं मिला","पता नहीं"],
  help:["मदद","क्या बोलना है","मुझे क्या कहना चाहिए"],
  back:["वापस","पीछे जाओ","पिछला चरण"],
  repeat:["दोहराओ","फिर से बताओ"],
  stop:["रुको","बंद करो","सुनना बंद करो"],
  undo:['आखिरी पुष्टि वापस लो','पिछला पिक वापस लो'],
  original:['पुरानी जगह सही है','दर्ज जगह पर मिला','मूल जगह की पुष्टि'],
  unconfirmed:['जगह की पुष्टि नहीं हुई','अभी पुष्टि नहीं हुई'],
  move:['नई जगह की पुष्टि करो','जगह बदलना मंजूर'],
  review:['समीक्षा सेव करो','समीक्षा की पुष्टि करो'],
  preview:['जगह बदलाव की समीक्षा करो'],
  cancel:['रद्द करो','रुको','नहीं']
 },
 'hi-en':{
  report_send:["send report","report bhejo","रिपोर्ट भेजो"],
  report_skip:["skip","nahi pata","पता नहीं"],
  help:["help","what should i say","मदद","kya bolna hai"],
  back:["back","go back","वापस","wapas jao"],
  repeat:["repeat","dobara bolo","फिर से बताओ"],
  stop:["stop","ruk jao","रुको"],
  undo:['undo last confirmation','last pick undo karo','पिछला पिक वापस लो'],
  original:['original location verified','purani jagah sahi hai','दर्ज जगह पर मिला'],
  unconfirmed:['still unconfirmed','jagah confirm nahi hai','जगह की पुष्टि नहीं हुई'],
  move:['confirm location change','nayi jagah confirm karo','नई जगह की पुष्टि करो'],
  review:['confirm review','review save karo','समीक्षा सेव करो'],
  preview:['review location change','nayi jagah review karo'],
  cancel:['cancel','stop','रुको']
 },
 'te-IN':{
  report_send:["నివేదిక పంపండి","రిపోర్ట్ పంపండి"],
  report_skip:["స్కిప్","తెలియదు","మరెక్కడా దొరకలేదు"],
  help:["సహాయం","ఏమి చెప్పాలి","ఏం మాట్లాడాలి"],
  back:["వెనక్కి","వెనక్కి వెళ్ళు"],
  repeat:["మళ్లీ చెప్పు","మళ్ళీ చెప్పండి"],
  stop:["ఆపు","వినడం ఆపు"],
  undo:['చివరి నిర్ధారణ రద్దు చేయి'],
  original:['పాత స్థానంలో దొరికింది','నమోదైన స్థానం సరైనదే'],
  unconfirmed:['స్థానం ఇంకా నిర్ధారించలేదు'],
  move:['కొత్త స్థానం నిర్ధారించు'],
  review:['సమీక్షను నిర్ధారించు','సమీక్షను సేవ్ చేయి'],
  preview:['స్థానం మార్పు సమీక్షించు'],
  cancel:['రద్దు','ఆపు','వద్దు']
 }
};
const normalize=text=>String(text||'').toLocaleLowerCase().normalize('NFC')
 .replace(/[.,!?।॥;:]/g,' ').trim().replace(/\s+/g,' ');
export const actionPhrases=(language,action)=>(PHRASES[language]||PHRASES['en-IN'])[action]||[];
export function voiceAction(language,action,transcript){
 const normalized=normalize(transcript);
 return !!normalized && actionPhrases(language,action).some(phrase=>normalize(phrase)===normalized);
}
export function reviewVoiceChoice(language,transcript){
 if(voiceAction(language,'original',transcript))return 'confirmed_original';
 if(voiceAction(language,'unconfirmed',transcript))return 'unconfirmed';
 if(voiceAction(language,'cancel',transcript))return 'cancel';
 return null;
}

export function dialogueControl(language,transcript){
 for(const action of ['stop','help','repeat','back']){
  if(voiceAction(language,action,transcript))return action;
 }
 return null;
}

/* A suggested shelf is unverified text, not a catalogue correction.
   Ask again instead of silently treating "maybe" as a new shelf. */
export function plausibleShelfSuggestion(text){
 const value=normalize(text);
 if(!value||value.length<3||['maybe','not sure','i do not know',"i don't know",'yes','no','okay','ok','unknown','शायद','पता नहीं','हो सकता है','తెలియదు'].includes(value))return false;
 return /(?:rack|shelf|bin|aisle|row|zone|section|floor|box|counter|entrance|corner|door|near|area|रैक|शेल्फ|बिन|शेल्फ़|डिब्बा|जगह|के पास|ర్యాక్|షెల్ఫ్|బిన్|అల్మారా|దగ్గర|విభాగం|\d)/i.test(value);
}
