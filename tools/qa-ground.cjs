// M20b QA: feet on the ground (epilogue walk-surfaces, whole-vale scan) and the Jump (height, landing, bounds, solids, ceilings, pose).
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(n,c,d)=>{console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));if(!c)fails++;};
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.setViewport({width:412,height:860,isMobile:true,hasTouch:true});
await p.evaluateOnNewDocument(()=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));});
const ready=()=>p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});
const go=async q=>{await p.goto('http://localhost:8090/?'+q,{waitUntil:'load',timeout:120000});await ready();await sleep(2500);};
const E=(f,...a)=>p.evaluate(f,...a);
// ---- 1 · epilogue: Sunspire platform / causeways / stairs, feet exactly on the stone ----
await go('q=lite&shot=epilogue');
const SX=-92.8,SZ=83.9;
const sun=await E((SX,SZ)=>{const V=window.__vale,out=[];const pts=[];for(let i=0;i<16;i++){const a=i/16*Math.PI*2;for(const r of [12,15,18,21.5])pts.push([SX+Math.sin(a)*r,SZ+Math.cos(a)*r]);}
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2;for(const r of [24,27,31,35,37.5])pts.push([SX+Math.sin(a)*r,SZ+Math.cos(a)*r]);}
 for(const [x,z] of pts){V.warp(x,z);V.sim([1/60],0,0);const st=V.camInfo().st;const q=V.footProbe(st.px,st.pz);if(q.blocked||q.top===null)continue;out.push([+x.toFixed(1),+z.toFixed(1),+q.foot.toFixed(2),+q.top.toFixed(2),q.name]);}return out;},SX,SZ);
const sunBad=sun.filter(o=>/sunspire/.test(o[4])&&Math.abs(o[3]-o[2])>0.08);
ok('Sunspire platform + causeways: feet on the stone (±8 cm)',sun.filter(o=>/sunspire/.test(o[4])).length>60&&sunBad.length===0,{n:sun.length,bad:sunBad.slice(0,6)});
// walk in along a causeway onto the platform
await E((SX,SZ)=>{const V=window.__vale;V.warp(SX,SZ+37.5);V.view(Math.PI,0,0.2,6);},SX,SZ);
const walkIn=await E(()=>{const V=window.__vale,ys=[];for(let i=0;i<110;i++){V.sim([1/30],0,-1);const h=V.hop();ys.push(+h.foot.toFixed(2));}const st=V.camInfo().st;const q=V.footProbe(st.px,st.pz);return {r:+Math.hypot(st.px+92.8,st.pz-83.9).toFixed(1),ys:[ys[5],ys[50],ys[109]],q:[q.foot,q.top,q.name]};});
ok('walking a causeway up onto the platform stays on top',Math.abs(walkIn.q[0]-walkIn.q[1])<0.08&&walkIn.q[0]>1.5,walkIn);
// walk off the platform edge between causeways: a drop, not a snap; lands on the terrain
await E((SX,SZ)=>{const a=Math.PI/8;const V=window.__vale;V.warp(SX+Math.sin(a)*21,SZ+Math.cos(a)*21);V.view(a,a+Math.PI,0.2,6);},SX,SZ);
const off=await E(()=>{const V=window.__vale;let air=0;for(let i=0;i<90;i++){V.sim([1/60],0,-1);if(V.hop().air)air++;}const st=V.camInfo().st;const q=V.footProbe(st.px,st.pz);return {air,foot:q.foot,top:q.top,name:q.name};});
ok('stepping off the platform drops under gravity and lands on the ground',off.air>=3&&Math.abs(off.foot-off.top)<0.35,off);
// whole-vale scan (epilogue): nowhere walkable sinks the feet into a visible floor
const scan=await E(()=>{const V=window.__vale,bad=[];let n=0;for(let x=-232;x<=232;x+=9)for(let z=-232;z<=232;z+=9){if(Math.hypot(x,z)>232)continue;V.warp(x,z);V.sim([1/60],0,0);const st=V.camInfo().st;if(Math.hypot(st.px-x,st.pz-z)>0.3)continue;const q=V.footProbe(st.px,st.pz);if(q.blocked||q.top===null)continue;n++;const d=q.top-q.foot;if(d>0.35&&d<3)bad.push([x,z,+q.foot.toFixed(2),+q.top.toFixed(2),q.name]);}return {n,bad};});
ok('vale scan: no walkable spot sinks the feet (>35 cm)',scan.n>2000&&scan.bad.length===0,{n:scan.n,bad:scan.bad.slice(0,8)});
// ---- 2 · the jump on open ground ----
await E(()=>{window.__vale.warp(2,8);window.__vale.view(Math.PI,0,0.15,6);window.__vale.sim(Array(60).fill(1/60),0,0);});
const j=await E(()=>{const V=window.__vale;const g0=V.hop().foot,st0=V.hop().stamina,c0=V.hop().count;V.jump();V.sim([1/60],0,0);const st1=V.hop().stamina;let max=-9,frames=1,minPose=9,landed=-1;const tr=[];
 for(let i=0;i<70;i++){V.sim([1/60],0,0);const h=V.hop();tr.push(+(h.foot-g0).toFixed(3));if(h.air){frames++;const ps=V.pose();if(ps!=null&&ps<minPose)minPose=ps;}if(h.foot>max)max=h.foot;if(landed<0&&!h.air&&i>2)landed=i;}
 const h=V.hop();return {apex:+(max-g0).toFixed(3),frames,minPose:+minPose.toFixed(3),end:+(h.foot-g0).toFixed(4),dSt:+(st0-st1).toFixed(1),dc:h.count-c0,landed,tr:tr.filter((_,k)=>k%6==0)};});
