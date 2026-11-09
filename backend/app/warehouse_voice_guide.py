"""Narrow voice command grammar for guided picking.

The Gnani Prisma transcript is interpreted only as a navigation/verification
REQUEST. Commands NEVER mark items picked, change stock or file reports.
"""
import re
from fastapi import HTTPException

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

def intent(transcript):
 value=re.sub(r'[.,!?।॥]+',' ',str(transcript).casefold())
 value=' '.join(value.split())
 # Allow harmless courtesy words around a SHORT command, never free-form actions.
 for prefix in ('please ','okay ','ok ','कृपया ','प्लीज ','ठीक है ','जी '):
  if value.startswith(prefix): value=value[len(prefix):]
 for suffix in (' please',' जी',' करो'):
  if value.endswith(suffix): value=value[:-len(suffix)]
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
 if action in ('help','unknown','stop'):
  hi=task.get('language') in ('hi-IN','hi-en')
  messages={
   'help':('Say next item, repeat location, found it, wrong location, or stop.',
           'कहें अगला सामान, जगह दोहराओ, मिल गया, गलत जगह, या रुको।'),
   'unknown':('Command not recognized. Say next item, repeat location, found it, or wrong location.',
              'कमांड समझ नहीं आया। कहें अगला सामान, जगह दोहराओ, मिल गया, या गलत जगह।'),
   'stop':('Voice guidance paused. Picking progress is saved. Resume when ready.',
           'आवाज़ के निर्देश रुके हैं। सामान चुनने की प्रगति सेव है। तैयार होने पर फिर शुरू करें।')
  }
  return {'action':action,'line':None,'text':messages[action][1 if hi else 0],
          'language':task['language']}
 index=pending_line(task)
 if index is None:
  return {'action':'done','line':None,
          'text':'सभी सामान जाँचे गए हैं। अब फिनिश पिकिंग दबाएँ।' if task['language'] in ('hi-IN','hi-en') else 'All items verified. Select Finish picking.',
          'language':task['language']}
 # Even if a worker says "next", an unverified item remains pending.
 # Repeat/verify/report can refer to the selected outstanding line only.
 if action in ('repeat','verify','report') and 0<=requested_line<len(task['lines']) and not task['lines'][requested_line].get('complete'):
  index=requested_line
 line=task['lines'][index]
 check_line(index)   # recheck product revision and actual saved location
 product=line['selected'];location=line['location']
 hi=task.get('language') in ('hi-IN','hi-en')
 place=', '.join(f"{dict(rack='रैक',shelf='शेल्फ',bin='बिन',aisle='गलियारा',zone='भाग',facility='गोदाम',floor='मंज़िल').get(k,k) if hi else k} {location[k]}" for k in ('facility','floor','zone','aisle','rack','shelf','bin') if location.get(k))
 name=f"{product['name']}, {product['sku']}"
 if action in ('next','repeat'):
  text=(f"अगला सामान {name}। {place}। सामान और शेल्फ की पुष्टि करें।" if hi else
        f"Next item: {name}. {place}. Verify the item and shelf.")
 elif action=='verify':
  text=('सामान मिलने पर आइटम और शेल्फ स्कैन करें, या जाँच करके मैन्युअल पुष्टि करें। केवल बोलने से पुष्टि नहीं होती।' if hi else
        'Scan the item and shelf, or explicitly confirm a manual check. Saying found it does not verify a pick.')
 else:
  text=('गलत जगह की रिपोर्ट भरें। मालिक जाँच करेगा। रिकॉर्ड अपने आप नहीं बदलेगा।' if hi else
        'Please submit the wrong-location report for owner review. The saved shelf will not change automatically.')
 return {'action':action,'line':index,'text':text,'language':task['language']}
