// Exact phrases shown by the picking controls for the selected voice locale.
// They travel through the same strict server command parser as Prisma transcripts.
export const PICK_VOICE_BUTTON_PHRASES={
  "kn-IN": {
    "next": "ಮುಂದಿನ ವಸ್ತು",
    "repeat": "ಸ್ಥಳವನ್ನು ಮತ್ತೆ ಹೇಳಿ",
    "verify": "ಸಿಕ್ಕಿತು",
    "report": "ತಪ್ಪು ಸ್ಥಳ",
    "stop": "ನಿಲ್ಲಿಸಿ",
    "help": "ಸಹಾಯ"
  },
  "ta-IN": {
    "next": "அடுத்த பொருள்",
    "repeat": "இடத்தை மீண்டும் சொல்லுங்கள்",
    "verify": "கிடைத்தது",
    "report": "தவறான இடம்",
    "stop": "நிறுத்து",
    "help": "உதவி"
  },
  "te-IN": {
    "next": "తదుపరి వస్తువు",
    "repeat": "స్థానాన్ని మళ్లీ చెప్పండి",
    "verify": "దొరికింది",
    "report": "తప్పు స్థానం",
    "stop": "ఆపు",
    "help": "సహాయం"
  },
  "ml-IN": {
    "next": "അടുത്ത സാധനം",
    "repeat": "സ്ഥലം വീണ്ടും പറയൂ",
    "verify": "കിട്ടി",
    "report": "തെറ്റായ സ്ഥലം",
    "stop": "നിർത്തൂ",
    "help": "സഹായം"
  },
  "mr-IN": {
    "next": "पुढचा माल",
    "repeat": "जागा पुन्हा सांगा",
    "verify": "मिळाले",
    "report": "चुकीची जागा",
    "stop": "थांबा",
    "help": "मदत"
  },
  "bn-IN": {
    "next": "পরের জিনিস",
    "repeat": "জায়গাটা আবার বলুন",
    "verify": "পেয়েছি",
    "report": "ভুল জায়গা",
    "stop": "থামুন",
    "help": "সাহায্য"
  },
  "gu-IN": {
    "next": "આગળની વસ્તુ",
    "repeat": "જગ્યા ફરી કહો",
    "verify": "મળી ગયું",
    "report": "ખોટી જગ્યા",
    "stop": "રોકો",
    "help": "મદદ"
  },
  "pa-IN": {
    "next": "ਅਗਲੀ ਚੀਜ਼",
    "repeat": "ਥਾਂ ਦੁਬਾਰਾ ਦੱਸੋ",
    "verify": "ਮਿਲ ਗਿਆ",
    "report": "ਗਲਤ ਥਾਂ",
    "stop": "ਰੁਕੋ",
    "help": "ਮਦਦ"
  },
  "en-IN": {
    "next": "next item",
    "repeat": "repeat location",
    "verify": "found it",
    "report": "wrong location",
    "stop": "stop",
    "help": "help"
  },
  "hi-IN": {
    "next": "अगला सामान",
    "repeat": "जगह दोहराओ",
    "verify": "मिल गया",
    "report": "गलत जगह",
    "stop": "रुको",
    "help": "मदद"
  },
  "hi-en": {
    "next": "next item",
    "repeat": "repeat location",
    "verify": "found it",
    "report": "wrong location",
    "stop": "stop",
    "help": "help"
  }
};
export const PICKING_VOICE_LANGUAGES=Object.freeze(Object.keys(PICK_VOICE_BUTTON_PHRASES));
export function pickVoicePhrase(language,action){
 return (PICK_VOICE_BUTTON_PHRASES[language]||PICK_VOICE_BUTTON_PHRASES['en-IN'])[action]||'help';
}