ok('jump: a short hop (apex 0.5–0.8 m, 0.4–0.7 s in the air)',j.apex>0.5&&j.apex<0.8&&j.frames>=24&&j.frames<=42,j);
ok('jump: lands back exactly on the ground (no sinking)',Math.abs(j.end)<0.01,j.end);
ok('jump: pose stays upright mid-air (head over hips ≥ 0.2)',j.minPose>=0.2,j.minPose);
ok('jump: costs a little stamina and is counted',j.dc===1&&j.dSt>0,{dc:j.dc,dSt:j.dSt});
// running jump keeps moving and lands on terrain
const rj=await E(()=>{const V=window.__vale;V.warp(2,8);V.sim(Array(20).fill(1/60),0,-1);V.jump();let air=0;for(let i=0;i<60;i++){V.sim([1/60],0,-1);if(V.hop().air)air++;}const st=V.camInfo().st;const q=V.footProbe(st.px,st.pz);return {air,foot:q.foot,top:q.top,moved:Math.hypot(st.px-2,st.pz-8)};});
ok('running jump travels and lands on the terrain',rj.air>20&&rj.moved>3&&Math.abs(rj.foot-rj.top)<0.35,rj);
// jump up onto the Sunspire platform from a causeway end and from the terrain beside it
await E((SX,SZ)=>{const V=window.__vale;V.warp(SX,SZ+25.2);V.view(Math.PI,0,0.2,6);},SX,SZ);
const up=await E(()=>{const V=window.__vale;V.jump();for(let i=0;i<70;i++)V.sim([1/60],0,-1);const st=V.camInfo().st;const q=V.footProbe(st.px,st.pz);return {foot:q.foot,top:q.top,air:V.hop().air};});
ok('jump onto the platform lands on its top',!up.air&&Math.abs(up.foot-up.top)<0.08&&up.foot>1.5,up);
// no escaping the world edge by jumping
await E(()=>{const V=window.__vale;V.warp(0,231);V.view(0,Math.PI,0.2,6);});
const edge=await E(()=>{const V=window.__vale;let mx=0;for(let k=0;k<8;k++){V.jump();for(let i=0;i<30;i++){V.sim([1/60],0,-1);const s=V.camInfo().st;mx=Math.max(mx,Math.hypot(s.px,s.pz));}}return mx;});
ok('jumping at the world edge never passes R=235',edge<=235.01,edge);
// no jumping through solids (Sunspire tower ring r 10.5)
await E((SX,SZ)=>{const V=window.__vale;V.warp(SX,SZ+13);V.view(Math.PI,0,0.2,6);},SX,SZ);
const sol=await E((SX,SZ)=>{const V=window.__vale;let mn=99;for(let k=0;k<6;k++){V.jump();for(let i=0;i<30;i++){V.sim([1/60],0,-1);const s=V.camInfo().st;mn=Math.min(mn,Math.hypot(s.px-SX,s.pz-SZ));}}return mn;},SX,SZ);
ok('jumping into the tower never gets through its wall',sol>=10.45,sol);
// stamina: a tired hop is refused
const tired=await E(()=>{const V=window.__vale;const c0=V.hop().count;for(let k=0;k<30;k++){V.jump();V.sim([1/60,1/60],0,0);}return {n:V.hop().count-c0,st:V.hop().stamina};});
ok('spamming Jump runs out of stamina (refused hops)',tired.n<30,tired);
// ---- 3 · interiors: ceiling and floors ----
await go('q=lite&qa=1');
await E(()=>{localStorage.setItem('vale3d-save',JSON.stringify({v:1,started:true,done:false,xp:0,seals:{},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0}));});
await go('q=lite&qa=1');
const door=(await E(()=>window.__vale.castle())).doors.find(d=>d.id==='pale');await E((x,z)=>window.__vale.warp(x,z),door.x+0.1,door.z+0.1);await sleep(300);await E(()=>window.__vale.interact());
await p.waitForFunction('window.__vale.castle().inCastle&&!window.__vale.castle().fading',{timeout:60000,polling:200});await sleep(500);
const cs=await E(()=>{const V=window.__vale;const k0=V.castle();const r=[];for(let k=0;k<5;k++){V.jump();let mx=-9,ce=null;for(let i=0;i<50;i++){V.sim([1/60],0,k%2?-1:0);const h=V.hop();if(h.foot>mx){mx=h.foot;ce=h.ceil;}}const h=V.hop();r.push({apex:+(mx-h.gy).toFixed(2),head:+(mx+1.85).toFixed(2),ceil:ce,air:h.air,room:V.castle().room,y:V.castle().y});}return {k0:{room:k0.room,y:k0.y},r};});
ok('castle: hops never lift the head through the ceiling',cs.r.every(o=>o.ceil===null||o.head<=o.ceil+0.06),cs.r);
ok('castle: hopping keeps the floor (no floor/gate skipping)',cs.r.every(o=>!o.air&&o.y===cs.k0.y),{k0:cs.k0,r:cs.r.map(o=>[o.room,o.y])});
// ---- 4 · sea cave passage + Keeper arena ----
await go('q=lite&shot=seal-open');
const sp=await E(()=>{const V=window.__vale;V.warp(3000-9.5,3000+13.5);V.view(0,Math.PI,0.18,5);V.sim(Array(20).fill(1/60),0,0);const g0=V.hop().foot;V.jump();let mx=-9;for(let i=0;i<60;i++){V.sim([1/60],0,-1);mx=Math.max(mx,V.hop().foot);}const h=V.hop();return {apex:+(mx-g0).toFixed(2),region:h.region,air:h.air};});
ok('sea cave: hop in the grotto passage, still in the cave',sp.region==='sea'&&!sp.air&&sp.apex>0.4&&sp.apex<0.8,sp);
await go('q=lite&shot=keeper');await sleep(3000);
const kp=await E(()=>{const V=window.__vale;const K=V.keeper();const c=K.center;let mx=0;V.warp(c.x-15,c.z);V.view(-Math.PI/2,Math.PI/2,0.2,7);for(let k=0;k<8;k++){V.jump();for(let i=0;i<30;i++){V.sim([1/60],0,-1);const s=V.camInfo().st;mx=Math.max(mx,Math.hypot(s.px-c.x,s.pz-c.z));}}return {mx,region:V.hop().region};});
ok('Keeper arena: jumping toward the wall stays inside',kp.region==='keep'&&kp.mx<21,kp);
ok('no page errors',errs.length===0,errs.slice(0,4));
console.log(fails?`QA-GROUND FAIL ${fails}`:'QA-GROUND PASS');await b.close();process.exit(fails?1:0);})().catch(e=>{console.log('CRASH',e.message);process.exit(2);});
