// M56 · generated from qa-rollback.cjs: M56 → release-M54 → M56. Serve <root>/rel/ (release-M54 dist) and <root>/m56/ (m56 dist).
// M56 · rollback compatibility proof: M56 → release-M54 → M56 on ONE origin (localStorage is per-origin).
// Serve a directory holding both builds:  <root>/rel/ (release-M54 dist)  and  <root>/m56/ (m54 dist), e.g.
//   python3 -m http.server 8094 --directory <root>     then   PORT=8094 node tools/qa-rollback.cjs
// Checks: progress made on M56 is intact on release-M54; progress made on release-M54 is intact back on M56; unknown fields kept by M56
// survive the release-M54 session; nothing pays twice on either build; no page errors.
const PORT=process.env.PORT||'8094';const B=`http://localhost:${PORT}`;
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:412,height:860,isMobile:true,hasTouch:true});let errs=[];p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
let fails=0;const ok=(n,c,v)=>{if(!c)fails++;console.log((c?'PASS ':'FAIL ')+n,JSON.stringify(v).slice(0,400));};
const Q=()=>p.evaluate(()=>window.__vale.quest());const K=()=>p.evaluate(()=>window.__vale.castle());
const ready=()=>p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});
const go=async(build)=>{errs=[];await p.goto(`${B}/${build}/?q=lite&qa=1`,{waitUntil:'load'});await ready();await sleep(1500);const src=await p.evaluate(()=>[...document.scripts].map(s=>s.src).find(s=>/index-/.test(s))||'');console.log('INFO on',build,src.split('/').pop());};
const enter=async(id)=>{await p.evaluate(id=>window.__vale.enterCastle(id),id);await p.waitForFunction(`window.__vale.castle().id==='${id}'&&!window.__vale.castle().fading`,{timeout:30000,polling:200}).catch(()=>{});await sleep(400);await p.evaluate(()=>{const v=window.__vale;if(v.castlePeace)v.castlePeace();});};
const at=(x,z,y,f=Math.PI)=>p.evaluate((x,z,y,f)=>window.__vale.castleAt(x,z,y,f),x,z,y,f);
const act=()=>p.evaluate(()=>window.__vale.interact());
const LS=k=>p.evaluate(k=>localStorage.getItem(k),k);
const xp=async()=>(await Q()).save.xp;
const has=(a,b)=>b.every(x=>(a||[]).includes(x));
const loot=async(x,z)=>{await at(x,z,0,Math.PI/2);const a=await xp();await act();await sleep(250);return (await xp())-a;};
const fogOf=(seed)=>Array.from({length:48},(_,i)=>((i*2654435761+seed)>>>0)&0x00ffff00);
const S0={v:1,started:true,done:false,xp:200,seals:{dawn:true},runes:[1,2,0],wind:true,warden:false,mirrors:[1,0,3,2],beacon:false,echo:false,charted:[true,true,false,true,false,false,false],cave:1,coast:0,sea:0,lamp:0,
 weapons:['rusty','spear','knight'],weapon:'knight',fog:fogOf(5),fogV:2,secrets:['pale'],chests:['pale-library'],lore:['pale-ledger'],whet:1,tod:.4,day:2,sq:{ress:2},hpUp:1,futureField:{from:'a newer build',n:[1,2,3]}};
