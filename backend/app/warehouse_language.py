"""Conservative Hindi/Hinglish normalization for warehouse item retrieval.

This is a small controlled product vocabulary, not machine translation.
It normalizes BOTH user transcripts and saved product names/aliases.
Unknown content must still fail to match rather than guess a shelf.
"""
import re
import unicodedata
from .warehouse_multilingual_terms import TERMS, FILLERS

# Longest phrases first; whole-token replacement prevents "tea" inside "steamer".
SYNONYMS = {
    'बासमती चावल':'basmati rice', 'basmati chawal':'basmati rice',
    'अरहर की दाल':'toor dal', 'अरहर दाल':'toor dal', 'arhar dal':'toor dal',
    'तूर दाल':'toor dal', 'toor daal':'toor dal',
    'मूंग दाल':'moong dal', 'moong daal':'moong dal',
    'चना दाल':'chana dal', 'chana daal':'chana dal',
    'उड़द दाल':'urad dal', 'urad daal':'urad dal',
    'चाय की पत्ती':'tea leaves', 'चाय पत्ती':'tea leaves',
    'chai ki patti':'tea leaves', 'chai patti':'tea leaves',
    'डिशवॉशिंग लिक्विड':'dishwashing liquid',
    'बर्तन धोने का लिक्विड':'dishwashing liquid',
    'बर्तन साबुन':'dishwashing liquid',
    'bartan dhone ka liquid':'dishwashing liquid',
    'bartan soap':'dishwashing liquid',
    'वाशिंग पाउडर':'detergent powder', 'washing powder':'detergent powder',
    'लाल मिर्च':'red chilli', 'lal mirch':'red chilli',
    'धनिया पाउडर':'coriander powder', 'dhania powder':'coriander powder',
    'हल्दी पाउडर':'turmeric powder', 'haldi powder':'turmeric powder',
    'एक किलो':'1 kg', 'दो किलो':'2 kg', 'पाँच किलो':'5 kg',
    'पांच किलो':'5 kg', 'दस किलो':'10 kg',
    'ek kilo':'1 kg', 'do kilo':'2 kg', 'paanch kilo':'5 kg',
    'panch kilo':'5 kg', 'das kilo':'10 kg',
    'आधा लीटर':'500 ml', 'aadha litre':'500 ml', 'aadha liter':'500 ml',
    'एक लीटर':'1 l', 'ek litre':'1 l', 'ek liter':'1 l',
    'दो लीटर':'2 l', 'do litre':'2 l', 'do liter':'2 l',
    'पंखे का':'fan', 'पंखे':'fan', 'पंखा':'fan', 'फैन':'fan', 'pankhe ka':'fan', 'pankha':'fan',
    'कैपेसिटर':'capacitor', 'कंडेंसर':'condenser',
    'नीली':'blue', 'नीला':'blue', 'नीले':'blue', 'सफेद':'white', 'सफ़ेद':'white', 'काली':'black',
    'काला':'black', 'लाल':'red', 'सूती':'cotton',
    'नारंगी':'orange', 'हरी':'green', 'हरा':'green',
    'ब्राउन':'brown', 'भूरा':'brown', 'भूरे':'brown', 'भूरी':'brown',
    'brown':'brown', 'ब्राउन कलर':'brown', 'गुलाबी':'pink', 'ग्रे':'grey', 'स्लेटी':'grey',
    'क्रीम':'cream', 'बेज':'beige', 'सिल्वर':'silver',
    'बासमती':'basmati', 'चावल':'rice', 'chawal':'rice',
    'chaval':'rice', 'चावलें':'rice', 'राइस':'rice',
    'सोनामसूरी':'sona masoori', 'सोना मसूरी':'sona masoori',
    'sona masuri':'sona masoori', 'sonamasuri':'sona masoori',
    'दाल':'dal', 'daal':'dal', 'अरहर':'toor', 'तूर':'toor',
    'moong':'moong', 'मूंग':'moong', 'उड़द':'urad', 'urad':'urad',
    'चना':'chana', 'राजमा':'rajma',
    'गेहूँ':'wheat', 'गेहूं':'wheat', 'आटा':'atta',
    'मैदा':'maida', 'सूजी':'rava', 'रवा':'rava', 'पोहा':'poha',
    'चीनी':'sugar', 'cheeni':'sugar', 'शक्कर':'sugar',
    'नमक':'salt', 'namak':'salt', 'हल्दी':'turmeric',
    'haldi':'turmeric', 'मिर्च':'chilli', 'mirchi':'chilli',
    'धनिया':'coriander', 'dhania':'coriander',
    'जीरा':'cumin', 'jeera':'cumin',
    'मसाला':'masala', 'चाय':'tea', 'chai':'tea', 'कॉफी':'coffee',
    'पानी':'water', 'paani':'water', 'pani':'water',
    'बोतल':'bottle', 'botal':'bottle', 'जूस':'juice',
    'तेल':'oil', 'tel':'oil', 'सरसों':'mustard', 'नूडल्स':'noodles',
    'बिस्कुट':'biscuits', 'बिस्किट':'biscuits',
    'नमकीन':'namkeen', 'चिप्स':'chips', 'साबुन':'soap',
    'डिटर्जेंट':'detergent', 'झाड़ू':'broom', 'टिशू':'tissue',
    'गार्बेज':'garbage', 'बैग':'bag', 'बोरी':'bag',
    'पैकेट':'pack', 'पैक':'pack', 'पाउच':'pouch',
    'किलो':'kg', 'किलोग्राम':'kg', 'केजी':'kg',
    'kilogram':'kg', 'kilograms':'kg', 'kilo':'kg', 'kgs':'kg',
    'ग्राम':'g', 'gram':'g', 'grams':'g', 'gm':'g', 'gms':'g',
    'लीटर':'l', 'litre':'l', 'liter':'l', 'litres':'l', 'liters':'l',
    'मिलीलीटर':'ml', 'millilitre':'ml', 'milliliter':'ml',
    'मिलि':'ml', 'एमएल':'ml',
    'साइज़':'size', 'साइज':'size', 'वाट':'w',
    'एम':'m', 'एल':'l',
    'extra large':'xl', 'extra small':'xs', 'medium':'m',
    'large':'l', 'small':'s',
    'thirty two':'32', 'thirty four':'34', 'forty':'40', 'twenty':'20',
    'one':'1', 'two':'2', 'three':'3', 'four':'4', 'five':'5',
    'six':'6', 'seven':'7', 'eight':'8', 'nine':'9',
    'एक':'1', 'दो':'2', 'तीन':'3', 'चार':'4', 'पांच':'5',
    'पाँच':'5', 'छह':'6', 'सात':'7', 'आठ':'8', 'नौ':'9',
    'दस':'10', 'बी':'b', 'सी':'c',
    'tshirts':'tshirt', 't-shirts':'tshirt',
    'trainer':'trainers', 'sandal':'sandals',
    'mixers':'mixer', 'kettles':'kettle',
    'लोफर्स':'loafers', 'लोफ़र्स':'loafers', 'लोफर':'loafers', 'लोफ़र':'loafers',
    'lofar':'loafers', 'lofers':'loafers', 'loffer':'loafers', 'loafer':'loafers',
    'सैंडल्स':'sandals', 'सैंडल':'sandals', 'चप्पल':'slippers', 'चप्पलें':'slippers',
    'ट्रेनर्स':'trainers', 'स्नीकर्स':'trainers', 'जूते':'shoes', 'जूता':'shoes',
    'towels':'towel', 'boxes':'box',
}

