import React,{useState} from 'react';
import './public-preview.css';

// Synthetic review fixture, not a connection to any organisation's private data.
const ITEMS=[
 {sku:'EX-CLO-001',name:'Blue T-shirt',type:'Clothing',detail:'Size M',location:'Clothing / Rack A / Shelf 1 / Bin 01'},
 {sku:'EX-CLO-002',name:'Blue T-shirt',type:'Clothing',detail:'Size L',location:'Clothing / Rack A / Shelf 2 / Bin 02'},
 {sku:'EX-CLO-004',name:'Black jeans',type:'Clothing',detail:'Size 32',location:'Clothing / Rack B / Shelf 2 / Bin 04'},
 {sku:'EX-CLO-005',name:'Black jeans',type:'Clothing',detail:'Size 34',location:'Clothing / Rack B / Shelf 1 / Bin 05'},
 {sku:'EX-APP-001',name:'Mixer grinder',type:'Appliances',detail:'750 W',location:'Appliances / Rack C / Shelf 1 / Bin 06'},
 {sku:'EX-HOM-001',name:'Storage box',type:'Home essentials',detail:'20 L',location:'Home / Rack D / Shelf 1 / Bin 08'}
];
const examples=['Blue T-shirt','Black jeans','Mixer grinder'];
export default function PublicPreview({onExit}){
 const [query,Q]=useState('Black jeans'),[matches,M]=useState(null),[selected,S]=useState(null);
 const [started,START]=useState(false),[verified,V]=useState(false);
 const [type,T]=useState('idea'),[feedback,F]=useState(''),[notice,N]=useState(''),[sending,B]=useState(false);
 function search(event){event?.preventDefault();
  const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const next=ITEMS.filter(p=>words.length&&words.every(word=>(p.name+' '+p.detail+' '+p.type+' '+p.sku).toLowerCase().includes(word)));
  M(next);S(null);START(false);V(false);
 }
 async function submit(event){event.preventDefault();B(true);N('');
  try{
   const r=await fetch('/api/public-preview/feedback',{method:'POST',headers:{'Content-Type':'application/json','X-Shop-Request':'1'},body:JSON.stringify({category:type,message:feedback})});
   const result=await r.json();if(!r.ok)throw Error(typeof result.detail==='string'?result.detail:'Could not send feedback.');
   F('');N(result.message);
  }catch(e){N(e.message)}finally{B(false)}
 }
 return <main className="sf-public-page">
  <header className="sf-public-top"><strong>finder <span>· public preview</span></strong><button type="button" onClick={onExit}>Back to sign in</button></header>
  <section className="sf-public-hero">
   <div className="sf-public-overline">Shop Finder · early access</div>
   <h1>Find the right product. Know where to pick it.</h1>
   <p>We’re sharing this early preview so anyone can explore our idea and suggest improvements, without creating an employee account.</p>
   <div className="sf-public-notice"><strong>What this preview includes</strong><p>A sample search, choosing the correct product version, an example shelf, and a simulated picking confirmation. All items and shelves here are fictional. This screen does not use Gnani speech-to-text or text-to-speech, and no real inventory is changed.</p></div>
  </section>
  <div className="sf-public-columns">
   <section className="sf-public-panel" aria-label="Try the sample finder">
    <h2>Try finding an item</h2>
    <p>Search an item below, or select an example.</p>
    <div className="sf-public-examples">{examples.map(name=><button key={name} type="button" onClick={()=>{Q(name);M(ITEMS.filter(p=>p.name===name));S(null);START(false);V(false)}}>{name}</button>)}</div>
    <form onSubmit={search} className="sf-public-search"><label htmlFor="sf-public-query">What are you looking for?</label><div><input id="sf-public-query" type="search" maxLength={100} minLength={2} required value={query} onChange={e=>Q(e.target.value)}/><button type="submit">Find items</button></div></form>
    {matches!==null&&<div className="sf-public-results" aria-live="polite">
     {matches.length===0?<div className="sf-public-empty"><h3>No matching product found</h3><p>Try a different product name. The preview won’t guess a shelf or substitute another item.</p></div>:<>
      <h3>{selected?'Your selected item':'Choose the exact item'}</h3><p>{matches.length>1?'More than one version was found. Choose the right size.':'One sample product matches.'}</p>
      <div className="sf-public-variants">{matches.map(p=><button type="button" key={p.sku} disabled={started} aria-pressed={selected?.sku===p.sku} className={selected?.sku===p.sku?'active':''} onClick={()=>{S(p);START(false);V(false)}}><strong>{p.name}</strong><small>{p.detail}</small></button>)}</div>
      {selected&&<div className="sf-public-shelf"><strong>Example shelf (not a real location)</strong><p>{selected.location}</p>
       {!started?<button type="button" onClick={()=>START(true)}>Start sample picking</button>:verified?<p role="status">✓ Sample pick complete. No inventory was changed.</p>:<><p>Look at the item and shelf before confirming.</p><div className="sf-public-pick-actions"><button type="button" onClick={()=>V(true)}>I found this item</button><button type="button" onClick={()=>{S(null);START(false)}}>Wrong version — choose again</button></div></>}</div>}
     </>}
    </div>}
   </section>
   <aside className="sf-public-panel sf-public-guide">
    <h2>How the full Shop Finder works</h2>
    <ol><li>Staff ask for products by voice or text.</li><li>The app checks the saved products and asks about sizes when needed.</li><li>It shows the recorded shelf and can speak the directions.</li><li>Workers confirm each item at its shelf.</li></ol>
    <p><strong>Language support:</strong> English, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Bengali, Gujarati and Punjabi. Real speech accuracy is still being tested.</p>
    <p><strong>Why is the preview public?</strong> We want feedback from reviewers while keeping actual store information, employee accounts and management controls protected.</p>
    <button type="button" onClick={onExit}>Staff sign in or request access</button>
   </aside>
  </div>
  <section className="sf-public-panel sf-public-feedback">
   <h2>Help us improve Shop Finder</h2><p>What confused you, or what would make this more useful? Your suggestion goes to the Shop Finder owner. Please avoid personal details, passwords or real customer information.</p>
   <form onSubmit={submit}><label htmlFor="sf-public-type">Feedback type</label><select id="sf-public-type" value={type} onChange={e=>T(e.target.value)}><option value="idea">Suggestion</option><option value="issue">Something didn't work</option><option value="other">Other feedback</option></select>
    <label htmlFor="sf-public-feedback">Your feedback</label><textarea id="sf-public-feedback" rows={4} minLength={15} maxLength={800} required value={feedback} onChange={e=>F(e.target.value)} placeholder="For example: Bigger shelf labels would help on phones."/>
    <button type="submit" disabled={sending||feedback.trim().length<15}>{sending?'Sending…':'Send feedback'}</button>{notice&&<p role="status">{notice}</p>}</form>
  </section>
  <footer className="sf-public-footer">Public reviewer preview · fictional catalogue only · no real stock changes</footer>
 </main>
}
