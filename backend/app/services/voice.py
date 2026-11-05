import os,io,wave
import httpx
from fastapi import HTTPException

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

async def transcribe(data,language):
    if language not in ('en-IN','hi-IN','hi-en'):raise HTTPException(422,'Language not enabled.')
    validate_wav(data)
    provider_language='hi-IN' if language=='hi-en' else language
    r=await call('/stt/v3',files={'audio_file':('query.wav',data,'audio/wav')},data={'language_code':provider_language})
    try:
        payload=r.json()
        if payload.get('success') is not True or not isinstance(payload.get('transcript'),str):raise ValueError()
        if not payload['transcript'].strip():raise ValueError()
        if payload.get('model') not in (None,'prisma-v2.5'):raise ValueError()
        return payload['transcript']
    except (ValueError,TypeError):raise HTTPException(502,'Invalid transcription response.')

async def speak(text,language='en-IN'):
    voices={'en-IN':'Kaveri','hi-IN':'Nalini','hi-en':'Poorvi'}
    if language not in voices:raise HTTPException(422,'Language not enabled.')
    r=await call('/api/v1/tts/inference',json={'text':text,'model':'timbre-v2.5','voice':voices[language],'language':language,'audio_config':{'encoding':'linear_pcm','container':'wav','sample_rate':48000,'num_channels':1,'sample_width':2}})
    if not r.content.startswith(b'RIFF'):raise HTTPException(502,'Invalid speech audio response.')
    return r.content
