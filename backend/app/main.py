import os,asyncio,re
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, Response
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict
from .services.matching import search
from .services import voice
from .workflows import install
from .reports import install_reports
from .warehouse import initialize_warehouse, install_warehouse
from .accounts import initialize_accounts, install_accounts, enforce_rate
from .streaming import install_streaming

class Constraints(BaseModel):
    model_config = ConfigDict(extra='forbid')
    manufacturer: str | None = None
    model: str | None = None
    part_number: str | None = None
    connector_type: str | None = None
    dimensions: dict[str, str | int | float] = Field(default_factory=dict)
    specifications: dict[str, str | int | float] = Field(default_factory=dict)

class SearchRequest(BaseModel):
    language: Literal['en-IN','hi-IN','hi-en'] = 'en-IN'
    model_config = ConfigDict(extra='forbid')
    constraints: Constraints = Field(default_factory=Constraints)
    query: str = Field(min_length=1, max_length=500)

from .database import initialize, seed, list_products, get_product, DEFAULT_DB
from .schemas import Product, Category

def create_app(db_path=None, seed_demo=None, *, auth_required=True, challenge_root=False):
    path = Path(db_path or os.environ.get('SHOP_FINDER_DB', DEFAULT_DB))
    demo = seed_demo if seed_demo is not None else os.environ.get('SHOP_FINDER_SEED_DEMO','false').lower() == 'true'
    @asynccontextmanager
    async def lifespan(app):
        initialize(path)
        initialize_accounts(path)
        initialize_warehouse(path,demo)
        if demo:
            seed(path)
        yield
    app = FastAPI(title='Shop Finder — warehouse voice workspace', version='1.0.0', lifespan=lifespan,docs_url=None,redoc_url=None,openapi_url=None,debug=False)
    install_accounts(app,path,auth_required)
    install_streaming(app,path)
    install_reports(app,path)
    install_warehouse(app,path)
    if challenge_root:
        from .challenge_workspaces import install_challenge_routes
        install_challenge_routes(app,path)

    # Public sign-in can request only four fixed welcome clips. Cache provider audio
    # by language to avoid anonymous users triggering arbitrary paid synthesis.
    public_welcome_cache={}
    public_welcome_lock=asyncio.Lock()
    PUBLIC_GREETING={
        'en-IN':"Hi there! Welcome to Finder. Let's make finding things easier!",
        'hi-IN':'नमस्ते! फाइंडर में आपका स्वागत है। चलिए, आज का काम आसान बनाते हैं!',
        'hi-en':"Hi there! Finder mein aapka welcome hai. Chaliye, aaj ka kaam aasan banate hain!",
        'kn-IN':'ನಮಸ್ಕಾರ! ಫೈಂಡರ್‌ಗೆ ಸ್ವಾಗತ. ಇಂದಿನ ಕೆಲಸವನ್ನು ಸುಲಭವಾಗಿ ಮಾಡೋಣ!',
        'te-IN':'నమస్కారం! ఫైండర్‌కు స్వాగతం. ఈ రోజు పని మరింత సులభంగా చేద్దాం!'
    }
    @app.get('/api/welcome/audio')
    async def public_greeting_audio(request:Request,language:Literal['en-IN','hi-IN','hi-en','kn-IN','te-IN']='en-IN'):
        enforce_rate(path,'anonymous-welcome:'+str(request.client.host if request.client else 'unknown'),'/api/welcome/audio')
        if not voice.ready():raise HTTPException(503,'Voice greeting is unavailable.')
        if language not in public_welcome_cache:
            async with public_welcome_lock:
                if language not in public_welcome_cache:
                    public_welcome_cache[language]=await voice.speak(PUBLIC_GREETING[language],language,voice_override='Riyaa')
        return Response(public_welcome_cache[language],media_type='audio/wav',headers={'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'})

    class WelcomeSpeechRequest(BaseModel):
        model_config=ConfigDict(extra='forbid')
        language:Literal['en-IN','hi-IN','hi-en','kn-IN','te-IN']='en-IN'
        hour:int=Field(ge=0,le=23)

    @app.post('/api/voice/welcome')
    async def private_greeting_audio(body:WelcomeSpeechRequest,request:Request):
        user=getattr(request.state,'user',None)
        if not user:raise HTTPException(401,'Please log in.')
        if not voice.ready():raise HTTPException(503,'Voice greeting is unavailable.')
        # Never trust a name supplied by the browser. Use the stored account.
        name='' if user.get('is_demo') else re.sub(r"[^\w-]",'',str(user.get('display_name') or user.get('username') or '').split(' ')[0],flags=re.UNICODE)[:32]
        greeting_time='morning' if body.hour<12 else 'afternoon' if body.hour<17 else 'evening'
        salutation={
            'en-IN':{'morning':'Good morning','afternoon':'Good afternoon','evening':'Good evening'},
            'hi-IN':{'morning':'सुप्रभात','afternoon':'नमस्कार','evening':'शुभ संध्या'},
            'hi-en':{'morning':'Good morning','afternoon':'Good afternoon','evening':'Good evening'},
            'kn-IN':{'morning':'ಶುಭೋದಯ','afternoon':'ನಮಸ್ಕಾರ','evening':'ಶುಭ ಸಂಜೆ'},
            'te-IN':{'morning':'శుభోదయం','afternoon':'శుభ మధ్యాహ్నం','evening':'శుభ సాయంత్రం'}
        }
        if not name:
            speech=PUBLIC_GREETING[body.language]
        else:
            prefix=salutation[body.language][greeting_time]+', '+name+'! '
            remainder={
                'en-IN':"Welcome back to Finder. Let's make finding things easier!",
                'hi-IN':'फाइंडर में फिर से स्वागत है। चलिए, आज का काम आसान बनाते हैं!',
                'hi-en':"Finder mein welcome back! Chaliye, aaj ka kaam aasan banate hain!",
                'kn-IN':'ಫೈಂಡರ್‌ಗೆ ಮತ್ತೆ ಸ್ವಾಗತ! ಇಂದಿನ ಕೆಲಸವನ್ನು ಸುಲಭವಾಗಿ ಮಾಡೋಣ!',
                'te-IN':'ఫైండర్‌కు మళ్లీ స్వాగతం! ఈ రోజు పని మరింత సులభంగా చేద్దాం!'
            }
            speech=prefix+remainder[body.language]
        audio=await voice.speak(speech,body.language,voice_override='Riyaa')
        return Response(audio,media_type='audio/wav',headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})

    @app.get('/api/health')
    def health(request: Request):
        result = {'status':'ok','voice_status':'configured-unvalidated' if voice.ready() else 'disabled'}
        # Public uptime monitors only need health status; do not disclose
        # catalogue size or database technology to unauthenticated visitors.
        if not auth_required or getattr(request.state,'user',None):
            result.update({'database':'sqlite','product_count':len(list_products(path)),
                           'scope':'single_organisation_warehouse_locator'})
        return result

    @app.get('/api/products', response_model=list[Product])
    def products(category: Category | None = None):
        return list_products(path,category)

    @app.get('/api/products/{product_id}', response_model=Product)
    def product(product_id: str):
        result = get_product(path,product_id)
        if result is None:
            raise HTTPException(404,detail={'code':'PRODUCT_NOT_FOUND','message':'No catalogue record has that ID.'})
        return result

    @app.get('/api/capabilities')
    def capabilities():
        return {'catalogue_read':True,'search':True,'clarification':True,
                'staff_edit':True,'unresolved_review':True,
                'prisma':'configured-unvalidated' if voice.ready() else 'disabled','timbre':'configured-unvalidated' if voice.ready() else 'disabled'}
    @app.post('/api/search')
    def text_search(request: SearchRequest,http_request:Request):
        return app.state.process_search(request.query, request.constraints.model_dump(exclude_none=True),language=request.language,user_id=getattr(http_request.state,'user',None))

    install(app,path,SearchRequest,Constraints)
    if os.environ.get('SHOP_FINDER_SERVE_WEB')=='true':
        from fastapi.staticfiles import StaticFiles
        web=Path(__file__).resolve().parents[2]/'frontend'/'dist'
        if not web.is_dir():raise RuntimeError('Frontend build is missing. Run npm run build --prefix frontend.')
        app.mount('/',StaticFiles(directory=web,html=True),name='web')
    return app

if os.getenv('SHOP_FINDER_CHALLENGE_SIGNUP','false').lower()=='true':
    from .challenge_workspaces import ChallengeDispatcher
    _root=create_app(challenge_root=True)
    _base=Path(os.environ.get('SHOP_FINDER_DB',DEFAULT_DB))
    app=ChallengeDispatcher(_root,_base)
else:
    app=create_app()
