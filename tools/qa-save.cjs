const __PORT=process.env.PORT||'8090';
// M53 · save migration + persistence QA. Crafts saves shaped like older releases (from quest.ts Save/loadSave history),
// injects each into localStorage, reloads, and checks that progress, gear, flags, secrets, stashes, charted, fog, profile
// survive; that unknown fields don't crash the loader; that looted stashes don't pay again; that a reload spawns at SPAWN.
// Also corrupted / empty / unknown-version saves. One browser, one page, cases run serially.
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const SPAWN={x:0,z:6};
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:412,height:860,isMobile:true,hasTouch:true});let errs=[];p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
const res=[];let cur='';let fails=0;const ok=(name,c,v)=>{if(!c)fails++;res.push({case:cur,name,pass:!!c});console.log((c?'PASS ':'FAIL ')+cur+' · '+name,JSON.stringify(v).slice(0,400));};
const Q=()=>p.evaluate(()=>window.__vale.quest());const K=()=>p.evaluate(()=>window.__vale.castle());
const ready=()=>p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});
const settle=async(fn,ms=60000)=>{await p.waitForFunction(fn,{timeout:ms,polling:200});};
const at=(x,z,y,f=Math.PI)=>p.evaluate((x,z,y,f)=>window.__vale.castleAt(x,z,y,f),x,z,y,f);
const act=()=>p.evaluate(()=>window.__vale.interact());
const LS=()=>p.evaluate(()=>({save:localStorage.getItem('vale3d-save'),hero:localStorage.getItem('vale3d-hero')}));
const inject=async(save,hero)=>{await p.evaluate((s,h)=>{localStorage.clear();if(h!==null)localStorage.setItem('vale3d-hero',h);if(s!==null)localStorage.setItem('vale3d-save',s);},save,hero);await p.reload({waitUntil:'load'});await ready();await sleep(1500);};
const reload=async()=>{await p.reload({waitUntil:'load'});await ready();await sleep(1500);};
const enter=async(id)=>{await p.evaluate(id=>window.__vale.enterCastle(id),id);await settle(`window.__vale.castle().id==='${id}'&&!window.__vale.castle().fading`,30000).catch(()=>{});await sleep(400);await p.evaluate(()=>{const v=window.__vale;if(v.castlePeace)v.castlePeace();});};
const leaveToSpawn=async()=>{await reload();};
const bits=a=>(a||[]).reduce((n,v)=>n+((v>>>0).toString(2).split('1').length-1),0);
const superset=(a,b)=>(b||[]).every(x=>(a||[]).includes(x));
const fogOf=(seed)=>Array.from({length:48},(_,i)=>((i*2654435761+seed)>>>0)&0x00ffff00);
await p.goto('http://localhost:'+__PORT+'/?q=lite&qa=1',{waitUntil:'load'});await ready();
const base={v:1,started:true,done:false,xp:140,seals:{dawn:true},runes:[1,2,0],wind:true,warden:false,mirrors:[1,0,3,2],beacon:false,echo:false,charted:[true,true,false,true,false,false,false],cave:1,coast:0,sea:0,lamp:0};
const cases=[
 {id:'pre-M21b (no stashes/whet/tod/sq; weapons+fog of M19/M20)',hero:{name:'Ilka',sex:'female'},save:{...base,weapons:['rusty','spear'],weapon:'spear',fog:fogOf(7),fogV:2,chests:['pale-library'],secrets:['pale'],lore:['pale-ledger']},stone:'pays'},
 {id:'pre-M47 (stashes, no pale-nook)',hero:{name:'Bram',sex:'male'},save:{...base,xp:310,seals:{dawn:true,sun:true},weapons:['rusty','spear','knight'],weapon:'knight',fog:fogOf(11),fogV:2,chests:['pale-library','pale-chapel','pale-secret'],secrets:['pale'],foes:['pale-chapel'],stashes:['pale-stone'],whet:1,tod:.42,day:3,sq:{ress:2},hpUp:1,found:['wayfinder'],views:['pale-look']},stone:'looted',nook:{pale:false,azure:false}},
 {id:'pre-M49 (pale-nook, no azure-nook)',hero:{name:'Ilka Marr',sex:'female'},save:{...base,xp:520,weapons:['rusty','spear','maul','knight'],weapon:'maul',fog:fogOf(19),fogV:2,secrets:['pale','pale-nook'],stashes:['pale-stone','pale-nook'],chests:['pale-library'],whet:2,tod:.8,day:5,rk:{wolves:4},gone:{'camp-a':4},sq:{ress:3,dov:1},hpUp:2,kit:['rope'],ressStair:1},stone:'looted',nook:{pale:true,azure:false}},
 {id:'current (everything) + unknown future fields',hero:{name:'Seren-Ö',sex:'female',extra:1},save:{...base,xp:900,done:false,seals:{dawn:true,sun:true,tide:true},weapons:['rusty','spear','maul','tide','knight','halberd'],weapon:'halberd',fog:fogOf(23),fogV:2,secrets:['pale','azure','pale-nook','azure-nook'],stashes:['pale-stone','pale-nook','azure-nook','pale-lever','pale-cell'],chests:['pale-library','azure-secret'],lore:['pale-ledger','pale-chapel'],foes:['pale-hall'],views:['pale-look'],found:['wayfinder'],whet:3,tod:.25,day:9,rk:{wolves:8},gone:{'camp-a':8},sq:{ress:4},hpUp:3,kit:['rope','lamp'],ressStair:1,futureField:{a:[1,2,3]},m60:'x',quests2:[{id:'q',n:1}]},stone:'looted',nook:{pale:true,azure:true}},
];
for(const c of cases){cur=c.id;errs=[];
 await inject(JSON.stringify(c.save),JSON.stringify(c.hero));
 let q=await Q();const s=q.save,w=c.save;const pr=await p.evaluate(()=>window.__vale.profile);
 ok('loads (ready, no page errors)',errs.length===0,errs.slice(0,3));
 ok('xp, done, seals survive',s.xp===w.xp&&s.done===w.done&&JSON.stringify(s.seals)===JSON.stringify(w.seals),{xp:s.xp,seals:s.seals});
 ok('quest flags survive (runes/wind/mirrors/cave)',JSON.stringify(s.runes)===JSON.stringify(w.runes)&&s.wind===w.wind&&JSON.stringify(s.mirrors)===JSON.stringify(w.mirrors)&&s.cave===w.cave,{runes:s.runes,mirrors:s.mirrors,cave:s.cave});
 ok('weapons + equipped survive',superset(s.weapons,w.weapons)&&s.weapons.length===w.weapons.length&&s.weapon===w.weapon,{weapons:s.weapons,weapon:s.weapon});
 ok('charted survives',JSON.stringify(s.charted)===JSON.stringify(w.charted),{charted:s.charted});
 for(const k of ['secrets','stashes','chests','lore','foes','views','found','kit'])if(w[k])ok(k+' survive',superset(s[k],w[k]),{[k]:s[k]});
 for(const k of ['whet','day','hpUp','ressStair'])if(w[k]!==undefined)ok(k+' survives',s[k]===w[k],{[k]:s[k]});
 for(const k of ['sq','rk','gone'])if(w[k])ok(k+' survives',JSON.stringify(s[k])===JSON.stringify(w[k]),{[k]:s[k]});
 if(w.tod!==undefined)ok('time of day survives',Math.abs(s.tod-w.tod)<0.02,{tod:s.tod});
 { const kept=(w.fog||[]).every((v,i)=>((s.fog[i]>>>0)&(v>>>0))===(v>>>0)); ok('fog (explored map) survives (every saved bit still set)',s.fog&&s.fog.length===48&&kept&&s.fogV===2,{bitsIn:bits(w.fog),bitsNow:bits(s.fog)}); }
 ok('name/gender survive',pr&&pr.name===c.hero.name&&pr.sex===c.hero.sex,{profile:pr});
 { const ci=await p.evaluate(()=>window.__vale.camInfo()); const k=await K(); ok('reload spawns at SPAWN, outside any keep',Math.hypot(ci.st.px-SPAWN.x,ci.st.pz-SPAWN.z)<0.6&&!k.inCastle,{px:ci.st.px,pz:ci.st.pz,inCastle:k.inCastle}); }
 if(c.nook){ await enter('pale'); let k=await K(); ok('Pale nook state matches save',k.nook===c.nook.pale,{nook:k.nook}); await reload(); await enter('azure'); k=await K(); ok('Azure nook state matches save',k.nook===c.nook.azure,{nook:k.nook}); await reload(); }
 // looted stash must not pay again; an unlooted one pays once and stays looted after reload
 { await enter('pale'); await at(14.0,-5.4,0,Math.PI/2); let k=await K(); const x0=(await Q()).save.xp; await act(); await sleep(250); const x1=(await Q()).save.xp;
   if(c.stone==='looted') ok('looted stash (pale-stone) not offered and pays nothing',!/loose stone/i.test(k.near||'')&&x1===x0,{near:k.near,dxp:x1-x0});
   else { ok('unlooted stash pays once (+15)',x1===x0+15,{dxp:x1-x0}); await act(); await sleep(250); ok('…and not twice in the same visit',(await Q()).save.xp===x1,{}); await reload(); await enter('pale'); await at(14.0,-5.4,0,Math.PI/2); const x2=(await Q()).save.xp; await act(); await sleep(250); ok('…and not again after a reload',(await Q()).save.xp===x2&&(await Q()).save.stashes.includes('pale-stone'),{dxp:(await Q()).save.xp-x2}); } }
 // second reload: what is in localStorage now round-trips
 await reload(); q=await Q(); ok('second reload keeps xp/secrets/stashes',q.save.xp>=w.xp&&superset(q.save.secrets,w.secrets)&&superset(q.save.stashes||[],w.stashes||[]),{xp:q.save.xp});
 if(w.futureField){ const raw=JSON.parse((await LS()).save); ok('unknown fields: loader did not crash (observation: kept in storage until next persist? '+('futureField' in raw)+')',errs.length===0,{keptInStorage:'futureField' in raw}); }
 ok('no page errors in case',errs.length===0,errs.slice(0,3));
}
// corrupted / empty / unknown version / wrong types
const bad=[['corrupted JSON','{"v":1,"xp":12'],['empty string',''],['null literal','null'],['unknown version v:2',JSON.stringify({v:2,started:true,xp:999})],['wrong types',JSON.stringify({v:1,started:'yes',xp:'lots',seals:5,runes:'abc',mirrors:null,charted:{},weapons:'spear',weapon:7,fog:[1,2],secrets:'pale',stashes:[1,{},'pale-stone'],tod:'noon',sq:[1],gone:'x'})]];
for(const [id,raw] of bad){cur='bad save: '+id;errs=[];
 await inject(raw,JSON.stringify({name:'Ilka',sex:'female'}));const q=await Q();
 ok('loads without crashing (ready, no page errors)',errs.length===0,errs.slice(0,3));
 if(id==='wrong types') ok('sanitised: xp 0, weapons [rusty], stashes only strings',q.save.xp===0&&q.save.weapons.includes('rusty')&&(q.save.stashes||[]).every(x=>typeof x==='string'),{xp:q.save.xp,weapons:q.save.weapons,stashes:q.save.stashes});
 else ok('falls back to a fresh save',q.save.xp===0&&q.save.started===false,{xp:q.save.xp,started:q.save.started});
 const after=(await LS()).save; ok('observation: raw storage after load (overwritten? '+(after!==raw)+')',true,{after:(after||'').slice(0,80)});
}
// profile missing → default Ilka
cur='missing profile';errs=[];await inject(JSON.stringify({...base}),null);{const pr=await p.evaluate(()=>window.__vale.profile);ok('no profile → no crash',errs.length===0,errs.slice(0,3));console.log('INFO missing profile →',JSON.stringify(pr));}

