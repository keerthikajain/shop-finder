"""Narrow voice command grammar for guided picking.

The Gnani Prisma transcript is interpreted only as a navigation/verification
REQUEST. Commands NEVER mark items picked, change stock or file reports.
"""
import re
import unicodedata
from fastapi import HTTPException
from .warehouse_voice_languages import REGIONAL, regional_messages

# Short, explicit commands avoid substring accidents ("not found" != "found").
COMMANDS = {
 'next': ('agla item','agli cheez','next samaan','next item dikhao','next','next item','go to next item','next one','aage','aage chalo','agla','agla item','agli item',
          'अगला','अगला आइटम','अगला सामान','अगली चीज','आगे','आगे चलो','नेक्स्ट','नेक्स्ट आइटम'),
 'repeat': ('location dobara batao','dobara batao','jagah dobara batao','repeat','repeat location','repeat the location','say location again',
            'where is it','where is this','again','dobara','phir se batao','location dobara',
            'दोबारा','फिर से','फिर से बताओ','जगह दोहराओ','लोकेशन दोहराओ','रैक फिर बताओ','कहाँ है'),
 'verify': ('mil gaya hai','mujhe mil gaya','item mil gaya','found it','i found it','got it','item found','found the item','mil gaya','mil gayi',
            'मिल गया','मिल गई','सामान मिल गया','मुझे मिल गया'),
 'report': ('item galat jagah hai','wrong location hai','yeh jagah galat hai','wrong location','wrong shelf','not here','not on this shelf','item missing',
            'wrong rack','galat jagah','yahan nahi hai','nahi mila',
            'गलत जगह','गलत लोकेशन','लोकेशन गलत है','यह जगह गलत है','गलत शेल्फ','यहाँ नहीं है','नहीं मिला','गलत रैक'),
 'stop': ('ruk jao','voice band karo','stop','stop guide','pause','pause guide','stop speaking','ruko','band karo',
          'रुको','रुकिए','बंद करो','आवाज बंद करो'),
 'help': ('kya bol sakte hain','kya bolu','help karo','help','commands','voice commands','what can i say','madad','मदद','क्या बोलूं','कमांड बताओ')
}

# Known short STT variations are enumerated rather than fuzzy-matched.
# Navigation and reporting requests do not commit a pick or change stock.
# Verified items still require a separate explicit yes/no confirmation.
VARIANTS={
 'te-IN':{
  'report':('తప్పు స్థానము','తప్పు స్థానమ్','తప్పు లొకేషన్','తప్పు లొకేషను','తప్పు స్థలము',
            'तप्पु स्थानम्','तप्पु स्थानम','तप्पु स्थानं','तप्पू स्थानम','తప్పు స్థానమ','తప్పు స్థానము.','wrong location'),
  'repeat':('స్థానం మళ్ళీ చెప్పండి','స్థానాన్ని మళ్ళీ చెప్పండి','స్థానాన్ని మళ్లీ చెప్పండి','లొకేషన్ మళ్ళీ చెప్పండి','లొకేషన్ మళ్లీ చెప్పండి',
            'location మళ్లీ చెప్పండి','location malli cheppu','location dobara batao',
            'location दोबारा बताओ','लोकेशन दोबारा बताओ'),
  'help':('హెల్ప్','help','నాకు సహాయం చేయండి'),
  'stop':('స్టాప్','stop','voice stop'),
  'next':('next item','తరవాతి వస్తువు')
 },
 'hi-en':{
  'repeat':('location दोबारा बताओ','लोकेशन दोबारा बताओ',
            'location फिर से बताओ','जगह फिर से बताओ','लोकेशन फिर बताओ'),
  'report':('wrong लोकेशन','गलत location','तप्पु स्थानम्','गलत लोकेशन','लोकेशन गलत है'),
  'help':('हेल्प','help करो'),
  'stop':('स्टॉप','voice बंद करो')
 },
 'hi-IN':{
  'report':('गलत लोकेशन','लोकेशन गलत है','जगह गलत है'),
  'repeat':('location दोबारा बताओ','लोकेशन दोबारा बताओ','जगह फिर से बताओ'),
  'help':('हेल्प',),
  'stop':('स्टॉप',)
 },
 'en-IN':{
  'repeat':('location dobara batao','location दोबारा बताओ'),
  'help':('मदद',),
 }
}
def normalized_command(value):
 value=unicodedata.normalize('NFC',str(value or '').casefold())
 value=re.sub(r'[.,!?।॥;:؟]+',' ',value)
 return ' '.join(value.split())

