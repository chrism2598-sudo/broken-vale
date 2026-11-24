// M64E · targeted test: three new ruins — placed clear of the canon sites (Azure, Sunspire, Iron Dome, Veilfall, Pale fixed) and every
// existing feature, on walkable ground, reachable on foot; discovered without XP; fracture mended with one spark (refused without one,
// hint without a seal); relic + lore taken; saved; region banners and fog tint; draw budget near a ruin. EMULATED headless Chrome.
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));const PORT=process.env.PORT||'8102';
let fails=0,n=0;const ok=(name,c,d)=>{n++;console.log((c?'PASS ':'FAIL ')+name+(d!==undefined?' '+JSON.stringify(d).slice(0,460):''));if(!c)fails++;};
const SAVE=(o={})=>JSON.stringify({v:1,started:true,done:false,xp:60,seals:{forge:true},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[false,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty'],weapon:'rusty',...o});
const ALLC=['move','talk','seal','attack','dodge','rolled','parry','parried','stamina','hurt','claim','pick'];
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errs=[];
const page=async(save,q='&tod=0.42',vp={width:412,height:915})=>{const p=await b.newPage();await p.setViewport({...vp,isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?q=lite&qa=1${q}`,{waitUntil:'load'});
  await p.evaluate((s,c)=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-coach',JSON.stringify(c));if(s)localStorage.setItem('vale3d-save',s);},save,ALLC);
  await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(400);return p;};
const sim=(p,k,sx=0,sy=0)=>p.evaluate((k,sx,sy)=>{window.__vale.sim(Array(k).fill(1/30),sx,sy);},k,sx,sy);const R=p=>p.evaluate(()=>window.__vale.ruins64());
const pos=p=>p.evaluate(()=>{const c=window.__vale.camInfo().st;return {x:c.px,z:c.pz};});
// 1 · placement (computed from the live build's world data)
{const p=await page(SAVE({}));await sim(p,10);const r=await R(p);const w=await p.evaluate(()=>window.__vale.world());
 const canon=await p.evaluate(()=>{const q=window.__vale.quests?window.__vale.quests():{};return null;});
 const sites=r.sites;const feats=[...w.fires.map(f=>({n:f.name,x:f.x,z:f.z,r:14})),...w.groups.map(g=>({n:g.id,x:g.x,z:g.z,r:22}))];
 const fixed=await p.evaluate(()=>window.__vale.places64?window.__vale.places64():null);
 const near=sites.map(s=>{let m={d:1e9,n:''};for(const f of [...feats,...(fixed||[])]){const d=Math.hypot(s.x-f.x,s.z-f.z)-(f.r||0);if(d<m.d)m={d:+d.toFixed(1),n:f.n};}return {id:s.id,...m};});
 ok('ruins sit clear of every fire, roam group, landmark, seal, outpost and the village (margin > 0)',near.every(m=>m.d>0)&&!!fixed,near);
 const slope=await p.evaluate(ss=>ss.map(s=>{let lo=1e9,hi=-1e9;for(let a=0;a<16;a++)for(const rr of [3,6]){const h=window.__vale.groundAt(s.x+Math.cos(a/16*6.283)*rr,s.z+Math.sin(a/16*6.283)*rr);lo=Math.min(lo,h);hi=Math.max(hi,h);}return {id:s.id,spread:+(hi-lo).toFixed(2),y:s.y};}),sites);
 const cg=await p.evaluate(ss=>ss.map(s=>+window.__vale.creekGap(s.x,s.z).toFixed(1)),sites);
 ok('each ruin stands on walkable ground (height spread within 6 m < 3 m, above water, ≥ 5 m from the creek)',slope.every(s=>s.spread<3&&s.y>-0.3)&&cg.every(g=>g>=5),{slope,creekGap:cg});await p.close();}
// 2 · reachable on foot: walk 26 m in from the village side and arrive
{const p=await page(SAVE({}));await sim(p,10);const r=await R(p);const res=[];
 for(const s of r.sites){const dx=-s.x,dz=-s.z,L=Math.hypot(dx,dz),sx=s.x+dx/L*26,sz=s.z+dz/L*26;await p.evaluate((x,z)=>window.__vale.warp(x,z),sx,sz);await sim(p,4);let sy=-1,best=1e9;
  for(let k=0;k<26;k++){const c=await pos(p);const f=Math.atan2(s.fx-c.x,s.fz-c.z);await p.evaluate(f=>window.__vale.view(f,f+Math.PI,0.3,7),f);const d0=Math.hypot(s.fx-c.x,s.fz-c.z);if(d0<2.4)break;await sim(p,15,0,sy);const c1=await pos(p);const d1=Math.hypot(s.fx-c1.x,s.fz-c1.z);if(d1>d0-0.2)sy=-sy;best=Math.min(best,d1);}
  const c=await pos(p);res.push({id:s.id,d:+Math.hypot(s.fx-c.x,s.fz-c.z).toFixed(2)});}
 ok('each fracture is reached on foot from 26 m out (within 2.8 m)',res.every(x=>x.d<2.8),res);await p.close();}
// 3 · discover (no XP), banner; refused without spark; hint without seal
{const p=await page(SAVE({seals:{},xp:0}));await sim(p,10);let r=await R(p);const s=r.sites[0];await p.evaluate((x,z)=>window.__vale.warp(x,z),s.fx,s.fz);await sim(p,30);r=await R(p);
 ok('no seal yet: the fracture prompt says a seal’s fire could mend it',/seal’s fire could mend it/.test(r.prompt||''),{prompt:r.prompt});await p.close();}
{const p=await page(SAVE({kindle:0}));await sim(p,10);let r=await R(p);const s=r.sites[0];const xp0=(await p.evaluate(()=>window.__vale.quest().save)).xp;
 await p.evaluate((x,z)=>window.__vale.warp(x,z),s.x+18,s.z);await sim(p,10);await p.evaluate((x,z)=>window.__vale.warp(x,z),s.fx,s.fz);await sim(p,40);r=await R(p);const xp1=(await p.evaluate(()=>window.__vale.quest().save)).xp;
 ok('walking in: the ruin is discovered and mapped, with no XP, and its name banner shows',r.found.includes('ruin-'+s.id)&&xp1===xp0&&r.banners.includes(s.name),{found:r.found,xp0,xp1,banners:r.banners});
 ok('region atmosphere: fog tint eases in near the ruin',r.zoneK>0.1,{zoneK:r.zoneK,zone:r.zone});
 ok('no spark: prompt asks for one; interact refuses and nothing changes',/needs a spark/.test(r.prompt||''),{prompt:r.prompt});await p.evaluate(()=>window.__vale.interact());await sim(p,5);r=await R(p);
 ok('…still unmended after the refused try',!r.mended.includes(s.id),r.mended);await p.close();}
// 4 · mend all three, take the relics, lore pages; persistence
{const p=await page(SAVE({kindle:3,seals:{forge:true,dawn:true}}));await sim(p,10);let r=await R(p);const out=[];
 for(const s of r.sites){await p.evaluate((x,z)=>window.__vale.warp(x,z),s.fx,s.fz);await sim(p,20);const k0=(await p.evaluate(()=>window.__vale.kindle())).v;const pr0=(await R(p)).prompt;
  await p.evaluate(()=>window.__vale.interact());await sim(p,60);const k1=(await p.evaluate(()=>window.__vale.kindle())).v;let rr=await R(p);const st=rr.sites.find(x=>x.id===s.id);
  await p.evaluate((x,z)=>window.__vale.warp(x,z),s.ax,s.az);await sim(p,10);rr=await R(p);const pr1=rr.prompt;await p.evaluate(()=>window.__vale.interact());await sim(p,4);await p.evaluate(()=>{while(window.__vale.dialog&&window.__vale.dialog())window.__vale.advance();for(let i=0;i<6;i++)window.__vale.advance();});await sim(p,4);
  rr=await R(p);out.push({id:s.id,pr0,spent:k0-k1,crack:st.crack,door:st.door,pr1,disc:rr.disc.includes(s.id)});}
 const pr=await p.evaluate(()=>window.__vale.progress64());const lore=(await p.evaluate(()=>window.__vale.quest().save)).lore||[];
 ok('mending spends one spark, the glow goes out and the stone sinks',out.every(o=>/Mend the fracture/.test(o.pr0)&&o.spent===1&&!o.crack&&o.door<-1.5),out);
 ok('the relic is offered and taken at each ruin',out.every(o=>/Take the/.test(o.pr1||'')&&o.disc),out.map(o=>({id:o.id,pr1:o.pr1,disc:o.disc})));
 ok('three relics owned, the first worn; three ruin lore pages in the journal',pr.relics.length===3&&pr.relic==='emberstone'&&['ruin-hearth','ruin-reed','ruin-rise'].every(x=>lore.includes(x)),{relics:pr.relics,relic:pr.relic,lore:lore.filter(x=>x.startsWith('ruin'))});
 await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sim(p,10);r=await R(p);
 ok('after a reload: ruins stay mended (no glow, stone down, no relic glint)',r.sites.every(s=>!s.crack&&s.door<-1.5&&!s.glint)&&r.mended.length===3&&r.disc.length===3,r.sites);
 await p.close();}
// 5 · draw budget near a ruin (lite): ≤ +6 draws over the same view with ruins far
{const p=await page(SAVE({}));await sim(p,10);const r=await R(p);const res=[];
 for(const s of r.sites){await p.evaluate((x,z)=>window.__vale.warp(x,z),s.x+9,s.z+9);await sim(p,6);await p.evaluate((x,z)=>window.__vale.view(Math.atan2(x,z),Math.atan2(x,z)+Math.PI,0.25,7),s.x-(s.x+9),s.z-(s.z+9));await sim(p,2);
  const per=v=>p.evaluate(v=>{window.__vale.ruinsHidden(v);const a=window.__vale.bench(1);const b=window.__vale.bench(1);return {c:b.calls-a.calls,t:b.tris-a.tris};},v);const on=await per(false),off=await per(true);await p.evaluate(()=>window.__vale.ruinsHidden(false));await sim(p,1);res.push({id:s.id,calls:on.c,without:off.c,delta:on.c-off.c,tris:on.t-off.t});if(s.id==='hearth')await p.screenshot({path:'/workspace/vale3d-m64/shots/m64/m64e-ruin-hearth.png'});}
 ok('a ruin in view costs ≤ 8 draw calls and ≤ 20k triangles (incl. shadow pass)',res.every(x=>x.delta<=8&&x.tris<=20000),res);await p.close();}
// 6 · migration: junk mended/disc lists repaired; M63 saves have none
{const p=await page(SAVE({mended:['hearth','x',5],disc:['nope']}));await sim(p,10);const r=await R(p);
 ok('junk ruin lists repaired (known ids only)',r.mended.join()==='hearth'&&r.disc.length===0,{mended:r.mended,disc:r.disc});await p.close();}
ok('no page errors',errs.length===0,errs.slice(0,3));
console.log(`\nM64E world: ${n-fails}/${n} PASS`);await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
