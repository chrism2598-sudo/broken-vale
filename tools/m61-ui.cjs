// M61 · phone UI audit (INTERNAL, EMULATED headless Chrome — not a real device). For each viewport and UI state:
// touch targets (visible interactive elements, min side < 44 CSS px), HUD text sizes, overlaps (HUD vs hero screen box vs controls),
// combat-control accessibility (on screen, unobstructed at centre), plus screenshots.
// PORT=8095 OUT=file.json SHOTS=dir [VIEWS=360x740,...] node tools/m61-ui.cjs
const pc=require(process.env.PUPPETEER_CORE);const fs=require('fs');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const PORT=process.env.PORT||'8095',SHOTS=process.env.SHOTS||'',OUT=process.env.OUT||'';
const VIEWS=(process.env.VIEWS||'360x740,375x667,390x844,412x915,844x390').split(',').map(s=>s.split('x').map(Number));
const SAVE=(o={})=>JSON.stringify({v:1,started:true,done:false,xp:0,seals:{},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty'],weapon:'rusty',...o});
const MID=SAVE({xp:230,seals:{dawn:true},weapons:['rusty','spear','maul','knight'],weapon:'rusty',whet:1});
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const R={port:PORT,label:'EMULATED headless Chrome (SwiftShader), touch + mobile viewport; not a real device',views:{}},errs=[];
const page=async(w,h,q,save,coach)=>{const p=await b.newPage();await p.setViewport({width:w,height:h,isMobile:true,hasTouch:true,deviceScaleFactor:1});p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?q=lite&qa=1&${q}`,{waitUntil:'load'});await p.evaluate((s,c)=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));if(s)localStorage.setItem('vale3d-save',s);},save,coach);
  await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await p.addStyleTag({content:'*,*::before,*::after{transition:none!important}'});await sleep(500);return p;};// geometry only: transitions off (SwiftShader frames lag them)
const sim=(p,n)=>p.evaluate((n)=>window.__vale.sim(Array(n).fill(1/30),0,0),n);
const measure=(p)=>p.evaluate(()=>{const v=window.__vale,cam=v.debug.camera,pl=v.debug.player,V3=cam.position.constructor;
  const vis=(e)=>{if(!e)return null;let n=e;while(n&&n!==document.body){const cs=getComputedStyle(n);if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity<0.05||n.hidden)return null;n=n.parentElement;}const r=e.getBoundingClientRect();if(r.width<1||r.height<1||r.right<0||r.bottom<0||r.left>innerWidth||r.top>innerHeight)return null;return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};};
  const ov=(a,b)=>{if(!a||!b)return 0;const w=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)),h=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));return Math.round(w*h);};
  const pts=[];for(const dx of [-0.35,0.35])for(const dz of [-0.35,0.35])for(const y of [0,1.75]){const q=new V3(pl.position.x+dx,pl.position.y+y,pl.position.z+dz).project(cam);pts.push([(q.x+1)/2*innerWidth,(1-q.y)/2*innerHeight]);}
  const xs=pts.map(a=>a[0]),ys=pts.map(a=>a[1]);const hero={x:Math.round(Math.min(...xs)),y:Math.round(Math.min(...ys)),w:Math.round(Math.max(...xs)-Math.min(...xs)),h:Math.round(Math.max(...ys)-Math.min(...ys))};
  const HUD=['quest','combat','bossbar','toast','coach','lvup','action','menubtn','fps','stam','wind','hint','chapter','dlg','wpick','journal','mapov','menu','settings'],CTL=['b-atk','b-hvy','b-blk','b-dge','b-jmp','b-wpn','joy'];
  const rect={};for(const id of [...HUD,...CTL])rect[id]=vis(document.getElementById(id));
  const coachOn=document.getElementById('coach').classList.contains('on');if(!coachOn)rect.coach=null;const lvOn=document.getElementById('lvup').classList.contains('on');if(!lvOn)rect.lvup=null;
  const toastOn=rect.toast&&document.getElementById('toast').textContent.trim()&&+getComputedStyle(document.getElementById('toast')).opacity>0.05;if(!toastOn)rect.toast=null;
  const o={hero,rect,heroCover:{},ctlCover:{},pair:{}};const ha=hero.w*hero.h||1;
  for(const id of HUD){if(!rect[id])continue;const a=ov(rect[id],hero);if(a)o.heroCover[id]=Math.round(100*a/ha);for(const c of CTL){const x=ov(rect[id],rect[c]);if(x)o.ctlCover[id+'>'+c]=x;}}
  const tr=['toast','coach','lvup','combat','quest','action','bossbar'];for(let i=0;i<tr.length;i++)for(let j=i+1;j<tr.length;j++){const x=ov(rect[tr[i]],rect[tr[j]]);if(x)o.pair[tr[i]+'×'+tr[j]]=x;}
  // touch targets: everything visible a player can tap
  const T=[];for(const e of document.querySelectorAll('button,[role=button],input,select,a,#joy,summary,label.tap,[data-w]')){const r=vis(e);if(!r)continue;if(e.closest('[hidden]'))continue;T.push({id:e.id||'',t:(e.textContent||e.value||e.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,28),w:r.w,h:r.h,min:Math.min(r.w,r.h)});}
  o.touch=T;o.small=T.filter(t=>t.min<44);
  // control accessibility: the element under each control's centre is the control (not covered)
  {const wp=rect.wpick;o.wpickRows=wp?[...document.querySelectorAll('#wpick button')].filter(e=>{const r=e.getBoundingClientRect();return r.top>=wp.y-1&&r.bottom<=wp.y+wp.h+1;}).length:null;}
  o.vw=innerWidth;  o.ctlFree={};for(const c of CTL){const r=rect[c];if(!r){o.ctlFree[c]=null;continue;}const el=document.elementFromPoint(r.x+r.w/2,r.y+r.h/2);const ok=!!el&&(el.id===c||!!el.closest('#'+c));o.ctlFree[c]=ok?true:(el?(el.id||el.className||el.tagName):'none');}
  // text sizes in HUD panels and open sheets
  const F=[];const roots=[...HUD.map(id=>document.getElementById(id)),...document.querySelectorAll('#journal,#mapov,#menu,#wpick,#settings')];
  for(const root of roots){if(!root||!vis(root))continue;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const s=n.textContent.trim();if(!s)continue;const el=n.parentElement;if(!vis(el))continue;F.push({in:root.id,px:parseFloat(getComputedStyle(el).fontSize),t:s.slice(0,24)});}}
  const fs=F.map(f=>f.px).sort((a,b)=>a-b);const by={};for(const f of F)by[f.in]=Math.min(by[f.in]||99,f.px);o.font={by,n:fs.length,min:fs[0]||null,p10:fs[Math.floor(fs.length*0.1)]||null,lt12:F.filter(f=>f.px<12).length,lt12ex:F.filter(f=>f.px<12).slice(0,6)};
  return o;});
for(const [w,h] of VIEWS){const tag=`${w}x${h}`;const V=R.views[tag]={};console.log('VIEW',tag);
  const snap=async(p,name)=>{await sleep(700);const m=await measure(p);V[name]=m;if(SHOTS){fs.mkdirSync(SHOTS,{recursive:true});await p.screenshot({path:`${SHOTS}/${tag}-${name}.png`});}
    console.log(' ',name,'fontBy',JSON.stringify(m.font.by),'small',m.small.length,'minFont',m.font.min,'lt12',m.font.lt12,'hero',JSON.stringify(m.heroCover),'ctl',JSON.stringify(m.ctlCover),'pair',JSON.stringify(m.pair));return m;};
  // calm explore
  {const p=await page(w,h,'tod=0.42',MID);await sim(p,30);await snap(p,'calm');
   // sheets from the calm screen
   await p.keyboard.press('KeyJ');await sleep(500);await snap(p,'journal');
   await p.evaluate(()=>{const s=document.querySelector('#journal .sheetin');s.scrollTop=s.scrollHeight;});await snap(p,'journalEnd');
   V.journalEndClose=await p.evaluate(()=>{const c=document.getElementById('jclose'),r=c.getBoundingClientRect();if(r.bottom<=0||r.top>=innerHeight)return 'off-screen';const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===c||c.contains(e)?'reachable':'covered';});console.log('  journal scrolled to end: close button',V.journalEndClose);
   await p.keyboard.press('Escape');await sleep(300);
   await p.keyboard.press('KeyM');await sleep(500);await snap(p,'map');await p.keyboard.press('Escape');await sleep(300);
   const mb=await p.$('#menubtn');if(mb){await p.evaluate(()=>document.getElementById('menubtn').click());await sleep(400);await snap(p,'menu');
     const mr=await p.evaluate(()=>{const r=document.getElementById('menu').getBoundingClientRect();return {x:r.x};});const tx=Math.round(Math.min(w*0.15,mr.x-30)),ty=Math.round(h*0.45);
     await p.touchscreen.tap(tx,ty);await sleep(300);V.menuOutsideClose=await p.evaluate(()=>document.getElementById('menu').hidden&&document.getElementById('journal').hidden&&document.getElementById('mapov').hidden);
     if(V.menuOutsideClose){await p.evaluate(()=>document.getElementById('menubtn').click());await sleep(300);}
     await p.evaluate(()=>document.getElementById('setbtn').click());await sleep(400);await snap(p,'settings');
     await p.touchscreen.tap(5,Math.round(h*0.5));await sleep(300);V.sheetBackdropClose=!!V.settings.rect.settings&&await p.evaluate(()=>document.getElementById('settings').hidden);
     console.log('  menu closes on outside tap',V.menuOutsideClose,'· sheet closes on backdrop tap',V.sheetBackdropClose);}
   await p.close();}
  // combat near the opening husks
  {const p=await page(w,h,'tod=0.42',MID);await p.evaluate(()=>window.__vale.warp(8,34));let eng=false;
   for(let i=0;i<60&&!eng;i++){await sim(p,5);eng=await p.evaluate(()=>{const c=document.getElementById('cbt');return !!c&&getComputedStyle(c).display!=='none'&&+getComputedStyle(c).opacity>0.5&&!document.getElementById('combat').hidden;});}
   V.combatEngaged=eng;await p.evaluate(()=>window.__vale.heal());await sim(p,3);await snap(p,'combat');
   await p.evaluate(()=>document.getElementById('b-wpn').click());await sleep(400);await snap(p,'wpick');
   {const wr=await p.evaluate(()=>{const r=document.getElementById('wpick').getBoundingClientRect();return {x:r.x};});await p.touchscreen.tap(Math.max(8,Math.round(Math.min(w*0.15,wr.x-30))),Math.round(h*0.5));}await sleep(300);V.pickOutsideClose=await p.evaluate(()=>document.getElementById('wpick').hidden);console.log('  picker closes on outside tap',V.pickOutsideClose);await p.close();}
  // opening seal-1 cluster: coach tip + seal toast + level-up banner
  {const p=await page(w,h,'',SAVE({xp:30}));const s=await p.evaluate(()=>window.__vale.quest().seals.find(x=>x.id==='forge'));
   await p.evaluate((x,z)=>window.__vale.warp(x+1.6,z+1.6),s.x,s.z);await sim(p,20);await p.evaluate(()=>{window.__claimT=performance.now();window.__vale.interact();});await sim(p,8);
   // hold the banner's shown state for the capture (SwiftShader screenshots can outlast its 3.2 s real-time timer — same approach as m60-progress), then restore
   await p.evaluate(()=>{const l=document.getElementById('lvup');if(l.textContent.trim())l.classList.add('on');});await snap(p,'seal1');await p.evaluate(()=>{if(performance.now()-window.__claimT>3200)document.getElementById('lvup').classList.remove('on');});
   // how long the cluster stays busy (≥2 of toast/coach/lvup visible), real seconds sampled
   V.seal1Coach=await p.evaluate(()=>document.getElementById('coach').classList.contains('on')?document.getElementById('coach').textContent:'');
   await sim(p,140);await sleep(3400);await snap(p,'seal1b');V.seal1bCoach=await p.evaluate(()=>document.getElementById('coach').classList.contains('on')?document.getElementById('coach').textContent:'');
   console.log('  seal1 coach@0',JSON.stringify(V.seal1Coach.slice(0,40)),'coach@4.7s',JSON.stringify(V.seal1bCoach.slice(0,40)));
   await p.close();}
}
if(process.env.CHECK){const F=[];const ok=(n,c,d)=>{if(!c)F.push(n+' '+JSON.stringify(d||''));};
 for(const [tag,V] of Object.entries(R.views)){const land=tag.startsWith('844');
  for(const st of ['calm','combat','wpick','seal1','seal1b','journal','map','menu','settings']){const m=V[st];if(!m){F.push(tag+' '+st+' missing');continue;}
   ok(tag+' '+st+' targets ≥44',m.small.length===0,m.small);ok(tag+' '+st+' text ≥12',m.font.lt12===0,m.font.lt12ex);}
  for(const st of ['calm','combat']){ok(tag+' '+st+' hero clear',Object.keys(V[st].heroCover).length===0,V[st].heroCover);}
  ok(tag+' combat engaged',V.combatEngaged);ok(tag+' combat controls reachable',Object.values(V.combat.ctlFree).every(x=>x===true),V.combat.ctlFree);
  ok(tag+' picker clear of controls',!Object.keys(V.wpick.ctlCover).some(k=>k.startsWith('wpick')),V.wpick.ctlCover);ok(tag+' picker ≥3 rows',V.wpick.wpickRows>=3,V.wpick.wpickRows);
  ok(tag+' seal1 coach waits (off at claim)',!V.seal1Coach,V.seal1Coach);ok(tag+' seal1 coach shows by +4.7 s',!!V.seal1bCoach);
  for(const st of ['seal1','seal1b']){const pr=V[st].pair;ok(tag+' '+st+' toast/banner/coach clear of each other and quest',!Object.keys(pr).some(k=>/toast|lvup|coach/.test(k)),pr);}
  if(!land)ok(tag+' seal1 toast+banner clear of hero',!V.seal1.heroCover.toast&&!V.seal1.heroCover.lvup,V.seal1.heroCover);
  const c=V.seal1b.rect.coach;ok(tag+' coach within screen',!!c&&c.x>=0&&c.x+c.w<=V.seal1b.vw,c);
  ok(tag+' journal close reachable at end',V.journalEndClose==='reachable',V.journalEndClose);
  ok(tag+' menu closes on outside tap',V.menuOutsideClose===true);ok(tag+' picker closes on outside tap',V.pickOutsideClose===true);ok(tag+' sheet closes on backdrop tap',V.sheetBackdropClose===true);}
 R.check={fails:F};console.log('M61-UI CHECK',F.length?'FAIL '+F.length:'PASS');for(const f of F)console.log('  ✗',f.slice(0,300));}
R.errs=errs;if(OUT)fs.writeFileSync(OUT,JSON.stringify(R,null,1));console.log('M61-UI DONE errs',errs.length);await b.close();})();