def _within_edits(a,b,limit):
 if abs(len(a)-len(b))>limit:return False
 previous=list(range(len(b)+1))
 for i,char in enumerate(a,1):
  current=[i]
  for j,other in enumerate(b,1):
   current.append(min(previous[j]+1,current[-1]+1,previous[j-1]+(char!=other)))
  if min(current)>limit:return False
  previous=current
 return previous[-1]<=limit

def _safe_lookup_variant(value,phrases):
 """A whole-phrase near match may repeat or OPEN a report, never confirm a pick."""
 if not value or re.search(r'\b(?:not|no|dont|never|without|nahi|mat|cancel)\b',value):
  return False
 if any(word in value for word in ('नहीं','नही','मत','వద్దు','కాదు','లేదు')):
  return False
 words=value.split(' ')
 for phrase in phrases:
  expected=normalized_command(phrase)
  target=expected.split(' ')
  if len(words)!=len(target) or len(value)<9 or len(expected)<9:
   continue
  if not _within_edits(words[0],target[0],1):
   continue
  limit=2 if max(len(value),len(expected))>=18 else 1
  if _within_edits(value,expected,limit):return True
 return False

def intent(transcript,language='en-IN'):
 value=normalized_command(transcript)
 # Allow harmless courtesy words around a SHORT command, never free-form actions.
 for prefix in ('please ','okay ','ok ','कृपया ','प्लीज ','ठीक है ','जी '):
  if value.startswith(prefix): value=value[len(prefix):]
 for suffix in (' please',' जी',' करो'):
  if value.endswith(suffix): value=value[:-len(suffix)]
 for kind,phrases in VARIANTS.get(language,{}).items():
  if value in (normalized_command(p) for p in phrases):return kind
 # Only non-committing commands can use minor spelling recovery.
 # Item verification, owner approvals, and location saves remain exact.
 if language in ('en-IN','hi-IN','hi-en','te-IN'):
  for action in ('repeat','report'):
   candidates=(*VARIANTS.get(language,{}).get(action,()),*(REGIONAL[language]['commands'][action] if language in REGIONAL else COMMANDS[action]))
   if _safe_lookup_variant(value,candidates):return action
 if language in REGIONAL:
  return next((kind for kind,phrases in REGIONAL[language]['commands'].items() if value in (normalized_command(p) for p in phrases)),'unknown')
 return next((kind for kind,phrases in COMMANDS.items() if value in (normalized_command(p) for p in phrases)),'unknown')

