"""Business preferences and explicit, auditable inventory operations.

An installation belongs to one organisation. A location quantity of None means
not counted; it is deliberately different from a confirmed count of zero.
"""
import json
from copy import deepcopy
from typing import Literal
from fastapi import HTTPException, Request, Response
from pydantic import Field, model_validator
from .database import connect
from .warehouse import (Strict, Location, Item, identity, now, encode, pending,
                        get_pending, item_row, public, write, loc_code, loc_text)
from .warehouse_catalogue import COLLECTION_MAP, LOCATION_FIELDS

DEFAULTS = {'name': '', 'business_type': 'warehouse', 'collections': list(COLLECTION_MAP),
            'location_fields': ['facility', 'zone', 'aisle', 'rack', 'shelf', 'bin'],
            'custom_fields': {}, 'staff_stock': False, 'configured': False, 'revision': 0}

class Settings(Strict):
    name: str = Field(min_length=2, max_length=80)
    business_type: Literal['warehouse', 'outlet', 'retail', 'stockroom']
    collections: list[str] = Field(min_length=1, max_length=4)
    location_fields: list[str] = Field(min_length=1, max_length=7)
    custom_fields: dict[str, list[str]] = Field(default_factory=dict)
    staff_stock: bool = False
    revision: int = Field(ge=0)

    @model_validator(mode='after')
    def validate_options(self):
        import re
        if len(set(self.collections)) != len(self.collections) or any(k not in COLLECTION_MAP for k in self.collections):
            raise ValueError('Choose supported product types without duplicates.')
        if len(set(self.location_fields)) != len(self.location_fields) or any(k not in LOCATION_FIELDS for k in self.location_fields):
            raise ValueError('Choose valid location levels without duplicates.')
        reserved={'sku','collection','name','brand','category','barcode','aliases','synthetic','revision','quantity',*LOCATION_FIELDS}
        for group, fields in self.custom_fields.items():
            if group not in COLLECTION_MAP or len(fields) > 6 or len(set(fields)) != len(fields):
                raise ValueError('Use up to six additional fields per product type.')
            if any(f in reserved or f in COLLECTION_MAP[group]['fields'] for f in fields):
                raise ValueError('Additional fields cannot replace built-in product or location fields.')
            if any(not re.fullmatch(r'[a-z][a-z0-9_]{0,39}', f) for f in fields):
                raise ValueError('Field names use lowercase letters, numbers and underscores.')
        return self

class StockChange(Strict):
    collection: Literal['clothing', 'footwear', 'appliances', 'home']
    sku: str = Field(min_length=1, max_length=40)
    revision: int = Field(ge=1)
    operation: Literal['receive', 'remove', 'move', 'count']
    source: str = Field(min_length=1, max_length=50)
    quantity: int = Field(ge=0, le=1000000000, strict=True)
    destination: Location | None = None
    reason: str = Field(min_length=3, max_length=300)


def initialize_store(c):
    c.executescript('''CREATE TABLE IF NOT EXISTS wh_settings(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS wh_setup_events(id INTEGER PRIMARY KEY,actor TEXT,at TEXT,before_json TEXT,after_json TEXT);''')


def get_settings(c):
    r = c.execute('SELECT payload FROM wh_settings WHERE id=1').fetchone()
    return {**deepcopy(DEFAULTS), **(json.loads(r[0]) if r else {})}


def stock_access(c, request, operation):
    u = identity(request)
    if u['role'] != 'owner' and (operation == 'count' or not get_settings(c)['staff_stock']):
        raise HTTPException(403, 'Owner approval is required for this stock operation.')
    return u


