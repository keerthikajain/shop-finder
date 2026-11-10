"""Store workflow contracts: catalogue identity, imports and inventory transactions."""
import csv
import io
import json
from concurrent.futures import ThreadPoolExecutor
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.database import connect
from app.warehouse import Item, loc_code, match, demo_items
from test_warehouse import setup, login, post, items, save, H


def one(c, sku='CLO-001', collection='clothing'):
    return next(p for p in items(c, collection) if p['sku'] == sku)


def stock(c, p, operation='count', quantity=12, **kwargs):
    body = dict(collection=p['collection'], sku=p['sku'], revision=p['revision'],
                source=p['placements'][0]['code'], operation=operation,
                quantity=quantity, reason='Checked physical stock', **kwargs)
    return post(c, '/stock/preview', body)


def apply(c, preview):
    assert preview.status_code == 200, preview.text
    return post(c, '/stock/' + preview.json()['token'] + '/confirm')


def imported(c, text, mapping=None):
    upload = c.post('/api/warehouse/imports?collection=all&filename=items.csv', headers=H, content=text.encode())
    assert upload.status_code == 200, upload.text
    data = upload.json()
    preview = post(c, '/imports/' + data['token'] + '/preview', {'mapping': mapping or data['suggested_mapping']})
    assert preview.status_code == 200, preview.text
    return preview.json()


def test_global_query_brand_and_three_product_types(setup):
    c, _ = setup
    task = post(c, '/search', {'query': 'Everyday red dress kahaan hai and Northline white trainers size 7 and mixer 750 W'}).json()
    assert [l['selected']['collection'] for l in task['lines']] == ['clothing', 'footwear', 'appliances']
    assert 'Sample catalogue locations, not verified for your store.' in task['spoken_text']
    assert 'rack D' in task['spoken_text']
    assert task['spoken_text'].count('Sample catalogue locations, not verified for your store.') == 1
    assert 'Example shelf' not in task['spoken_text']
    assert not post(c, '/search', {'query': 'red dress', 'brand': 'Northline'}).json()['lines'][0]['candidates']
    for query in ['Northline red dress', 'white trainers size 99', 'Hearth mixer 500 W waterproof']:
        assert not post(c, '/search', {'query': query}).json()['lines'][0]['candidates']


def test_duplicate_sku_requires_catalogue_identity_and_global_barcode_uniqueness(setup):
    c, _ = setup
    p = one(c); p['collection'] = 'home'; p['synthetic'] = False; p['barcode'] = 'UNIQUE-001'
    assert save(c, p, 0).status_code == 200
    task = post(c, '/search', {'query': p['sku']}).json()
    assert task['lines'][0]['selected'] is None
    payload = {'line': 0, 'sku': p['sku'], 'location': p['placements'][0]['code']}
    assert post(c, '/tasks/' + task['id'] + '/choose', payload).status_code == 422
    picked = post(c, '/tasks/' + task['id'] + '/choose', {**payload, 'collection': 'home'}).json()
    assert picked['lines'][0]['selected']['collection'] == 'home'
    assert post(c, '/tasks/' + task['id'] + '/scan', {'line': 0, 'kind': 'product', 'value': 'ITEM:home:CLO-001'}).status_code == 200
    p['sku'] = 'DIFFERENT'; p['collection'] = 'clothing'
    assert save(c, p, 0).status_code == 409


def test_settings_permissions_revision_persistence_and_search_scope(setup):
    c, path = setup
    before = c.get('/api/warehouse/settings').json()
    assert not before['configured']
    body = {k: v for k, v in before.items() if k != 'configured'}
    body.update(name='Central warehouse', collections=['clothing', 'footwear'], location_fields=['zone', 'rack', 'shelf'], custom_fields={'clothing': ['fit']})
    response = c.put('/api/warehouse/settings', headers=H, json=body)
    assert response.status_code == 200, response.text
    assert len(c.get('/api/warehouse/items').json()) == 16
    assert c.put('/api/warehouse/settings', headers=H, json=body).status_code == 409
    with TestClient(create_app(path,seed_demo=True)) as restarted:
        login(restarted)
        assert restarted.get('/api/warehouse/settings').json()['name'] == 'Central warehouse'
    login(c, 'staff')
    body['revision'] = 1
    assert c.put('/api/warehouse/settings', headers=H, json=body).status_code == 403