def pending_line(task):
 # Stable ordered list; no routing-distance claim and no skipped verification.
 choices=[(i,line) for i,line in enumerate(task['lines']) if not line.get('complete') and not line.get('deferred_reason')]
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
 if action not in (*COMMANDS,'unknown','start'):
  raise HTTPException(422,'Unsupported voice command.')
 language=task.get('language','en-IN')
 regional=language in REGIONAL
 hi=language=='hi-IN'
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
  hinglish={'help':'Bolo: agla item, location dobara batao, mil gaya, galat jagah, help ya ruko.',
            'unknown':'Command samajh nahi aaya. Bolo help, mil gaya, location dobara batao ya galat jagah.',
            'stop':'Voice guide pause ho gaya. Aapki progress saved hai. Ready hone par resume karo.'}
  return {'action':action,'line':None,
          'text':messages[action] if regional else hinglish[action] if language=='hi-en' else legacy[action][1 if hi else 0],
          'language':language}
 index=pending_line(task)
 if index is None:
  if any(line.get('deferred_reason') and not line.get('complete') for line in task['lines']):
   unresolved={
    'te-IN':'మిగిలిన వస్తువులు నిర్ధారించబడలేదు. వాటిని తర్వాత మళ్లీ ప్రయత్నించండి లేదా మేనేజర్ సమీక్ష కోసం ఉంచండి.',
    'kn-IN':'ಕೆಲವು ವಸ್ತುಗಳು ಇನ್ನೂ ದೃಢಪಟ್ಟಿಲ್ಲ. ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಪರಿಶೀಲನೆಗಾಗಿ ಉಳಿಸಿ.'
   }
   text=unresolved.get(language,'Baaki items confirm nahi hue. Baad mein retry karo ya manager ko review ke liye bhejo.' if language=='hi-en' else 'कुछ सामान अभी पुष्टि नहीं हुआ है। उसे बाद में दोबारा जाँचें।' if hi else 'Some items remain unconfirmed. Retry them manually or leave them for review.')
   return {'action':'unresolved','line':None,'text':text,'language':language}
  completion={
   'kn-IN':'ಎಲ್ಲಾ ವಸ್ತುಗಳ ಪರಿಶೀಲನೆ ಮುಗಿದಿದೆ. ಪಟ್ಟಿಯನ್ನು ಪೂರ್ಣಗೊಳಿಸುತ್ತಿದ್ದೇವೆ.',
   'te-IN':'అన్ని వస్తువులను తనిఖీ చేశాం. జాబితాను పూర్తి చేస్తున్నాం.'
  }
  spoken=completion.get(language,messages['done'] if regional else
    ('Saare items check ho gaye. Picking list finish ho rahi hai.' if language=='hi-en' else 'सारा सामान जाँच लिया गया है। सूची पूरी हो रही है।' if hi else
     'Everything is checked. Finishing your picking list now.'))
  return {'action':'done','line':None,'text':spoken,'language':language}
 if action in ('start','repeat','verify','report') and 0<=requested_line<len(task['lines']) and not task['lines'][requested_line].get('complete') and not task['lines'][requested_line].get('deferred_reason'):
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
    'next':f'ಮುಂದಿನ ವಸ್ತು: {name}. {place}.',
    'start':f'ಮೊದಲ ವಸ್ತು: {name}. {place}.',
    'repeat':f'ಖಂಡಿತ. {name}. {place}.'
   },
   'te-IN':{
    'verify':f'{name} తీసుకున్నారా? నిర్ధారించడానికి అవును అనండి, లేదా కాదు అనండి.',
    'report':'తెలియజేసినందుకు ధన్యవాదాలు. మీ మేనేజర్‌కు పంపేందుకు స్థాన వివరాలను ఇవ్వండి.',
    'next':f'తదుపరి వస్తువు: {name}. {place}.',
    'start':f'మొదటి వస్తువు: {name}. {place}.',
    'repeat':f'తప్పకుండా. {name}. {place}.'
   }
  }
  text=friendly.get(language,{}).get(action) or messages['next' if action in ('start','next') else action].format(name=name,place=place)
 elif action=='start':
  text=(f"Pehla item: {name}. {place}." if language=='hi-en' else
        f"पहला सामान {name}। {place}।" if hi else
        f"First item: {name}. {place}.")
 elif action in ('next','repeat'):
  text=(f"{'Location dobara:' if action=='repeat' else 'Next item:'} {name}. {place}." if language=='hi-en' else
        f"अगला सामान {name}। {place}।" if hi else
        f"Next up: {name}. {place}.")
 elif action=='verify':
  text=(f'Kya aapne {name} pick kiya? Confirm karne ke liye haan bolo, warna nahi.' if language=='hi-en' else
        f'क्या आपने {name} उठा लिया? पुष्टि के लिए हाँ कहें, या नहीं कहें।' if hi else
        f'Did you pick {name}? Say yes to confirm, or no to cancel.')
 else:
  text=('Wrong location report khol rahe hain. Batao kya galat hai, phir confirm karke report bhejo.' if language=='hi-en' else
        'बताने के लिए धन्यवाद। सही जगह की जानकारी दीजिए, हम मैनेजर को भेज देंगे।' if hi else
        'Thanks for checking. Tell us where you found it so we can inform your manager.')
 return {'action':action,'line':index,'text':text,'language':language}