// ---- 1 · M56: load an existing save (with a field M56 doesn't know), make progress (loot the armoury loose stone) ----
await p.goto(`${B}/m56/?q=lite&qa=1`,{waitUntil:'load'});
await p.evaluate(s=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Bram',sex:'male'}));localStorage.setItem('vale3d-save',JSON.stringify(s));},S0);
await go('m56');
ok('M56 loads the save',(await xp())===200,{});
await enter('pale');const d1=await loot(14.0,-5.4);ok('M56 progress: loose stone +15',d1===15,{d1});
await p.evaluate(()=>window.__vale.saveNow());
const p54=JSON.parse(await LS('vale3d-save')),ext54=await LS('vale3d-save-ext');
ok('M56 wrote a v1 primary with the new progress and no unknown keys',p54.v===1&&p54.xp===215&&p54.stashes.includes('pale-stone')&&!('futureField' in p54),{xp:p54.xp});
ok('M56 kept the unknown field in the side key',!!ext54&&JSON.parse(ext54).unknown.futureField.from==='a newer build',{ext54});
ok('no page errors (M56 #1)',errs.length===0,errs.slice(0,3));
// ---- 2 · roll back to release-M54: M56's progress must be there; make progress on release-M54 (open the Pale nook, loot its box) ----
await go('rel');
let q=await Q();const pr=await p.evaluate(()=>window.__vale.profile);
ok('release-M54 sees M56 progress (xp 215, pale-stone looted, gear, flags, charted, profile)',q.save.xp===215&&has(q.save.stashes,['pale-stone'])&&has(q.save.secrets,['pale'])&&q.save.weapon==='knight'&&has(q.save.weapons,['rusty','spear','knight'])&&q.save.charted[3]===true&&q.save.sq.ress===2&&pr.name==='Bram'&&pr.sex==='male',{xp:q.save.xp,stashes:q.save.stashes,profile:pr});
await enter('pale');const d2=await loot(14.0,-5.4);ok('release-M54 does not pay the M56-looted stash again',d2===0,{d2});
await at(8.1,2.65,0,Math.PI/2);let a=await xp();await act();await sleep(400);ok('release-M54 progress: Pale nook opens (+10)',(await xp())===a+10&&(await K()).nook===true,{});
await sleep(1200);const d3=await loot(12.2,2.2);ok('release-M54 progress: nook box +20',d3===20,{d3});
const p52=JSON.parse(await LS('vale3d-save'));ok('release-M54 saved its progress (xp 245)',p52.xp===245&&has(p52.stashes,['pale-stone','pale-nook'])&&has(p52.secrets,['pale-nook']),{xp:p52.xp});
ok('release-M54 left the side key untouched',(await LS('vale3d-save-ext'))===ext54,{});
ok('no page errors (release-M54)',errs.length===0,errs.slice(0,3));
// ---- 3 · forward to M56 again: both sets of progress, unknown field back, nothing pays twice ----
await go('m56');
q=await Q();const st=await p.evaluate(()=>window.__vale.saveStatus());
ok('M56 has M56 + release-M54 progress (xp 245, both stashes, nook secret)',q.save.xp===245&&has(q.save.stashes,['pale-stone','pale-nook'])&&has(q.save.secrets,['pale','pale-nook']),{xp:q.save.xp,stashes:q.save.stashes,secrets:q.save.secrets});
ok('M56 took the primary as authoritative and restored the unknown field',st.source==='primary'&&st.unknownKeys.includes('futureField')&&st.notices.length===0,st);
await enter('pale');ok('Pale nook still open on M56',(await K()).nook===true,{});
const d4=await loot(14.0,-5.4),d5=await loot(12.2,2.2);ok('nothing pays twice on M56 (stone, nook box)',d4===0&&d5===0,{d4,d5});
await p.evaluate(()=>window.__vale.saveNow());
await go('m56');ok('M56 reload keeps xp 245',(await xp())===245,{});
await go('rel');q=await Q();ok('second rollback to release-M54 after M56 writes again: xp 245 + stashes intact',q.save.xp===245&&has(q.save.stashes,['pale-stone','pale-nook']),{xp:q.save.xp});
ok('no page errors (round trip 2)',errs.length===0,errs.slice(0,3));
await go('m56');ok('…and forward again: unknown field still kept',JSON.parse(await LS('vale3d-save-ext')).unknown.futureField.n.length===3,{});
console.log(fails?`QA-ROLLBACK FAIL ${fails}`:'QA-ROLLBACK PASS');await b.close();process.exit(fails?1:0);})().catch(e=>{console.log('QA-ROLLBACK ERROR',e.message);process.exit(2);});