def test_optional_locations_preserve_old_qr_codes():
    import hashlib
    from app.warehouse import encode, norm
    old = {'facility': 'A', 'zone': 'B', 'aisle': '1', 'rack': 'C', 'shelf': '2', 'bin': '008'}
    previous = 'LOC-' + hashlib.sha256(encode([norm(v) for v in old.values()]).encode()).hexdigest()[:14].upper()
    assert loc_code(old) == previous
    assert loc_code({**old, 'floor': '1'}) != previous
    p = next(demo_items()); p['placements'] = [{'rack': 'R-01'}]
    assert Item(**p).placements[0].quantity is None
    p['placements'] = [{}]
    with pytest.raises(ValueError): Item(**p)


def test_stock_unknown_count_receive_remove_move_and_history(setup):
    c, _ = setup
    p = one(c)
    assert stock(c, p, 'receive', 3).status_code == 422
    p = apply(c, stock(c, p)).json()
    p = apply(c, stock(c, p, 'receive', 5)).json()
    assert p['placements'][0]['quantity'] == 17
    preview = stock(c, p, 'remove', 2)
    assert one(c)['placements'][0]['quantity'] == 17
    p = apply(c, preview).json()
    assert p['placements'][0]['quantity'] == 15
    p = apply(c, stock(c, p, 'move', 4, destination={'rack': 'D', 'shelf': '3'})).json()
    assert [l['quantity'] for l in p['placements']] == [11, 4]
    assert sum(l['quantity'] for l in p['placements']) == 15
    h = c.get('/api/warehouse/history').json()[0]
    assert h['action'] == 'stock_move' and h['actor'] == 'owner'
    assert h['before']['placements'][0]['quantity'] == 15
    assert post(c, '/stock/' + preview.json()['token'] + '/confirm').status_code == 410


def test_quantity_validation_stale_preview_and_search_never_decrements(setup):
    c, _ = setup
    p = apply(c, stock(c, one(c))).json()
    assert stock(c, p, 'remove', 13).status_code == 409
    for quantity in [-1, 2.5, True, '2', 1000000001]:
        assert stock(c, p, 'receive', quantity).status_code == 422
    assert stock(c, p, 'move', 1, destination={'rack': ''}).status_code == 422
    first = stock(c, p, 'receive', 1); second = stock(c, p, 'remove', 1)
    assert apply(c, first).status_code == 200
    assert apply(c, second).status_code == 409
    task = post(c, '/search', {'query': 'CLO-001'}).json()
    url = '/tasks/' + task['id'] + '/scan'
    assert post(c, url, {'line': 0, 'kind': 'manual', 'value': 'checked'}).status_code == 200
    assert one(c)['placements'][0]['quantity'] == 13


def test_stock_permission_changes_invalidate_pending_staff_action(setup):
    c, _ = setup
    p = apply(c, stock(c, one(c))).json()
    login(c, 'staff'); assert stock(c, p, 'receive', 1).status_code == 403
    login(c)
    settings = c.get('/api/warehouse/settings').json(); settings.pop('configured')
    settings.update(name='Warehouse', staff_stock=True)
    assert c.put('/api/warehouse/settings', headers=H, json=settings).status_code == 200
    login(c, 'staff')
    preview = stock(c, p, 'receive', 1)
    assert preview.status_code == 200
    assert stock(c, p, 'count', 12).status_code == 403
    login(c)
    settings.update(staff_stock=False, revision=1)
    assert c.put('/api/warehouse/settings', headers=H, json=settings).status_code == 200
    login(c, 'staff'); assert apply(c, preview).status_code == 403


def test_stock_removal_and_metadata_edits_cannot_bypass_counts(setup):
    c, _ = setup
    p = apply(c, stock(c, one(c))).json()
    changed = json.loads(json.dumps(p)); changed['placements'][0]['quantity'] = 99
    assert save(c, changed, p['revision']).status_code == 422
    changed['placements'] = [{'rack': 'Elsewhere'}]
    assert save(c, changed, p['revision']).status_code == 422
    dest = {'rack': 'Corrected'}
    preview = post(c, '/moves/preview', dict(collection=p['collection'], sku=p['sku'], revision=p['revision'], source=p['placements'][0]['code'], destination=dest, reason='Label was incorrect'))
    assert preview.status_code == 200
    corrected = post(c, '/moves/' + preview.json()['token'] + '/confirm').json()
    assert corrected['placements'][0]['quantity'] == 12


