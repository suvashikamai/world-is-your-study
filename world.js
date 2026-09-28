/* ============ 3D isometric world (Three.js r147, lazy-loaded) ============ */
const World = (() => {
  let T, renderer, scene, camera, controls, host, canvas;
  let running=false, raf=0, ready=false, hi=true;
  let opts={gfx:'auto', dayMode:'real', weather:'auto'};
  let n=12, city=null, cityKey='', terrainKey='', editable=false;
  const known=new Set();
  let land, terrain, cityGroup, fxGroup, npcGroup, gridHelper, selBox;
  let sun, hemi, amb;
  const M={}; // material cache
  let winMat, lampMat, glowMat, headMat, tailMat, waterMat, smokeMat;
  const anims=[]; // {obj, fn}
  const lampSprites=[];
  let cars=[], walkers=[], planes=[], ships=[], puffs=[];
  let rain=null, snow=null, clouds=[], flash=0;
  let placing=null, ghost=null;
  let bIndex=new Map(); // u -> {group, b}
  let t0=performance.now(), lastT=performance.now();
  let wxNow='';

  const mat = (col, o={}) => { const k=col+JSON.stringify(o); if(!M[k]) M[k]=new T.MeshLambertMaterial(Object.assign({color:col},o)); return M[k]; };
  function mesh(geo, m, x=0,y=0,z=0){ const me=new T.Mesh(geo, typeof m==='string'?mat(m):m); me.position.set(x,y,z); return me; }
  const box=(w,h,d,c,x=0,y=0,z=0)=>mesh(new T.BoxGeometry(w,h,d),c,x,y+h/2,z);
  const cyl=(rt,rb,h,c,x=0,y=0,z=0,seg=12)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),c,x,y+h/2,z);
  const sph=(r,c,x=0,y=0,z=0,seg=10)=>mesh(new T.SphereGeometry(r,seg,Math.max(6,seg-2)),c,x,y,z);
  const cone=(r,h,c,x=0,y=0,z=0,seg=8)=>mesh(new T.ConeGeometry(r,h,seg),c,x,y+h/2,z);

  function init(){
    T=THREE;
    hi = opts.gfx==='high' || (opts.gfx==='auto' && !(/Mobi|Android/i.test(navigator.userAgent) && (navigator.hardwareConcurrency||4)<6));
    renderer=new T.WebGLRenderer({antialias:hi, powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1, hi?2:1.25));
    renderer.shadowMap.enabled=hi; renderer.shadowMap.type=T.PCFSoftShadowMap;
    renderer.outputEncoding=T.sRGBEncoding;
    canvas=renderer.domElement;
    scene=new T.Scene(); scene.fog=new T.Fog(0x8fc6e8, 60, 160);
    camera=new T.OrthographicCamera(-10,10,10,-10,0.1,400);
    camera.position.set(40,38,40); camera.lookAt(0,0,0);
    controls=new T.OrbitControls(camera, canvas);
    controls.enableDamping=true; controls.dampingFactor=0.1; controls.screenSpacePanning=false;
    controls.minPolarAngle=0.45; controls.maxPolarAngle=1.18; controls.minZoom=0.45; controls.maxZoom=5;
    controls.touches={ONE:T.TOUCH.PAN, TWO:T.TOUCH.DOLLY_ROTATE};
    controls.mouseButtons={LEFT:T.MOUSE.ROTATE, MIDDLE:T.MOUSE.DOLLY, RIGHT:T.MOUSE.PAN};
    hemi=new T.HemisphereLight(0xdff2ff, 0x4d6b3a, 0.55); scene.add(hemi);
    amb=new T.AmbientLight(0x3050a0, 0.0); scene.add(amb);
    sun=new T.DirectionalLight(0xffffff, 0.9); sun.position.set(30,50,20);
    if(hi){ sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.bias=-0.0008; sun.shadow.normalBias=0.02; }
    scene.add(sun); scene.add(sun.target);
    winMat=new T.MeshLambertMaterial({color:0x2b3f55, emissive:0xffd27a, emissiveIntensity:0});
    lampMat=new T.MeshLambertMaterial({color:0xfff2c4, emissive:0xffe19a, emissiveIntensity:0});
    headMat=new T.MeshLambertMaterial({color:0xffffff, emissive:0xfff6d0, emissiveIntensity:0});
    tailMat=new T.MeshLambertMaterial({color:0x991111, emissive:0xff2020, emissiveIntensity:0});
    waterMat=new T.MeshLambertMaterial({color:0x3f8fc9, transparent:true, opacity:0.92});
    smokeMat=new T.MeshLambertMaterial({color:0xdadada, transparent:true, opacity:0.55});
    const gc=document.createElement('canvas'); gc.width=gc.height=64; const g=gc.getContext('2d'); const gr=g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,'rgba(255,230,160,1)'); gr.addColorStop(1,'rgba(255,210,120,0)'); g.fillStyle=gr; g.fillRect(0,0,64,64);
    glowMat=new T.SpriteMaterial({map:new T.CanvasTexture(gc), transparent:true, depthWrite:false, blending:T.AdditiveBlending, opacity:0});
    cityGroup=new T.Group(); fxGroup=new T.Group(); npcGroup=new T.Group(); scene.add(cityGroup, fxGroup, npcGroup);
    // pointer handling: tap vs drag
    let down=null;
    canvas.addEventListener('pointerdown', e=>{ down={x:e.clientX,y:e.clientY,t:performance.now()}; });
    canvas.addEventListener('pointermove', e=>{ if(placing && e.pointerType==='mouse' && !(e.buttons&1)) moveGhostTo(e); });
    canvas.addEventListener('pointerup', e=>{ if(!down) return; const dx=e.clientX-down.x, dy=e.clientY-down.y; const tap=dx*dx+dy*dy<64 && performance.now()-down.t<500; down=null; if(tap) onTap(e); });
    new ResizeObserver(()=>resize()).observe(canvas);
    document.addEventListener('visibilitychange', ()=>{ if(document.hidden) stop(); else if(running) loop(); });
    ready=true; World.ready=true;
  }
  function resize(){ if(!renderer||!host) return; const w=host.clientWidth||600, h=host.clientHeight||400; renderer.setSize(w,h,false); const a=w/h; const v=n*0.45; camera.left=-v*a; camera.right=v*a; camera.top=v; camera.bottom=-v; camera.updateProjectionMatrix(); }
  function mount(el){ host=el; if(!ready) init(); if(canvas.parentNode!==el){ el.innerHTML=''; el.appendChild(canvas); } resize(); }

  /* ---------- tile math ---------- */
  const fp=(d,r)=> (r%2)?[d.d,d.w]:[d.w,d.d];
  const tileCenter=(x,z,fw,fd)=>[x+fw/2-n/2, z+fd/2-n/2];
  function tileAt(e){
    const r=canvas.getBoundingClientRect(); const v=new T.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
    const rc=new T.Raycaster(); rc.setFromCamera(v,camera); const p=new T.Vector3();
    if(!rc.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),p)) return null;
    return {x:Math.floor(p.x+n/2), z:Math.floor(p.z+n/2)};
  }
  function buildingAtTile(tx,tz){
    for(const [u,o] of bIndex){ const b=o.b, d=BMAP[b.id]; if(!d) continue; const [fw,fd]=fp(d,b.r||0); if(tx>=b.x&&tx<b.x+fw&&tz>=b.z&&tz<b.z+fd) return b; }
    return null;
  }

  /* ---------- models ---------- */
  function winBands(g, w, d, floors, fh, y0=0, inset=0.02){ for(let i=0;i<floors;i++){ const b=box(w+inset*2, fh*0.38, d+inset*2, winMat, 0, y0+i*fh+fh*0.3, 0); g.add(b);} }
  function tree(g,x,z,s=1,gold){ g.add(cyl(0.05*s,0.07*s,0.28*s,'#7a5230',x,0,z,6)); g.add(cone(0.28*s,0.55*s,gold?'#f5c542':'#3f8f4a',x,0.22*s,z,7)); g.add(cone(0.2*s,0.4*s,gold?'#ffe08a':'#4fa85a',x,0.5*s,z,7)); }
  function carMesh(col){ const g=new T.Group(); g.add(box(0.34,0.12,0.18,col,0,0.04,0)); g.add(box(0.18,0.1,0.16,'#cfe3f2',-0.02,0.16,0)); const h1=box(0.02,0.04,0.04,headMat,0.18,0.07,0.05), h2=box(0.02,0.04,0.04,headMat,0.18,0.07,-0.05); const t1=box(0.02,0.04,0.04,tailMat,-0.18,0.07,0.05), t2=box(0.02,0.04,0.04,tailMat,-0.18,0.07,-0.05); g.add(h1,h2,t1,t2); return g; }
  function planeMesh(col='#f4f7fa'){ const g=new T.Group(); const f=cyl(0.09,0.09,1.1,col,0,0,0,8); f.rotation.z=Math.PI/2; f.position.y=0.09; g.add(f); g.add(box(0.28,0.03,1.2,col,0,0.08,0)); g.add(box(0.12,0.25,0.03,'#e63946',-0.5,0.12,0)); g.add(box(0.14,0.02,0.45,col,-0.5,0.12,0)); return g; }
  function flagMesh(g, col, x, z, h=1.1){ g.add(cyl(0.025,0.025,h,'#dfe6ec',x,0,z,6)); const f=box(0.02,0.22,0.36,col,x,h-0.24,z+0.19); f.userData.anim='flag'; g.add(f); }

  function buildModel(d, b){
    const g=new T.Group(); const m=d.m; const W=d.w, D=d.d;
    const slab=(col,h=0.04)=>g.add(box(W*0.98,h,D*0.98,col,0,0,0));
    switch(m.k){
      case 'house': { const s=m.s, h=m.h; g.add(box(s,h,s*0.9,m.col)); const r=cone(s*0.78,0.42*s+0.15,m.roof,0,h,0,4); r.rotation.y=Math.PI/4; g.add(r); g.add(box(0.14,0.24,0.02,'#6b4226',0,0,s*0.45+0.01)); g.add(box(0.14,0.12,0.02,winMat,s*0.26,h*0.45,s*0.45+0.01)); g.add(box(0.14,0.12,0.02,winMat,-s*0.26,h*0.45,s*0.45+0.01)); g.add(box(0.1,0.2,0.1,'#8a8a8a',s*0.25,h+0.1,-s*0.1)); break; }
      case 'villa': { slab('#9ccf7e'); g.add(box(0.6,0.42,0.42,m.col,-0.12,0,-0.18)); g.add(box(0.36,0.3,0.36,m.col,0.22,0,0.05)); g.add(box(0.66,0.04,0.48,m.roof,-0.12,0.42,-0.18)); winBands(g,0.6,0.42,1,0.42,0); const p=box(0.34,0.03,0.22,waterMat,-0.18,0.02,0.3); g.add(p); break; }
      case 'block': { const fl=m.fl, fh=0.34, w=W*0.84, dd=D*0.8; g.add(box(w,fl*fh,dd,m.col)); winBands(g,w,dd,fl,fh); g.add(box(w+0.04,0.05,dd+0.04,'#5a6570',0,fl*fh,0));
        if(m.awn) g.add(box(w*0.9,0.04,0.16,m.awn,0,fh*0.75,dd/2+0.08));
        if(m.sign) g.add(box(w*0.5,0.14,0.04,m.sign,0,fl*fh-0.02,dd/2+0.02));
        if(m.cross){ g.add(box(0.26,0.06,0.06,'#e63946',0,fl*fh+0.05,0)); g.add(box(0.06,0.06,0.26,'#e63946',0,fl*fh+0.05,0)); g.add(box(0.06,0.2,0.06,'#e63946',0,fl*fh+0.05,0)); }
        break; }
      case 'tower': { const fl=m.fl, fh=0.3, s=m.s*(W>1?1:1); g.add(box(s+0.1,0.12,s+0.1,'#8894a0')); g.add(box(s,fl*fh,s,m.col,0,0.12,0)); winBands(g,s,s,fl,fh,0.12); g.add(box(s*0.5,0.18,s*0.5,'#77838f',0,0.12+fl*fh,0)); if(fl>8){ const a=cyl(0.02,0.02,0.6,'#cccccc',0,0.3+fl*fh,0,5); g.add(a); const bl=sph(0.04,lampMat,0,0.9+fl*fh,0,6); g.add(bl);} if(m.cross){ g.add(box(0.4,0.08,0.1,'#e63946',0,0.2+fl*fh,0)); g.add(box(0.1,0.08,0.4,'#e63946',0,0.2+fl*fh,0)); } break; }
      case 'civic': { const k=m.big?1.7:1; g.add(box(0.9*k,0.08,0.8*k,'#d8d2c2')); g.add(box(0.84*k,0.06,0.74*k,'#e8e3d6',0,0.08,0)); g.add(box(0.7*k,0.5*k,0.5*k,m.col,0,0.14,-0.06*k)); for(let i=0;i<5;i++) g.add(cyl(0.03*k,0.03*k,0.46*k,'#f7f4ec',-0.3*k+i*0.15*k,0.14,0.26*k,6)); g.add(box(0.8*k,0.08,0.62*k,'#cdc6b3',0,0.14+0.5*k,0)); const r=cone(0.5*k,0.2*k,'#b9b09a',0,0.22+0.5*k,0,4); r.rotation.y=Math.PI/4; r.scale.z=0.75; g.add(r); if(m.big) flagMesh(g,'#f5bf4f',0,0.4,0.6+1.1); break; }
      case 'campus': { slab('#86c06c'); g.add(box(0.7,0.7,0.5,m.col,-0.55,0,-0.55)); winBands(g,0.7,0.5,2,0.35); g.add(box(0.5,0.55,0.9,m.col,0.6,0,-0.3)); g.add(box(0.8,0.45,0.4,'#c9835f',0.1,0,0.65)); g.add(box(0.24,1.5,0.24,'#e8d9c0',-0.55,0,0.45)); g.add(cone(0.22,0.3,'#7a3b2e',-0.55,1.5,0.45,4)); g.add(box(0.14,0.14,0.02,'#ffffff',-0.55,1.25,0.58)); tree(g,0.2,-0.2,0.9); tree(g,-0.05,0.2,0.8); break; }
      case 'dome': { const k=W>1?1.7:1; g.add(cyl(0.45*k,0.45*k,0.4*k,m.col,0,0,0,20)); winBands(g,0,0,0,0); const dm=mesh(new T.SphereGeometry(0.42*k,20,12,0,Math.PI*2,0,Math.PI/2),'#dfe8ee',0,0.4*k,0); g.add(dm); g.add(box(0.9*k,0.06,0.2,winMat,0,0.18*k,0)); break; }
      case 'road': { g.add(box(1,0.03,1,'#3b4148')); const nb=b&&b._nb||{}; const dash='#f2d16b'; g.add(box(0.12,0.035,0.12,dash,0,0,0)); if(nb.n) g.add(box(0.06,0.035,0.4,dash,0,0,-0.3)); if(nb.s) g.add(box(0.06,0.035,0.4,dash,0,0,0.3)); if(nb.e) g.add(box(0.4,0.035,0.06,dash,0.3,0,0)); if(nb.w) g.add(box(0.4,0.035,0.06,dash,-0.3,0,0)); g.add(box(1,0.04,0.06,'#aab3bb',0,0,0.47)); g.add(box(1,0.04,0.06,'#aab3bb',0,0,-0.47)); break; }
      case 'rail': { g.add(box(1,0.04,0.7,'#8a7f73')); for(let i=0;i<5;i++) g.add(box(0.08,0.03,0.6,'#6b4a2b',-0.4+i*0.2,0.04,0)); g.add(box(1,0.04,0.03,'#c0c6cc',0,0.07,0.15)); g.add(box(1,0.04,0.03,'#c0c6cc',0,0.07,-0.15)); break; }
      case 'lamp': { g.add(cyl(0.025,0.035,0.8,'#44505c',0,0,0,6)); g.add(box(0.16,0.03,0.04,'#44505c',0.06,0.78,0)); g.add(sph(0.05,lampMat,0.12,0.74,0,8)); const sp=new T.Sprite(glowMat); sp.scale.set(1.2,1.2,1); sp.position.set(0.12,0.6,0); sp.userData.glow=1; g.add(sp); break; }
      case 'bench': { g.add(box(0.4,0.04,0.14,'#8b5a2b',0,0.14,0)); g.add(box(0.4,0.12,0.03,'#8b5a2b',0,0.18,-0.06)); g.add(box(0.03,0.14,0.12,'#333',-0.17,0,0)); g.add(box(0.03,0.14,0.12,'#333',0.17,0,0)); break; }
      case 'flowers': { g.add(box(0.7,0.08,0.7,'#6b4a2b')); const cols=['#ff6b9a','#ffd166','#c792ff','#ff7d5c','#ffffff']; for(let i=0;i<14;i++){ const a=i*2.4, r=0.1+(i%4)*0.07; g.add(sph(0.055,cols[i%5],Math.cos(a)*r,0.12,Math.sin(a)*r,6)); } break; }
      case 'flag': { g.add(box(0.3,0.06,0.3,'#aab3bb')); flagMesh(g,(city&&city.flag)||'#f5bf4f',0,0); break; }
      case 'fountain': { g.add(cyl(0.42,0.45,0.12,'#c8cdd2',0,0,0,18)); g.add(cyl(0.36,0.36,0.02,waterMat,0,0.1,0,18)); g.add(cyl(0.06,0.08,0.3,'#c8cdd2',0,0.1,0,8)); const w=cone(0.12,0.25,waterMat,0,0.35,0,10); w.userData.anim='bob'; g.add(w); break; }
      case 'statue': { g.add(box(0.36,0.3,0.36,m.gold?'#f5c542':'#bdb5a6')); g.add(cyl(0.07,0.09,0.36,m.gold?'#ffd166':'#9aa3ab',0,0.3,0,8)); g.add(sph(0.07,m.gold?'#ffd166':'#9aa3ab',0,0.74,0,8)); if(m.gold) g.add(cyl(0.16,0.06,0.18,'#f5c542',0,0.82,0,10)); else g.add(box(0.2,0.14,0.03,'#e8e0cc',0.1,0.5,0.08)); break; }
      case 'tree': tree(g,0,0,1.3,m.gold); break;
      case 'lighthouse': { g.add(cyl(0.3,0.36,0.1,'#aab3bb')); for(let i=0;i<5;i++) g.add(cyl(0.2-i*0.02,0.22-i*0.02,0.28,i%2?'#e63946':'#ffffff',0,0.1+i*0.28,0,12)); g.add(cyl(0.14,0.14,0.18,lampMat,0,1.5,0,10)); g.add(cone(0.18,0.2,'#e63946',0,1.68,0,10)); const sp=new T.Sprite(glowMat); sp.scale.set(2.4,2.4,1); sp.position.set(0,1.6,0); sp.userData.glow=1; g.add(sp); break; }
      case 'busstop': { g.add(box(0.8,0.03,0.4,'#aab3bb')); g.add(box(0.6,0.03,0.25,'#4f8fbf',0,0.45,0)); g.add(box(0.03,0.45,0.03,'#666',-0.28,0,-0.1)); g.add(box(0.03,0.45,0.03,'#666',0.28,0,-0.1)); g.add(box(0.5,0.3,0.02,'#bfe2f5',0,0.1,-0.12)); g.add(cyl(0.02,0.02,0.6,'#666',0.38,0,0.12,5)); g.add(box(0.12,0.12,0.02,'#2a9d8f',0.38,0.55,0.12)); break; }
      case 'parking': { g.add(box(0.98,0.03,0.98,'#4b525a')); for(let i=0;i<4;i++) g.add(box(0.03,0.035,0.3,'#e8e8e8',-0.36+i*0.24,0,-0.28)); const c1=carMesh('#e63946'); c1.rotation.y=Math.PI/2; c1.position.set(-0.24,0.03,-0.28); g.add(c1); const c2=carMesh('#2a9d8f'); c2.rotation.y=Math.PI/2; c2.position.set(0.24,0.03,-0.28); g.add(c2); break; }
      case 'station': { slab('#aab3bb'); g.add(box(W*0.7,0.55,0.5,m.col,0,0,-0.18)); winBands(g,W*0.7,0.5,1,0.55); g.add(box(W*0.9,0.04,0.35,'#d0d6dc',0,0.5,0.28)); for(let i=0;i<4;i++) g.add(box(0.03,0.5,0.03,'#666',-W*0.4+i*W*0.27,0,0.4)); g.add(box(0.2,0.8,0.2,m.col,W*0.3,0,-0.25)); g.add(box(0.16,0.16,0.02,'#ffffff',W*0.3,0.6,-0.14)); break; }
      case 'airport': { slab(m.mil?'#7d8a6a':'#8f99a3'); g.add(box(W*0.95,0.045,0.5,'#3b4148',0,0,-0.9)); for(let i=0;i<7;i++) g.add(box(0.24,0.05,0.05,'#ffffff',-1.2+i*0.4,0,-0.9)); g.add(box(1.4,0.45,0.6,m.mil?'#5f6b4e':'#cfd8e0',-0.5,0,0.7)); winBands(g,1.4,0.6,1,0.45); g.add(cyl(0.12,0.14,1.3,'#dfe6ec',0.9,0,0.8,10)); g.add(cyl(0.22,0.18,0.22,'#4f8fbf',0.9,1.3,0.8,10)); const p=planeMesh(m.mil?'#7f8a93':'#f4f7fa'); p.position.set(0.5,0.05,0.05); p.rotation.y=0.3; g.add(p); if(m.mil){ for(let i=0;i<2;i++){ g.add(box(0.7,0.4,0.55,'#5f6b4e',-1.0+i*0.8,0,-0.05)); } } break; }
      case 'market': { slab('#c9b08a'); const cols=['#e63946','#f4a261','#2a9d8f','#e9c46a']; for(let i=0;i<4;i++){ const x=(i%2)*0.44-0.22, z=Math.floor(i/2)*0.44-0.22; g.add(box(0.3,0.18,0.3,'#8b5a2b',x,0,z)); const r=cone(0.26,0.16,cols[i],x,0.3,z,4); r.rotation.y=Math.PI/4; g.add(r); for(let k=0;k<4;k++) g.add(cyl(0.012,0.012,0.3,'#555',x+(k%2?0.13:-0.13),0,z+(k<2?0.13:-0.13),4)); } break; }
      case 'kiosk': { g.add(box(0.36,0.46,0.3,'#2a6f97')); g.add(box(0.24,0.16,0.02,winMat,0,0.24,0.16)); g.add(box(0.4,0.06,0.34,'#f5bf4f',0,0.46,0)); break; }
      case 'shed': { const w=W*0.9, dd=D*0.86; g.add(box(w,0.42,dd,m.col)); const r=mesh(new T.CylinderGeometry(dd/2,dd/2,w,12,1,false,0,Math.PI),'#a5b1bd',0,0.42,0); r.rotation.z=Math.PI/2; r.scale.x=0.45; g.add(r); g.add(box(w*0.4,0.3,0.02,'#56606a',0,0,dd/2+0.01)); break; }
      case 'factory': { const k=m.big?1.7:1; g.add(box(0.8*k,0.5,0.6*k,m.col,-0.05*k,0,0.1*k)); winBands(g,0.8*k,0.6*k,1,0.5); for(let i=0;i<3;i++){ const r=box(0.26*k,0.16,0.6*k,'#8d99ae',-0.3*k+i*0.26*k,0.5,0.1*k); g.add(r); }
        if(m.cool){ g.add(cyl(0.3*k,0.4*k,0.9*k,'#d6dadf',0.25*k,0,-0.25*k,16)); }
        else { g.add(cyl(0.06*k,0.08*k,1.1*k,'#6d6d6d',0.28*k,0,-0.25*k,8)); g.add(cyl(0.05*k,0.07*k,0.9*k,'#6d6d6d',0.12*k,0,-0.3*k,8)); }
        g.userData.smoke={x:m.cool?0.25*k:0.28*k, y:m.cool?0.95*k:1.15*k, z:-0.25*k}; break; }
      case 'farm': { g.add(box(W*0.98,0.05,D*0.98,'#7a5a3a')); const rows=Math.round(6*W); for(let i=0;i<rows;i++) g.add(box(0.06,0.1,D*0.8,m.crop,-W*0.42+i*(W*0.84/(rows-1)),0.05,0.05)); g.add(box(0.26,0.26,0.24,'#b33a2c',W*0.32,0.05,-D*0.34)); const r=cone(0.22,0.14,'#5b2a1e',W*0.32,0.31,-D*0.34,4); r.rotation.y=Math.PI/4; g.add(r); break; }
      case 'greenhouse': { g.add(box(0.9,0.04,0.8,'#8a7f73')); const gl=new T.MeshLambertMaterial({color:0xcff5e7, transparent:true, opacity:0.55}); g.add(box(0.8,0.4,0.66,gl,0,0.04,0)); const r=cone(0.58,0.22,gl,0,0.44,0,4); r.rotation.y=Math.PI/4; r.scale.z=0.8; g.add(r); for(let i=0;i<3;i++) g.add(box(0.7,0.1,0.1,'#4fa85a',0,0.06,-0.2+i*0.2)); break; }
      case 'silo': { g.add(cyl(0.18,0.18,0.9,'#d9dde1',-0.18,0,0,12)); g.add(sph(0.18,'#b8bfc6',-0.18,0.9,0,12)); g.add(cyl(0.14,0.14,0.7,'#d9dde1',0.22,0,0.1,12)); g.add(sph(0.14,'#b8bfc6',0.22,0.7,0.1,12)); break; }
      case 'tank': { const low=m.low; for(const [x,z] of [[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]]) g.add(box(0.04,low?0.3:0.7,0.04,'#6b7680',x,0,z)); g.add(cyl(0.3,0.3,0.4,m.col,0,low?0.3:0.7,0,16)); g.add(cone(0.32,0.14,'#8894a0',0,low?0.7:1.1,0,16)); break; }
      case 'solar': { g.add(box(0.96,0.03,0.96,'#9aa56f')); for(let i=0;i<3;i++) for(let j=0;j<2;j++){ const p=box(0.26,0.02,0.36,'#1f3b73',-0.3+i*0.3,0.12,-0.2+j*0.42); p.rotation.x=-0.5; g.add(p); g.add(box(0.02,0.12,0.02,'#666',-0.3+i*0.3,0,-0.2+j*0.42)); } break; }
      case 'gas': { g.add(box(0.96,0.03,0.96,'#8f99a3')); g.add(box(0.8,0.05,0.5,'#e63946',0,0.5,0.1)); for(const x of [-.3,.3]) g.add(box(0.05,0.5,0.05,'#ddd',x,0,0.1)); for(const x of [-.15,.15]) g.add(box(0.1,0.22,0.08,'#f5bf4f',x,0,0.1)); g.add(box(0.4,0.3,0.26,'#f4f6f8',0,0,-0.3)); break; }
      case 'antenna': { g.add(box(0.3,0.08,0.3,'#8894a0')); g.add(mesh(new T.CylinderGeometry(0.03,0.16,1.8,4),'#c9cfd5',0,0.98,0)); g.add(sph(0.05,lampMat,0,1.9,0,6)); const dish=mesh(new T.SphereGeometry(0.16,12,6,0,Math.PI*2,0,Math.PI/2.5),'#ffffff',0.08,1.1,0); dish.rotation.z=-1.2; g.add(dish); break; }
      case 'wind': { g.add(cyl(0.03,0.06,1.6,'#f1f4f7',0,0,0,8)); g.add(box(0.14,0.1,0.1,'#f1f4f7',0,1.6,0.03)); const bl=new T.Group(); for(let i=0;i<3;i++){ const b1=box(0.05,0.7,0.02,'#ffffff',0,0,0); b1.position.y=0.35; const arm=new T.Group(); arm.add(b1); arm.rotation.z=i*Math.PI*2/3; bl.add(arm);} bl.position.set(0,1.65,0.1); bl.userData.anim='spin'; g.add(bl); break; }
      case 'park': { g.add(box(W*0.98,0.05,D*0.98,'#7cc46a')); g.add(box(0.14,0.055,0.98,'#d9c9a3',0,0,0)); if(m.play){ g.add(box(0.26,0.3,0.06,'#ff7d5c',-0.28,0.05,-0.2)); g.add(box(0.06,0.04,0.36,'#ffd166',-0.28,0.2,0.0)); g.add(box(0.03,0.35,0.03,'#58d0e8',0.22,0.05,-0.25)); g.add(box(0.03,0.35,0.03,'#58d0e8',0.22,0.05,0.2)); g.add(box(0.03,0.03,0.48,'#58d0e8',0.22,0.4,-0.02)); } else { tree(g,-0.28,-0.25,0.8); tree(g,0.3,0.26,0.9); tree(g,0.28,-0.3,0.7); g.add(box(0.26,0.04,0.08,'#8b5a2b',-0.25,0.14,0.25)); } break; }
      case 'stadium': { g.add(box(2.9,0.04,2.9,'#8f99a3')); const outer=cyl(1.35,1.4,0.55,'#dfe6ec',0,0,0,28); outer.scale.z=0.78; g.add(outer); const inner=cyl(1.05,1.05,0.56,'#3a7d44',0,0.02,0,28); inner.scale.z=0.7; g.add(inner); g.add(box(1.2,0.575,0.02,'#ffffff',0,0.01,0)); for(const [x,z] of [[-1.25,-1],[1.25,-1],[-1.25,1],[1.25,1]]){ g.add(cyl(0.03,0.04,1.3,'#9aa3ab',x,0,z,6)); g.add(box(0.26,0.12,0.06,lampMat,x,1.3,z)); } break; }
      case 'base': { g.add(box(2.9,0.04,2.9,'#7d8a6a')); for(const s of [-1,1]){ g.add(box(2.9,0.18,0.03,'#9aa3ab',0,0.04,s*1.43)); g.add(box(0.03,0.18,2.9,'#9aa3ab',s*1.43,0.04,0)); } for(let i=0;i<3;i++) g.add(box(0.7,0.35,0.36,m.col,-0.8+i*0.8,0.04,-0.8)); for(let i=0;i<3;i++){ const tx=-0.7+i*0.6; g.add(box(0.36,0.14,0.22,'#556b2f',tx,0.04,0.55)); g.add(cyl(0.08,0.08,0.08,'#4b5d2a',tx,0.18,0.55,8)); const barrel=cyl(0.02,0.02,0.3,'#3d4a22',tx+0.15,0.22,0.55,5); barrel.rotation.z=Math.PI/2; g.add(barrel);} flagMesh(g,'#ff7d5c',1.1,1.1); break; }
      case 'harbor': { g.add(box(2.95,0.04,1.95,waterMat)); g.add(box(2.9,0.12,0.5,'#9aa3ab',0,0,-0.72)); g.add(box(0.3,0.1,1.2,'#8b7355',0.8,0,0.1)); for(const [x,l,c] of [[-0.5,1.2,'#5b6770'],[0.3,0.8,'#5b6770']]){ g.add(box(l,0.18,0.3,c,x,0.02,0.45)); g.add(box(l*0.3,0.2,0.2,'#dfe6ec',x-l*0.1,0.2,0.45)); } g.add(box(0.06,0.9,0.06,'#f5bf4f',-1.2,0.1,-0.72)); g.add(box(0.7,0.06,0.06,'#f5bf4f',-0.9,0.95,-0.72)); break; }
      default: g.add(box(0.8,0.4,0.8,'#cccccc'));
    }
    return g;
  }
  function townHall(th){
    const g=new T.Group(); const k=1+Math.min(th,12)*0.04;
    g.add(box(1.96,0.06,1.96,'#d8d2c2'));
    g.add(box(1.5*k,0.35+th*0.06,1.2*k,'#efe7d4',0,0.06,-0.1));
    winBands(g,1.5*k,1.2*k,Math.max(1,Math.floor((0.35+th*0.06)/0.34)),0.34,0.06);
    const top=0.41+th*0.06;
    for(let i=0;i<6;i++) g.add(cyl(0.035,0.035,top-0.06,'#fbf8f0',-0.62*k+i*0.25*k,0.06,0.55*k,6));
    g.add(box(1.6*k,0.08,1.35*k,'#c9bfa6',0,top,-0.05));
    if(th>=4) { g.add(cyl(0.3*k,0.34*k,0.25,'#efe7d4',0,top+0.08,-0.1,16)); g.add(mesh(new T.SphereGeometry(0.32*k,16,10,0,Math.PI*2,0,Math.PI/2),th>=8?'#f5c542':'#6fa3c7',0,top+0.33,-0.1)); }
    else { const r=cone(1.0*k,0.4,'#b0533f',0,top+0.08,-0.05,4); r.rotation.y=Math.PI/4; r.scale.z=0.85; g.add(r); }
    if(th>=7){ g.add(box(0.28,1.0+th*0.05,0.28,'#e3dac4',0.75*k,0.06,-0.55*k)); g.add(cone(0.2,0.3,'#6fa3c7',0.75*k,1.06+th*0.05,-0.55*k,4)); }
    flagMesh(g,(city&&city.flag)||'#f5bf4f',-0.75*k,0.7*k,top+0.6);
    return g;
  }
  // merge static meshes per material to cut draw calls
  function optimise(g){
    if(!T.BufferGeometryUtils) return g;
    g.updateMatrixWorld(true);
    const buckets=new Map(), keep=[];
    g.traverse(o=>{ if(o.isMesh && !o.userData.anim && !hasAnimAncestor(o,g)){ const arr=buckets.get(o.material)||[]; const geo=o.geometry.index? o.geometry.toNonIndexed() : o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); ['uv','uv2'].forEach(a=>geo.deleteAttribute(a)); arr.push(geo); buckets.set(o.material,arr); } });
    const out=new T.Group();
    buckets.forEach((geos,m)=>{ const merged=T.BufferGeometryUtils.mergeBufferGeometries(geos,false); if(merged){ const me=new T.Mesh(merged,m); me.castShadow=hi; me.receiveShadow=hi; out.add(me);} geos.forEach(x=>x.dispose()); });
    g.traverse(o=>{ if((o.userData.anim||o.isSprite) && o.parent && !hasAnimAncestor(o,g,true)) keep.push(o); });
    keep.forEach(o=>{ const wp=new T.Vector3(), wq=new T.Quaternion(), ws=new T.Vector3(); o.getWorldPosition(wp); o.getWorldQuaternion(wq); o.getWorldScale(ws); o.parent.remove(o); o.position.copy(wp); o.quaternion.copy(wq); o.scale.copy(ws); out.add(o); });
    out.userData=g.userData;
    return out;
  }
  function hasAnimAncestor(o, root, strict){ let p=o.parent; while(p && p!==root){ if(p.userData.anim) return true; p=p.parent; } return strict? false : o.isSprite; }

  /* ---------- terrain & scenery ---------- */
  function buildTerrain(){
    if(terrain){ scene.remove(terrain); disposeTree(terrain); }
    terrain=new T.Group();
    const th=city.th;
    const water=mesh(new T.PlaneGeometry(400,400), waterMat); water.rotation.x=-Math.PI/2; water.position.y=-0.6; terrain.add(water);
    const R=n*0.5+10+th*1.2;
    const isl=mesh(new T.CylinderGeometry(R, R+1.5, 0.8, 48), '#78b85f', 0, -0.45, 0); isl.position.y=-0.4; isl.receiveShadow=hi; terrain.add(isl);
    const sand=mesh(new T.CylinderGeometry(R+1.5, R+2.2, 0.3, 48), '#e7d49a', 0, -0.62, 0); terrain.add(sand);
    land=box(n+0.4,0.2,n+0.4,'#8fcf73',0,-0.2,0); land.receiveShadow=hi; terrain.add(land);
    gridHelper=new T.GridHelper(n, n, 0x6fae58, 0x6fae58); gridHelper.position.y=0.005; gridHelper.material.transparent=true; gridHelper.material.opacity=editable?0.35:0.12; terrain.add(gridHelper);
    // forest ring (instanced)
    const rnd=seeded('terrain'+th);
    const count = Math.round((hi?160:70) * (0.4 + th/12));
    const trunkG=new T.CylinderGeometry(0.06,0.09,0.4,5), leafG=new T.ConeGeometry(0.4,0.9,7);
    const trunks=new T.InstancedMesh(trunkG, mat('#7a5230'), count), leaves=new T.InstancedMesh(leafG, mat('#3f8f4a'), count);
    const m4=new T.Matrix4(); let placed=0;
    for(let i=0;i<count*3 && placed<count;i++){
      const a=rnd()*Math.PI*2, r=n*0.5+1.6+rnd()*(R-n*0.5-2.5); const x=Math.cos(a)*r, z=Math.sin(a)*r;
      if(Math.abs(x)<n/2+1 && Math.abs(z)<n/2+1) continue;
      if(th>=4 && x>n/2+2 && Math.abs(z)<4) continue; // lake area
      const s=0.7+rnd()*0.9;
      m4.compose(new T.Vector3(x,0.2*s-0.02,z), new T.Quaternion(), new T.Vector3(s,s,s)); trunks.setMatrixAt(placed,m4);
      m4.compose(new T.Vector3(x,0.4*s+0.45*s,z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),rnd()*3), new T.Vector3(s,s,s)); leaves.setMatrixAt(placed,m4);
      placed++;
    }
    trunks.count=leaves.count=placed; leaves.castShadow=hi; terrain.add(trunks, leaves);
    if(th>=4){ const lake=mesh(new T.CircleGeometry(3.4,24), waterMat, n/2+4.5, 0.02, 0); lake.rotation.x=-Math.PI/2; lake.scale.set(1,1.4,1); terrain.add(lake); }
    if(th>=5){ const river=mesh(new T.PlaneGeometry(2.2, R*2), waterMat, -n/2-4, 0.015, 0); river.rotation.x=-Math.PI/2; terrain.add(river); const br=box(3,0.25,1.2,'#9aa3ab',-n/2-4,0,2); terrain.add(br); }
    if(th>=6){ for(let i=0;i<(th>=9?7:4);i++){ const a=Math.PI*0.9+i*0.28, r=R-3; const h=4+rnd()*4+th*0.3; const mt=cone(3+rnd()*1.5,h,'#8a8f8a',Math.cos(a)*r,-0.2,Math.sin(a)*r,7); terrain.add(mt); const cap=cone(1.3,h*0.3,'#f4f7fa',Math.cos(a)*r,h*0.7-0.2,Math.sin(a)*r,7); terrain.add(cap);} }
    if(th>=8){ const dam=box(0.6,1.2,3.6,'#b8bfc6',n/2+8.2,-0.2,0); terrain.add(dam); }
    if(th>=9){ const hw=box(1.4,0.05,R*2,'#3b4148',0,0.0,0); hw.position.x=n/2+1.8; terrain.add(hw); for(let i=-R;i<R;i+=1.5) terrain.add(box(0.06,0.06,0.6,'#f2d16b',n/2+1.8,0.01,i)); }
    scene.add(terrain);
    sun.shadow && (sun.shadow.camera.left=-n, sun.shadow.camera.right=n, sun.shadow.camera.top=n, sun.shadow.camera.bottom=-n, sun.shadow.camera.far=150, sun.shadow.camera.updateProjectionMatrix());
  }
  function disposeTree(o){ o.traverse(x=>{ if(x.geometry) x.geometry.dispose(); }); }

  /* ---------- load city ---------- */
  function load(c, o){
    city=c; editable=!!o.editable;
    const newN=gridSizeFor(c.th);
    const key=JSON.stringify([c.th,c.flag,c.b.map(b=>[b.u,b.id,b.x,b.z,b.r,b.done,Math.round(b.prog||0)]),o.owner]);
    const tKey=c.th+'|'+editable+'|'+(o.owner||'');
    if(tKey!==terrainKey){ n=newN; buildTerrain(); terrainKey=tKey; resize(); if(!cityKey) resetCamera(); }
    if(key===cityKey) return;
    const ownerChanged = !cityKey || JSON.parse(cityKey)[3]!==o.owner;
    cityKey=key;
    // rebuild city
    cityGroup.children.slice().forEach(ch=>{ cityGroup.remove(ch); disposeTree(ch); });
    lampSprites.length=0; anims.length=0; puffs.forEach(p=>fxGroup.remove(p)); puffs=[]; bIndex=new Map();
    const th=townHall(c.th); cityGroup.add(optimise(th)); collectAnim(cityGroup.children[cityGroup.children.length-1]);
    const roads=new Set(c.b.filter(b=>b.id==='road').map(b=>b.x+','+b.z));
    c.b.forEach(b=>{
      const d=BMAP[b.id]; if(!d) return;
      if(b.id==='road') b._nb={n:roads.has(b.x+','+(b.z-1)), s:roads.has(b.x+','+(b.z+1)), e:roads.has((b.x+1)+','+b.z), w:roads.has((b.x-1)+','+b.z)};
      let g=buildModel(d,b); const smoke=g.userData.smoke; g=optimise(g); g.userData.smoke=smoke;
      const wrap=new T.Group(); wrap.add(g); g.rotation.y=-(b.r||0)*Math.PI/2;
      const [fw,fd]=fp(d,b.r||0); const [cx,cz]=tileCenter(b.x,b.z,fw,fd); wrap.position.set(cx,0,cz);
      if(b.done===false){
        const p=clamp((b.prog||0)/d.min,0,1); const bb=new T.Box3().setFromObject(g); const fullH=Math.max(0.5,bb.max.y); g.scale.y=0.12+0.88*p;
        const sc=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(fw*0.92, fullH, fd*0.92)), new T.LineBasicMaterial({color:0xf5a623})); sc.position.y=fullH/2; wrap.add(sc);
        const crane=new T.Group(); crane.add(box(0.05,1.4,0.05,'#f5a623',0,0,0)); crane.add(box(0.9,0.05,0.05,'#f5a623',0.3,1.4,0)); crane.position.set(fw*0.4,0,-fd*0.4); crane.userData.anim='crane'; wrap.add(crane);
      } else if(smoke){ for(let i=0;i<3;i++){ const pf=sph(0.12,smokeMat,0,0,0,6); const base=new T.Vector3(smoke.x,smoke.y,smoke.z).applyAxisAngle(new T.Vector3(0,1,0),-(b.r||0)*Math.PI/2).add(wrap.position); pf.userData={base, ph:i/3}; fxGroup.add(pf); puffs.push(pf);} }
      if(!known.has(b.u) && !ownerChanged){ wrap.scale.setScalar(0.01); wrap.userData.pop=performance.now(); }
      known.add(b.u);
      cityGroup.add(wrap); collectAnim(wrap);
      bIndex.set(b.u,{group:wrap,b});
    });
    if(gridHelper) gridHelper.material.opacity=editable?0.35:0.12;
    spawnNPCs(c);
    if(selBox){ scene.remove(selBox); selBox=null; }
  }
  function collectAnim(root){ root.traverse(o=>{ if(o.userData.anim) anims.push(o); if(o.isSprite && o.userData.glow) lampSprites.push(o); }); }

  /* ---------- NPCs ---------- */
  function spawnNPCs(c){
    npcGroup.children.slice().forEach(ch=>npcGroup.remove(ch)); cars=[]; walkers=[]; planes=[]; ships=[];
    const roads=c.b.filter(b=>b.id==='road' && b.done!==false); const set=new Map(roads.map(r=>[r.x+','+r.z,r]));
    const nbrs=r=>[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>set.get((r.x+dx)+','+(r.z+dz))).filter(Boolean);
    const cap=hi?28:10; const withN=roads.filter(r=>nbrs(r).length);
    const colors=['#e63946','#2a9d8f','#f4a261','#457b9d','#ffffff','#ffd166','#6a4c93'];
    const hasBus=c.b.some(b=>b.id==='busterm'&&b.done!==false);
    for(let i=0;i<Math.min(cap, Math.floor(withN.length*0.6)); i++){
      const r=withN[Math.floor(Math.random()*withN.length)]; const bus=hasBus && i<2;
      const m=carMesh(bus?'#f5bf4f':colors[i%colors.length]); if(bus) m.scale.set(1.8,1.3,1.1);
      npcGroup.add(m); cars.push({m, from:r, to:nbrs(r)[0], t:Math.random(), sp:0.5+Math.random()*0.4, nb:nbrs});
    }
    const pop=cityStats(c).population; const wc=Math.min(hi?36:12, Math.floor(pop/25)+2);
    const skin=['#f1c27d','#e0ac69','#c68642','#8d5524','#ffdbac'], shirt=['#e63946','#2a9d8f','#f4a261','#457b9d','#ffd166','#c792ff','#ffffff'];
    const spots=c.b.filter(b=>b.done!==false).map(b=>{ const d=BMAP[b.id]; const [fw,fd]=fp(d,b.r||0); const [x,z]=tileCenter(b.x,b.z,fw,fd); return [x+(fw/2+0.15)*(Math.random()<.5?1:-1)*0.9, z+fd/2+0.1]; });
    spots.push([0,1.3],[1.3,0],[-1.3,0]);
    for(let i=0;i<wc;i++){
      const g=new T.Group(); g.add(cyl(0.035,0.04,0.14,shirt[i%shirt.length],0,0.06,0,6)); g.add(sph(0.035,skin[i%skin.length],0,0.25,0,6)); g.add(box(0.05,0.07,0.04,'#34495e',0,0,0));
      const s=spots[Math.floor(Math.random()*spots.length)];
      g.position.set(s[0],0,s[1]); npcGroup.add(g);
      walkers.push({m:g, tgt:null, sp:(i%5===0?0.9:0.35)+Math.random()*0.2, spots, wait:Math.random()*2});
    }
    if(c.b.some(b=>(b.id==='airport'||b.id==='airbase') && b.done!==false)){ const p=planeMesh(c.b.some(b=>b.id==='airbase')?'#8a949c':'#ffffff'); p.scale.setScalar(1.3); npcGroup.add(p); planes.push({m:p, a:0}); }
    if(c.b.some(b=>b.id==='navalbase' && b.done!==false) || c.th>=7){ const s=new T.Group(); s.add(box(1.6,0.3,0.45,'#5b6770',0,-0.35,0)); s.add(box(0.5,0.35,0.3,'#dfe6ec',-0.2,-0.05,0)); s.add(box(0.08,0.4,0.08,'#8894a0',0.2,-0.05,0)); npcGroup.add(s); ships.push({m:s, a:Math.random()*6}); }
  }
  function stepNPCs(dt, t){
    cars.forEach(c=>{ if(!c.to){ c.m.visible=false; return; } c.t+=dt*c.sp; if(c.t>=1){ c.t=0; const all=c.nb(c.to); const op=all.filter(r=>r!==c.from); const pick=op.length?op:all; c.from=c.to; c.to=pick[Math.floor(Math.random()*pick.length)]||c.from; }
      const [ax,az]=tileCenter(c.from.x,c.from.z,1,1), [bx,bz]=tileCenter(c.to.x,c.to.z,1,1); const dx=bx-ax, dz=bz-az; const len=Math.hypot(dx,dz)||1; const ox=-dz/len*0.18, oz=dx/len*0.18;
      c.m.position.set(ax+dx*c.t+ox, 0.03, az+dz*c.t+oz); c.m.rotation.y=Math.atan2(-dz,dx); });
    walkers.forEach(w=>{ if(w.wait>0){ w.wait-=dt; return; } if(!w.tgt){ const s=w.spots[Math.floor(Math.random()*w.spots.length)]; w.tgt=new T.Vector3(s[0]+(Math.random()-.5)*0.4,0,s[1]+(Math.random()-.5)*0.3); }
      const d=w.tgt.clone().sub(w.m.position); const L=d.length(); if(L<0.05){ w.tgt=null; w.wait=0.5+Math.random()*3; return; }
      d.normalize(); w.m.position.addScaledVector(d, Math.min(L, dt*w.sp)); w.m.rotation.y=Math.atan2(d.x,d.z); w.m.position.y=Math.abs(Math.sin(t*10*w.sp))*0.02; });
    planes.forEach(p=>{ p.a+=dt*0.12; const R=n*0.55+4; const ph=(Math.sin(p.a*0.5)+1)/2; p.m.position.set(Math.cos(p.a)*R, 2+ph*6, Math.sin(p.a)*R); p.m.rotation.set(0,-p.a-Math.PI/2,0.25); });
    ships.forEach(s=>{ s.a+=dt*0.03; const R=n*0.5+13+city.th*1.2; s.m.position.set(Math.cos(s.a)*R, 0, Math.sin(s.a)*R); s.m.rotation.y=-s.a; });
  }

  /* ---------- sky, time & weather ---------- */
  function dayFrac(){ const d=new Date(); if(opts.dayMode==='day') return 0.52; if(opts.dayMode==='night') return 0.94; if(opts.dayMode==='cycle') return ((performance.now()-t0)/1000/180 + 0.3)%1; return (d.getHours()*3600+d.getMinutes()*60+d.getSeconds())/86400; }
  function pickWeather(){
    if(opts.weather!=='auto') return opts.weather;
    const d=new Date(); const r=seeded(dayKey()+'|'+Math.floor(d.getHours()/3))(); const winter=[11,0,1].includes(d.getMonth());
    const table=winter?[['sunny',35],['cloudy',25],['snow',20],['fog',10],['rain',10]]:[['sunny',42],['cloudy',25],['rain',15],['fog',8],['storm',5],['snow',0]];
    let x=r*table.reduce((a,b)=>a+b[1],0); for(const [k,w] of table){ if(x<w) return k; x-=w; } return 'sunny';
  }
  const C=(h)=>new THREE.Color(h);
  function applySky(){
    const f=dayFrac(); const elev=Math.sin((f-0.25)*Math.PI*2); const day=clamp(elev*1.8+0.25,0,1);
    const wx=pickWeather(); if(wx!==wxNow){ wxNow=wx; setupWeather(); }
    const gloom = {sunny:0, cloudy:0.3, rain:0.45, storm:0.6, snow:0.25, fog:0.35}[wxNow]||0;
    const night=C('#0b1a33'), dusk=C('#f29e6d'), dayc=C('#8fc6e8'), grey=C('#9aa7b3');
    const tw = clamp(1-Math.abs(elev)*3.2,0,1);
    const sky=night.clone().lerp(dayc, day).lerp(dusk, tw*0.55*(1-gloom)).lerp(grey.clone().multiplyScalar(0.4+day*0.6), gloom);
    scene.background=sky; scene.fog.color.copy(sky);
    const fogK = wxNow==='fog'?1:0; scene.fog.near = 50-fogK*38; scene.fog.far = 170-fogK*110;
    sun.intensity = (0.15 + day*0.95) * (1-gloom*0.6);
    sun.color.copy(C('#ffffff').lerp(C('#ffb070'), tw*0.8));
    const ang=(f-0.25)*Math.PI*2; sun.position.set(Math.cos(ang)*40, Math.max(8, Math.sin(ang)*50), 25);
    hemi.intensity = 0.25 + day*0.45; amb.intensity = (1-day)*0.35;
    const nightF=clamp((0.55-day)*2.2 + gloom*0.2,0,1);
    winMat.emissiveIntensity=nightF*1.1; lampMat.emissiveIntensity=nightF*1.6; headMat.emissiveIntensity=nightF*2; tailMat.emissiveIntensity=nightF*1.5; glowMat.opacity=nightF*0.85;
    if(flash>0){ amb.intensity+=flash*2; flash-=0.08; }
    const lbl=document.getElementById('w-clock'); if(lbl){ const h=Math.floor(f*24), mm=Math.floor((f*24-h)*60); lbl.textContent=`${pad2(h)}:${pad2(mm)} · ${{sunny:'☀️ Sunny',cloudy:'☁️ Cloudy',rain:'🌧️ Rain',storm:'⛈️ Storm',snow:'❄️ Snow',fog:'🌫️ Fog'}[wxNow]}`; }
  }
  function setupWeather(){
    [rain,snow].forEach(p=>{ if(p) scene.remove(p); }); rain=snow=null; clouds.forEach(c=>scene.remove(c)); clouds=[];
    const R=n*0.8+10;
    const cc={sunny:3, cloudy:10, rain:12, storm:14, snow:9, fog:4}[wxNow]||3; const dark=['rain','storm'].includes(wxNow);
    for(let i=0;i<cc;i++){ const g=new T.Group(); const col=dark?'#8d98a3':'#ffffff'; const m=new T.MeshLambertMaterial({color:col, transparent:true, opacity:0.9}); for(let k=0;k<5;k++){ const s=new T.Mesh(new T.SphereGeometry(0.8+Math.random()*0.8,8,6), m); s.position.set(k*0.9-1.8, Math.random()*0.4, (Math.random()-.5)*1.2); g.add(s);} g.position.set((Math.random()-.5)*R*2, 9+Math.random()*4, (Math.random()-.5)*R*2); g.userData.sp=0.3+Math.random()*0.5; scene.add(g); clouds.push(g); }
    if(wxNow==='rain'||wxNow==='storm'){ const N=hi?(wxNow==='storm'?2600:1600):600; const pos=new Float32Array(N*6); for(let i=0;i<N;i++){ const x=(Math.random()-.5)*R*2, y=Math.random()*16, z=(Math.random()-.5)*R*2; pos.set([x,y,z,x+0.05,y-0.5,z],i*6); } const g=new T.BufferGeometry(); g.setAttribute('position',new T.BufferAttribute(pos,3)); rain=new T.LineSegments(g,new T.LineBasicMaterial({color:0xaec6dd, transparent:true, opacity:0.55})); scene.add(rain); }
    if(wxNow==='snow'){ const N=hi?1800:600; const pos=new Float32Array(N*3); for(let i=0;i<N;i++) pos.set([(Math.random()-.5)*R*2, Math.random()*16, (Math.random()-.5)*R*2],i*3); const g=new T.BufferGeometry(); g.setAttribute('position',new T.BufferAttribute(pos,3)); snow=new T.Points(g,new T.PointsMaterial({color:0xffffff,size:0.12})); scene.add(snow); }
  }
  function stepWeather(dt){
    const R=n*0.8+10;
    clouds.forEach(c=>{ c.position.x+=dt*c.userData.sp; if(c.position.x>R) c.position.x=-R; });
    if(rain){ const p=rain.geometry.attributes.position; const a=p.array; for(let i=0;i<a.length;i+=6){ a[i+1]-=dt*22; a[i+4]-=dt*22; if(a[i+4]<0){ a[i+1]=16; a[i+4]=15.5; } } p.needsUpdate=true; if(wxNow==='storm' && Math.random()<0.004) flash=1; }
    if(snow){ const p=snow.geometry.attributes.position; const a=p.array; for(let i=0;i<a.length;i+=3){ a[i+1]-=dt*1.5; a[i]+=Math.sin(a[i+1]+i)*dt*0.3; if(a[i+1]<0) a[i+1]=16; } p.needsUpdate=true; }
  }

  /* ---------- loop ---------- */
  function loop(){
    cancelAnimationFrame(raf);
    const frame=()=>{
      if(!running || document.hidden) return;
      const now=performance.now(); const dt=Math.min(0.05,(now-lastT)/1000); lastT=now; const t=(now-t0)/1000;
      controls.update(); applySky(); stepWeather(dt); stepNPCs(dt,t);
      anims.forEach(o=>{ const k=o.userData.anim; if(k==='spin') o.rotation.z+=dt*3; else if(k==='flag') o.rotation.y=Math.sin(t*3+o.id)*0.25; else if(k==='bob') o.scale.y=1+Math.sin(t*4)*0.15; else if(k==='crane') o.rotation.y=Math.sin(t*0.5)*0.8; });
      puffs.forEach(p=>{ const ph=(t*0.3+p.userData.ph)%1; p.position.copy(p.userData.base).add(new T.Vector3(ph*0.4,ph*1.4,0)); p.scale.setScalar(0.6+ph*1.6); p.material.opacity=0.5*(1-ph); });
      cityGroup.children.forEach(w=>{ if(w.userData.pop){ const k=clamp((now-w.userData.pop)/650,0,1); const e=1+2.2*Math.pow(k-1,3)+1.2*Math.pow(k-1,2); w.scale.setScalar(Math.max(0.01,e)); if(k>=1){ w.scale.setScalar(1); delete w.userData.pop; } } });
      if(ghost){ ghost.position.y=0.02+Math.sin(t*5)*0.03; }
      renderer.render(scene,camera);
      raf=requestAnimationFrame(frame);
    };
    lastT=performance.now(); raf=requestAnimationFrame(frame);
  }
  function resume(){ running=true; loop(); }
  function stop(){ cancelAnimationFrame(raf); }
  function pause(){ running=false; stop(); }
  function resetCamera(){ if(!controls) return; controls.target.set(0,0,0); camera.position.set(40,38,40); camera.zoom=1; camera.updateProjectionMatrix(); controls.update(); }
  function setOptions(o){ const gfxChanged = o.gfx && o.gfx!==opts.gfx; Object.assign(opts,o); if(ready && o.weather){ wxNow=''; } if(ready && gfxChanged){ hi = opts.gfx==='high' || (opts.gfx==='auto'); renderer.setPixelRatio(Math.min(devicePixelRatio||1, hi?2:1)); renderer.shadowMap.enabled=hi; sun.castShadow=hi; cityKey=''; terrainKey=''; } }

  /* ---------- selection & placement ---------- */
  function onTap(e){
    const tl=tileAt(e); if(!tl) return;
    if(placing){ setGhost(tl.x - Math.floor((placing.fw-1)/2), tl.z - Math.floor((placing.fd-1)/2)); return; }
    const b=buildingAtTile(tl.x,tl.z); select(b);
  }
  function select(b){
    if(selBox){ scene.remove(selBox); selBox=null; }
    if(b){ const o=bIndex.get(b.u); if(o){ selBox=new T.BoxHelper(o.group, 0xf5bf4f); scene.add(selBox); } }
    worldSelectUI(b ? (G.worldTarget? b : G.S.city.b.find(x=>x.u===b.u)||b) : null);
  }
  function makeGhost(id, r){
    if(ghost){ scene.remove(ghost); disposeTree(ghost); }
    const d=BMAP[id]; const g=buildModel(d,{_nb:{}}); g.rotation.y=-(r||0)*Math.PI/2;
    const wrap=new T.Group(); wrap.add(g);
    const [fw,fd]=fp(d,r||0); const base=mesh(new T.PlaneGeometry(fw*0.98,fd*0.98), new T.MeshBasicMaterial({color:0x83c96e, transparent:true, opacity:0.5, depthWrite:false})); base.rotation.x=-Math.PI/2; base.position.y=0.03; base.userData.base=1; wrap.add(base);
    ghost=wrap; scene.add(ghost);
  }
  function setGhost(x,z){
    if(!placing) return; placing.x=x; placing.z=z;
    const c=G.S.city; placing.valid=tileFree(c,x,z,placing.d.w,placing.d.d,placing.r,placing.moveU);
    const [cx,cz]=tileCenter(x,z,placing.fw,placing.fd); ghost.position.set(cx,0.02,cz);
    ghost.children.forEach(ch=>{ if(ch.userData.base) ch.material.color.set(placing.valid?0x83c96e:0xff6b6b); });
    worldPlaceUI(placing);
  }
  function moveGhostTo(e){ const tl=tileAt(e); if(!tl) return; setGhost(tl.x - Math.floor((placing.fw-1)/2), tl.z - Math.floor((placing.fd-1)/2)); }
  function firstFree(d,r){ const c=G.S.city; const [fw,fd]=fp(d,r); const mid=Math.floor(n/2); for(let rad=0;rad<n;rad++) for(let dx=-rad;dx<=rad;dx++) for(let dz=-rad;dz<=rad;dz++){ if(Math.max(Math.abs(dx),Math.abs(dz))!==rad) continue; const x=mid+dx, z=mid+dz+2; if(tileFree(c,x,z,d.w,d.d,r)) return [x,z]; } return [0,0]; }
  function beginPlace(id, inv){ select(null); const d=BMAP[id]; const r=0; const [fw,fd]=fp(d,r); placing={id, inv, d, r, fw, fd, x:0, z:0, valid:false}; makeGhost(id,r); const [x,z]=firstFree(d,r); setGhost(x,z); }
  function beginMove(b){ const d=BMAP[b.id]; const o=bIndex.get(b.u); if(o) o.group.visible=false; select(null); const r=b.r||0; const [fw,fd]=fp(d,r); placing={id:b.id, moveU:b.u, d, r, fw, fd, x:b.x, z:b.z}; makeGhost(b.id,r); setGhost(b.x,b.z); }
  function rotatePlace(){ if(!placing) return; placing.r=(placing.r+1)%4; const [fw,fd]=fp(placing.d,placing.r); placing.fw=fw; placing.fd=fd; makeGhost(placing.id,placing.r); setGhost(placing.x,placing.z); }
  function endPlace(){ if(placing && placing.moveU){ const o=bIndex.get(placing.moveU); if(o) o.group.visible=true; } placing=null; if(ghost){ scene.remove(ghost); disposeTree(ghost); ghost=null; } worldPlaceUI(null); }
  function placement(){ return placing ? {id:placing.id, x:placing.x, z:placing.z, r:placing.r, inv:placing.inv, moveU:placing.moveU} : null; }

  return {mount, load, resume, pause, setOptions, resetCamera, beginPlace, beginMove, rotatePlace, endPlace, placement, select, ready:false};
})();

