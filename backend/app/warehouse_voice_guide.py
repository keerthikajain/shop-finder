"""Narrow voice command grammar for guided picking.

The Gnani Prisma transcript is interpreted only as a navigation/verification
REQUEST. Commands NEVER mark items picked, change stock or file reports.
"""
import re
from fastapi import HTTPException
from .warehouse_voice_languages import REGIONAL, regional_messages

# Short, explicit commands avoid substring accidents ("not found" != "found").
COMMANDS = {
 'next': ('next','next item','go to next item','next one','aage','aage chalo','agla','agla item','agli item',
          'अगला','अगला आइटम','अगला सामान','अगली चीज','आगे','आगे चलो','नेक्स्ट','नेक्स्ट आइटम'),
 'repeat': ('repeat','repeat location','repeat the location','say location again',
            'where is it','where is this','again','dobara','phir se batao','location dobara',
            'दोबारा','फिर से','फिर से बताओ','जगह दोहराओ','लोकेशन दोहराओ','रैक फिर बताओ','कहाँ है'),
 'verify': ('found it','i found it','got it','item found','found the item','mil gaya','mil gayi',
            'मिल गया','मिल गई','सामान मिल गया','मुझे मिल गया'),
 'report': ('wrong location','wrong shelf','not here','not on this shelf','item missing',
            'wrong rack','galat jagah','yahan nahi hai','nahi mila',
            'गलत जगह','गलत शेल्फ','यहाँ नहीं है','नहीं मिला','गलत रैक'),
 'stop': ('stop','stop guide','pause','pause guide','stop speaking','ruko','band karo',
          'रुको','रुकिए','बंद करो','आवाज बंद करो'),
 'help': ('help','commands','voice commands','what can i say','madad','मदद','क्या बोलूं','कमांड बताओ')
}

def intent(transcript,language='en-IN'):
 value=re.sub(r'[.,!?।॥]+',' ',str(transcript).casefold())
 value=' '.join(value.split())
 # Allow harmless courtesy words around a SHORT command, never free-form actions.
 for prefix in ('please ','okay ','ok ','कृपया ','प्लीज ','ठीक है ','जी '):
  if value.startswith(prefix): value=value[len(prefix):]
 for suffix in (' please',' जी',' करो'):
  if value.endswith(suffix): value=value[:-len(suffix)]
 if language in REGIONAL:
  return next((kind for kind,phrases in REGIONAL[language]['commands'].items() if value in phrases),'unknown')
 return next((kind for kind,phrases in COMMANDS.items() if value in phrases),'unknown')

def pending_line(task):
 # Stable ordered list; no routing-distance claim and no skipped verification.
 choices=[(i,line) for i,line in enumerate(task['lines']) if not line.get('complete')]
 if not choices:return None
 # Group by actual recorded location text, then original request index.
 def location_key(entry):
  i,line=entry
  location=line.get('location') or {}
  return (tuple(str(location.get(k,'')).casefold() for k in ('facility','floor','zone','aisle','rack','shelf','bin')),i)
 return sorted(choices,key=location_key)[0][0]