def test_mixed_import_maps_brand_quantity_and_optional_locations(setup):
    c, _ = setup
    text = 'Product code,Catalogue,Product name,Brand name,Category,Row,Shelf,Qty\nNEW-1,clothing,Green shirt,SampleBrand,Shirts,01,02,8\nNEW-2,home,Cotton towel,Nest,Bath,03,04,5\n'
    preview = imported(c, text)
    assert not preview['errors'], preview
    assert preview['counts']['create'] == 2
    assert post(c, '/imports/' + preview['token'] + '/confirm').status_code == 200
    p = one(c, 'NEW-1')
    assert p['brand'] == 'SampleBrand' and p['placements'][0]['aisle'] == '01'
    assert p['placements'][0]['quantity'] == 8
    assert post(c, '/search', {'query': 'SampleBrand green shirt'}).json()['lines'][0]['selected']['sku'] == 'NEW-1'


def test_import_quantity_omission_roundtrip_and_missing_locations(setup):
    c, _ = setup
    p = apply(c, stock(c, one(c))).json()
    export = c.get('/api/warehouse/export?collection=all').content.decode('utf-8-sig')
    roundtrip = imported(c, export)
    assert not roundtrip['errors'] and roundtrip['counts']['unchanged'] == 32
    grid = list(csv.DictReader(io.StringIO(export)))
    fields = [k for k in grid[0] if k != 'quantity']
    out = io.StringIO(); writer = csv.DictWriter(out, fieldnames=fields, extrasaction='ignore'); writer.writeheader(); writer.writerows(grid)
    without_counts = imported(c, out.getvalue())
    assert without_counts['counts']['unchanged'] == 32
    bad = imported(c, 'sku,collection,name,category,rack\nMISS,home,Missing item,Storage,\n')
    assert bad['errors'] and post(c, '/imports/' + bad['token'] + '/confirm').status_code == 422


def test_concurrent_confirmations_do_not_double_apply(setup):
    c, path = setup
    p = apply(c, stock(c, one(c))).json()
    a = stock(c, p, 'receive', 1).json()['token']; b = stock(c, p, 'remove', 1).json()['token']
    cookies = dict(c.cookies)
    def confirm(token):
        with TestClient(create_app(path,seed_demo=True)) as worker:
            worker.cookies.update(cookies)
            return post(worker, '/stock/' + token + '/confirm').status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(confirm, [a, b]))
    assert sorted(statuses) == [200, 409]
    assert one(c)['placements'][0]['quantity'] in (11, 13)


def test_stock_readback_is_stored_and_does_not_apply_change(setup, monkeypatch):
    c, _ = setup
    captured = {}
    async def speak(text, language):
        captured.update(text=text, language=language)
        return b'RIFFtest'
    monkeypatch.setattr('app.services.voice.speak', speak)
    preview = stock(c, one(c), 'count', 12).json()
    r = post(c, '/stock/' + preview['token'] + '/speak')
    assert r.status_code == 200 and captured['text'] == preview['spoken_text']
    assert '12' in captured['text'] and captured['language'] == 'en-IN'
    assert one(c)['placements'][0]['quantity'] is None
    assert post(c, '/stock/' + preview['token'] + '/confirm').status_code == 200
    assert post(c, '/stock/' + preview['token'] + '/speak').status_code == 410


def test_normalization_never_joins_words_across_name_boundaries():
    from app.warehouse import tokens
    assert 'shirt' in tokens('Green shirt Shirts SampleBrand')
    assert tokens('Blue T-shirt') == tokens('blue t shirt')


def test_qualified_barcode_lookup_preserves_catalogue_identity(setup):
    c, _ = setup
    line = post(c, '/search', {'query': 'ITEM:footwear:SHO-001'}).json()['lines'][0]
    assert line['selected']['collection'] == 'footwear' and line['selected']['sku'] == 'SHO-001'


def test_custom_specs_cannot_override_export_identity():
    p = next(demo_items()); p['specs']['sku'] = 'WRONG'
    with pytest.raises(ValueError): Item(**p)


def test_example_files_import_with_counts(setup):
    from pathlib import Path
    c, _ = setup
    for path in sorted((Path(__file__).resolve().parents[2] / 'data' / 'store_examples').glob('*.csv')):
        preview = imported(c, path.read_text())
        assert not preview['errors'] and preview['counts']['create'] == 3, preview
        assert post(c, '/imports/' + preview['token'] + '/confirm').status_code == 200
    assert len(c.get('/api/warehouse/items').json()) == 44