// ===== M54 · backup / recovery / storage-failure / version / unknown-field cases =====
const SK='vale3d-save',BAK='vale3d-save-bak',TMP='vale3d-save-tmp',EXT='vale3d-save-ext',QUAR='vale3d-save-quarantine';
const setLS=(kv)=>p.evaluate(kv=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));for(const [k,v] of Object.entries(kv))localStorage.setItem(k,v);},kv);
const getLS=(k)=>p.evaluate(k=>localStorage.getItem(k),k);
const ST=(pg=p)=>pg.evaluate(()=>window.__vale.saveStatus());
const toastText=(pg=p)=>pg.evaluate(()=>{const t=document.getElementById('toast');return t?t.textContent:'';});
const good=(xp,extra={})=>JSON.stringify({...base,xp,weapons:['rusty','spear'],weapon:'spear',fog:fogOf(3),fogV:2,secrets:['pale'],stashes:['pale-stone'],...extra});
const special=async(init,fn)=>{const pg=await b.newPage();await pg.setViewport({width:412,height:860,isMobile:true,hasTouch:true});const e=[];pg.on('pageerror',x=>e.push('pageerror: '+x.message));pg.on('console',m=>{if(m.type()==='error')e.push('console: '+m.text())});
 await pg.evaluateOnNewDocument(init);await pg.goto('http://localhost:'+__PORT+'/?q=lite&qa=1',{waitUntil:'load'});await pg.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(1500);try{await fn(pg,e);}finally{await pg.close();}};
