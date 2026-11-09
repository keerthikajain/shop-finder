"""Aggregate genuine unmatched catalogue queries for owner review.

This is NOT an issue/report and never creates a product mapping on its own.
Only bounded query phrases are stored, without employee ID or audio data.
"""
import re
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from .warehouse_language import normal_query, tokens

def utc_now():
 return datetime.now(timezone.utc).isoformat()

def initialize(c):
 c.execute("""CREATE TABLE IF NOT EXISTS wh_failed_searches(
  id INTEGER PRIMARY KEY,
  scope TEXT NOT NULL,
  query_key TEXT NOT NULL,
  example TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 1,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','dismissed')),
  reviewed_at TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT NOT NULL DEFAULT '',
  review_note TEXT NOT NULL DEFAULT '',
  linked_collection TEXT NOT NULL DEFAULT '',
  linked_sku TEXT NOT NULL DEFAULT '',
  UNIQUE(scope,query_key)
 )""")
 c.execute("CREATE INDEX IF NOT EXISTS wh_failed_searches_priority ON wh_failed_searches(status,hits DESC,last_seen DESC)")

def safe_query(phrase):
 # Avoid keeping phone numbers, email addresses, URLs or unbounded dictation.
 # This is an operational signal, not transcription history.
 value=re.sub(r'\s+',' ',str(phrase)).strip(' .?!')
 if not 3<=len(value)<=100:return None
 if re.search(r'[\x00-\x1f\x7f@]|(?:https?://|www\.)|(?:\+?\d[\d\s()\-]{7,}\d)',value,re.I):return None
 key=normal_query(value)
 if not key or not tokens(value) or len(key)>140:return None
 return value,key

def capture(c,phrases,scope,all_items,matcher):
 # A filter miss or ambiguous catalogue choice is NOT a genuine unknown.
 seen=set()
 for phrase in phrases:
  valid=safe_query(phrase)
  if not valid:continue
  display,key=valid
  if key in seen or matcher(phrase,all_items,'all'):continue
  seen.add(key)
  at=utc_now()
  c.execute("""INSERT INTO wh_failed_searches(scope,query_key,example,hits,first_seen,last_seen)
              VALUES(?,?,?,1,?,?)
              ON CONFLICT(scope,query_key) DO UPDATE SET
               hits=wh_failed_searches.hits+1,
               last_seen=excluded.last_seen,
               status=CASE WHEN wh_failed_searches.status='resolved' THEN 'open' ELSE wh_failed_searches.status END
            """,(scope,key,display,at,at))
 # Simple bounded retention of stale signals; no audio, usernames or task IDs.
 cutoff=(datetime.now(timezone.utc)-timedelta(days=90)).isoformat()
 c.execute("DELETE FROM wh_failed_searches WHERE last_seen<?",(cutoff,))

def list_for_owner(c,scope='all',status='open'):
 if scope not in ('all','clothing','footwear','appliances','home','grocery'):
  raise HTTPException(422,'Unknown product type.')
 if status not in ('open','resolved','dismissed','all'):
  raise HTTPException(422,'Unknown review status.')
 where=[];args=[]
 if scope!='all':where.append('scope=?');args.append(scope)
 if status!='all':where.append('status=?');args.append(status)
 sql='SELECT * FROM wh_failed_searches'+(' WHERE '+' AND '.join(where) if where else '')+' ORDER BY hits DESC,last_seen DESC,id DESC LIMIT 100'
 return [dict(r) for r in c.execute(sql,args)]

def resolve(c,record_id,action,user,reason,collection,sku,revision,verified,item_lookup,items_all,match,write,Item):
 row=c.execute('SELECT * FROM wh_failed_searches WHERE id=?',(record_id,)).fetchone()
 if not row:raise HTTPException(404,'Unknown search phrase.')
 if row['status']!='open':raise HTTPException(409,'This phrase was already reviewed. Refresh the list.')
 if action=='dismiss':
  if len(reason.strip())<3:raise HTTPException(422,'Explain why this request was dismissed.')
  c.execute("""UPDATE wh_failed_searches SET status='dismissed',reviewed_at=?,reviewed_by=?,review_note=?,
             linked_collection='',linked_sku='' WHERE id=?""",(utc_now(),user['username'],reason.strip(),record_id))
  return {'status':'dismissed','id':record_id}
 if action!='alias':raise HTTPException(422,'Unknown review action.')
 if not verified:raise HTTPException(422,'Physically verify the item identity before adding an alias.')
 if not collection or not sku or revision is None:raise HTTPException(422,'Choose a verified product and its revision.')
 if not safe_query(row['example']):raise HTTPException(422,'Cannot use this phrase as an alias.')
 p=item_lookup(c,collection,sku)
 if p['revision']!=revision:raise HTTPException(409,'Catalogue changed. Refresh the item before applying this alias.')
 key=normal_query(row['example'])
 if any(normal_query(v)==key for v in [p['name'],*p['aliases']]):
  raise HTTPException(409,'This name already belongs to the selected product.')
 if len(p['aliases'])>=20:raise HTTPException(422,'This product already has the maximum number of aliases.')
 updated=Item(**{**{k:v for k,v in p.items() if k not in ('revision','updated_at','updated_by')},
                  'placements':[{k:v for k,v in loc.items() if k!='code'} for loc in p['placements']],
                  'aliases':[*p['aliases'],row['example']]}).model_dump()
 # Before committing, require the REAL matcher to resolve only this verified
 # exact product across enabled catalogues, without a guessed substitution.
 originals=items_all(c)
 candidates=[{**item, 'aliases':updated['aliases']} if item['collection']==collection and item['sku']==p['sku'] else item for item in originals]
 hits=match(row['example'],candidates,'all')
 if len(hits)!=1 or (hits[0]['collection'],hits[0]['sku'])!=(collection,p['sku']):
  raise HTTPException(409,'This phrase does not uniquely identify the selected product. Review the name or specifications instead.')
 write(c,updated,revision,user['username'],'Owner verified failed-search alias','alias')
 c.execute("""UPDATE wh_failed_searches SET status='resolved',reviewed_at=?,reviewed_by=?,review_note=?,
            linked_collection=?,linked_sku=? WHERE id=?""",(utc_now(),user['username'],reason.strip(),collection,p['sku'],record_id))
 return {'status':'resolved','id':record_id,'collection':collection,'sku':p['sku']}
