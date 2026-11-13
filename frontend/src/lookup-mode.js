import {pickVoicePhrase} from './picking-voice-phrases.js';
import {dialogueControl} from './voice-review-commands.js';
import {pickConfirmationIntent} from './picking-confirmations.js';

// Explicit whole-phrase commands. Do not interpret unclear speech as permission
// to start a session, confirm a pick, or change an inventory record.
const norm=value=>String(value||'').normalize('NFC').toLocaleLowerCase().replace(/[.,!?।॥]/g,' ').trim().replace(/\s+/g,' ');
const CHOICES={
 'en-IN':{guided:['guided picking','help me pick','help with picking','start picking','begin picking','picking help'],locations:['just locations','locations only','just the locations','only locations','show locations','tell me the locations']},
 'hi-IN':{guided:['पिकिंग में मदद','सामान उठाने में मदद','पिकिंग शुरू करो','मदद से सामान उठाना'],locations:['सिर्फ जगह','केवल जगह','बस जगह बताओ','सिर्फ लोकेशन','जगह बताओ']},
 'hi-en':{guided:['guided picking','help me pick','picking shuru karo','picking mein help','पिकिंग शुरू करो'],locations:['just locations','only location','sirf location','sirf jagah','बस जगह बताओ','लोकेशन बताओ']},
 'te-IN':{guided:['పికింగ్ సహాయం','వస్తువులు తీసుకోవడానికి సహాయం','పికింగ్ ప్రారంభించండి','guided picking','start picking'],locations:['స్థానాలు మాత్రమే','స్థానాలు చెప్పండి','లొకేషన్లు మాత్రమే','just locations','locations only']}
};
const EXTRA={
 'en-IN':{report:['wrong location'],verify:['found it','i picked it'],repeat:['repeat location','repeat locations'],help:['help'],stop:['stop']},
 'hi-IN':{report:['गलत जगह'],verify:['मिल गया'],repeat:['जगह दोहराओ','लोकेशन दोबारा बताओ'],help:['मदद'],stop:['रुको']},
 'hi-en':{report:['galat jagah','wrong location'],verify:['mil gaya','found it'],repeat:['location dobara batao','location दोबारा बताओ'],help:['help','मदद'],stop:['ruko','stop']},
 'te-IN':{report:['తప్పు స్థానం','తప్పు స్థానము','తప్పు లొకేషన్','तप्पु स्थानम','wrong location'],verify:['దొరికింది','found it'],repeat:['స్థానాన్ని మళ్లీ చెప్పండి','location दोबारा बताओ','repeat location'],help:['సహాయం','help'],stop:['ఆపు','stop']}
};
const ITEM_WORDS={
 'en-IN':[/^(?:item|number)\s+(\d{1,2})$/,/^(first|second|third|fourth|fifth)\s+item$/],
 'hi-IN':[/^(?:सामान|आइटम)\s+(\d{1,2})$/],
 'hi-en':[/^(?:item|number)\s+(\d{1,2})$/],
 'te-IN':[/^(?:item|number)\s+(\d{1,2})$/,/^(?:వస్తువు|ఐటెమ్)\s+(\d{1,2})$/]
};
export function modeChoiceIntent(language,text){
 const phrase=norm(text);
 if(!phrase)return null;
 for(const [action,variants] of Object.entries(CHOICES[language]||CHOICES['en-IN']))
  if(variants.some(x=>norm(x)===phrase))return action;
 return null;
}
export function lookupVoiceIntent(language,text,lines=[]){
 const phrase=norm(text);
 if(!phrase)return {action:'unknown'};
 if(modeChoiceIntent(language,text)==='guided')return {action:'guided'};
 const confirmation=pickConfirmationIntent(language,text);
 if(confirmation!=='unknown')return {action:confirmation};
 const control=dialogueControl(language,text);
 if(['stop','help','repeat'].includes(control))return {action:control};
 for(const [action,variants] of Object.entries(EXTRA[language]||EXTRA['en-IN'])){
  if(variants.some(x=>norm(x)===phrase)||norm(pickVoicePhrase(language,action))===phrase)return {action};
 }
 // An exact SKU or a numbered line is an unambiguous choice. No fuzzy names.
 const itemBySku=lines.findIndex(line=>line.selected?.sku&&norm(line.selected.sku)===phrase);
 if(itemBySku>=0)return {action:'select',line:itemBySku};
 for(const pattern of ITEM_WORDS[language]||ITEM_WORDS['en-IN']){
  const match=phrase.match(pattern);
  if(!match)continue;
  const index=/^\d+$/.test(match[1])?Number(match[1])-1:
   ['first','second','third','fourth','fifth'].indexOf(match[1]);
  if(index>=0&&index<lines.length)return {action:'select',line:index};
 }
 return {action:'unknown'};
}
export const modeChoicePhrases=language=>({
 guided:CHOICES[language]?.guided[0]||CHOICES['en-IN'].guided[0],
 locations:CHOICES[language]?.locations[0]||CHOICES['en-IN'].locations[0]
});
