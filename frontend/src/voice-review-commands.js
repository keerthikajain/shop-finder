// Strict, opt-in spoken actions for high-impact picking and owner review.
// No substring matching: a transcript must exactly match an approved command.
// Confirmations never bypass the existing authenticated backend validation.
const PHRASES={
 'en-IN':{
  undo:['undo last confirmation','undo last pick','undo confirmation'],
  original:['original location verified','found at recorded location','confirm original location'],
  unconfirmed:['location not confirmed','still unconfirmed','keep under review'],
  move:['confirm location change','save verified location'],
  cancel:['cancel','stop','no']
 },
 'hi-IN':{
  undo:['आखिरी पुष्टि वापस लो','पिछला पिक वापस लो'],
  original:['पुरानी जगह सही है','दर्ज जगह पर मिला','मूल जगह की पुष्टि'],
  unconfirmed:['जगह की पुष्टि नहीं हुई','अभी पुष्टि नहीं हुई'],
  move:['नई जगह की पुष्टि करो','जगह बदलना मंजूर'],
  cancel:['रद्द करो','रुको','नहीं']
 },
 'hi-en':{
  undo:['undo last confirmation','last pick undo karo','पिछला पिक वापस लो'],
  original:['original location verified','purani jagah sahi hai','दर्ज जगह पर मिला'],
  unconfirmed:['still unconfirmed','jagah confirm nahi hai','जगह की पुष्टि नहीं हुई'],
  move:['confirm location change','nayi jagah confirm karo','नई जगह की पुष्टि करो'],
  cancel:['cancel','stop','रुको']
 },
 'te-IN':{
  undo:['చివరి నిర్ధారణ రద్దు చేయి'],
  original:['పాత స్థానంలో దొరికింది','నమోదైన స్థానం సరైనదే'],
  unconfirmed:['స్థానం ఇంకా నిర్ధారించలేదు'],
  move:['కొత్త స్థానం నిర్ధారించు'],
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
