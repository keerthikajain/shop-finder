import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const frontend=fileURLToPath(new URL('..',import.meta.url));
const directory=await mkdtemp(path.join(tmpdir(),'finder-greeting-'));
after(()=>rm(directory,{recursive:true,force:true}));
const bundle=path.join(directory,'workspace-greeting.cjs');
await build({
 entryPoints:[path.join(frontend,'src/workspace-greeting.jsx')],
 bundle:true,platform:'node',format:'cjs',outfile:bundle,
 loader:{'.css':'empty'},logLevel:'silent'
});
const {greetingName,greetingMessage}=await import(pathToFileURL(bundle));

test('greeting safely uses a real account display first name or username',()=>{
 assert.equal(greetingName({id:'1',display_name:'Keerthi Jain',username:'different'}),'Keerthi');
 assert.equal(greetingName({id:'2',username:'keerthi_jain'}),'keerthijain');
 assert.equal(greetingName({id:'3',is_demo:true,username:'visitor283'}),'');
 assert.equal(greetingName(null),'');
 assert.equal(greetingName({username:'<script>alert(1)</script>'}).includes('<'),false);
});

test('time-based welcome uses current local hour and only once per workspace mount',async()=>{
 const user={id:'1',username:'keerthi',display_name:'Keerthi Jain'};
 assert.match(greetingMessage(user,'en-IN',8),/^Good morning, Keerthi\./);
 assert.match(greetingMessage(user,'en-IN',14),/^Good afternoon, Keerthi\./);
 assert.match(greetingMessage(user,'en-IN',20),/^Good evening, Keerthi\./);
 assert.match(greetingMessage(user,'en-IN',0),/^Good morning, Keerthi\./);
 const src=await readFile(new URL('../src/workspace-greeting.jsx',import.meta.url),'utf8');
 assert.match(src,/if\(attempted\.current\)return/);
 assert.match(src,/attempted\.current=true/);
 assert.match(src,/if\(interrupt\)return/);
 assert.match(src,/playWelcomeOnce\(/);
});

test('localized spoken greetings and guest fallback never invent a name',()=>{
 const user={id:'2',username:'keerthi',display_name:'Keerthi'};
 assert.match(greetingMessage(user,'hi-IN',9),/सुप्रभात, Keerthi/);
 assert.match(greetingMessage(user,'bn-IN',9),/সুপ্রভাত, Keerthi/);
 assert.match(greetingMessage(user,'te-IN',19),/శుభ సాయంత్రం, Keerthi/);
 for(const language of ['en-IN','hi-IN','bn-IN','mr-IN','gu-IN','pa-IN','kn-IN','te-IN','ta-IN','ml-IN']){
  const guest=greetingMessage({id:'guest',is_demo:true,username:'temporary81'},language,9);
  assert.ok(guest.length>0);
  assert.doesNotMatch(guest,/temporary81|Good morning, temporary/i);
 }
});

test('workspace requests authenticated Gnani female welcome once with no replay button',async()=>{
 const src=await readFile(new URL('../src/workspace-greeting.jsx',import.meta.url),'utf8');
 const app=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/workspace-greeting.css',import.meta.url),'utf8');
 assert.match(app,/import WorkspaceGreeting from '\.\/workspace-greeting\.jsx'/);
 assert.match(app,/<WorkspaceGreeting user=\{user\} appLanguage=\{appLanguage\} interrupt=/);
 assert.match(src,/playWelcomeOnce\(/);
 assert.match(src,/url:'\/api\/voice\/welcome'/);
 assert.match(src,/body:\{language,hour:entryHour\.current\}/);
 assert.match(src,/if\(attempted\.current\)return/);
 assert.match(src,/if\(interrupt\)return/);
 assert.match(src,/playWelcomeOnce\(/);
 assert.match(src,/if\(interrupt\)stopGreeting\(\)/);
 assert.match(src,/stopWelcome\(activeSpeech\.current\)/);
 assert.doesNotMatch(src,/Hear greeting|Stop greeting|Mute automatic greeting/);
 assert.match(css,/@media\(max-width:480px\)/);
 assert.doesNotMatch(src,/GNANI_API_KEY|apiKey=/);
});
