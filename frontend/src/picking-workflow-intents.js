// Short, explicit phrases to finish a verified picking list or report a missing item.
// Never finish a list based on a partial command or a single generic "yes".
const words={
 'en-IN':{finish:['finish picking','finish pickin','finish the picking','complete picking','finish the list','finish pick list'],missing:['not found','item not found','cannot find it','cant find it','could not find it']},
 'hi-IN':{finish:['पिकिंग पूरी करो','पिकिंग खत्म करो'],missing:['नहीं मिला','सामान नहीं मिला']},
 'hi-en':{finish:['finish picking','finish pickin','finish the picking','complete picking','picking khatam karo'],missing:['not found','item not found','nahi mila','नहीं मिला']},
 'kn-IN':{finish:['ಪಿಕಿಂಗ್ ಪೂರ್ಣಗೊಳಿಸಿ'],missing:['ಸಿಗಲಿಲ್ಲ','ವಸ್ತು ಸಿಗಲಿಲ್ಲ']},
 'te-IN':{finish:['పికింగ్ పూర్తి చేయండి'],missing:['దొరకలేదు','వస్తువు దొరకలేదు']}
};
const norm=value=>String(value||'').toLocaleLowerCase().replace(/[.,!?।॥]/g,' ').trim().replace(/\s+/g,' ');
export function pickingWorkflowIntent(locale,transcript){
 const input=norm(transcript),entry=words[locale];
 if(!entry||!input)return 'unknown';
 for(const action of ['finish','missing']){
  if(entry[action].some(phrase=>norm(phrase)===input))return action;
 }
 return 'unknown';
}
