import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict
from .services.matching import search
from .services import voice
from .workflows import install
from .reports import install_reports
from .warehouse import initialize_warehouse, install_warehouse
from .accounts import initialize_accounts, install_accounts
from .streaming import install_streaming
from .public_preview import install_public_preview

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

def create_app(db_path=None, seed_demo=None, *, auth_required=True):
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
    install_public_preview(app,path)
    install_streaming(app,path)
    install_reports(app,path)
    install_warehouse(app,path)

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

app = create_app()