/* ---------- 2D fallback map for low-end devices ---------- */
const World2D = {
  show(el, city){
    el.innerHTML=''; const c=document.createElement('canvas'); c.className='fallback2d'; el.appendChild(c);
    const n=gridSizeFor(city.th); const W=el.clientWidth||600, H=el.clientHeight||400; const dpr=Math.min(2,devicePixelRatio||1);
    c.width=W*dpr; c.height=H*dpr; const g=c.getContext('2d'); g.scale(dpr,dpr);
    const s=Math.floor(Math.min(W,H)/(n+2)); const ox=(W-s*n)/2, oy=(H-s*n)/2;
    g.fillStyle='#4f8fbf'; g.fillRect(0,0,W,H); g.fillStyle='#8fcf73'; g.fillRect(ox,oy,s*n,s*n);
    g.strokeStyle='rgba(0,0,0,.08)'; for(let i=0;i<=n;i++){ g.beginPath(); g.moveTo(ox+i*s,oy); g.lineTo(ox+i*s,oy+n*s); g.stroke(); g.beginPath(); g.moveTo(ox,oy+i*s); g.lineTo(ox+n*s,oy+i*s); g.stroke(); }
    const mid=Math.floor(n/2)-1; g.fillStyle='#efe7d4'; g.fillRect(ox+mid*s,oy+mid*s,2*s,2*s); g.font=`${s*1.2}px serif`; g.textAlign='center'; g.textBaseline='middle'; g.fillText('🏛️',ox+(mid+1)*s,oy+(mid+1)*s);
    city.b.forEach(b=>{ const d=BMAP[b.id]; if(!d) return; const [fw,fd]=(b.r%2)?[d.d,d.w]:[d.w,d.d];
      g.fillStyle = b.id==='road'?'#3b4148': d.c==='dec'?'#7cc46a': b.done===false?'#f5a62388':'#ffffffcc'; g.fillRect(ox+b.x*s+1,oy+b.z*s+1,fw*s-2,fd*s-2);
      if(b.id!=='road'){ g.font=`${Math.min(fw,fd)*s*0.7}px serif`; g.fillText(d.i, ox+(b.x+fw/2)*s, oy+(b.z+fd/2)*s); } });
  }
};
