"""Run after installing dependencies. Secrets remain in the child environment."""
import os,secrets,getpass,subprocess,sys,shutil,importlib.util
if os.name=='posix':os.umask(0o077)
from pathlib import Path
root=Path(__file__).resolve().parents[1]
if importlib.util.find_spec('uvicorn') is None:
    raise SystemExit(f'Backend dependencies are missing. Run:\n"{sys.executable}" -m pip install -r backend/requirements-lock.txt')
if shutil.which('node') is None:
    raise SystemExit('Node.js is missing from PATH. Install Node.js and restart your terminal.')
if not (root/'frontend/node_modules/vite/bin/vite.js').is_file():
    raise SystemExit('Frontend dependencies are missing. Run: npm ci --prefix frontend')
env=os.environ.copy()
env['SHOP_FINDER_PYTHON']=sys.executable
sys.path.insert(0,str(root/'backend'))
from app.database import initialize,connect,DEFAULT_DB
from app.accounts import initialize_accounts,add_account
path=Path(env.get('SHOP_FINDER_DB',DEFAULT_DB))
initialize(path);initialize_accounts(path)
with connect(path) as c:has_owner=c.execute("SELECT 1 FROM accounts WHERE role='owner'").fetchone()
if not has_owner:
    print('First launch: create the owner account. Passwords are hidden while typing.')
    while True:
        name=input('Owner username (letters, numbers, dot, dash or underscore): ').strip()
        password=getpass.getpass('Owner password (at least 12 characters): ')
        confirm=getpass.getpass('Repeat password: ')
        if password!=confirm:print('Passwords do not match.');continue
        try:add_account(path,name,password,role='owner')
        except Exception:print('Use a valid username and a password of 12–128 characters.');continue
        del password,confirm
        print('Owner account created. Log in in the browser.');break
else:print('Log in with your owner or staff account in the browser.')
env['GNANI_ENABLED']='false'
if input('Enable live Gnani calls using your account credits? [y/N] ').strip().lower()=='y':
    env['GNANI_API_KEY']=getpass.getpass('Gnani API key (hidden, not saved): ')
    env['GNANI_ENABLED']='true'
try:subprocess.run(['node','scripts/dev.mjs'],cwd=root,env=env,check=True)
except KeyboardInterrupt:pass
except subprocess.CalledProcessError as e:raise SystemExit(f'Application stopped with code {e.returncode}. Read the error above; fix it before restarting.')
