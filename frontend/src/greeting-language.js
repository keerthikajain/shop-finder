// Calm, short welcome messages. The greeting language is the APP language,
// not the separately selected speech-recognition language.
export const APP_GREETING_VOICE=Object.freeze({
 en:'en-IN',hi:'hi-IN',bn:'bn-IN',mr:'mr-IN',gu:'gu-IN',
 pa:'pa-IN',kn:'kn-IN',te:'te-IN',ta:'ta-IN',ml:'ml-IN'
});
export const PUBLIC_GREETING=Object.freeze({
 en:'Hi, welcome to Finder.',
 hi:'नमस्ते, फाइंडर में आपका स्वागत है।',
 bn:'নমস্কার, ফাইন্ডারে স্বাগতম।',
 mr:'नमस्कार, फाइंडरमध्ये आपले स्वागत आहे.',
 gu:'નમસ્તે, ફાઇન્ડરમાં આપનું સ્વાગત છે.',
 pa:'ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਫਾਈਂਡਰ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ।',
 kn:'ನಮಸ್ಕಾರ, ಫೈಂಡರ್‌ಗೆ ಸ್ವಾಗತ.',
 te:'నమస్కారం, ఫైండర్‌కు స్వాగతం.',
 ta:'வணக்கம், ஃபைண்டருக்கு வரவேற்கிறோம்.',
 ml:'നമസ്കാരം, ഫൈൻഡറിലേക്ക് സ്വാഗതം.'
});
const PERIOD={
 en:{morning:'Good morning',afternoon:'Good afternoon',evening:'Good evening',back:'Welcome back to Finder.'},
 hi:{morning:'सुप्रभात',afternoon:'नमस्कार',evening:'शुभ संध्या',back:'फाइंडर में फिर से स्वागत है।'},
 bn:{morning:'সুপ্রভাত',afternoon:'নমস্কার',evening:'শুভ সন্ধ্যা',back:'ফাইন্ডারে আবার স্বাগতম।'},
 mr:{morning:'सुप्रभात',afternoon:'नमस्कार',evening:'शुभ संध्याकाळ',back:'फाइंडरमध्ये पुन्हा स्वागत आहे.'},
 gu:{morning:'સુપ્રભાત',afternoon:'નમસ્તે',evening:'શુભ સાંજ',back:'ફાઇન્ડરમાં ફરી સ્વાગત છે.'},
 pa:{morning:'ਸ਼ੁਭ ਸਵੇਰ',afternoon:'ਸਤ ਸ੍ਰੀ ਅਕਾਲ',evening:'ਸ਼ੁਭ ਸ਼ਾਮ',back:'ਫਾਈਂਡਰ ਵਿੱਚ ਮੁੜ ਸੁਆਗਤ ਹੈ।'},
 kn:{morning:'ಶುಭೋದಯ',afternoon:'ನಮಸ್ಕಾರ',evening:'ಶುಭ ಸಂಜೆ',back:'ಫೈಂಡರ್‌ಗೆ ಮತ್ತೆ ಸ್ವಾಗತ.'},
 te:{morning:'శుభోదయం',afternoon:'నమస్కారం',evening:'శుభ సాయంత్రం',back:'ఫైండర్‌కు మళ్లీ స్వాగతం.'},
 ta:{morning:'காலை வணக்கம்',afternoon:'வணக்கம்',evening:'மாலை வணக்கம்',back:'ஃபைண்டருக்கு மீண்டும் வரவேற்கிறோம்.'},
 ml:{morning:'സുപ്രഭാതം',afternoon:'നമസ്കാരം',evening:'ശുഭ സായാഹ്നം',back:'ഫൈൻഡറിലേക്ക് വീണ്ടും സ്വാഗതം.'}
};
export function greetingForApp(appLanguage,hour,name=''){
 const code=Object.prototype.hasOwnProperty.call(PERIOD,appLanguage)?appLanguage:'en';
 if(!name)return PUBLIC_GREETING[code];
 const period=hour<12?'morning':hour<17?'afternoon':'evening';
 return PERIOD[code][period]+', '+name+'. '+PERIOD[code].back;
}
