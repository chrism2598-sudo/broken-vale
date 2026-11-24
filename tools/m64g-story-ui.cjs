// M64G · targeted test: opening hook (new game), seal claim beat, overworld fight music in/out, earned ending recap,
// UI kit layout (perk card, region banner, boss card, cold open) at 360×740 / 412×915 / 915×412, text contrast [COMP],
// misleading-text audit [COMP: journal XP literals vs the constants that pay them]. EMULATED headless Chrome otherwise.
const pc=require(process.env.PUPPETEER_CORE);const fs=require('fs');const path=require('path');const sleep=ms=>new Promise(r=>setTimeout(r,ms));const PORT=process.env.PORT||'8102';
const SRC=path.join(__dirname,'..','src');
let fails=0,n=0;const ok=(name,c,d)=>{n++;console.log((c?'PASS ':'FAIL ')+name+(d!==undefined?' '+JSON.stringify(d).slice(0,460):''));if(!c)fails++;};
const SAVE=(o={})=>JSON.stringify({v:1,started:true,done:false,xp:60,seals:{},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty'],weapon:'rusty',...o});
const ALLC=['move','talk','seal','attack','dodge','rolled','parry','parried','stamina','hurt','claim','pick'];
// ---- computed audits first (no browser)
{const rd=f=>fs.readFileSync(path.join(SRC,f),'utf8');const C={};for(const f of fs.readdirSync(SRC).filter(f=>f.endsWith('.ts')))for(const m of rd(f).matchAll(/(?:export )?const ([A-Z_]+_XP) = (\d+)/g))C[m[1]]=+m[2];
 const W=rd('warden.ts').match(/WARDEN_XP = (\d+)/);if(W)C.WARDEN_XP=+W[1];const j=rd('journal.ts');
 const claims=[['Windward Blessing','SHRINE_XP'],['Warden’s Crest claimed','WARDEN_XP'],['Morning-Bearer','BEACON_XP'],['Echo carried','ECHO_XP'],['the Second Seam (','COAST_XP'],['round seal (','SEA_XP'],['long watch relieved','KEEPER_XP'],['Seam-Binder','LAMP_XP']];
 const res=claims.map(([k,c])=>{const i=j.indexOf(k);const m=i>=0?(j.slice(i,i+120).match(/\+(\d+) XP/)||j.slice(Math.max(0,i-40),i).match(/\+(\d+) XP[^+]*$/)):null;return {k,claim:m?+m[1]:null,real:C[c]};});
 ok('[COMP] every XP figure the Journal promises equals the constant that pays it',res.every(r=>r.claim!==null&&r.claim===r.real),res);
 const lum=h=>{const c=h.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];};
 const cr=(a,b)=>{const A=lum(a),B=lum(b);return (Math.max(A,B)+0.05)/(Math.min(A,B)+0.05);};
 const mix=(fg,a,bg)=>'#'+[0,1,2].map(i=>Math.round(parseInt(fg.slice(1+2*i,3+2*i),16)*a+parseInt(bg.slice(1+2*i,3+2*i),16)*(1-a)).toString(16).padStart(2,'0')).join('');
 const bright='#d8e4ee';// a bright daytime sky behind translucent panels (worst case)
 const pairs=[['perk title','#fff1d6',mix('#0e1a1c',0.96,bright)],['perk desc','#e8dcc0',mix('#0e1a1c',0.96,bright)],['perk note','#cbbd9d',mix('#0e1a1c',0.96,bright)],['cold-open line','#fff1d6',mix('#080604',0.72,bright)],['boss line','#ead9b8',mix('#0c0804',0.78,bright)],['kindle pips (gold on panel)','#e8c46a',mix('#0e1a1c',0.94,bright)]];
 const out=pairs.map(([n,f,b])=>({n,ratio:+cr(f,b).toFixed(2)}));ok('[COMP] new UI text contrast ≥ 4.5:1 against its panel over a bright sky',out.every(o=>o.ratio>=4.5),out);
 const bundle=fs.readdirSync(path.join(__dirname,'..','dist','assets')).filter(f=>/^index-.*\.js$/.test(f)).map(f=>fs.readFileSync(path.join(__dirname,'..','dist','assets',f),'utf8')).join('');
 const bad=['coming soon','TODO','lorem','placeholder text'].filter(w=>bundle.toLowerCase().includes(w.toLowerCase())&&!(w==='TODO'&&!/["'`][^"'`]*TODO/.test(bundle)));
 ok('[COMP] no placeholder / coming-soon text in the shipped bundle',bad.length===0,bad);}
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errs=[];
const page=async(save,q='&tod=0.42',vp={width:412,height:915},hero=true)=>{const p=await b.newPage();await p.setViewport({...vp,isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?q=lite&qa=1${q}`,{waitUntil:'load'});
  await p.evaluate((s,c,h)=>{localStorage.clear();if(h)localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-coach',JSON.stringify(c));if(s)localStorage.setItem('vale3d-save',s);},save,ALLC,hero);
  await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(400);return p;};
const sim=(p,k,sx=0,sy=0)=>p.evaluate((k,sx,sy)=>{window.__vale.sim(Array(k).fill(1/30),sx,sy);},k,sx,sy);const S=p=>p.evaluate(()=>window.__vale.story64());
const box=(p,id)=>p.evaluate(id=>{const e=document.getElementById(id);if(!e||e.hidden)return null;const r=e.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight};},id);
// 1 · opening hook on a new character
{const p=await page(null,'&tod=0.42',{width:412,height:915},false);await sim(p,5);const form=await p.evaluate(()=>!document.getElementById('create').hidden);
 await p.evaluate(()=>{document.getElementById('cname').value='Wren';const f=document.getElementById('create');f.requestSubmit?f.requestSubmit():f.dispatchEvent(new Event('submit',{cancelable:true}));});await sim(p,3);let s=await S(p);const shown=s.cold;
 const sk=await box(p,'coldskip');await sim(p,260);const mid=await S(p);await sim(p,200);s=await S(p);
 ok('new game: after the hero is made, three opening lines play in order with the hero’s name, then clear',form&&shown&&mid.coldLog.length>=3&&/Wren/.test(mid.coldLog[2])&&/sky cracked/.test(mid.coldLog[0])&&/Enna/.test(mid.coldLog[1])&&!s.cold,{form,shown,log:mid.coldLog,end:s.cold});
 ok('the Skip button is ≥ 44 px and on screen',sk&&sk.h>=44&&sk.w>=44&&sk.y+sk.h<=sk.vh,sk);
 await p.evaluate(()=>window.__vale.coldOpen());await sim(p,4);await p.evaluate(()=>document.getElementById('coldskip').click());await sim(p,2);s=await S(p);ok('Skip ends it at once',!s.cold,s.cold);await p.close();}
// 2 · seal claim beat (first seal: unguarded)
{const p=await page(SAVE({}));await sim(p,10);const seal=await p.evaluate(()=>{const s=window.__vale.world().seals||null;return s;});
 const forge=await p.evaluate(()=>{const q=window.__vale.places64().find(x=>x.n==='Forge Heart');return q;});await p.evaluate((x,z)=>window.__vale.warp(x,z-2),forge.x,forge.z);await sim(p,10);
 await p.evaluate(()=>window.__vale.interact());await sim(p,8);const card=await p.evaluate(()=>{const e=document.getElementById('boss');return {on:e.classList.contains('on'),win:e.classList.contains('win'),name:document.getElementById('bossname').textContent,sub:document.getElementById('bosssub').textContent,line:document.getElementById('bossline').textContent};});
 const ovl=await p.evaluate(()=>{const R=id=>{const e=document.getElementById(id);if(!e||(id!=='quest'&&!e.classList.contains('on')))return null;const r=e.getBoundingClientRect();return r.width?{id,x:r.left,y:r.top,w:r.width,h:r.height}:null;};
  const card=document.getElementById('boss');const cr=card.getBoundingClientRect();const inner=[...card.children].map(c=>c.getBoundingClientRect()).filter(r=>r.width);const top=Math.min(...inner.map(r=>r.top)),bot=Math.max(...inner.map(r=>r.bottom));
  const others=['toast','lvup','quest','coach'].map(R).filter(Boolean);return {card:{y:top,h:bot-top},others,hit:others.filter(o=>!(o.y>=bot||o.y+o.h<=top)).map(o=>o.id)};});
 ok('the beat card’s text overlaps none of the toast, level banner, quest pill or coach tip',ovl.hit.length===0&&ovl.others.some(o=>o.id==='toast'),ovl);
 ok('claiming a seal shows its own beat card (name, “Seal 1 of 4 · place”, its line)',card.on&&card.name==='Forge Heart'&&/Seal 1 of 4 · Iron Dome/.test(card.sub)&&/heart remembering/.test(card.line),card);
 await p.screenshot({path:'/workspace/vale3d-m64/shots/m64/m64g-seal-beat.png'});await p.close();}
// 3 · overworld fight music in and out
{const p=await page(SAVE({}));await sim(p,10);await p.evaluate(()=>window.__vale.warp(8,35));await sim(p,30);const g=(await p.evaluate(()=>window.__vale.world())).groups.find(g=>g.id==='d-dome');const t=g.mobs.find(m=>m.alive);
 await p.evaluate(()=>window.__vale.foeBulk(1000));await p.evaluate((x,z)=>window.__vale.warp(x,z-1.5),t.x,t.z);let inF=null;for(let i=0;i<10&&inF!=='keeper';i++){await sim(p,10);await p.evaluate(()=>window.__vale.heal());inF=(await S(p)).region;}
 await p.evaluate(()=>window.__vale.warp(3,1));await sim(p,30);const soon=(await S(p)).region;await sim(p,150);const later=(await S(p)).region;
 ok('overworld fight: the fight music comes in, holds briefly after you leave, then the meadow theme returns',inF==='keeper'&&soon==='keeper'&&later==='meadow',{inF,soon,later});await p.close();}
// 4 · earned ending recap from the player's own counts
{const p=await page(SAVE({seals:{dawn:true,sun:true,tide:true,forge:true},done:true,beacon:true,cave:4,coast:3,sea:5,lamp:1,xp:700,kstat:{parry:31,slip:12,felled:44,forge:3,dawn:2},mended:['hearth'],relics:['emberstone'],relic:'emberstone',perks:['hearth','mend']}));await sim(p,10);
 const txt=await p.evaluate(()=>window.__vale.finalCard64());
 ok('the ending card names how you came through (title + your counts, no invented numbers)',/Turner of Blows/.test(txt)&&/31 parries/.test(txt)&&/12 blows rolled through/.test(txt)&&/44 foes felled/.test(txt)&&/5 sparks kindled/.test(txt)&&/ruins mended 1\/3/.test(txt)&&/relics 1\/3/.test(txt)&&/2 perks/.test(txt),{txt:txt.slice(-260)});
 await p.screenshot({path:'/workspace/vale3d-m64/shots/m64/m64g-ending-recap.png'});await p.close();}
{const p=await page(SAVE({xp:60,seals:{forge:true}}));await sim(p,10);await p.evaluate(()=>window.__vale.warp(8,35));await sim(p,30);const g=(await p.evaluate(()=>window.__vale.world())).groups.find(g=>g.id==='d-dome');const t=g.mobs.find(m=>m.alive);
 await p.evaluate(()=>window.__vale.foeBulk(1000));await p.evaluate((x,z)=>window.__vale.warp(x,z-1.2),t.x,t.z);
 for(let k=0;k<6;k++){for(let i=0;i<240;i++){await sim(p,1);const st=await p.evaluate(id=>{for(const g of window.__vale.world().groups)for(const m of g.mobs)if(m.id===id)return m.state;},t.id);if(st==='windup')break;}await sim(p,22);await p.evaluate(()=>dispatchEvent(new KeyboardEvent('keydown',{code:'KeyQ'})));await sim(p,8);await p.evaluate(()=>dispatchEvent(new KeyboardEvent('keyup',{code:'KeyQ'})));await sim(p,10);await p.evaluate(()=>window.__vale.heal());}
 const s=await S(p);const c=await p.evaluate(()=>window.__vale.combat().counts.parry);ok('lifetime counts are recorded in play (parries counted as they happen)',(s.kstat.parry||0)===c&&c>=1,{kstat:s.kstat,parries:c});await p.close();}
// 5 · UI kit layout: perk card, region banner, cold open, boss card at three sizes, nothing off-screen
for(const vp of [{width:360,height:740},{width:412,height:915},{width:915,height:412}]){const p=await page(SAVE({xp:200,seals:{forge:true}}),'&tod=0.42&perks=1',vp);await sim(p,90);
 const perk=await box(p,'perk');await p.evaluate(()=>document.querySelector('#perk button[data-p]').click());await p.evaluate(()=>window.__vale.coldOpen());await sim(p,4);const cold=await box(p,'cold');
 const rr=(await p.evaluate(()=>window.__vale.ruins64())).sites[0];await p.evaluate((x,z)=>window.__vale.warp(x,z),rr.x,rr.z+5);await sim(p,8);const rg=await p.evaluate(()=>{const e=document.getElementById('rgn');const r=e.querySelector('b').getBoundingClientRect();return {on:e.classList.contains('on'),x:r.left,w:r.width,y:r.top,h:r.height,vw:innerWidth};});
 const inside=o=>o&&o.x>=0&&o.y>=0&&o.x+o.w<=o.vw+0.5&&o.y+o.h<=(o.vh||1e9)+0.5;
 const rq=await p.evaluate(()=>{const a=document.querySelector('#rgn b').getBoundingClientRect(),q=document.getElementById('quest').getBoundingClientRect(),T=document.getElementById('toast'),L=document.getElementById('lvup');const hit=(r)=>!(r.top>=a.bottom||r.bottom<=a.top||r.left>=a.right||r.right<=a.left);const zone=(e)=>{const c=e.classList.contains('on');e.classList.add('on');const r=e.getBoundingClientRect();if(!c)e.classList.remove('on');return r;};return {quest:hit(q),toast:hit(zone(T)),lvup:hit(zone(L))};});
 ok(`UI ${vp.width}×${vp.height}: region banner clear of the quest pill, toast and level banner`,!rq.quest&&!rq.toast&&!rq.lvup,rq);
 ok(`UI ${vp.width}×${vp.height}: perk card, opening caption and region banner fit on screen`,inside(perk)&&inside(cold)&&rg.on&&inside(rg),{perk,cold,rg});
 if(vp.width===412)await p.screenshot({path:'/workspace/vale3d-m64/shots/m64/m64g-region-banner.png'});await p.close();}
ok('no page errors',errs.length===0,errs.slice(0,3));
console.log(`\nM64G story/UI: ${n-fails}/${n} PASS`);await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
