"""Optional owner-initiated translation suggestions. Results are NEVER auto-saved.

Gnani continues to provide speech transcription and synthesis. A separately
configured Sarvam Mayura subscription supplies text translation suggestions.
Only the product's name is transmitted; not its SKU, location, or stock.
"""
import asyncio
import os
import httpx
from fastapi import HTTPException

_API = 'https://api.sarvam.ai/translate'
_TARGETS = {'en':'en-IN','hi':'hi-IN','te':'te-IN','kn':'kn-IN'}
_ALLOWED = set(_TARGETS.values())

async def suggest(name: str, source_language: str = 'en-IN') -> dict[str,str]:
    key = os.getenv('SARVAM_API_KEY', '').strip()
    if not key:
        raise HTTPException(503,'Automatic translations are not configured. Add reviewed product names manually, or configure the optional server-side translation service.')
    if source_language not in _ALLOWED:
        raise HTTPException(422,'Choose English, Hindi, Telugu or Kannada as the source language.')
    if not name.strip() or len(name)>120:
        raise HTTPException(422,'Product name must be 1–120 characters.')
    # Mayura supports Roman-script Hindi via output_script='roman'.
    # These are unverified suggestions; the owner must review every result.
    async with httpx.AsyncClient(timeout=20, trust_env=False) as client:
        async def translate(target: str, roman: bool = False) -> str:
            payload={'input':name.strip(),'source_language_code':source_language,
                     'target_language_code':target,'model':'mayura:v1',
                     'mode':'modern-colloquial'}
            if roman:payload['output_script']='roman'
            try:
                reply=await client.post(_API,headers={'api-subscription-key':key},json=payload)
                if reply.status_code==429:
                    raise HTTPException(429,'Translation provider limit reached. Try again later.')
                if not reply.is_success:
                    raise HTTPException(502,'Translation service could not provide suggestions. Enter names manually.')
                text=reply.json().get('translated_text','')
                if not isinstance(text,str) or not text.strip() or len(text.strip())>120:
                    raise HTTPException(502,'Translation service returned an invalid product name.')
                return text.strip()
            except httpx.RequestError as exc:
                raise HTTPException(502,'Translation provider connection failed. Enter names manually.') from exc
            except (ValueError,TypeError) as exc:
                raise HTTPException(502,'Translation provider returned an invalid response.') from exc
        jobs={}
        for field,code in _TARGETS.items():
            if code==source_language:
                jobs[field]=asyncio.sleep(0,result=name.strip())
            else:
                jobs[field]=translate(code)
        jobs['hi_latn']=translate('hi-IN',roman=True)
        outputs=await asyncio.gather(*jobs.values())
    return dict(zip(jobs.keys(),outputs))