# Verified basic product words in the native scripts. These are lexical
# equivalents, not similarity guesses; explicit colours remain mandatory.
REGIONAL_PRODUCT_SYNONYMS = {
 'ಜೀನ್ಸ್':'jeans', 'ಕಪ್ಪು':'black', 'ಕಪ್ಪುಬಣ್ಣದ':'black', 'ನೀಲಿ':'blue',
 'ஜீன்ஸ்':'jeans', 'கருப்பு':'black', 'நீல':'blue', 'நீலம்':'blue',
 'జీన్స్':'jeans', 'నల్ల':'black', 'నీలం':'blue', 'నీలి':'blue',
 'ജീൻസ്':'jeans', 'കറുപ്പ്':'black', 'നീല':'blue',
 'जीन्स':'jeans', 'काळी':'black', 'काळा':'black', 'निळी':'blue', 'निळा':'blue',
 'জিন্স':'jeans', 'কালো':'black', 'নীল':'blue',
 'જીન્સ':'jeans', 'કાળા':'black', 'કાળી':'black', 'વાદળી':'blue',
 'ਜੀਨਸ':'jeans', 'ਜੀਨਜ਼':'jeans', 'ਕਾਲੀ':'black', 'ਕਾਲਾ':'black', 'ਨੀਲੀ':'blue',
}
SYNONYMS.update(REGIONAL_PRODUCT_SYNONYMS)

# Only generic request words are removed. Do NOT remove units, ratings,
# sizes, package counts, brands, locations or product descriptors.

