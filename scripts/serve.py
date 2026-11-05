"""Single-process production entry point; HTTPS is terminated by the host."""
import os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
os.environ['SHOP_FINDER_SERVE_WEB']='true'
import uvicorn
uvicorn.run('app.main:app',host='0.0.0.0',port=int(os.getenv('PORT','8080')),workers=1)
