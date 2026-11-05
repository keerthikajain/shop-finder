"""Bounded demo vocabulary; never translates or infers compatibility."""
import re

LANGUAGES = ('en-IN', 'hi-IN', 'hi-en')
PHRASES = {
 'पंखे का': 'fan', 'पंखा': 'fan', 'पंखे': 'fan', 'pankhe ka': 'fan', 'pankha': 'fan',
 'कैपेसिटर': 'capacitor', 'कैपेसिटर का': 'capacitor', 'कंडेंसर': 'condenser', 'capacitor ka': 'capacitor',
 'वॉशिंग मशीन': 'washing machine', 'वाशिंग मशीन': 'washing machine',
 'ड्रेन पंप': 'drain pump', 'पानी निकालने का पंप': 'drain pump',
 'फ्रिज': 'fridge', 'रेफ्रिजरेटर': 'refrigerator', 'फैन': 'fan',
 'मिक्सर': 'mixer', 'मिक्सी': 'mixer', 'ग्राइंडर': 'grinder', 'कपलर': 'coupler',
 'आयरन': 'iron', 'इस्त्री': 'iron', 'हीटर': 'heater', 'थर्मल फ्यूज': 'thermal fuse',
 'वाटर प्यूरीफायर': 'water purifier', 'आर ओ': 'RO', 'फिल्टर': 'filter',
 'पंप': 'pump', 'मोटर': 'motor', 'बेल्ट': 'belt', 'बेयरिंग': 'bearing',
 'गैस्केट': 'gasket', 'रबर': 'rubber', 'वाल्व': 'valve',
 'माइक्रोफैराड': 'uf', 'माइक्रोफैरड': 'uf', 'वोल्ट': 'v', 'वाट': 'w',
 'एसी': 'AC', 'डीसी': 'DC', 'मिलीमीटर': 'mm',
 'दो पॉइंट पांच': '2.5', 'दो दशमलव पांच': '2.5', 'ढाई': '2.5',
 'कहाँ है': '', 'कहां है': '', 'कहाँ मिलेगा': '', 'कहां मिलेगा': '', 'चाहिए': '',
 'kidhar hai': '', 'kahan hai': '', 'chahiye': '', 'का': '', 'की': '',
 'नहीं': 'not', 'नही': 'not', 'बदले': 'instead', 'लग सकता': 'compatible', 'फिट': 'fit',
}

def normalize_query(text):
    text = text.translate(str.maketrans('०१२३४५६७८९', '0123456789')).casefold()
    for src,dst in sorted(PHRASES.items(),key=lambda x:-len(x[0])):
        text = re.sub(r'(?<!\S)'+re.escape(src)+r'(?=$|\s|[?!।,])',lambda m:dst,text)
    return re.sub(r'\s+', ' ', text).strip(' ?.!,।')

def has_unhandled_hindi(text):
    return bool(re.search('[\u0900-\u097f]', text))

def followup_constraints(text):
    """Accept only a fully understood short reply; preserve previous constraints."""
    q=normalize_query(text).replace('µ','u').replace('μ','u')
    if re.fullmatch(r'syn-\d+',q):return {'part_number':q.upper()}
    for pattern,key in [(r'(\d+(?:\.\d+)?)\s*(?:uf|microfarads?)','capacitance_uf'),(r'(\d+(?:\.\d+)?)\s*(?:v|volts?)','voltage_v'),(r'(\d+(?:\.\d+)?)\s*(?:w|watts?)','power_w')]:
        m=re.fullmatch(pattern,q)
        if m:return {'specifications':{key:m[1]}}
    if q in ('ac','dc'):return {'specifications':{'supply':q.upper()}}
    if q in ('2 wire leads','2 spade terminals','2-pin keyed plug','2 flat terminals','4-pin keyed plug','axial leads'):return {'connector_type':q}
    return None

def response_text(products, language):
    hi=language in ('hi-IN','hi-en')
    if not products:return 'इस अनुरोध की पुष्टि नहीं हुई। पार्ट नंबर और रेटिंग जाँचें या स्टाफ से पूछें।' if hi else 'No candidate confirmed. Check the exact part number and rating, or ask staff.'
    if len(products)>1:
        ratings=sorted({str(p.specifications['capacitance_uf']) for p in products if 'capacitance_uf' in p.specifications})
        detail=(' / '.join(ratings)+' माइक्रोफैराड') if hi else (' or '.join(ratings)+' microfarads')
        return (f'{len(products)} संभावित पार्ट मिले। '+(f'लेबल पर कौन सी रेटिंग है: {detail}?' if len(ratings)>1 else 'लेबल का सटीक पार्ट नंबर या कनेक्टर बताएँ।')+' समान नाम से अनुकूलता साबित नहीं होती।') if hi else (f'{len(products)} candidates found. '+(f'Which rating is on the label: {detail}?' if len(ratings)>1 else 'Read the exact part number or connector from the label.')+' Similar names do not confirm compatibility.')
    p=products[0];loc=p.location
    if hi:
        prefix='केवल काल्पनिक डेमो। ' if p.is_synthetic else ('स्टाफ द्वारा सत्यापित कैटलॉग रिकॉर्ड। ' if p.verification.status=='verified' else 'असत्यापित कैटलॉग रिकॉर्ड। ')
        return f'{prefix}{p.name}, {p.part_number or p.id}। रैक {loc.rack}, शेल्फ {loc.shelf}, बॉक्स {loc.box}। यह अनुकूलता या बदलकर लगाने की सलाह नहीं है।'
    prefix='Synthetic demo only. Fictional location. ' if p.is_synthetic else ('Staff-verified catalogue record. ' if p.verification.status=='verified' else 'Unverified catalogue record. ')
    return f'{prefix}{p.name}, {p.part_number or p.id}. Rack {loc.rack}, shelf {loc.shelf}, box {loc.box}. This does not confirm compatibility or substitution.'
