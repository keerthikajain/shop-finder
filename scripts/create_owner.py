"""Interactive first-owner setup for a hosted installation. No default password."""
import sys,os,getpass
if os.name=='posix':os.umask(0o077)
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'backend'))
from app.database import initialize,connect,DEFAULT_DB
from app.accounts import initialize_accounts,add_account
path=Path(os.getenv('SHOP_FINDER_DB',DEFAULT_DB));initialize(path);initialize_accounts(path)
with connect(path) as c:exists=c.execute("SELECT 1 FROM accounts WHERE role='owner'").fetchone()
if exists:raise SystemExit('An owner already exists. Log in with that account.')
name=input('Owner username: ').strip()
password=getpass.getpass('Owner password (12+ characters): ')
if password!=getpass.getpass('Repeat password: '):raise SystemExit('Passwords did not match. Nothing was saved.')
try:add_account(path,name,password,role='owner')
except Exception:raise SystemExit('Use letters, numbers, dot, dash or underscore for the username, and a password of 12–128 characters.')
print('Owner created. Log in through the app; create staff in Account.')