def calculate_change(c, b):
    record = item_row(c, b.collection, b.sku)
    if record['revision'] != b.revision:
        raise HTTPException(409, 'Stock changed. Reopen the item and review the current quantities.')
    before = Item(**json.loads(record['payload'])).model_dump()
    after = deepcopy(before)
    source = next((p for p in after['placements'] if loc_code(p) == b.source), None)
    if source is None:
        raise HTTPException(409, 'Source location changed. Reopen the item.')
    if b.operation != 'count' and b.quantity == 0:
        raise HTTPException(422, 'Enter a quantity greater than zero.')
    if b.operation != 'count' and source['quantity'] is None:
        raise HTTPException(422, 'Stock has not been counted here. Ask the owner to record a physical count first.')
    if b.operation == 'count':
        source['quantity'] = b.quantity
    elif b.operation == 'receive':
        source['quantity'] += b.quantity
    else:
        if b.quantity > source['quantity']:
            raise HTTPException(409, 'There is not enough recorded stock at this location.')
        source['quantity'] -= b.quantity
        if b.operation == 'move':
            if b.destination is None:
                raise HTTPException(422, 'Choose a destination for the stock move.')
            code = loc_code(b.destination.model_dump())
            if code == b.source:
                raise HTTPException(422, 'Choose a different destination.')
            target = next((p for p in after['placements'] if loc_code(p) == code), None)
            if target is None:
                target = {**b.destination.model_dump(), 'quantity': 0}
                after['placements'].append(target)
            if target['quantity'] is None:
                raise HTTPException(422, 'Count the stock already at the destination before moving more there.')
            target['quantity'] += b.quantity
    try:
        after = Item(**after).model_dump()
    except ValueError:
        raise HTTPException(422, 'The resulting stock or location count exceeds the allowed limit.')
    return before, after


def stock_readback(body, before, after):
    source = next(p for p in before['placements'] if loc_code(p) == body.source)
    prefix = f"{body.operation.capitalize()} {body.quantity} units for {before['brand']} {before['name']}, {before['sku']}. "
    if body.operation == 'count':
        prefix = f"Set the physical count to {body.quantity} for {before['name']}, {before['sku']}. "
    text = prefix + f"Location: {loc_text(source)}. "
    if body.operation == 'move':
        text += f"Destination: {loc_text(body.destination.model_dump())}. "
    return text + 'Review the change and confirm to save.'


def install_store(app, path):
    @app.get('/api/warehouse/settings')
    def settings(request: Request):
        identity(request)
        with connect(path) as c:
            return get_settings(c)

    @app.put('/api/warehouse/settings')
    def save_settings(body: Settings, request: Request):
        u = identity(request, True)
        with connect(path) as c:
            c.execute('BEGIN IMMEDIATE')
            old = get_settings(c)
            if old['revision'] != body.revision:
                raise HTTPException(409, 'Business settings changed. Reload before saving.')
            result = {**body.model_dump(), 'configured': True, 'revision': body.revision + 1}
            c.execute('INSERT OR REPLACE INTO wh_settings VALUES(1,?)', (encode(result),))
            c.execute('INSERT INTO wh_setup_events(actor,at,before_json,after_json) VALUES(?,?,?,?)',
                      (u['username'], now(), encode(old), encode(result)))
            return result

    @app.post('/api/warehouse/stock/preview')
    def preview(body: StockChange, request: Request):
        with connect(path) as c:
            u = stock_access(c, request, body.operation)
            before, after = calculate_change(c, body)
            token = pending(c, 'stock', u, body.model_dump())
            return {'token': token, 'before': before, 'after': after,
                    'operation': body.operation, 'quantity': body.quantity, 'reason': body.reason,
                    'spoken_text': stock_readback(body, before, after)}

    @app.post('/api/warehouse/stock/{token}/speak')
    async def read_preview(token: str, request: Request):
        from .services import voice
        u = identity(request)
        with connect(path) as c:
            body = StockChange(**get_pending(c, token, 'stock', u))
            stock_access(c, request, body.operation)
            before, after = calculate_change(c, body)
            text = stock_readback(body, before, after)
        audio = await voice.speak(text, 'en-IN')
        return Response(audio, media_type='audio/wav')

    @app.post('/api/warehouse/stock/{token}/confirm')
    def confirm(token: str, request: Request):
        u = identity(request)
        with connect(path) as c:
            c.execute('BEGIN IMMEDIATE')
            body = StockChange(**get_pending(c, token, 'stock', u))
            stock_access(c, request, body.operation)
            _, after = calculate_change(c, body)
            result = write(c, after, body.revision, u['username'], body.reason, 'stock_' + body.operation)
            c.execute('DELETE FROM wh_pending WHERE id=?', (token,))
            return result
