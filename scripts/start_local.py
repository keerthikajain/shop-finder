"""Run after installing dependencies. Secrets remain in the child environment."""
import os,secrets,getpass,subprocess,sys,shutil,importlib.util
if os.name=='posix':os.umask(0o077)
from pathlib import Path
root=Path(__file__).resolve().parents[1]
# Read only approved backend configuration keys from the private local .env.
# The file is never copied to the frontend or printed in logs.
config_keys={'GNANI_ENABLED','GNANI_API_KEY','GNANI_STT_MODEL','GNANI_TTS_MODEL',
             'GNANI_TTS_VOICE','SHOP_FINDER_SEED_DEMO','SHOP_FINDER_PUBLIC_DEMO',
             'SHOP_FINDER_CHALLENGE_SIGNUP','SHOP_FINDER_CHALLENGE_DATA_DIR',
             'SHOP_FINDER_SECURE_COOKIE','SHOP_FINDER_DB'}
private_env=root/'.env'
if private_env.is_file():
    for raw in private_env.read_text(encoding='utf-8-sig').splitlines():
        line=raw.strip()
        if not line or line.startswith('#') or '=' not in line:continue
        key,value=line.split('=',1)
        key=key.strip()
        if key in config_keys:
            value=value.strip().strip('"').strip("'")
            if value and value!='PASTE_YOUR_ACTUAL_API_KEY_HERE':
                os.environ.setdefault(key,value)
if importlib.util.find_spec('uvicorn') is None:
    raise SystemExit(f'Backend dependencies are missing. Run:\n"{sys.executable}" -m pip install -r backend/requirements-lock.txt')
if shutil.which('node') is None:
    raise SystemExit('Node.js is missing from PATH. Install Node.js and restart your terminal.')
if not (root/'frontend/node_modules/vite/bin/vite.js').is_file():
    raise SystemExit('Frontend dependencies are missing. Run: npm ci --prefix frontend')
# Never reuse a real shop database for publicly accessible judge workspaces.
challenge=os.getenv('SHOP_FINDER_CHALLENGE_SIGNUP','false').lower()=='true'
if challenge:
    os.environ.setdefault('SHOP_FINDER_DB',str(root/'data'/'challenge_local_registry.sqlite3'))
    os.environ.setdefault('SHOP_FINDER_CHALLENGE_DATA_DIR',str(root/'data'/'challenge_local_workspaces'))
env=os.environ.copy()
env['SHOP_FINDER_PYTHON']=sys.executable
sys.path.insert(0,str(root/'backend'))
from app.database import initialize,connect,DEFAULT_DB
from app.accounts import initialize_accounts,add_account
path=Path(env.get('SHOP_FINDER_DB',DEFAULT_DB))
if challenge:
    print('Challenge signup uses its own local database and private reviewer workspaces.')
else:
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
if env.get('GNANI_ENABLED')=='true' and env.get('GNANI_API_KEY'):
    print('Live Gnani enabled using private local configuration.')
else:
    env['GNANI_ENABLED']='false'
    if input('Enable live Gnani calls using your account credits? [y/N] ').strip().lower()=='y':
        if not env.get('GNANI_API_KEY'):
            env['GNANI_API_KEY']=getpass.getpass('Gnani API key (hidden, not saved): ')
        if not env.get('GNANI_API_KEY'):
            raise SystemExit('Gnani API key is required for live voice.')
        env['GNANI_ENABLED']='true'
try:subprocess.run(['node','scripts/dev.mjs'],cwd=root,env=env,check=True)
except KeyboardInterrupt:pass
except subprocess.CalledProcessError as e:raise SystemExit(f'Application stopped with code {e.returncode}. Read the error above; fix it before restarting.')
