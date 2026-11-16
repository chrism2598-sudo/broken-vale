// M37 glitch probe: walk the main routes with the stick (steering at each waypoint); flags stuck spots, sinks, big vertical pops and HP loss.
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const R={
 ridge:[[0,6],[-8,17],[-14,23],[-21,29],[-27,35],[-30.5,41],[-32.5,47],[-34,51],[-34,58],[-34,64]],
 castle:[[0,6],[-12,-12],[-25,-30],[-40,-48],[-46,-58],[-52,-64],[-60,-69],[-66,-71],[-70,-78],[-71.5,-88],[-73,-97],[-75,-101.9],[-77.5,-106],[-80,-110]],
 echo:[[0,6],[8,-12],[14,-30],[24,-38],[31.4,-40]],
 shrine:[[0,6],[-10,-15],[-18,-34],[-26,-40]],
 azure:[[0,6],[20,-20],[45,-60],[65,-90],[71,-96]],
 dome:[[0,6],[15,30],[35,50],[45.8,60]],
 sunspire:[[0,6],[-30,20],[-60,40],[-85,55],[-92.8,58]],
 veilfall:[[0,6],[-30,-25],[-60,-50],[-80,-66]],
};
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.setViewport({width:412,height:915,isMobile:true,hasTouch:true});
await p.evaluateOnNewDocument(()=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));});
await p.goto('http://localhost:8090/?q=lite&shot=spawn&tod=0.4',{waitUntil:'load',timeout:120000});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(3000);
for(const [name,pts] of Object.entries(process.argv[2]?{[process.argv[2]]:R[process.argv[2]]}:R)){
 const r=await p.evaluate((pts)=>{const V=window.__vale;V.warp(pts[0][0],pts[0][1]);V.sim(Array(10).fill(1/30),0,0);const out={stuck:[],sink:[],pop:[],reached:0,frames:0};let lastFoot=null;
  for(let w=1;w<pts.length;w++){const [tx,tz]=pts[w];let best=1e9,since=0;
   for(let it=0;it<400;it++){const st=V.camInfo().st;const dx=tx-st.px,dz=tz-st.pz,d=Math.hypot(dx,dz);if(d<1.2){out.reached++;break;}
    if(d<best-0.25){best=d;since=0;}else since++; if(since>40){out.stuck.push([+st.px.toFixed(1),+st.pz.toFixed(1),'->',tx,tz]);break;}
    const h=Math.atan2(dx,dz);V.view(h,h-Math.PI,0.15,6);V.sim([1/30,1/30,1/30],0,-1);out.frames+=3;
    const s2=V.camInfo().st;const q=V.footProbe(s2.px,s2.pz);const hp=V.hop();
    if(q&&!q.blocked&&q.top!=null&&!hp.air&&q.top-hp.foot>0.3)out.sink.push([+s2.px.toFixed(1),+s2.pz.toFixed(1),+(q.top-hp.foot).toFixed(2)]);
    if(lastFoot!==null&&Math.abs(hp.foot-lastFoot)>0.7)out.pop.push([+s2.px.toFixed(1),+s2.pz.toFixed(1),+(hp.foot-lastFoot).toFixed(2)]);lastFoot=hp.foot;}}
  out.stuck=out.stuck.slice(0,6);out.sink=out.sink.slice(0,6);out.pop=out.pop.slice(0,6);return out;},pts);
 console.log(name,(r.reached===pts.length-1&&!r.stuck.length&&!r.sink.length&&!r.pop.length)?'OK':'CHECK',JSON.stringify(r));}
console.log('errors',JSON.stringify(errs.slice(0,5)));await b.close();})().catch(e=>{console.error(e);process.exit(1);});
