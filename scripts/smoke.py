"""Local HTTP integration smoke test using isolated temporary accounts and catalogue."""
import subprocess,time,json,urllib.request,urllib.error,http.cookiejar,tempfile,os,secrets,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'backend'))
from app.database import initialize
from app.accounts import initialize_accounts,add_account
with tempfile.TemporaryDirectory() as temporary:
 path=Path(temporary)/'smoke.sqlite3';initialize(path);initialize_accounts(path)
 password=secrets.token_urlsafe(24);add_account(path,'smoketester',password,role='owner')
 env={**os.environ,'SHOP_FINDER_DB':str(path),'SHOP_FINDER_SEED_DEMO':'true','SHOP_FINDER_PYTHON':sys.executable,'GNANI_ENABLED':'false'}
 with open(root/'evaluation/results/local-startup.log','w') as log:
  p=subprocess.Popen(['node','scripts/dev.mjs','--port','5173','--strictPort'],cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
  try:
   for _ in range(80):
    if p.poll() is not None:raise RuntimeError('Launcher exited; inspect local-startup.log')
    try:
     with urllib.request.urlopen('http://127.0.0.1:5173/api/auth/status',timeout=1) as r:
      if json.load(r)['configured']:break
    except Exception:time.sleep(.25)
   else:raise RuntimeError('Server did not become ready')
   client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
   def request(route,body=None):
    req=urllib.request.Request('http://127.0.0.1:5173/api'+route,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','X-Shop-Request':'1'})
    with client.open(req) as response:return json.load(response)
   request('/auth/login',{'username':'smoketester','password':password})
   assert len(request('/products'))==20
   assert request('/search',{'query':'SYN-008'})['candidates'][0]['id']=='DEMO-008'
   request('/auth/logout',{})
   try:request('/products');raise AssertionError('Logged-out catalogue access was allowed')
   except urllib.error.HTTPError as e:assert e.code==401
   result={'status':'passed','checks':['launcher and frontend proxy','account login with session cookie','authenticated catalogue and search','logout revokes access'],'voice_calls':0,'browser_end_to_end':'not verified'}
   (root/'evaluation/results/account-smoke.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
  finally:
   p.terminate()
   try:p.wait(timeout=5)
   except subprocess.TimeoutExpired:p.kill();p.wait()
