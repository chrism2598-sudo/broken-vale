// M25 QA: Pale Keep's grand stair — walk from the meadow through the Wing Gate up the stair to the keep door and back down,
// check foot heights (rock top 5.6, meadow ~1.2), the side walls hold, the cliff holds, and the camera never drops into the steps.
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const LX=2.6+(95-360)*0.36, LZ=-2.5+(70-420)*0.36, F=Math.atan2(0-LX,6-LZ), sf=Math.sin(F), cf=Math.cos(F);
const W=(u,v)=>[LX+cf*u+sf*v, LZ-sf*u+cf*v], UV=(x,z)=>{const dx=x-LX,dz=z-LZ;return {u:+(dx*cf-dz*sf).toFixed(2),v:+(dx*sf+dz*cf).toFixed(2)};};
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const q=process.env.Q||'lite';const p=await b.newPage();await p.setViewport({width:412,height:860,isMobile:true,hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(e.message));
let fails=0;const ok=(n,c,v)=>{if(!c)fails++;console.log((c?'PASS ':'FAIL ')+n,JSON.stringify(v));};
await p.goto(`http://localhost:8090/?q=${q}&qa=1`,{waitUntil:'load'});await p.evaluate(()=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));});
await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(1500);
const H=()=>p.evaluate(()=>({h:window.__vale.hop(),c:window.__vale.camInfo()}));
const go=async(u,v,face,yaw)=>{const [x,z]=W(u,v);await p.evaluate((x,z,f,y)=>{window.__vale.warp(x,z);window.__vale.view(f,y,0.15,6);window.__vale.sim(Array(10).fill(1/30),0,0);},x,z,face,yaw);};
const walk=async(sx,sy,n)=>{const out=[];for(let i=0;i<n;i+=6){await p.evaluate((sx,sy)=>window.__vale.sim(Array(6).fill(1/30),sx,sy),sx,sy);const r=await H();const uv=UV(r.h.px,r.h.pz);out.push({...uv,foot:+r.h.foot.toFixed(2),cam:r.c.cam});}return out;};
// up: from the road through the gate, up both flights, through the gatehouse
await go(0,40,F+Math.PI,F);let up=await walk(0,-1,600);
const vmin=Math.min(...up.map(s=>s.v)), topFoot=up.filter(s=>s.v<20.5&&s.v>17).map(s=>s.foot);
ok('walk up the stair to the gatehouse',vmin<17.5,{vmin,last:up[up.length-1],trace:up.filter((s,i)=>i%4===0).map(s=>[s.u,s.v,s.foot])});
ok('top landing at the rock top (5.6)',topFoot.length>0&&topFoot.every(f=>Math.abs(f-5.6)<0.2),{topFoot});
let mono=true;for(let i=1;i<up.length;i++){if(up[i].v<up[i-1].v-0.05&&up[i].foot<up[i-1].foot-0.35)mono=false;}ok('height climbs steadily (no drops)',mono,up.filter((s,i)=>i%5===0).map(s=>[s.v,s.foot]));
let maxStep=0;for(let i=1;i<up.length;i++)maxStep=Math.max(maxStep,up[i].foot-up[i-1].foot);ok('no big vertical jumps',maxStep<0.9,{maxStep});
ok('stays in the stair (|u|<2.6) while on it',up.filter(s=>s.v>20.8&&s.v<31.6).every(s=>Math.abs(s.u)<2.6),{});
// down: turn round and walk back to the meadow; camera above the steps
await go(0,19.5,F,F+Math.PI);let dn=await walk(0,-1,240);
const vmax=Math.max(...dn.map(s=>s.v));ok('walk back down to the meadow',vmax>33&&dn[dn.length-1].foot<2.2,{vmax,last:dn[dn.length-1]});
const yb=Math.min(...dn.filter(s=>s.v>31.7&&s.v<33).map(s=>s.foot));const camLow=[];for(const s of dn.concat(up)){const c=UV(s.cam[0],s.cam[2]);if(c.v>20.8&&c.v<31.6&&Math.abs(c.u)<2.5){const k=(c.v-20.8),R=(5.6-yb)/16;/* tread height under the camera */const ty=5.6-Math.min(5.6-yb,Math.max(0,k<4.5?(Math.floor(k/0.643)+1)*R:k<6.3?8*R:(9+Math.floor((k-6.3)/0.643))*R));if(s.cam[1]<ty+0.3)camLow.push({cv:c.v,cy:s.cam[1],ty:+ty.toFixed(2)});}}
ok('camera stays above the treads',camLow.length===0,camLow.slice(0,5));
// side walls: push sideways mid-stair
await go(0,23,F+Math.PI,F);let sd=await walk(1,0,90);ok('east stair wall holds',Math.max(...sd.map(s=>Math.abs(s.u)))<2.7,{u:sd[sd.length-1].u,foot:sd[sd.length-1].foot});
await go(0,28,F+Math.PI,F);sd=await walk(-1,0,90);ok('west stair wall holds',Math.max(...sd.map(s=>Math.abs(s.u)))<2.7,{u:sd[sd.length-1].u,foot:sd[sd.length-1].foot});
// cliff: walk at the rock from the meadow side (east of the stair) — must not climb it
await go(12,32,F+Math.PI,F);let cl=await walk(0,-1,150);ok('cliff blocks the meadow side',Math.max(...cl.map(s=>s.foot))<2.2,{last:cl[cl.length-1]});
ok('no page errors',errs.length===0,errs.slice(0,3));
console.log(fails?`QA-STAIR FAIL ${fails}`:'QA-STAIR ALL PASS');await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
