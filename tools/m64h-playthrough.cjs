// M64H · EMULATED full playthrough, Chapter I on one continuous save with the M64 systems in the loop, then the full
// Chapter I + II story run (tools/qa-run.cjs) on the same build. A scripted bot plays the fights: it attacks, and on each foe
// wind-up it parries (55%), rolls (25%) or reacts too late (20%, takes the blow) — an imitation of a fair player, not a human.
// Movement between places uses QA warps; inside a fight the bot closes distance in 0.12 m steps (≈ walking pace). No healing by
// the test: when the hero is downed the game's own recovery runs and the bot tries again. NOT human playtest data.
const pc=require(process.env.PUPPETEER_CORE);const fs=require('fs');const {spawnSync}=require('child_process');const sleep=ms=>new Promise(r=>setTimeout(r,ms));const PORT=process.env.PORT||'8102';
let fails=0,n=0;const R={checks:[],timeline:[]};const ok=(name,c,d)=>{n++;R.checks.push({name,pass:!!c,d});console.log((c?'PASS ':'FAIL ')+name+(d!==undefined?' '+JSON.stringify(d).slice(0,500):''));if(!c)fails++;};
const ALLC=['move','talk','seal','attack','dodge','rolled','parry','parried','stamina','hurt','claim','pick'];
const BOT=`window.__bot=function(ids,maxF,seed){const V=window.__vale;let r=seed||7;const rnd=()=>((r=(r*16807)%2147483647)/2147483647);
 const key=(c,d)=>dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{code:c}));const st={frames:0,parryTry:0,rollTry:0,late:0,attacks:0,downs:0,kindles:0,hpLow:99};const plan={};let hold=0,holdKey=null,lastHp=null;
 for(let f=0;f<maxF;f++){const w=V.world();const foes=[];for(const g of w.groups)if(ids.includes(g.id))for(const m of g.mobs)if(m.alive&&m.vis!==false)foes.push(m);
  if(!foes.length){st.frames=f;st.done=true;break;}
  const c=V.camInfo().st;let t=foes[0],bd=1e9;for(const m of foes){const d=Math.hypot(m.x-c.px,m.z-c.pz);if(d<bd){bd=d;t=m;}}
  if(hold>0){hold--;if(hold===0&&holdKey){key(holdKey,false);holdKey=null;}}
  else{let acted=false;for(const m of foes){if(m.wl<0){delete plan[m.id];continue;}const d=Math.hypot(m.x-c.px,m.z-c.pz);if(d>3.4)continue;
     if(!plan[m.id]){const x=rnd();plan[m.id]=x<0.55?'parry':x<0.8?'roll':'late';if(plan[m.id]==='late')st.late++;}
     if(plan[m.id]==='parry'&&m.wl<=0.16){key('KeyQ',true);holdKey='KeyQ';hold=9;st.parryTry++;plan[m.id]='done';acted=true;break;}
     if(plan[m.id]==='roll'&&m.wl<=0.1){key('KeyC',true);key('KeyC',false);hold=12;st.rollTry++;plan[m.id]='done';acted=true;break;}}
   if(!acted){const k=V.kindle();if(k.shown&&k.v>=1&&foes.length>=2&&rnd()<0.02){V.kindleNow();st.kindles++;}
     if(bd>1.7){const s=Math.min(0.12,bd-1.6);V.warp(c.px+(t.x-c.px)/bd*s,c.pz+(t.z-c.pz)/bd*s);}
     else if(!foes.some(m=>m.wl>=0&&Math.hypot(m.x-c.px,m.z-c.pz)<3.4)){const cb=V.combat();if(!cb.act&&cb.stamina>15){key('KeyK',true);key('KeyK',false);st.attacks++;}}}}
  V.sim([1/30],0,0);const hp=w.playerHp;if(lastHp!==null&&hp>lastHp+1)st.downs++;lastHp=hp;st.hpLow=Math.min(st.hpLow,hp);st.frames=f+1;
  if(V.quest().talking){V.advance();V.advance();V.advance();}}
 if(holdKey)key(holdKey,false);return st;};`;
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:1800000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errs=[];
const p=await b.newPage();await p.setViewport({width:412,height:915,isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push(e.message));
await p.goto(`http://localhost:${PORT}/?q=lite&qa=1&tod=0.40&perks=1`,{waitUntil:'load'});await p.evaluate(c=>{localStorage.clear();localStorage.setItem('vale3d-coach',JSON.stringify(c));},ALLC);
await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(400);await p.evaluate(BOT);
const sim=k=>p.evaluate(k=>window.__vale.sim(Array(k).fill(1/30),0,0),k);const Q=()=>p.evaluate(()=>window.__vale.quest());const P=()=>p.evaluate(()=>window.__vale.progress64());
const T=(ev,d)=>{R.timeline.push({ev,...d});console.log('·',ev,JSON.stringify(d).slice(0,300));};
const drain=async()=>{for(let i=0;i<12&&(await Q()).talking;i++){await p.evaluate(()=>window.__vale.advance());await sim(2);}};
const why=()=>p.evaluate(()=>{const v=window.__vale,q=v.quest(),w=v.world();const vis=id=>{const e=document.getElementById(id);return !!e&&!e.hidden;};return {talking:q.talking,chapter:vis('chapter'),ending:vis('ending'),fading:w.fading,locked:w.locked,down:w.down,hp:w.playerHp,engaged:(w.groups||[]).filter(g=>g.engaged||g.state==='fight').map(g=>g.id)};});
const perkPick=async()=>{for(let i=0,picked=0;i<16;i++){{const q=await Q();if(q.talking)await drain();}await sim(60);const pr=await P();if(i===15&&!pr.open&&pr.perks.length<[3,6,9,12].filter(l=>pr.level>=l).length)T('perk not offered',await why());const due=[3,6,9,12].filter(l=>pr.level>=l).length;if(!pr.open){if(pr.perks.length>=due)break;continue;}picked++;const pick=pr.opts[pr.perks.length%2];await p.evaluate(id=>window.__vale.choosePerk(id),pick);T('perk chosen',{lv:pr.open,pick});}};
const fight=async(ids,label)=>{const r=await p.evaluate((ids,s)=>window.__bot(ids,5400,s),ids,label.length*131+7);const pr=await P();const k=await p.evaluate(()=>window.__vale.kindle());T('fight '+label,{...r,level:pr.level,sparks:k.v});return r;};
// 1 · new hero → opening hook → Wayfinder
await p.evaluate(()=>{document.getElementById('cname').value='Ilka';document.getElementById('create').requestSubmit();});await sim(3);const s0=await p.evaluate(()=>window.__vale.story64());
await sim(400);T('opening',{cold:s0.cold,lines:(await p.evaluate(()=>window.__vale.story64())).coldLog.length});
let q=await Q();await p.evaluate((x,z)=>window.__vale.warp(x,z+1.5),q.wayfinder.x,q.wayfinder.z);await sim(20);await p.evaluate(()=>window.__vale.interact());await sim(4);await drain();q=await Q();
ok('opening: hook plays, Wayfinder starts the quest',s0.cold&&q.save.started,{cold:s0.cold,started:q.save.started});
// 2 · first fight (d-dome husks) → first seal (Forge Heart)
await p.evaluate(()=>window.__vale.warp(8,30));await sim(30);let f1=await fight(['d-dome'],'d-dome husks');
const forge=q.seals.find(s=>s.id==='forge');await p.evaluate((x,z)=>window.__vale.warp(x,z-2),forge.x,forge.z);await sim(10);await p.evaluate(()=>window.__vale.interact());await sim(150);await drain();q=await Q();
ok('first fight won by the bot and the first seal claimed',f1.done&&q.save.seals.forge,{f1,seal:q.save.seals.forge});await perkPick();
// 3 · the other three seals: each guard group fought for real, then claimed
const sealFight=async id=>{const s=q.seals.find(x=>x.id===id);await p.evaluate((x,z)=>window.__vale.warp(x,z+14),s.x,s.z);await sim(30);
 const gs=(await p.evaluate(()=>window.__vale.world())).groups.find(g=>g.id==='g-'+id);if(gs)await p.evaluate((x,z)=>window.__vale.warp(x+3,z+3),gs.x,gs.z);await sim(20);
 const fr=await fight(['g-'+id],'guards of '+id);await p.evaluate((x,z)=>window.__vale.warp(x,z-2),s.x,s.z);await sim(10);await p.evaluate(()=>window.__vale.interact());await sim(150);await drain();q=await Q();
 ok(`guards of the ${id} seal beaten by the bot; seal claimed`,fr.done&&q.save.seals[id],{fr,claimed:q.save.seals[id]});await perkPick();};
await sealFight('dawn');await sealFight('sun');
// 4 · ruins: mend with earned sparks (fight d-south for more if needed), take relics
const R6=await p.evaluate(()=>window.__vale.ruins64());let mended=0;
for(const r of R6.sites){let k=await p.evaluate(()=>window.__vale.kindle());if(k.v<1){await p.evaluate(()=>window.__vale.warp(4,90));await sim(20);await fight(['d-south'],'d-south (for sparks)');k=await p.evaluate(()=>window.__vale.kindle());}
 await p.evaluate((x,z)=>window.__vale.warp(x,z),r.x+18,r.z);await sim(10);await p.evaluate((x,z)=>window.__vale.warp(x,z),r.fx,r.fz);await sim(15);await p.evaluate(()=>window.__vale.interact());await sim(60);
 await p.evaluate((x,z)=>window.__vale.warp(x,z),r.ax,r.az);await sim(10);await p.evaluate(()=>window.__vale.interact());await sim(4);await drain();const rr=await p.evaluate(()=>window.__vale.ruins64());if(rr.disc.includes(r.id))mended++;T('ruin '+r.id,{sparksBefore:k.v,mended:rr.mended.includes(r.id),relic:rr.disc.includes(r.id)});}
ok('ruins mended with sparks earned in play; relics taken',mended>=2,{mended,of:3});
// 5 · the Vale Warden (bot: out of the ring on the tell, in and strike on recovery; kindles when it can)
{const W=await p.evaluate(()=>window.__vale.warden());await p.evaluate((x,z)=>window.__vale.warp(x,z+5),W.x,W.z);let st={atk:0,dodge:0,downs:0};let hp0=null;
 for(let f=0;f<9000;f++){const w=await p.evaluate(()=>window.__vale.warden());if((await Q()).save.warden)break;const c=await p.evaluate(()=>window.__vale.camInfo().st);
  if(w.phase===1&&Math.hypot(c.px-w.sx,c.pz-w.sz)<3.6){let dx=c.px-w.sx,dz=c.pz-w.sz;if(Math.hypot(dx,dz)<0.3){dx=c.px-w.x;dz=c.pz-w.z;const l=Math.hypot(dx,dz)||1;const px=-dz/l,pz=dx/l;dx=px;dz=pz;}const d=Math.hypot(dx,dz)||1;await p.evaluate((x,z)=>window.__vale.warp(x,z),w.sx+dx/d*4.4,w.sz+dz/d*4.4);st.dodge++;}
  else if(w.phase===2||!w.awake){const d=Math.hypot(c.px-w.x,c.pz-w.z);if(d>2.6)await p.evaluate((x,z,d)=>window.__vale.warp(x+(window.__vale.camInfo().st.px-x)/d*2.4,z+(window.__vale.camInfo().st.pz-z)/d*2.4),w.x,w.z,d);else{await p.evaluate(()=>{dispatchEvent(new KeyboardEvent('keydown',{code:'KeyK'}));dispatchEvent(new KeyboardEvent('keyup',{code:'KeyK'}));});st.atk++;}}
  else if(w.phase===1&&f%40===0){const k=await p.evaluate(()=>window.__vale.kindle());if(k.v>=1&&k.attuned!=='forge')await p.evaluate(()=>window.__vale.kindleNow());}
  await sim(3);if(hp0!==null&&w.playerHp>hp0+1)st.downs++;hp0=w.playerHp;if((await Q()).talking)await drain();}
 q=await Q();T('warden',{...st,beaten:q.save.warden});ok('the Vale Warden beaten by the bot',q.save.warden,st);await perkPick();}
await sealFight('tide');
{for(let i=0;i<120;i++){await sim(30);q=await Q();if(q.talking)await drain();if(q.chapter)break;}q=await Q();const chap=q.chapter;if(chap)await p.evaluate(()=>document.getElementById('chok').click());await sim(10);
 T('finale',{done:q.save.done,chapterCard:chap});ok('four seals → the Wayfinder finale runs and the chapter card shows',q.save.done&&chap,{done:q.save.done,chap});}
await p.evaluate(()=>window.__vale.warp(30,20));await perkPick(); // back on the meadow, calm: any owed choices are offered
const pr=await P();const story=await p.evaluate(()=>window.__vale.story64());q=await Q();
T('end of Ch I play',{level:pr.level,xp:q.save.xp,perks:pr.perks,relics:pr.relics,relic:pr.relic,kstat:story.kstat,bossCards:story.bossLog.length});
ok('progression in play: level ≥ 6 with perks chosen at each due level (no grinding loops)',pr.level>=6&&pr.perks.length===[3,6,9,12].filter(l=>pr.level>=l).length,{level:pr.level,perks:pr.perks});
ok('no page errors in the Ch I play',errs.length===0,errs.slice(0,3));
fs.writeFileSync(process.env.SAVEOUT||'/tmp/m64h-ch1-save.json',await p.evaluate(()=>localStorage.getItem('vale3d-save')));await b.close();
// 6 · the full Chapter I + II story run on the same build (finale, Ch II cave, coast, sea cave, Keeper, Lamp, ending)
{const t0=Date.now();const r=spawnSync('node',['tools/qa-run.cjs'],{env:{...process.env,PORT},encoding:'utf8',timeout:2300000,maxBuffer:64<<20});const out=(r.stdout||'')+(r.stderr||'');
 fs.writeFileSync(process.env.RUNLOG||'/tmp/m64h-qa-run.log',out);const has=k=>out.includes(k);
 const marks={chapterCard:has('chapter card'),keeper:/Keeper/.test(out),lamp:/Lamp/i.test(out),errors:(out.match(/^errors (\[.*\])$/m)||[])[1]||null,crash:/^ERR |PAGE-CRASH/m.test(out)};
 T('qa-run (Ch I + II story)',{exit:r.status,sec:Math.round((Date.now()-t0)/1000),...marks});
 ok('the full Ch I + II story run completes on this build (exit 0, no page errors)',r.status===0&&marks.chapterCard&&marks.keeper&&marks.lamp&&marks.errors==='[]'&&!marks.crash,marks);}
fs.writeFileSync(process.env.OUT||'/tmp/m64h-playthrough.json',JSON.stringify(R,null,1));
console.log(`\nM64H playthrough: ${n-fails}/${n} PASS`);process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
