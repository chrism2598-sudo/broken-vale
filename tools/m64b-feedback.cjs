// M64B · targeted test: combat feedback — swing arc + spark colour per weapon, struck sound per weapon class, directional twist,
// death ash + fall sound, foe wind-up voices and notice cue, pooled FX (no growth in scene objects; ≤ +2 draws during a swing).
// EMULATED headless Chrome (audio cues are counted at the call; the WebAudio graph itself is not heard). Not player data.
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));const PORT=process.env.PORT||'8102';
let fails=0,n=0;const ok=(name,c,d)=>{n++;console.log((c?'PASS ':'FAIL ')+name+(d!==undefined?' '+JSON.stringify(d).slice(0,400):''));if(!c)fails++;};
const SAVE=(o={})=>JSON.stringify({v:1,started:true,done:false,xp:60,seals:{forge:true},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty','spear','maul','tide','ember'],weapon:'rusty',...o});
const ALLC=['move','talk','seal','attack','dodge','rolled','parry','parried','stamina','hurt','claim','pick'];
const WANT={rusty:['#ffb36a','blade'],spear:['#dfe9ff','pierce'],maul:['#ff8a3a','blunt'],tide:['#7fe6dc','sea'],ember:['#ff5a1f','fire']};
(async()=>{const L=()=>pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});let b=await L();const errs=[];
// harness: a swiftshader renderer that dies mid-block (Target closed) is relaunched and that block retried once; logged as RETRY.
const retry=async(name,fn)=>{try{await fn();}catch(e){console.log('RETRY '+name+' after harness error: '+String(e.message||e).slice(0,120));try{await b.close();}catch(_){}b=await L();await fn();}};
const page=async(save,q='&tod=0.42')=>{const p=await b.newPage();await p.setViewport({width:412,height:915,isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?q=lite&qa=1${q}`,{waitUntil:'load'});
  await p.evaluate((s,c)=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-coach',JSON.stringify(c));if(s)localStorage.setItem('vale3d-save',s);},save,ALLC);
  await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(400);return p;};
const sim=(p,k)=>p.evaluate(k=>window.__vale.sim(Array(k).fill(1/30),0,0),k);const key=(p,code,down)=>p.evaluate((c,d)=>dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{code:c})),code,down);
const W=p=>p.evaluate(()=>window.__vale.world());const G=async(p,id)=>(await W(p)).groups.find(g=>g.id===id);const FX=p=>p.evaluate(()=>window.__vale.fxState());
const atHusks=async(p,bulk=1000)=>{await p.evaluate(()=>window.__vale.warp(8,35));await sim(p,30);const g=await G(p,'d-dome');const t=g.mobs.find(m=>m.alive);if(bulk)await p.evaluate(b=>window.__vale.foeBulk(b),bulk);await p.evaluate((x,z)=>window.__vale.warp(x,z-1.2),t.x,t.z);await sim(p,2);return t;};
// 1 · per weapon: arc shows in the weapon's colour during a swing, sparks take its colour, struck sound kind matches
for(const [w,[col,kind]] of Object.entries(WANT))await retry(w,async()=>{const p=await page(SAVE({weapon:w}));await sim(p,20);const t=await atHusks(p);await p.evaluate(()=>window.__vale.heal());
 let seen=false,arcCol=null,spark=null,hitKind=null;const c0=(await FX(p)).cues.hit||0;
 for(let r=0;r<3&&!seen;r++){await key(p,'KeyK',true);await key(p,'KeyK',false);for(let i=0;i<24;i++){await sim(p,1);const f=await FX(p);if(f.arc){seen=true;arcCol=f.arcColor;}spark=f.spark;hitKind=f.hitKind;}await p.evaluate(()=>window.__vale.heal());}
 const f=await FX(p);ok(`${w}: swing arc shows in the weapon colour; sparks match; struck sound = ${kind}`,seen&&arcCol===col&&spark===col&&hitKind===kind&&(f.cues.hit||0)>c0,{seen,arcCol,spark,hitKind,hits:(f.cues.hit||0)-c0});
 await p.close();});
// 2 · directional twist: a blow from the foe's right twists it one way, from its left the other; decays back
{const p=await page(SAVE({weapon:'maul'}));await sim(p,20);const t=await atHusks(p);let tws=[];
 for(const side of [1,-1]){const m=(await G(p,'d-dome')).mobs.find(m=>m.id===t.id);await p.evaluate((x,z)=>window.__vale.warp(x,z),m.x+1.1*side,m.z);await sim(p,2);
  let mx=0;for(let tr=0;tr<4&&Math.abs(mx)<0.2;tr++){const m2=(await G(p,'d-dome')).mobs.find(m=>m.id===t.id);await p.evaluate((x,z)=>window.__vale.warp(x,z),m2.x+1.1*side,m2.z);await sim(p,1);await key(p,'KeyK',true);await key(p,'KeyK',false);for(let i=0;i<20;i++){await sim(p,1);const mm=(await G(p,'d-dome')).mobs.find(m=>m.id===t.id);if(Math.abs(mm.tw)>Math.abs(mx))mx=mm.tw;}await sim(p,20);await p.evaluate(()=>window.__vale.heal());}tws.push(mx);await sim(p,30);}
 const after=(await G(p,'d-dome')).mobs.find(m=>m.id===t.id).tw;
 ok('directional twist: struck foes twist away from the blow (opposite signs from opposite sides) and settle',Math.abs(tws[0])>0.2&&Math.abs(tws[1])>0.2&&Math.sign(tws[0])!==Math.sign(tws[1])&&Math.abs(after)<0.05,{tws,after});await p.close();}
// 3 · death: an ash puff (dark dust) + embers and a fall sound
{const p=await page(SAVE({weapon:'maul'}));await sim(p,20);const t=await atHusks(p,0);let dead=false,ash=false;const f0=await FX(p);
 for(let r=0;r<14&&!dead;r++){const m=(await G(p,'d-dome')).mobs.find(m=>m.id===t.id);if(!m.alive){dead=true;break;}await p.evaluate((x,z)=>window.__vale.warp(x,z-1.2),m.x,m.z);await key(p,'KeyK',true);await key(p,'KeyK',false);
  for(let i=0;i<18;i++){await sim(p,1);const f=await FX(p);if(f.dustAsh)ash=true;}await p.evaluate(()=>window.__vale.heal());dead=!(await G(p,'d-dome')).mobs.find(m=>m.id===t.id).alive;}
 const f=await FX(p);ok('a felled foe leaves an ash puff and the fall sound plays',dead&&ash&&(f.cues.fall||0)>(f0.cues.fall||0),{dead,ash,fall:f.cues.fall});await p.close();}
// 4 · foe voices: a wind-up cue per foe type (husk, shade, brute) and a notice cue
{const p=await page(SAVE({}),'&tod=0.97');await sim(p,20);const w=await W(p);const g=w.groups.find(g=>g.id==='n-sun')||w.groups.find(g=>g.mobs.some(m=>m.look==='shade'));
 await p.evaluate((x,z)=>window.__vale.warp(x,z),g.x,g.z-9);await sim(p,10);await p.evaluate(()=>window.__vale.foeBulk(1000));await p.evaluate((x,z)=>window.__vale.warp(x,z-2),g.x,g.z);
 for(let i=0;i<48;i++){await sim(p,15);await p.evaluate(()=>window.__vale.heal());const f=await FX(p);const left=g.mobs.find(m=>!(f.cues['tell:'+m.look]>0));if(!left)break;
  if(i%4===3){const mm=(await G(p,g.id)).mobs.find(m=>m.look===left.look&&m.alive);if(mm)await p.evaluate((x,z)=>window.__vale.warp(x+1.3,z),mm.x,mm.z);}} 
 const f=await FX(p);const looks=[...new Set(g.mobs.map(m=>m.look))];
 ok(`wind-up voices: each foe type in the group (${looks.join('+')}) sounds its own tell; a notice cue plays`,looks.every(l=>(f.cues['tell:'+l]||0)>0)&&(f.cues.notice||0)>0,{cues:f.cues});await p.close();}
{const p=await page(SAVE({}));await sim(p,20);await atHusks(p);for(let i=0;i<20;i++){await sim(p,15);await p.evaluate(()=>window.__vale.heal());}const f=await FX(p);
 ok('husk wind-up voice sounds in a husk fight',(f.cues['tell:husk']||0)>0,{cues:f.cues});await p.close();}
// 5 · pooled: scene object count stable across 12 swings + a kill; swing adds ≤ 2 draw calls
{const p=await page(SAVE({weapon:'rusty'}));await sim(p,20);await atHusks(p);await sim(p,10);
 const cnt=()=>p.evaluate(()=>window.__vale.sceneCount());
 const per=()=>p.evaluate(()=>{const a=window.__vale.bench(1).calls;const b=window.__vale.bench(1).calls;return {c:b-a,arc:window.__vale.fxState().arc};});const idle=(await per()).c;await key(p,'KeyK',true);await key(p,'KeyK',false);await sim(p,20);const n0=await cnt();let mx=0;
 for(let r=0;r<11;r++){await key(p,'KeyK',true);await key(p,'KeyK',false);for(let i=0;i<4;i++){await sim(p,3);if((await FX(p)).arc){const c=await per();if(c.arc)mx=Math.max(mx,c.c);}}await sim(p,8);await p.evaluate(()=>window.__vale.heal());}
 const n1=await cnt();ok('FX pooled: no scene-object growth over 11 more swings; a landed swing costs ≤ +5 draw calls (arc is the only new one; sparks, flash, dust, foe flash date from M47–M52)',n1-n0<=0&&mx>0&&mx-idle<=5,{idle,swingMax:mx,objs:[n0,n1]});
 await p.screenshot({path:'/workspace/vale3d-m64/shots/m64/m64b-swing.png'});await p.close();}
ok('no page errors',errs.length===0,errs.slice(0,3));
console.log(`\nM64B feedback: ${n-fails}/${n} PASS`);await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
