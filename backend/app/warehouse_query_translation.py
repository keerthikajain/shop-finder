"""Opt-in, query-time multilingual retrieval. Never modifies catalogue records.

Gnani speech transcription remains separate. A Sarvam translation subscription
may translate a worker's short *search request* into a language already present
in the catalogue. Every proposed translation still goes through deterministic
SKU/specification/location matching; translation cannot return a shelf.
"""
import os
import re
import unicodedata
import httpx

_SUPPORTED={'en-IN','hi-IN','hi-en','kn-IN','te-IN'}
_TARGETS=('en-IN','hi-IN','kn-IN','te-IN')
_SCRIPT_RANGES={'hi-IN':(0x0900,0x097f),'kn-IN':(0x0c80,0x0cff),
                'te-IN':(0x0c00,0x0c7f)}
_API='https://api.sarvam.ai/translate'

def configured():
    return bool(os.environ.get('SARVAM_API_KEY','').strip())

def target_languages(items,original_language):
    """Choose only languages actually occurring in original saved catalogue names."""
    names=' '.join(str(p.get('name',''))+' '+' '.join(p.get('aliases',[])) for p in items)
    present=[]
    if re.search(r'[A-Za-z]',names):
        present.append('en-IN')
    for language,(low,high) in _SCRIPT_RANGES.items():
        if any(low<=ord(c)<=high and unicodedata.category(c).startswith('L') for c in names):
            present.append(language)
    # Names written in Latin script usually map to English; no translation
    # is needed if the original request is English or already matches.
    return [lang for lang in _TARGETS if lang in present and lang!=original_language][:3]

async def translate_to_catalogue(query,language,items):
    """Return limited alternative phrases, not matches, with a transparent status."""
    if language not in _SUPPORTED or not items or len(query)>300:
        return [],'not_applicable'
    targets=target_languages(items,language)
    if not targets:
        return [],'not_applicable'
    if not configured():
        return [],'not_configured'
    key=os.environ['SARVAM_API_KEY'].strip()
    translated=[]
    try:
        async with httpx.AsyncClient(timeout=8,trust_env=False) as client:
            for target in targets:
                payload={'input':query,'source_language_code':'auto',
                         'target_language_code':target,'model':'mayura:v1','mode':'code-mixed'}
                response=await client.post(_API,headers={'api-subscription-key':key},json=payload)
                if response.status_code==429:
                    return translated,'rate_limited'
                if response.status_code!=200:
                    return translated,'provider_error'
                result=response.json().get('translated_text','')
                if isinstance(result,str) and result.strip() and len(result)<=300:
                    translated.append(result.strip())
    except (httpx.RequestError,ValueError,TypeError):
        return translated,'provider_error'
    return list(dict.fromkeys(translated)),'attempted'

def preserves_explicit_details(original,translated,product):
    """Never erase written digits, Latin model codes or obvious colour constraints."""
    original_numbers=set(re.findall(r'(?<![\\w.])\\d+(?:\\.\\d+)?(?![\\w.])',original))
    candidate_numbers=set(re.findall(r'\\d+(?:\\.\\d+)?',' '.join(str(v) for v in product.get('specs',{}).values())))
    if original_numbers and not original_numbers<=candidate_numbers:
        return False
    # Translation is fallible: an explicitly written original SKU or barcode
    # must always be matched as-is and cannot be generalized.
    for token in re.findall(r'(?<!\\w)[A-Za-z]+[-_][A-Za-z0-9_-]+(?!\\w)',original):
        if token.casefold() not in {str(product.get('sku','')).casefold(),
                                     str(product.get('barcode','')).casefold()}:
            return False
    from .warehouse_language import tokens
    colours={'blue','black','white','red','green','grey','brown','pink','beige','silver','clear'}
    specified=tokens(original)&colours
    if specified:
        saved=tokens(str(product.get('specs',{}).get('colour',''))) or tokens(str(product.get('name','')))
        if not specified<=saved:
            return False
    return True