# Only grammatical request words. Never drop product descriptors, size,
# quantity, pack, brand, colour or electrical rating words.
# Explicit location/request grammar for all eight regional languages.
# Product words, colours, sizes, brands and specifications MUST stay in tokens.
# Extend this only with phrases verified as grammatical requests, never by
# stripping arbitrary native-script text.
REGIONAL_REQUEST_WORDS = {
 'kn-IN': 'ಎಲ್ಲಿ ಎಲ್ಲಿದೆ ಎಲ್ಲಿದೆಯೆ ಎಲ್ಲಿವೆ ಎಲ್ಲಿದ್ದಾರೆ ಇದೆ ಇವೆ ನನಗೆ ಬೇಕು ದಯವಿಟ್ಟು ತೋರಿಸಿ ಕೊಡಿ ಹುಡುಕಿ ಸಿಗುತ್ತದೆ ಸಿಗುತ್ತವೆ',
 'ta-IN': 'எங்கே எங்குள்ளது எங்கிருக்கிறது உள்ளது இருக்கிறது இருக்கின்றன எனக்கு வேண்டும் தயவுசெய்து காட்டுங்கள் காட்டு சொல்லுங்கள் கிடைக்கும்',
 'te-IN': 'ఎక్కడ ఎక్కడుంది ఎక్కడుందో ఎక్కడున్నాయి ఎక్కడున్నది ఉంది ఉన్నాయి నాకు కావాలి దయచేసి చూపించు చూపించండి చెప్పండి దొరుకుతుంది',
 'ml-IN': 'എവിടെ എവിടെയാണ് എവിടെയുണ്ട് എവിടെയാണുള്ളത് ഉണ്ട് ഉണ്ടോ എനിക്ക് വേണം ദയവായി കാണിക്കൂ കാണിക്കുക പറയൂ കിട്ടും',
 'mr-IN': 'कुठे कुठे आहे कुठे मिळेल आहे आहेत मला पाहिजे कृपया दाखवा सांगा मिळेल',
 'bn-IN': 'কোথায় কোথায় কোথায় আছে আছে আছে কি আমাকে চাই দয়া করে দেখান বলুন পাওয়া যাবে',
 'gu-IN': 'ક્યાં ક્યાં છે ક્યાં મળશે છે મને જોઈએ કૃપા કરીને બતાવો કહો મળશે',
 'pa-IN': 'ਕਿੱਥੇ ਕਿੱਥੇ ਹੈ ਕਿਥੇ ਹੈ ਹੈ ਮੈਨੂੰ ਚਾਹੀਦਾ ਕਿਰਪਾ ਕਰਕੇ ਦਿਖਾਓ ਦੱਸੋ ਮਿਲੇਗਾ',
}
INDIC_REQUEST_FILLERS = set(' '.join(REGIONAL_REQUEST_WORDS.values()).split())

STOP = set("""
find where is are the a an i can do you have me please show need want
get locate in stock of for at my this that which it them there
mujhe muje chahiye chahie chahiyeh kahan kahaan kaha kidhar
hai hain he h kya batao btao dikhao dhundo dhoondo milega milegi milenge
rakha rakhi rakhe rakhega rakhiye ka ki ke ko par se mujko zara
aur and
मुझे मुजे चाहिए चाहिये कहाँ कहां किधर है हैं मिलेगा मिलेगी मिलेंगे
बताओ दिखाओ ढूंढो खोजो जरा ज़रा किस कहाँपर रखा रखी रखे रखेगा
का की के को से पर में यह ये वह वो मुझे इसका इस की कहाँ रखा हुआ हैं
और सामान उत्पाद प्रोडक्ट चीज चीज़ कितने किसमें
size uk colour color power capacity brand w l
""".split()) | FILLERS | INDIC_REQUEST_FILLERS

_DEVANAGARI = '\u0900-\u097f'
# Match a whole Devanagari/Latin phrase, never part of another word.
_BOUNDARY = r'[\w\u0900-\u0d7f]'
_RULES = [
    (re.compile(r'(?<!' + _BOUNDARY + r')' + re.escape(src) +
                r'(?!' + _BOUNDARY + r')', re.IGNORECASE), dst)
    for src, dst in sorted({**TERMS, **SYNONYMS}.items(), key=lambda p: (-len(p[0]), p[0]))
]

def normal_query(text):
    text = unicodedata.normalize('NFKC', str(text)).casefold()
    # Unicode decimal digits include digits in all supported Indic scripts.
    text = ''.join(str(unicodedata.decimal(c)) if c.isdecimal() else c for c in text)
    text = re.sub(r'[\u200b-\u200d\ufeff]', '', text)
    text = re.sub(r'\bt[- ]shirt\b', 'tshirt', text)
    text = re.sub(r'[।॥?!,:;()\[\]{}]|(?<!\d)\.|\.(?!\d)', ' ', text)
    for pattern, replacement in _RULES:
        text = pattern.sub(lambda _m, value=replacement: value, text)
    return re.sub(r'\s+', ' ', text).strip()

def tokens(text):
    # Regex \\w drops combining vowel signs in Kannada, Tamil, Telugu,
    # Malayalam, Bengali, Punjabi and Gujarati. Split on whitespace after
    # punctuation normalization to preserve complete native-script words.
    # Hyphens still separate English pack expressions like 30-count.
    return {token for token in normal_query(text).replace('-', ' ').split()
            if token not in STOP}
