"""Public preview feedback. No guest account or warehouse permission is created."""
import hashlib,time
from typing import Literal
from fastapi import HTTPException,Request
from pydantic import BaseModel,Field,ConfigDict
from .database import connect

class PreviewFeedback(BaseModel):
 model_config=ConfigDict(extra='forbid')
 category:Literal['idea','issue','other']='idea'
 message:str=Field(min_length=15,max_length=800)

def install_public_preview(app,path):
 with connect(path) as c:
  c.execute("""CREATE TABLE IF NOT EXISTS public_preview_feedback(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,message TEXT NOT NULL,
    created_at REAL NOT NULL,peer_bucket TEXT NOT NULL)""")
  c.execute('CREATE INDEX IF NOT EXISTS public_feedback_peer_time ON public_preview_feedback(peer_bucket,created_at)')
 @app.post('/api/public-preview/feedback',status_code=201)
 def send(body:PreviewFeedback,request:Request):
  message=body.message.strip()
  if len(message)<15 or len(message)>800:raise HTTPException(422,'Feedback must be between 15 and 800 characters.')
  peer=request.client.host if request.client else 'unknown'
  bucket=hashlib.sha256(('sf-preview:'+peer).encode()).hexdigest()
  stamp=time.time()
  with connect(path) as c:
   c.execute('BEGIN IMMEDIATE')
   c.execute('DELETE FROM public_preview_feedback WHERE created_at<?',(stamp-30*86400,))
   count=c.execute('SELECT count(*) FROM public_preview_feedback WHERE peer_bucket=? AND created_at>?',(bucket,stamp-86400)).fetchone()[0]
   if count>=10:raise HTTPException(429,'Feedback limit reached. Please try tomorrow.')
   c.execute('INSERT INTO public_preview_feedback(category,message,created_at,peer_bucket) VALUES(?,?,?,?)',(body.category,message,stamp,bucket))
  return {'ok':True,'message':'Thank you! Your suggestion was sent to the Shop Finder owner.'}
 @app.get('/api/public-preview/feedback')
 def owner_list(request:Request):
  user=getattr(request.state,'user',None)
  if not user or user['role']!='owner':raise HTTPException(403,'Owner access required.')
  with connect(path) as c:
   result=c.execute('SELECT id,category,message,created_at FROM public_preview_feedback ORDER BY created_at DESC LIMIT 100').fetchall()
  return [dict(row) for row in result]
