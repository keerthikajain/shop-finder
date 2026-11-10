// Short exact confirmation phrases. Never interpret a casual "yes" as a pick
// unless the worker first requested verification of the current item.
const CONFIRM={
 'en-IN':{yes:['yes','yes picked','yes i picked it','confirm','confirm picked'],no:['no','cancel','not yet']},
 'hi-IN':{yes:['हाँ','हां','हाँ उठाया','पुष्टि करो','जी हाँ'],no:['नहीं','रद्द करो']},
 'hi-en':{yes:['yes','haan','ha','हाँ','हां','haan picked','confirm'],no:['no','nahi','नहीं','cancel']},
 'kn-IN':{yes:['ಹೌದು','ಹೌದು ತೆಗೆದುಕೊಂಡೆ','ಖಚಿತಪಡಿಸಿ'],no:['ಇಲ್ಲ','ರದ್ದು ಮಾಡಿ']},
 'te-IN':{yes:['అవును','అవును తీసుకున్నాను','నిర్ధారించండి'],no:['కాదు','రద్దు చేయండి']}
};
const normalize=text=>String(text||'').toLocaleLowerCase().replace(/[.,!?।॥]/g,' ').trim().replace(/\s+/g,' ');
export function pickConfirmationIntent(language,text){
 const options=CONFIRM[language];
 if(!options)return 'unknown';
 const value=normalize(text);
 if(options.yes.some(x=>normalize(x)===value))return 'yes';
 if(options.no.some(x=>normalize(x)===value))return 'no';
 return 'unknown';
}
