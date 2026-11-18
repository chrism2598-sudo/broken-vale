// M44: env YS (comma list, default 0,4.5), PEACE=1 clears sentinels; x spans the whole keep. M40 castle camera probe: sweep positions x 8 yaws in the keep, record camera boom length + height (Lite portrait).
const pc=require(process.env.PUPPETEER_CORE);const sleep=t=>new Promise(r=>setTimeout(r,t));
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:412,height:915,isMobile:true,hasTouch:true});
await p.evaluateOnNewDocument(()=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));});
await p.goto('http://localhost:8090/?q=lite&shot='+(process.env.SHOT||'m20-hall'),{waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(1500);
const r=await p.evaluate((YS,PEACE)=>{const V=window.__vale,out={},raw=[];const ys=YS.split(',').map(Number);if(PEACE&&V.castlePeace)V.castlePeace();
 for(const ly of ys)for(let x=-14.75;x<=14.75;x+=0.75)for(let z=-17.75;z<=9.5;z+=0.75){if(V.castleWalk&&!V.castleWalk(x,z,ly))continue;V.castleAt(x,z,ly,0);const c0=V.castle();if(!c0.room||Math.abs(c0.y-ly)>0.3)continue;
  for(let k=0;k<8;k++){const f=k*Math.PI/4;V.castleAt(x,z,ly,f);V.sim(Array(6).fill(1/30),0,0);const ci=V.camInfo();const pl=ci.player,cm=ci.cam;const d=Math.hypot(cm[0]-pl[0],cm[1]-(pl[1]+1.42),cm[2]-pl[2]);const room=V.castle().room+(ly>1?'@up':ly<-1?'@down':'');(out[room]=out[room]||[]).push(d);if(d<2.6)raw.push([room,x,z,ly,k,+d.toFixed(2),+(cm[1]-pl[1]).toFixed(2)]);}}
 const sum={};for(const[k,a]of Object.entries(out)){a.sort((x,y)=>x-y);sum[k]={n:a.length,min:+a[0].toFixed(2),p10:+a[Math.floor(a.length*.1)].toFixed(2),med:+a[Math.floor(a.length/2)].toFixed(2),under2_6:a.filter(v=>v<2.6).length}}return {sum,raw:raw};},process.env.YS||'0,4.5',!!process.env.PEACE);
console.log(JSON.stringify(r.sum));require('fs').writeFileSync(process.env.RAW||'/tmp/camraw.json',JSON.stringify(r.raw));console.log('raw',r.raw.length);await b.close()})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
