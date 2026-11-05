import json
import sqlite3
from pathlib import Path
from contextlib import contextmanager
from .schemas import Product

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT.parent / 'data' / 'sample_catalogue.json'
DEFAULT_DB = ROOT / 'shop_finder.sqlite3'

@contextmanager
def connect(path):
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def initialize(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY, category TEXT NOT NULL,
            synthetic INTEGER NOT NULL CHECK(synthetic IN (0,1)),
            verification_status TEXT NOT NULL CHECK(verification_status IN ('unverified','verified','needs_review')),
            payload TEXT NOT NULL CHECK(json_valid(payload)),
            CHECK(NOT(synthetic=1 AND verification_status='verified'))
        )""")
        conn.execute('CREATE INDEX IF NOT EXISTS products_category ON products(category)')
        conn.execute("""CREATE TABLE IF NOT EXISTS unresolved_questions (
            id INTEGER PRIMARY KEY, query TEXT NOT NULL, reason TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
            product_id TEXT REFERENCES products(id), resolution_note TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS verification_events (
            id INTEGER PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id),
            staff_id TEXT NOT NULL, action TEXT NOT NULL, evidence_json TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )""")

def seed(path, source=SEED):
    # Validate the complete input before touching SQLite; duplicate IDs are errors.
    products = [Product.model_validate(x) for x in json.loads(Path(source).read_text())]
    if len({p.id for p in products}) != len(products):
        raise ValueError('Duplicate product IDs')
    initialize(path)
    with connect(path) as conn:
        before = conn.total_changes
        for p in products:
            conn.execute('INSERT OR IGNORE INTO products VALUES (?,?,?,?,?)',
                         (p.id,p.appliance_category,int(p.is_synthetic),p.verification.status,p.model_dump_json()))
        return conn.total_changes - before

def list_products(path, category=None):
    with connect(path) as conn:
        rows = conn.execute('SELECT payload FROM products WHERE (? IS NULL OR category=?) ORDER BY id', (category,category)).fetchall()
    return [Product.model_validate_json(r['payload']) for r in rows]

def get_product(path, product_id):
    with connect(path) as conn:
        row = conn.execute('SELECT payload FROM products WHERE id=?',(product_id,)).fetchone()
    return Product.model_validate_json(row['payload']) if row else None

if __name__ == '__main__':
    import os
    path = Path(os.environ.get('SHOP_FINDER_DB', DEFAULT_DB))
    print(f'Inserted {seed(path)} records into {path}')
