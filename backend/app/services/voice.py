import os,io,wave,json
import httpx
from fastapi import HTTPException

STT_LANGUAGES = ('en-IN','hi-IN','bn-IN','mr-IN','gu-IN','pa-IN','kn-IN','te-IN','ta-IN','ml-IN')

def parse_language_candidates(value):
    """An optional list of 2–4 likely languages; no list means full auto-detection."""
    if value is None or value == '':
        return ()
    if not isinstance(value,str) or len(value)>80:
        raise HTTPException(422,'Choose 2–4 expected languages.')
    codes=tuple(p.strip() for p in value.split(','))
    if not 2<=len(codes)<=4 or len(set(codes))!=len(codes) or any(p not in STT_LANGUAGES for p in codes):
        raise HTTPException(422,'Choose 2–4 distinct supported languages.')
    return codes


def ready():return os.getenv('GNANI_ENABLED')=='true' and bool(os.getenv('GNANI_API_KEY'))

def validate_wav(data):
    try:
        with wave.open(io.BytesIO(data)) as w:
            if w.getnchannels()!=1 or w.getsampwidth()!=2 or not 8000<=w.getframerate()<=44100 or not 0<w.getnframes()/w.getframerate()<=30:
                raise ValueError()
            if len(w.readframes(w.getnframes())) != w.getnframes()*2:raise ValueError()
    except (wave.Error,EOFError,ValueError):raise HTTPException(422,'Use a valid mono, 16-bit PCM WAV, 8–44.1 kHz, at most 30 seconds.')

async def call(endpoint,**kwargs):
    if not ready():raise HTTPException(503,'Gnani is disabled. Configure backend credentials and explicitly enable it.')
    try:
        async with httpx.AsyncClient(timeout=40) as client:
            r=await client.post('https://api.vachana.ai'+endpoint,headers={'X-API-Key-ID':os.environ['GNANI_API_KEY']},**kwargs)
        if r.status_code!=200:raise HTTPException(502,f'Gnani returned HTTP {r.status_code}. No result was generated.')
        return r
    except httpx.HTTPError:raise HTTPException(502,'Gnani connection failed; use text search.')

# Prisma V3 REST fields match Gnani's public SDK (`gnani.stt.client._build_rest_form`).
# Keep v2.5 as an explicit rollback setting, never silently downgrade on errors.
def stt_model():
    value=os.getenv('GNANI_STT_MODEL','prisma-v3.0').strip().lower()
    if value not in ('prisma-v3.0','prisma-v2.5'):
        raise HTTPException(503,'Unsupported Gnani STT model configuration.')
    return value

def _stt_options(language,output_style='transcribe',enhanced=True,keywords=None,language_candidates=None):
    if language not in (*STT_LANGUAGES,'hi-en','auto'):
        raise HTTPException(422,'Language not enabled.')
    model=stt_model()
    candidates=parse_language_candidates(language_candidates)
    if candidates and (language!='auto' or not enhanced or model!='prisma-v3.0'):
        raise HTTPException(422,'Language hints require Prisma V3 auto-detection.')
    if output_style not in ('verbatim','transcribe','codemix','transliterate'):
        raise HTTPException(422,'Unsupported transcript style.')
    if model!='prisma-v3.0':
        if language=='auto' or output_style in ('codemix','transliterate'):
            raise HTTPException(422,'This feature requires Prisma V3.0.')
        return {'language_code':'hi-IN' if language=='hi-en' else language,
                'format':output_style},model
    auto=language in ('auto','hi-en')
    data={'model':model,'language_code':'indic-auto' if auto else language,
          'format':output_style}
    if auto and enhanced:
        # Auto mode without hints can detect every supported language.
        selected=candidates or (('hi-IN','en-IN') if language=='hi-en' else ())
        if selected:data['multi_lang_codes']=','.join(selected)
    if keywords:
        selected=[]
        for word in keywords:
            if isinstance(word,str):
                word=word.strip()
                if 1<=len(word)<=100 and '<|' not in word and '|>' not in word and word not in selected:
                    selected.append(word)
            if len(selected)>=80:break
        if selected:
            data['keywords']=json.dumps(selected,ensure_ascii=False)
    data['topic']='Warehouse inventory item names, brands, sizes, quantities and shelf locations.'
    return data,model

async def transcribe_details(data,language,*,output_style='transcribe',enhanced=True,keywords=None,language_candidates=None):
    validate_wav(data)
    form,model=_stt_options(language,output_style,enhanced,keywords,language_candidates)
    response=await call('/stt/v3',files={'audio_file':('query.wav',data,'audio/wav')},data=form)
    try:
        payload=response.json()
        if not isinstance(payload,dict) or payload.get('success') is not True:raise ValueError()
        transcript=payload.get('transcript')
        if not isinstance(transcript,str) or not transcript.strip():raise ValueError()
        if payload.get('model') not in (None,model):raise ValueError()
        if payload.get('truncated') is True:
            raise HTTPException(502,'Gnani returned a truncated transcript. Record a shorter request.')
        detected=payload.get('detected_language_code')
        if detected not in STT_LANGUAGES:detected=None
        search_language=(detected or 'hi-en') if language=='auto' else language
        return {'transcript':transcript.strip(),'model':model,'detected_language_code':detected,
                'search_language':search_language,'output_style':output_style}
    except (ValueError,TypeError,KeyError):
        raise HTTPException(502,'Invalid transcription response.')

async def transcribe(data,language,*,output_style='transcribe',enhanced=True,keywords=None,language_candidates=None):
    return (await transcribe_details(data,language,output_style=output_style,
                                    enhanced=enhanced,keywords=keywords,
                                    language_candidates=language_candidates))['transcript']

async def speak(text,language='en-IN'):
    # Gnani Timbre v2.5 official Preferred Voices by Language catalog.
    # These voices must be live-tested with the deployed API key before release.
    voices={
      'en-IN':'Kaveri','hi-IN':'Nalini','hi-en':'Poorvi',
      'bn-IN':'Kirra','mr-IN':'Ishaan','gu-IN':'Falak','pa-IN':'Zayan',
      'kn-IN':'Kavin','te-IN':'Varuni','ta-IN':'Trisha','ml-IN':'Reshma'
    }
    if language not in voices:raise HTTPException(422,'Language not enabled.')
    r=await call('/api/v1/tts/inference',json={'text':text,'model':'timbre-v2.5','voice':voices[language],'language':language,'audio_config':{'encoding':'linear_pcm','container':'wav','sample_rate':48000,'num_channels':1,'sample_width':2}})
    if not r.content.startswith(b'RIFF'):raise HTTPException(502,'Invalid speech audio response.')
    return r.content