await p.goto('http://localhost:'+__PORT+'/?q=lite&qa=1',{waitUntil:'load'});await ready();

cur='M54 malformed primary + valid backup';errs=[];
{const bad='{"v":1,"xp":77,"seals":{"da';await setLS({[SK]:bad,[BAK]:good(333)});await reload();const q=await Q(),s=await ST();
 ok('recovered from the backup',q.save.xp===333&&s.source==='backup',{xp:q.save.xp,source:s.source});
 ok('player warned',s.notices.some(n=>/backup/.test(n))&&/backup/.test(await toastText()),{notices:s.notices,toast:await toastText()});
 ok('damaged primary preserved under the quarantine key',(await getLS(QUAR))===bad,{q:(await getLS(QUAR)||'').slice(0,40)});
 await p.evaluate(()=>window.__vale.saveNow());const pr=JSON.parse(await getLS(SK));ok('next write repairs the primary (valid v1, xp 333)',pr.v===1&&pr.xp===333,{xp:pr.xp});
 ok('backup still a valid save (never replaced by the damaged primary)',JSON.parse(await getLS(BAK)).xp===333,{});
 ok('no page errors',errs.length===0,errs.slice(0,3));}

cur='M54 both primary and backup invalid';errs=[];
{const bad='{{garbage',bad2='not json either';await setLS({[SK]:bad,[BAK]:bad2});await reload();const q=await Q(),s=await ST();
 ok('fresh game',q.save.xp===0&&q.save.started===false,{xp:q.save.xp});
 ok('player warned (new game, damaged save kept aside)',s.notices.some(n=>/no valid backup/.test(n)),{notices:s.notices});
 ok('corrupt primary preserved under the quarantine key',(await getLS(QUAR))===bad,{});
 await p.evaluate(()=>window.__vale.saveNow());ok('backup slot not overwritten with invalid data',(await getLS(BAK))===bad2,{bak:await getLS(BAK)});
 ok('no page errors',errs.length===0,errs.slice(0,3));}

