import hashlib,re,os
from typing import Literal
from pathlib import Path
from fastapi import Request,HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel,Field,ConfigDict
from .database import connect,get_product
class Report(BaseModel):
 model_config=ConfigDict(extra='forbid')
 product_id:str
 reason:Literal['empty_box','wrong_location','different_part']
 note:str=Field(default='',max_length=1000)
def install_reports(app,path):
 @app.post('/api/reports')
 def report(body:Report,request:Request):
  p=get_product(path,body.product_id)
  if not p:raise HTTPException(404,'Unknown product.')
  user=request.state.user
  reasons={'empty_box':'Box is empty','wrong_location':'Location is wrong','different_part':'Part looks different'}
  reason=reasons[body.reason]+(' — '+body.note if body.note else '')
  with connect(path) as c:
   old=c.execute("SELECT id FROM unresolved_questions WHERE product_id=? AND reason=? AND status='open'",(p.id,reason)).fetchone()
   if old:return {'id':old['id'],'status':'open'}
   cur=c.execute('INSERT INTO unresolved_questions(query,reason,product_id) VALUES (?,?,?)',(f"{p.part_number or p.id}: {p.name} — reported by {user['username']}",reason,p.id))
   return {'id':cur.lastrowid,'status':'open'}
 @app.post('/api/media')
 async def upload(request:Request):
  data=bytearray()
  async for chunk in request.stream():
   data.extend(chunk)
   if len(data)>3_000_000:raise HTTPException(413,'Photo must be smaller than 3 MB.')
  if data.startswith(b'\x89PNG\r\n\x1a\n'):ext='png'
  elif data.startswith(b'\xff\xd8\xff'):ext='jpg'
  else:raise HTTPException(422,'Use a PNG or JPEG photo.')
  directory=Path(path).parent/'photos'
  directory.mkdir(mode=0o700,parents=True,exist_ok=True)
  if os.name=='posix':os.chmod(directory,0o700)
  name=hashlib.sha256(data).hexdigest()+'.'+ext
  target=directory/name
  target.write_bytes(data)
  if os.name=='posix':os.chmod(target,0o600)
  return {'url':'/api/media/'+name}
 @app.get('/api/media/{name}')
 def photo(name:str):
  if not re.fullmatch(r'[a-f0-9]{64}\.(png|jpg)',name):raise HTTPException(404,'Photo not found.')
  target=Path(path).parent/'photos'/name
  if not target.is_file():raise HTTPException(404,'Photo not found.')
  return FileResponse(target,headers={'X-Content-Type-Options':'nosniff'})
