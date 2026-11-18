// M37 audit: Lite phone-portrait shots of every area + console errors/warnings, per-view draw calls/tris, UI overlap. Usage: node tools/m37-audit.cjs [names...]
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));const PORT=process.env.PORT||'8090';
const v=(x,z,h,pitch,dist)=>`__vale.warp(${x},${z});__vale.view(${h.toFixed(3)},${(h-Math.PI).toFixed(3)},${pitch},${dist})`;
const H=(x0,z0,x1,z1)=>Math.atan2(x1-x0,z1-z0);const L=''+(process.env.QQ||'q=lite')+'&shot=spawn&tod=0.4';
const S={
  'stair':[L,v(-35.6,47.8,H(-35.6,47.8,-34,62),0.08,5)], 'falls':[L,v(-15,39,H(-15,39,-18,56),0.12,7)], 'track':[L,v(-12,24,H(-12,24,-28,46),0.12,7)],
  'hub':[L,v(0,6,Math.PI,0.1,7)], 'bridge':[L,v(-40,-52,H(-40,-52,-52,-60),0.1,8)], 'castle-road':[L,v(-64,-70,H(-64,-70,-80,-112),0.2,5)],
  'rock-far':[L,v(-38,-78,H(-38,-78,-91.8,-128.5),0.0,8)], 'plaza':[''+(process.env.QQ||'q=lite')+'&shot=spawn&tod=0.62',v(-75.0,-101.9,H(-75.0,-101.9,-91.8,-128.5),0.05,5)],
  'echo':[L,v(14,-30,H(14,-30,31.4,-45.7),0.06,7)], 'shrine':[L,v(-18,-34,H(-18,-34,-34,-46),0.06,7)],
  'azure':[L,v(71,-92,H(71,-92,71,-128.5),0.0,8)], 'sunspire':[L,v(-92.8,52,H(-92.8,52,-92.8,83.9),0.0,8)], 'dome':[L,v(45.8,58,H(45.8,58,45.8,85.7),0.0,8)],
  'veilfall':[L,v(-82,-66,H(-82,-66,-105.4,-81.7),0.0,8)], 'coast':[''+(process.env.QQ||'q=lite')+'&shot=coast',''], 'sea-cave':[''+(process.env.QQ||'q=lite')+'&shot=sea-cave-mouth',''], 'cave':[''+(process.env.QQ||'q=lite')+'&shot=cave-interior',''],
  'hall':[''+(process.env.QQ||'q=lite')+'&shot=m20-hall',`__vale.warp(6000,2.6);__vale.view(Math.PI,0,-0.12,6.5)`], 'shafts':[''+(process.env.QQ||'q=lite')+'&shot=m20-hall',`__vale.warp(6003,-1.8);__vale.view(Math.PI/2,-Math.PI/2,0.35,2.2)`],
  'under-bridge':[L,`__vale.warp(-45,-55.9);__vale.view(0.7,0.7-Math.PI,0.25,4)`],
  'shafts2':[''+(process.env.QQ||'q=lite')+'&shot=m20-hall',`__vale.warp(6003,-1.8);__vale.view(Math.PI/2,-Math.PI/2,-0.35,2.2)`],
  'banks':[L,v(-55,-22,H(-55,-22,-62,-40),0.12,6)], 'orchard':[L,v(-20,30,H(-20,30,-30,40),0.1,6)],
  'kitchen':[''+(process.env.QQ||'q=lite')+'&shot=m20-kitchen',''], 'armoury':[''+(process.env.QQ||'q=lite')+'&shot=m20-hall',`__vale.warp(6010.9,-5.0);__vale.view(Math.PI/2-0.3+Math.PI,Math.PI/2-0.3,-0.08,2.0)`],
  'night-hub':[''+(process.env.QQ||'q=lite')+'&shot=spawn&tod=0.98',v(0,6,Math.PI,0.1,7)], 'night-stair':[''+(process.env.QQ||'q=lite')+'&shot=spawn&tod=0.98',v(-35.6,47.8,H(-35.6,47.8,-34,62),0.08,5)],
};
// M42 · Pale keep room views: hero a third in from one end, looking down the long axis (castleAt + view). Names r-<room>.
{const RM={entry:[-4,4,4,10,0],hall:[-9,9,-10,4,0],library:[4,11,4,10,0],chapel:[-11,-4,4,10,0],solar:[-9,-1,-17,-10,4.5],tower:[2,9,-17,-10,4.5],secret:[-15,-9,-2,4,0],kitchen:[-15,-9,-10,-4,0],armory:[9,15,-10,-4,0],cellar:[-15,-5,-18,-10,-4],bed:[-15,-9,-17,-10.6,4.5],gallery:[-8,8,-9.6,-7,4.5],
  'hall-n':[-9,9,4,-10,0]};
 for(const [k,[x0,x1,z0,z1,y]] of Object.entries(RM)){const cx=(x0+x1)/2,cz=(z0+z1)/2,W=Math.abs(x1-x0)>=Math.abs(z1-z0),hx=W?x0+0.3*(x1-x0):cx,hz=W?cz:z1-0.3*(z1-z0),f=W?Math.atan2(x1-x0,0):Math.atan2(0,z0-z1);
  S['r-'+k]=[''+(process.env.QQ||'q=lite')+'&shot='+(process.env.KEEPSHOT||'m20-hall'),`__vale.castleAt(${hx.toFixed(2)},${hz.toFixed(2)},${y},${f.toFixed(3)});__vale.view(${f.toFixed(3)},${(f+Math.PI).toFixed(3)},0.06,3.2)`];}}
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const names=process.argv.slice(2).length?process.argv.slice(2):Object.keys(S);
 for(const n of names){const [q,js]=S[n];const p=await b.newPage();const logs=[];p.on('pageerror',e=>logs.push('PE '+e.message.slice(0,200)));p.on('console',m=>{const t=m.type();if(t==='error'||t==='warning'||t==='warn')logs.push(t[0].toUpperCase()+' '+m.text().slice(0,200));});
  await p.setViewport({width:412,height:915,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await p.evaluateOnNewDocument(()=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));});
  try{await p.goto(`http://localhost:${PORT}/?${q}`,{waitUntil:'load',timeout:120000});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(4000);
  if(js){await p.evaluate(js);} await p.evaluate(()=>window.__vale.sim(Array(45).fill(1/30),0,0)); await sleep(2500);
  const info=await p.evaluate(()=>{const V=window.__vale;const a=V.bench(2),c=V.bench(4);const st=V.state?V.state():null;
    const vis=[...document.querySelectorAll('body *')].filter(e=>{const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden'||+s.opacity===0)return false;if(!(s.position==='fixed'||s.position==='absolute'))return false;const r=e.getBoundingClientRect();return r.width>8&&r.height>8&&r.width<400&&e.id;});
    const R=vis.map(e=>({id:e.id,r:e.getBoundingClientRect()}));const ov=[];for(let i=0;i<R.length;i++)for(let j=i+1;j<R.length;j++){const A=R[i].r,B=R[j].r;if(vis[i].contains(vis[j])||vis[j].contains(vis[i]))continue;const w=Math.min(A.right,B.right)-Math.max(A.left,B.left),h=Math.min(A.bottom,B.bottom)-Math.max(A.top,B.top);if(w>4&&h>4)ov.push(R[i].id+'×'+R[j].id);}
    return {calls:Math.round((c.calls-a.calls)/2),tris:Math.round((c.tris-a.tris)/2),ov};});
  await p.screenshot({path:`/workspace/vale3d/shots/m39-${process.env.TAG||"x"}-${n}.png`});console.log(n,JSON.stringify(info),JSON.stringify([...new Set(logs)].slice(0,8)));}catch(e){console.log(n,'CRASH',e.message.slice(0,200),JSON.stringify(logs.slice(0,5)));}
  await p.close();}
 await b.close();})().catch(e=>{console.error(e);process.exit(1);});