cur='M54 interrupted write';errs=[];
{await setLS({[SK]:good(300).slice(0,60),[TMP]:good(444),[BAK]:good(300)});await reload();let q=await Q(),s=await ST();
 ok('truncated primary + complete write-ahead copy → the newer complete save (xp 444)',q.save.xp===444&&s.source==='tmp',{xp:q.save.xp,source:s.source});
 await setLS({[TMP]:good(120)});await reload();q=await Q();s=await ST();
 ok('first-ever write interrupted (no primary, complete write-ahead copy) → restored',q.save.xp===120&&s.source==='tmp',{xp:q.save.xp,source:s.source});
 await setLS({[SK]:good(210),[TMP]:'{"v":1,"xp":9'});await reload();q=await Q();s=await ST();
 ok('valid primary + torn write-ahead copy → primary used, torn copy discarded',q.save.xp===210&&s.source==='primary'&&(await getLS(TMP))===null,{xp:q.save.xp,tmp:await getLS(TMP)});
 ok('no page errors',errs.length===0,errs.slice(0,3));}

cur='M54 setItem throws (quota exceeded)';
{const prev=good(250);await setLS({[SK]:prev});
 await special(()=>{const o=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(String(k).startsWith('vale3d-save'))throw new DOMException('The quota has been exceeded.','QuotaExceededError');return o.call(this,k,v);};},async(pg,e)=>{
  const q=await pg.evaluate(()=>window.__vale.quest());ok('game loads the existing save',q.save.xp===250,{xp:q.save.xp});
  const r=await pg.evaluate(()=>window.__vale.saveNow());const s=await ST(pg);
  ok('write reported as failed, player warned',r===false&&s.failures>=1&&s.notices.some(n=>/could not be saved/.test(n))&&/could not be saved/.test(await toastText(pg)),{r,notices:s.notices,toast:await toastText(pg)});
  ok('previous save byte-for-byte intact',(await pg.evaluate(()=>localStorage.getItem('vale3d-save')))===prev,{});
  ok('no write-ahead debris',(await pg.evaluate(()=>localStorage.getItem('vale3d-save-tmp')))===null,{});
  ok('no page errors',e.length===0,e.slice(0,3));});}

