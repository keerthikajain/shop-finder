// Interface copy follows the app language. Recognition and TTS keep their own
// selected speech language. This module never changes a command sent to the API.
import {translate} from './locale.js';
import {pickingCopy} from './picking-copy.js';
import {reportVoiceCopy} from './report-voice-copy.js';

const appToSpeechUi={hi:'hi-IN',te:'te-IN'};
const appCopy=(appLanguage,read,key)=>{
 const code=appToSpeechUi[appLanguage];
 return code?read(code,key):translate(appLanguage,read('en-IN',key));
};
export const pickingUiCopy=(appLanguage,key)=>appCopy(appLanguage,pickingCopy,key);
export const reportUiCopy=(appLanguage,key)=>appCopy(appLanguage,reportVoiceCopy,key);

// The clickable command label is translated, while the exact spoken phrase is
// displayed separately and sent unchanged to the strict voice-command parser.
const commands={
 en:{verify:'Found it',report:'Wrong location',repeat:'Repeat location',next:'Next item',stop:'Stop',help:'Help'},
 hi:{verify:'मिल गया',report:'गलत जगह',repeat:'जगह दोहराएँ',next:'अगला सामान',stop:'रोकें',help:'मदद'},
 te:{verify:'దొరికింది',report:'తప్పు స్థానం',repeat:'స్థానాన్ని మళ్లీ చెప్పండి',next:'తదుపరి వస్తువు',stop:'ఆపు',help:'సహాయం'},
 kn:{verify:'ಸಿಕ್ಕಿತು',report:'ತಪ್ಪು ಸ್ಥಳ',repeat:'ಸ್ಥಳ ಮತ್ತೆ ಹೇಳಿ',next:'ಮುಂದಿನ ವಸ್ತು',stop:'ನಿಲ್ಲಿಸಿ',help:'ಸಹಾಯ'},
 ta:{verify:'கிடைத்தது',report:'தவறான இடம்',repeat:'இடத்தை மீண்டும் கூறு',next:'அடுத்த பொருள்',stop:'நிறுத்து',help:'உதவி'},
 ml:{verify:'കിട്ടി',report:'തെറ്റായ സ്ഥലം',repeat:'സ്ഥലം വീണ്ടും പറയുക',next:'അടുത്ത സാധനം',stop:'നിർത്തുക',help:'സഹായം'},
 mr:{verify:'मिळाले',report:'चुकीची जागा',repeat:'जागा पुन्हा सांगा',next:'पुढचा माल',stop:'थांबा',help:'मदत'},
 bn:{verify:'পাওয়া গেছে',report:'ভুল জায়গা',repeat:'জায়গা আবার বলুন',next:'পরের জিনিস',stop:'থামুন',help:'সাহায্য'},
 gu:{verify:'મળી ગયું',report:'ખોટી જગ્યા',repeat:'સ્થાન ફરી કહો',next:'આગળની વસ્તુ',stop:'રોકો',help:'મદદ'},
 pa:{verify:'ਮਿਲ ਗਿਆ',report:'ਗਲਤ ਥਾਂ',repeat:'ਥਾਂ ਦੁਬਾਰਾ ਦੱਸੋ',next:'ਅਗਲੀ ਚੀਜ਼',stop:'ਰੋਕੋ',help:'ਮਦਦ'}
};
export const pickingCommandLabel=(appLanguage,action)=>(commands[appLanguage]||commands.en)[action]||action;

// Neutral explanations avoid telling Hindi-app users to say Hindi phrases when
// their speech recognizer is actually set to Telugu, English, or Hinglish.
const tips={
 en:{available:'Use the buttons below, or say the smaller phrases shown in your selected speech language.',confirm:'Did you pick the correct item? Answer using your selected speech language.',speakHint:'Say these phrases in your selected speech language:',yes:'Yes',no:'No'},
 hi:{available:'नीचे दिए बटन दबाएँ, या उनके नीचे अपनी चुनी हुई आवाज़ की भाषा में लिखे शब्द बोलें।',confirm:'क्या आपने सही सामान उठाया? अपनी चुनी हुई आवाज़ की भाषा में हाँ या नहीं बोलें।',speakHint:'अपनी चुनी हुई आवाज़ की भाषा में ये शब्द बोलें:',yes:'हाँ',no:'नहीं'},
 te:{available:'క్రింది బటన్లను వాడండి లేదా వాటి కింద ఉన్న పదాలను ఎంచుకున్న వాయిస్ భాషలో చెప్పండి.',confirm:'సరైన వస్తువు తీసుకున్నారా? ఎంచుకున్న వాయిస్ భాషలో అవును లేదా కాదు అనండి.',speakHint:'ఎంచుకున్న వాయిస్ భాషలో ఈ మాటలు చెప్పండి:',yes:'అవును',no:'కాదు'}
};
export const pickingUiTip=(appLanguage,key)=>{
 const en=tips.en[key];
 return (tips[appLanguage]?.[key])||translate(appLanguage,en)||en;
};
export const spokenYesNo=language=>language==='te-IN'?['అవును','కాదు']:
 language==='hi-IN'?['हाँ','नहीं']:language==='hi-en'?['haan','nahi']:
 language==='kn-IN'?['ಹೌದು','ಇಲ್ಲ']:['yes','no'];

const reportTips={
 en:{confirm:'To answer by voice, use the words shown in your selected speech language.',submit:'To submit by voice, say the phrase shown in your selected speech language.'},
 hi:{confirm:'आवाज़ से उत्तर देने के लिए नीचे अपनी चुनी हुई आवाज़ की भाषा में लिखे शब्द बोलें।',submit:'रिपोर्ट भेजने के लिए अपनी चुनी हुई आवाज़ की भाषा में नीचे लिखा आदेश बोलें।'},
 te:{confirm:'వాయిస్‌తో సమాధానం ఇవ్వాలంటే ఎంచుకున్న వాయిస్ భాషలో కింద చూపిన పదాలు చెప్పండి.',submit:'నివేదికను పంపడానికి ఎంచుకున్న వాయిస్ భాషలో కింద చూపిన మాట చెప్పండి.'}
};
export const reportUiTip=(appLanguage,key)=>reportTips[appLanguage]?.[key]||translate(appLanguage,reportTips.en[key])||reportTips.en[key];