def guide(task,action,requested_line,check_line):
 if task.get('picking',{}).get('status')!='active':
  raise HTTPException(409,'Start picking before using voice guidance.')
 if action not in (*COMMANDS,'unknown'):
  raise HTTPException(422,'Unsupported voice command.')
 language=task.get('language','en-IN')
 regional=language in REGIONAL
 hi=language in ('hi-IN','hi-en')
 messages, labels=regional_messages(language) if regional else ({}, {})
 if action in ('help','unknown','stop'):
  legacy={
   'help':('Say next item, repeat location, found it, wrong location, or stop.',
           'कहें अगला सामान, जगह दोहराओ, मिल गया, गलत जगह, या रुको।'),
   'unknown':('Command not recognized. Say next item, repeat location, found it, or wrong location.',
              'कमांड समझ नहीं आया। कहें अगला सामान, जगह दोहराओ, मिल गया, या गलत जगह।'),
   'stop':('Voice guidance paused. Picking progress is saved. Resume when ready.',
           'आवाज़ के निर्देश रुके हैं। सामान चुनने की प्रगति सेव है। तैयार होने पर फिर शुरू करें।')
  }
  return {'action':action,'line':None,
          'text':messages[action] if regional else legacy[action][1 if hi else 0],
          'language':language}
 index=pending_line(task)
 if index is None:
  completion={
   'kn-IN':'ಎಲ್ಲಾ ವಸ್ತುಗಳನ್ನು ತೆಗೆದುಕೊಂಡಿದ್ದೀರಿ. ಪಿಕಿಂಗ್ ಪೂರ್ಣಗೊಳಿಸಬೇಕೇ? ಹೌದು ಅಥವಾ ಇಲ್ಲ ಎಂದು ಹೇಳಿ.',
   'te-IN':'అన్ని వస్తువులు తీసుకున్నారు. పికింగ్ పూర్తి చేయాలా? అవును లేదా కాదు అని చెప్పండి.'
  }
  spoken=completion.get(language,messages['done'] if regional else
    ('सारा सामान मिल गया। क्या पिकिंग पूरी कर दें? हाँ या नहीं कहें।' if hi else
     'All items are picked. Ready to finish? Say yes to finish, or no to review.'))
  return {'action':'done','line':None,'text':spoken,'language':language}
 if action in ('repeat','verify','report') and 0<=requested_line<len(task['lines']) and not task['lines'][requested_line].get('complete'):
  index=requested_line
 line=task['lines'][index]
 check_line(index)   # recheck product revision and recorded location
 product=line['selected'];location=line['location']
 label_hi={'rack':'रैक','shelf':'शेल्फ','bin':'बिन','aisle':'गलियारा','zone':'भाग','facility':'गोदाम','floor':'मंज़िल'}
 label_keys=('facility','floor','zone','aisle','rack','shelf','bin')
 place=', '.join(f"{labels.get(k,k) if regional else (label_hi.get(k,k) if hi else k)} {location[k]}" for k in label_keys if location.get(k))
 name=f"{product['name']}, {product['sku']}"
 if regional:
  friendly={
   'kn-IN':{
    'verify':f'{name} ತೆಗೆದುಕೊಂಡಿದ್ದೀರಾ? ಖಚಿತಪಡಿಸಲು ಹೌದು ಎಂದು ಹೇಳಿ. ಇಲ್ಲದಿದ್ದರೆ ಇಲ್ಲ ಎಂದು ಹೇಳಿ.',
    'report':'ತಿಳಿಸಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮ ಮ್ಯಾನೇಜರ್‌ಗೆ ತಿಳಿಸಲು ಸ್ಥಳದ ವಿವರಗಳನ್ನು ನೀಡಿ.',
    'next':f'ಮುಂದಿನ ವಸ್ತು: {name}. {place}. ಸಿಕ್ಕಿದ ನಂತರ ತಿಳಿಸಿ.',
    'repeat':f'ಖಂಡಿತ. {name}. {place}.'
   },
   'te-IN':{
    'verify':f'{name} తీసుకున్నారా? నిర్ధారించడానికి అవును అనండి, లేదా కాదు అనండి.',
    'report':'తెలియజేసినందుకు ధన్యవాదాలు. మీ మేనేజర్‌కు పంపేందుకు స్థాన వివరాలను ఇవ్వండి.',
    'next':f'తదుపరి వస్తువు: {name}. {place}. దొరికిన తర్వాత చెప్పండి.',
    'repeat':f'తప్పకుండా. {name}. {place}.'
   }
  }
  text=friendly.get(language,{}).get(action) or messages['next' if action=='next' else action].format(name=name,place=place)
 elif action in ('next','repeat'):
  text=(f"अगला सामान {name}। {place}। मिलने पर बताइए।" if hi else
        f"Next up: {name}. {place}. Tell me when you have it.")
 elif action=='verify':
  text=(f'क्या आपने {name} उठा लिया? पुष्टि के लिए हाँ कहें, या नहीं कहें।' if hi else
        f'Did you pick {name}? Say yes to confirm, or no to cancel.')
 else:
  text=('बताने के लिए धन्यवाद। सही जगह की जानकारी दीजिए, हम मैनेजर को भेज देंगे।' if hi else
        'Thanks for checking. Tell us where you found it so we can inform your manager.')
 return {'action':action,'line':index,'text':text,'language':language}
