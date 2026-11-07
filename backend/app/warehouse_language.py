"""Conservative Hindi/Hinglish normalization for warehouse item retrieval.

This is a small controlled product vocabulary, not machine translation.
It normalizes BOTH user transcripts and saved product names/aliases.
Unknown content must still fail to match rather than guess a shelf.
"""
import re

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
    'नीली':'blue', 'नीला':'blue', 'सफेद':'white', 'काली':'black',
    'काला':'black', 'लाल':'red', 'सूती':'cotton',
    'नारंगी':'orange', 'हरी':'green', 'हरा':'green',
    'बासमती':'basmati', 'चावल':'rice', 'chawal':'rice',
    'chaval':'rice', 'चावलें':'rice', 'राइस':'rice',
    'सोनामसूरी':'sona masoori', 'सोना मसूरी':'sona masoori',
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
    'loafer':'loafers', 'towels':'towel', 'boxes':'box',
}

# Only generic request words are removed. Do NOT remove units, ratings,
# sizes, package counts, brands, locations or product descriptors.
STOP = set("""
find where is are the a an i can do you have me please show need want
get locate in stock of for at my this that which
mujhe muje chahiye chahie chahiyeh kahan kahaan kaha kidhar
hai hain he h kya batao btao dikhao dhundo dhoondo milega milegi milenge
rakha rakhi rakhe rakhega rakhiye ka ki ke ko par se mujko zara
aur and
मुझे मुजे चाहिए चाहिये कहाँ कहां किधर है हैं मिलेगा मिलेगी मिलेंगे
बताओ दिखाओ ढूंढो खोजो जरा ज़रा किस कहाँपर रखा रखी रखे रखेगा
का की के को से पर में यह ये वह वो मुझे इसका इस की कहाँ रखा हुआ हैं
और सामान उत्पाद प्रोडक्ट चीज चीज़ कितने किसमें
size uk colour color power capacity brand
""".split())

_DEVANAGARI = '\u0900-\u097f'
# Match a whole Devanagari/Latin phrase, never part of another word.
_BOUNDARY = r'[\w' + _DEVANAGARI + r']'
_RULES = [
    (re.compile(r'(?<!' + _BOUNDARY + r')' + re.escape(src) +
                r'(?!' + _BOUNDARY + r')', re.IGNORECASE), dst)
    for src, dst in sorted(SYNONYMS.items(), key=lambda p: (-len(p[0]), p[0]))
]

def normal_query(text):
    text = str(text).casefold().translate(str.maketrans('०१२३४५६७८९', '0123456789'))
    text = re.sub(r'\bt[- ]shirt\b', 'tshirt', text)
    text = re.sub(r'[।?!,:;()\[\]{}]', ' ', text)
    for pattern, replacement in _RULES:
        text = pattern.sub(lambda _m, value=replacement: value, text)
    return re.sub(r'\s+', ' ', text).strip()

def tokens(text):
    return {token for token in re.findall(r'[\w.\u0900-\u097f]+', normal_query(text))
            if token not in STOP}