cur='M54 localStorage unavailable (throws on access)';
await special(()=>{Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('The operation is insecure.','SecurityError');}});},async(pg,e)=>{
 const s=await ST(pg);ok('game runs (ready)',await pg.evaluate(()=>!!window.__vale.ready),{});
 ok('player warned that saving is unavailable',s.available===false&&s.notices.some(n=>/unavailable/.test(n)),{notices:s.notices});
 const r=await pg.evaluate(()=>{try{return window.__vale.saveNow();}catch(x){return 'threw '+x.message;}});ok('a save attempt neither throws nor pretends to succeed',r===false,{r});
 ok('no page errors',e.length===0,e.slice(0,3));});

cur='M54 newer save version';errs=[];
{const newer=JSON.stringify({v:3,started:true,xp:4242,shards:{a:1},note:'from the future'});await setLS({[SK]:newer});await reload();const s=await ST();
 ok('loaded read-only with a warning',s.readOnly==='newer'&&s.notices.some(n=>/newer version/.test(n)),{readOnly:s.readOnly,notices:s.notices});
 const r=await p.evaluate(()=>window.__vale.saveNow());await enter('pale');await reload();
 ok('newer save not overwritten (after a forced write, a keep visit and a reload)',r===false&&(await getLS(SK))===newer,{r,now:(await getLS(SK)||'').slice(0,60)});
 ok('no page errors',errs.length===0,errs.slice(0,3));}

cur='M54 unknown fields survive load/save';errs=[];
{const fut={futureField:{a:[1,2,3],b:'x'},m60:'keep me',quests2:[{id:'q',n:1}]};await setLS({[SK]:good(500,fut)});await reload();await p.evaluate(()=>window.__vale.saveNow());
 const pr=JSON.parse(await getLS(SK)),ex=JSON.parse(await getLS(EXT)||'null');
 ok('primary stays the exact v1 shape release-M52 reads (no unknown keys in it)',pr.v===1&&!('futureField' in pr)&&!('m60' in pr)&&pr.xp===500,{keys:Object.keys(pr).length});
 ok('unknown fields kept in the side key',ex&&ex.schema===2&&JSON.stringify(ex.unknown)===JSON.stringify(fut),{ext:ex});
 await reload();await p.evaluate(()=>window.__vale.saveNow());const ex2=JSON.parse(await getLS(EXT)||'null');const s=await ST();
 ok('…and survive a second load/save cycle',JSON.stringify(ex2&&ex2.unknown)===JSON.stringify(fut)&&s.unknownKeys.includes('futureField'),{unknownKeys:s.unknownKeys});
 const newerExt=JSON.stringify({schema:9,unknown:{x:1},other:'y'});await setLS({[SK]:good(500),[EXT]:newerExt});await reload();await p.evaluate(()=>window.__vale.saveNow());
 ok('a newer side-key schema is left untouched',(await getLS(EXT))===newerExt,{});
 ok('no page errors',errs.length===0,errs.slice(0,3));}

cur='M54 backup only ever holds a validated save';errs=[];
{await setLS({[SK]:good(100)});await reload();await p.evaluate(()=>window.__vale.saveNow());
 await p.evaluate(()=>localStorage.setItem('vale3d-save','{"v":1,"xp":'));await p.evaluate(()=>window.__vale.saveNow());
 const bk=JSON.parse(await getLS(BAK)||'null');ok('a damaged primary is never copied into the backup',bk&&bk.xp===100,{bak:bk&&bk.xp});
 ok('no page errors',errs.length===0,errs.slice(0,3));}
require('fs').writeFileSync(process.env.OUT||'/tmp/qa-save.json',JSON.stringify(res,null,1));
console.log(fails?`QA-SAVE FAIL ${fails}`:'QA-SAVE PASS');await b.close();process.exit(fails?1:0);})().catch(e=>{console.log('QA-SAVE ERROR',e.message);process.exit(2);});
