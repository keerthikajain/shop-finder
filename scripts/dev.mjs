import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const localPython=path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const python=process.env.SHOP_FINDER_PYTHON||(existsSync(localPython)?localPython:'python');
const processes=[];
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const p of processes)p.kill();process.exitCode=code;}
function launch(command,args,cwd){
 const p=spawn(command,args,{cwd,stdio:'inherit',env:process.env});processes.push(p);
 p.on('error',e=>{console.error(e.message);stop(1)});
 p.on('exit',code=>{if(!stopping)stop(code||0)});return p;
}
launch(python,['-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000'],path.join(root,'backend'));
launch(process.execPath,[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1',...process.argv.slice(2)],path.join(root,'frontend'));
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
