// M26 QA: the opening path — climb the ridge stair, cross the quarry stream on the stepping stones,
// and cross the three-pier bridge on its deck (never dropping into the water).
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const q=process.env.Q||'lite';const p=await b.newPage();await p.setViewport({width:412,height:860,isMobile:true,hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(e.message));
let fails=0;const ok=(n,c,v)=>{if(!c)fails++;console.log((c?'PASS ':'FAIL ')+n,JSON.stringify(v));};
await p.goto(`http://localhost:8090/?q=${q}&qa=1`,{waitUntil:'load'});await p.evaluate(()=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));});
await p.reload({waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(1500);
// walk from (x0,z0) toward (x1,z1): heading h = atan2(dx,dz), camera behind
const run=async(x0,z0,x1,z1,n)=>{const h=Math.atan2(x1-x0,z1-z0);await p.evaluate((x,z,h)=>{window.__vale.warp(x,z);window.__vale.view(h,h-Math.PI,0.15,6);window.__vale.sim(Array(10).fill(1/30),0,0);},x0,z0,h);
  const out=[];for(let i=0;i<n;i+=6){await p.evaluate(()=>window.__vale.sim(Array(6).fill(1/30),0,-1));const r=await p.evaluate(()=>window.__vale.hop());out.push([+r.px.toFixed(2),+r.pz.toFixed(2),+r.foot.toFixed(2)]);}return out;};
const jumps=t=>{let m=0;for(let i=1;i<t.length;i++)m=Math.max(m,t[i][2]-t[i-1][2]);return +m.toFixed(2);};
// 1 · ridge stair (x -34, z 51.6 → 63.2; ridge top ≈ 5.4)
let t=await run(-34,49.5,-34,66,330);const top=Math.max(...t.map(s=>s[2]));
ok('climb the ridge stair to the crest',Math.max(...t.map(s=>s[1]))>62.5&&top>4.4,{top,last:t[t.length-1],trace:t.filter((s,i)=>i%5===0)});
ok('ridge stair: no big vertical jumps',jumps(t)<0.9,{max:jumps(t)});
ok('ridge stair: stays on the treads',t.filter(s=>s[1]>52.5&&s[1]<62.5).every(s=>Math.abs(s[0]+34)<1.6),{});
// 2 · stepping stones where the quarry track crosses the stream
t=await run(-30.2,39.5,-32.8,48.5,200);const lo=Math.min(...t.filter(s=>s[1]>42&&s[1]<46).map(s=>s[2]));
ok('cross the stream on the stepping stones',Math.max(...t.map(s=>s[1]))>47&&lo>-0.5,{lo,last:t[t.length-1]});
// 3 · bridge over the creek on the Pale road (centre z -59.16, x -51.89)
t=await run(-42.5,-53.2,-61.7,-65.2,420);const mid=t.filter(s=>Math.hypot(s[0]+51.89,s[1]+59.16)<3);
ok('cross the bridge end to end',Math.min(...t.map(s=>s[1]))<-63.5,{last:t[t.length-1]});
ok('bridge deck holds the walker above the water',mid.length>0&&mid.every(s=>s[2]>0.25),{mid});
ok('bridge: no big vertical jumps',jumps(t)<0.9,{max:jumps(t)});
ok('no page errors',errs.length===0,errs.slice(0,3));
console.log(fails?`QA-OPENING FAIL ${fails}`:'QA-OPENING ALL PASS');await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(2);});
