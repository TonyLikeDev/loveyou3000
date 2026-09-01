const CONFIG = {
  message: 'Happy Birthday Linh Xinh Yeu!',
  candles: 5,
  sound: true
};

let THREE;
const gsap = window.gsap;
try {
  THREE = await import('three');
  if (!gsap) throw new Error('gsap failed to load');
} catch (err) {
  document.querySelector('#loader p').textContent = 'this surprise needs an internet connection ✉';
  throw err;
}

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(hover: none)').matches;   // no pointer parallax from taps
const $ = s => document.querySelector(s);
const ui = { fade:$('#fade'), hint:$('#hint'), wish:$('#wishHint'),
  toast:$('#toast'), actions:$('#actions'), loader:$('#loader'), mute:$('#mute') };

/* ============================== renderer ============================== */
const canvas = $('#stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const clock = new THREE.Clock();
let elapsed = 0;
let stageT = 0;      // time since the stage appeared (camera sway starts dead-centre)
let phase = 'idle';   // idle → opening → dive → dark → reveal → lit → blowing → blown

/* ============================== helpers ============================== */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t._canvas = c; t._draw = draw;
  return t;
}
function redrawTex(t) { t._draw(t._canvas.getContext('2d'), t._canvas.width, t._canvas.height); t.needsUpdate = true; }
function radialTex(size, stops) {
  return canvasTex(size, size, (ctx, w, h) => {
    ctx.clearRect(0,0,w,h);
    const g = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
    for (const [o, col] of stops) g.addColorStop(o, col);
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  });
}
const glowTex   = radialTex(256, [[0,'rgba(255,235,200,1)'],[.25,'rgba(255,200,130,.55)'],[.6,'rgba(255,160,90,.16)'],[1,'rgba(255,150,80,0)']]);
const flameTex  = radialTex(128, [[0,'rgba(255,253,240,1)'],[.2,'rgba(255,240,190,.95)'],[.45,'rgba(255,190,95,.8)'],[.7,'rgba(255,125,50,.35)'],[1,'rgba(255,110,40,0)']]);
const coreTex   = radialTex(64,  [[0,'rgba(255,255,250,1)'],[.5,'rgba(255,250,230,.7)'],[1,'rgba(255,250,220,0)']]);
const smokeTex  = radialTex(128, [[0,'rgba(190,185,200,.4)'],[.6,'rgba(180,175,195,.14)'],[1,'rgba(170,170,190,0)']]);

const GOLD = new THREE.MeshStandardMaterial({ color:0xd9a94e, metalness:.85, roughness:.28 });

/* ============================================================================
   SCENE A — the envelope, floating in a pastel dusk
============================================================================ */
const sceneA = new THREE.Scene();
sceneA.background = canvasTex(16, 512, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#b4a3e6'); g.addColorStop(.45, '#f2bfd4'); g.addColorStop(1, '#ffe7cd');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
});
const camA = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, .05, 60);
camA.position.set(0, .2, 6);
const lookA = new THREE.Vector3(0, .15, 0);

sceneA.add(new THREE.HemisphereLight(0xcdbcf2, 0xffdcb8, .85));
const keyA = new THREE.DirectionalLight(0xfff2df, 1.7); keyA.position.set(3, 4, 5); sceneA.add(keyA);
const rimA = new THREE.DirectionalLight(0xb8c8ff, .9);  rimA.position.set(-4, 2, -3); sceneA.add(rimA);

/* -------- envelope -------- */
const EW = 3, EH = 2, FLAP = 1.25;
const env = new THREE.Group(); sceneA.add(env);

const paperMat  = new THREE.MeshStandardMaterial({ color:0xfdf6ec, roughness:.62 });
const grain = (ctx) => { // faint paper speckle
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(160,130,90,${Math.random()*.045})`;
    ctx.fillRect(Math.random()*1024, Math.random()*1024, 1.5, 1.5);
  }
};
const frontTex = canvasTex(1024, 683, (ctx, w, h) => {
  ctx.fillStyle = '#fdf6ec'; ctx.fillRect(0,0,w,h);
  ctx.save(); grain(ctx); ctx.restore();
  const cx = w/2, cy = h*.52;
  ctx.strokeStyle = 'rgba(196,164,116,.5)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (const [x,y] of [[0,0],[w,0],[0,h],[w,h]]) {
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(cx,cy); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(220,180,110,.55)'; ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, w-24, h-24);
});
const mouthTex = canvasTex(256, 32, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#4c2333'); g.addColorStop(.5,'#7c4258'); g.addColorStop(1,'#4c2333');
  ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
});
const slab = new THREE.Mesh(
  new THREE.BoxGeometry(EW, EH, .07),
  [ paperMat, paperMat,
    new THREE.MeshStandardMaterial({ map:mouthTex, roughness:.9 }),
    paperMat,
    new THREE.MeshStandardMaterial({ map:frontTex, roughness:.62 }),
    paperMat ]
);
env.add(slab);

/* flap (hinged at top edge) */
const flapShape = new THREE.Shape();
flapShape.moveTo(-EW/2, 0); flapShape.lineTo(EW/2, 0); flapShape.lineTo(0, -FLAP); flapShape.closePath();
const flapGeo = new THREE.ShapeGeometry(flapShape);
const flapOuterTex = canvasTex(1024, 512, (ctx, w, h) => {
  ctx.fillStyle = '#fbf2e4'; ctx.fillRect(0,0,w,h);
  grain(ctx);
  ctx.strokeStyle = 'rgba(217,169,78,.85)'; ctx.lineWidth = 7; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(10,6); ctx.lineTo(w-10,6); ctx.lineTo(w/2, h-12); ctx.closePath(); ctx.stroke();
});
const flapInnerTex = canvasTex(1024, 512, (ctx, w, h) => {
  ctx.fillStyle = '#f6cdd9'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (let y = 20; y < h; y += 64)
    for (let x = (y/64)%2 ? 32 : 0; x < w; x += 64) {
      ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
    }
});
function fitFlapUV(tex) {
  tex.repeat.set(1/EW, 1/FLAP);
  tex.offset.set(.5, 1);
  return tex;
}
const flap = new THREE.Group();
flap.position.set(0, EH/2, .05);
const flapOuter = new THREE.Mesh(flapGeo, new THREE.MeshStandardMaterial({ map:fitFlapUV(flapOuterTex), roughness:.6, side:THREE.DoubleSide }));
flapOuter.position.z = .006;
const flapInner = new THREE.Mesh(flapGeo, new THREE.MeshStandardMaterial({ map:fitFlapUV(flapInnerTex), roughness:.75, side:THREE.DoubleSide }));
flapInner.position.z = -.006;
flap.add(flapOuter, flapInner);
env.add(flap);

/* wax seal + gold heart */
const seal = new THREE.Group();
seal.position.set(0, EH/2 - FLAP + .18, .095);
const waxMat = new THREE.MeshStandardMaterial({ color:0xd96c87, roughness:.38, transparent:true });
const wax = new THREE.Mesh(new THREE.CylinderGeometry(.21, .23, .05, 40), waxMat);
wax.rotation.x = Math.PI/2;
const heartShape = new THREE.Shape();
heartShape.moveTo(2.5,2.5);
heartShape.bezierCurveTo(2.5,2.5,2,0,0,0);
heartShape.bezierCurveTo(-3,0,-3,3.5,-3,3.5);
heartShape.bezierCurveTo(-3,5.5,-1,7.7,2.5,9.5);
heartShape.bezierCurveTo(6,7.7,8,5.5,8,3.5);
heartShape.bezierCurveTo(8,3.5,8,0,5,0);
heartShape.bezierCurveTo(3.5,0,2.5,2.5,2.5,2.5);
const heartGeo = new THREE.ExtrudeGeometry(heartShape, { depth:1.2, bevelEnabled:true, bevelThickness:.4, bevelSize:.4, bevelSegments:2, curveSegments:10 });
heartGeo.center();
const heartMat = new THREE.MeshStandardMaterial({ color:0xe4b264, metalness:.8, roughness:.3, transparent:true });
const heart = new THREE.Mesh(heartGeo, heartMat);
heart.scale.setScalar(.02);
heart.rotation.z = Math.PI;
heart.position.z = .035;
seal.add(wax, heart);
env.add(seal);

env.rotation.set(-.06, .12, .02);

/* keep the whole envelope in frame on narrow screens (e.g. phones) */
function envelopeFitZ() {
  const halfH = Math.tan(THREE.MathUtils.degToRad(45) / 2);
  const halfW = halfH * camA.aspect;
  return Math.max(6, (EW/2 + .55) / halfW, (EH/2 + .9) / halfH);
}
let camABaseZ = envelopeFitZ();
camA.position.z = camABaseZ;

/* mouth glow + ambient sparkles */
const mouthGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map:glowTex, color:0xffd9a0, blending:THREE.AdditiveBlending, depthWrite:false, transparent:true, opacity:0 }));
mouthGlow.position.set(0, .95, .1);
mouthGlow.scale.setScalar(.1);
env.add(mouthGlow);

function makeSparkles(count, spread, color, sizeMin, sizeMax) {
  const pos = new Float32Array(count*3), scale = new Float32Array(count),
        phs = new Float32Array(count), spd = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i*3]   = (Math.random()-.5) * spread[0];
    pos[i*3+1] = (Math.random()-.5) * spread[1];
    pos[i*3+2] = (Math.random()-.5) * spread[2];
    scale[i] = sizeMin + Math.random()*(sizeMax-sizeMin);
    phs[i] = Math.random()*Math.PI*2;
    spd[i] = .25 + Math.random()*.9;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phs, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(spd, 1));
  const mat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uTime:{value:0}, uPR:{value:renderer.getPixelRatio()}, uColor:{value:new THREE.Color(color)}, uAlpha:{value:1} },
    vertexShader:`
      uniform float uTime; uniform float uPR;
      attribute float aScale; attribute float aPhase; attribute float aSpeed;
      varying float vTw;
      void main(){
        vec3 p = position;
        p.y += sin(uTime*aSpeed + aPhase) * .25;
        p.x += cos(uTime*aSpeed*.6 + aPhase*1.3) * .2;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vTw = .5 + .5*sin(uTime*(1.2 + aSpeed*1.5) + aPhase*2.0);
        gl_PointSize = aScale * uPR * (.55 + .75*vTw) * (6.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader:`
      uniform vec3 uColor; uniform float uAlpha; varying float vTw;
      void main(){
        float d = length(gl_PointCoord - .5);
        float a = pow(smoothstep(.5, .0, d), 2.0);
        gl_FragColor = vec4(uColor, a * vTw * uAlpha);
      }`
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}
const sparklesA = makeSparkles(110, [11, 6.5, 5], 0xffd9b0, 7, 17);
sparklesA.position.z = -.6;
sceneA.add(sparklesA);

/* burst sparkles (fly out of the mouth on open) */
const BURST_N = 70;
const burstGeo = new THREE.BufferGeometry();
burstGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BURST_N*3), 3));
const burstMat = new THREE.PointsMaterial({ map:glowTex, color:0xffcf8f, size:.16, transparent:true,
  depthWrite:false, blending:THREE.AdditiveBlending, opacity:0 });
const burstPts = new THREE.Points(burstGeo, burstMat);
burstPts.frustumCulled = false;
sceneA.add(burstPts);
const burstVel = [];
for (let i = 0; i < BURST_N; i++) {
  const a = Math.random()*Math.PI*2, r = .4 + Math.random()*1.4;
  burstVel.push(new THREE.Vector3(Math.cos(a)*r*.6, 1 + Math.random()*2.2, Math.sin(a)*r*.35 + .8));
}
let burstLife = -1;
function fireBurst() {
  const p = burstGeo.attributes.position.array;
  for (let i = 0; i < BURST_N; i++) { p[i*3] = 0; p[i*3+1] = .95; p[i*3+2] = .1; }
  burstGeo.attributes.position.needsUpdate = true;
  burstLife = 0; burstMat.opacity = 1;
}

/* ============================================================================
   SCENE B — dark stage, spotlight, the cake
============================================================================ */
const sceneB = new THREE.Scene();
sceneB.background = new THREE.Color(0x0a0510);
sceneB.fog = new THREE.FogExp2(0x0a0510, .028);
const camB = new THREE.PerspectiveCamera(42, innerWidth/innerHeight, .1, 80);
const rig = new THREE.Group();
rig.position.set(0, 1.5, 0);
camB.position.set(0, .55, 7.6);
rig.add(camB);
sceneB.add(rig);

const hemiB = new THREE.HemisphereLight(0xf8c8d8, 0x2a1418, 0); sceneB.add(hemiB);
const rimB  = new THREE.DirectionalLight(0x9db7ff, 0); rimB.position.set(-3, 4, -6); sceneB.add(rimB);

/* floor + platform */
const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48),
  new THREE.MeshStandardMaterial({ color:0x171017, roughness:.32, metalness:.08 }));
floor.rotation.x = -Math.PI/2;
floor.receiveShadow = true;
sceneB.add(floor);

const platform = new THREE.Group(); sceneB.add(platform);
const platSide = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.42, .5, 64),
  new THREE.MeshStandardMaterial({ color:0x96566c, roughness:.8 }));
platSide.position.y = .25;
platSide.castShadow = platSide.receiveShadow = true;
const platRim = new THREE.Mesh(new THREE.TorusGeometry(2.31, .035, 12, 72), GOLD);
platRim.rotation.x = Math.PI/2; platRim.position.y = .5;
platform.add(platSide, platRim);

/* cake stand */
const standFoot = new THREE.Mesh(new THREE.CylinderGeometry(.32, .44, .1, 32), GOLD);
standFoot.position.y = .55;
const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.24, .05, 56),
  new THREE.MeshStandardMaterial({ color:0xefe5d6, roughness:.35 }));
plate.position.y = .625;
plate.castShadow = plate.receiveShadow = true;
const plateRim = new THREE.Mesh(new THREE.TorusGeometry(1.28, .02, 10, 64), GOLD);
plateRim.rotation.x = Math.PI/2; plateRim.position.y = .64;
platform.add(standFoot, plate, plateRim);

/* -------- the cake -------- */
const cake = new THREE.Group();
cake.position.y = .65;
sceneB.add(cake);

const tiers = [
  { r:1.02, h:.55, color:0xefb6c8 },   // blush
  { r:.76,  h:.5,  color:0xbadfcb },   // mint
  { r:.52,  h:.45, color:0xf2e4cf }    // cream
];
const icingMat = new THREE.MeshStandardMaterial({ color:0xf3ebdd, roughness:.5 });
let yCursor = 0;
const dummy = new THREE.Object3D();
for (const t of tiers) {
  const body = new THREE.Mesh(new THREE.CylinderGeometry(t.r, t.r, t.h, 56),
    new THREE.MeshStandardMaterial({ color:t.color, roughness:.58 }));
  body.position.y = yCursor + t.h/2;
  body.castShadow = body.receiveShadow = true;
  cake.add(body);
  const topY = yCursor + t.h;

  const rimTorus = new THREE.Mesh(new THREE.TorusGeometry(t.r + .005, .05, 10, 64), icingMat);
  rimTorus.rotation.x = Math.PI/2; rimTorus.position.y = topY - .01;
  rimTorus.castShadow = true;
  cake.add(rimTorus);

  const N = 22;
  const drips = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.045, .16, 3, 10), icingMat, N);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + Math.random()*.14;
    const len = .35 + Math.random()*.75;
    dummy.position.set(Math.cos(a)*(t.r + .004), topY - .05 - (.16*len)/2, Math.sin(a)*(t.r + .004));
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(.7 + Math.random()*.5, len, .7 + Math.random()*.5);
    dummy.updateMatrix();
    drips.setMatrixAt(i, dummy.matrix);
  }
  drips.castShadow = true;
  cake.add(drips);
  t.topY = topY;
  yCursor = topY;
}
const cakeTopY = yCursor;                 // local; world = +0.65

/* piped dollops on each exposed ring */
const dollops = new THREE.InstancedMesh(new THREE.SphereGeometry(.055, 14, 12), icingMat, 18*3);
{
  let k = 0;
  for (const t of tiers) {
    for (let i = 0; i < 18; i++) {
      const a = (i/18)*Math.PI*2 + .12;
      dummy.position.set(Math.cos(a)*(t.r-.08), t.topY + .02, Math.sin(a)*(t.r-.08));
      dummy.rotation.set(0,0,0);
      dummy.scale.set(1, .78, 1);
      dummy.updateMatrix();
      dollops.setMatrixAt(k++, dummy.matrix);
    }
  }
  dollops.castShadow = true;
  cake.add(dollops);
}

/* sprinkles */
const SPRINKLE_COLORS = ['#f291b1','#7fcfae','#b490e6','#ffce7a','#8fc7f0','#e8b84b'];
const sprinkles = new THREE.InstancedMesh(
  new THREE.CapsuleGeometry(.011, .034, 2, 6),
  new THREE.MeshStandardMaterial({ roughness:.4 }), 78);
{
  const c = new THREE.Color();
  for (let i = 0; i < 78; i++) {
    const t = tiers[i % 3];
    const a = Math.random()*Math.PI*2;
    const rr = (i % 3 === 2) ? Math.random()*(t.r-.14) : (t.r - .14) - Math.random()*.24;
    dummy.position.set(Math.cos(a)*Math.max(rr,0), t.topY + .012, Math.sin(a)*Math.max(rr,0));
    dummy.rotation.set(Math.PI/2 + (Math.random()-.5)*.7, 0, Math.random()*Math.PI*2);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    sprinkles.setMatrixAt(i, dummy.matrix);
    sprinkles.setColorAt(i, c.set(SPRINKLE_COLORS[i % SPRINKLE_COLORS.length]));
  }
  cake.add(sprinkles);
}

/* -------- candles + flames -------- */
const stripeVariants = [['#f0a0b8','#eee2d3'], ['#98cfb6','#eee2d3'], ['#c2a9e2','#eee2d3']].map(([a,b]) =>
  canvasTex(64, 64, (ctx, w, h) => {
    ctx.fillStyle = b; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, w, h/4); ctx.fillRect(0, h/2, w, h/4);
  }));
stripeVariants.forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 2); });

const flames = [];
const candleLight = new THREE.PointLight(0xffb36b, 0, 4.5, 2);
candleLight.position.set(0, cakeTopY + .48, .22);
cake.add(candleLight);
candleLight.userData.base = 0;

for (let i = 0; i < CONFIG.candles; i++) {
  const spreadIdx = i - (CONFIG.candles - 1)/2;
  const a = Math.PI/2 + spreadIdx * (CONFIG.candles > 6 ? .5 : .48);
  const cx = Math.cos(a) * .3, cz = Math.sin(a) * .3;
  const tex = stripeVariants[i % 3];
  const candleMat = new THREE.MeshStandardMaterial({ map:tex, roughness:.5 });
  const capMat = new THREE.MeshStandardMaterial({ color:0xeee2d3, roughness:.5 });
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(.034, .034, .26, 14), [candleMat, capMat, capMat]);
  candle.position.set(cx, cakeTopY + .13, cz);
  candle.castShadow = true;
  cake.add(candle);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .05, 6),
    new THREE.MeshStandardMaterial({ color:0x2a2020 }));
  wick.position.set(cx, cakeTopY + .28, cz);
  cake.add(wick);

  const fg = new THREE.Group();
  fg.position.set(cx, cakeTopY + .35, cz);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:0xffc07a,
    blending:THREE.AdditiveBlending, depthWrite:false, transparent:true, opacity:0 }));
  glow.scale.setScalar(.42);
  const body = new THREE.Sprite(new THREE.SpriteMaterial({ map:flameTex,
    blending:THREE.AdditiveBlending, depthWrite:false, transparent:true, opacity:0 }));
  body.scale.set(.18, .36, 1);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map:coreTex,
    blending:THREE.AdditiveBlending, depthWrite:false, transparent:true, opacity:0 }));
  core.scale.set(.085, .145, 1);
  core.position.y = -.02;
  fg.add(glow, body, core);
  cake.add(fg);
  flames.push({ group:fg, glow, body, core, phase:Math.random()*9, lit:{ v:0 }, x:cx, z:cz });
}

function igniteFlame(i) {
  const f = flames[i];
  gsap.to(f.lit, { v:1, duration:.4, ease:'back.out(2.2)' });
  gsap.to(candleLight.userData, { base:'+=' + (3/CONFIG.candles), duration:.4 });
  sfx.tink(i);
}
function blowFlame(i) {
  const f = flames[i];
  gsap.to(f.lit, { v:0, duration:.16, ease:'power2.in' });
  const smoke = new THREE.Sprite(new THREE.SpriteMaterial({ map:smokeTex, transparent:true,
    depthWrite:false, opacity:.55 }));
  smoke.position.copy(f.group.position);
  smoke.scale.setScalar(.12);
  cake.add(smoke);
  const drift = (Math.random()-.5)*.3;
  gsap.to(smoke.position, { y:'+=.55', x:'+='+drift, duration:1.7, ease:'power1.out' });
  gsap.to(smoke.scale, { x:.5, y:.62, z:.5, duration:1.7, ease:'power1.out' });
  gsap.to(smoke.material, { opacity:0, duration:1.7, ease:'power1.in',
    onComplete:() => { cake.remove(smoke); smoke.material.dispose(); } });
}

/* -------- topper -------- */
const topperTex = canvasTex(1024, 512, (ctx, w, h) => {
  ctx.clearRect(0,0,w,h);
  const bx = 60, by = 110, bw = w-120, bh = h-220, R = 26;
  ctx.fillStyle = '#fff3de';
  ctx.strokeStyle = '#c9964a'; ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, R);
  ctx.fill(); ctx.stroke();
  // scallop dots along top and bottom edges
  ctx.fillStyle = '#eb9db6';
  for (let x = bx + 30; x < bx + bw - 10; x += 52) {
    ctx.beginPath(); ctx.arc(x, by, 12, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 26, by + bh, 12, 0, 7); ctx.fill();
  }
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#b34f6d'); grad.addColorStop(.55, '#a8762e'); grad.addColorStop(1, '#b34f6d');
  ctx.fillStyle = grad;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = 150;
  ctx.font = `${size}px "Great Vibes", cursive`;
  while (ctx.measureText(CONFIG.message).width > bw - 90 && size > 40) {
    size -= 6; ctx.font = `${size}px "Great Vibes", cursive`;
  }
  ctx.fillText(CONFIG.message, w/2, h/2 + 6);
});
const topper = new THREE.Group();
const stickMat = new THREE.MeshStandardMaterial({ color:0xe8d9c2, roughness:.6 });
for (const sx of [-.4, .4]) {
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .72, 8), stickMat);
  stick.position.set(sx, cakeTopY + .34, -.25);
  topper.add(stick);
}
const topCard = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .55),
  new THREE.MeshStandardMaterial({ map:topperTex, transparent:true, alphaTest:.08, roughness:.85,
    color:0xaf9f86, side:THREE.DoubleSide }));
topCard.position.set(0, cakeTopY + .64, -.19);
topper.add(topCard);
cake.add(topper);

/* -------- glowing headline sign, floating behind the cake -------- */
const signTex = canvasTex(2048, 1024, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const words = CONFIG.message.trim().split(/\s+/);
  let lines = [CONFIG.message.trim()];
  ctx.font = '320px "Great Vibes", cursive';
  if (words.length > 1 && ctx.measureText(lines[0]).width > w - 260) {
    let best = 1, bestDiff = Infinity;                 // split into the two most balanced lines
    for (let i = 1; i < words.length; i++) {
      const d = Math.abs(ctx.measureText(words.slice(0, i).join(' ')).width - ctx.measureText(words.slice(i).join(' ')).width);
      if (d < bestDiff) { bestDiff = d; best = i; }
    }
    lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }
  let size = lines.length > 1 ? 300 : 360;
  const setFont = () => { ctx.font = `${size}px "Great Vibes", cursive`; };
  setFont();
  while (size > 90 && lines.some(l => ctx.measureText(l).width > w - 260)) { size -= 10; setFont(); }
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#ffe3ae'); grad.addColorStop(.55, '#ffb1cc'); grad.addColorStop(1, '#ffd9a0');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(255,175,120,.9)';
  const lineH = size * 1.05;
  const y0 = h / 2 - (lines.length - 1) * lineH / 2;
  lines.forEach((l, i) => {
    ctx.shadowBlur = 70; ctx.fillText(l, w / 2, y0 + i * lineH);
    ctx.shadowBlur = 18; ctx.fillText(l, w / 2, y0 + i * lineH);
  });
});
const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2),
  new THREE.MeshBasicMaterial({ map:signTex, transparent:true, opacity:0, depthWrite:false, fog:false }));
const signGroup = new THREE.Group();
signGroup.position.set(0, 3.7, -3.2);
signGroup.add(sign);
const signPivot = new THREE.Group();   // follows most of the camera sway so the sign drifts only ~20%
signPivot.add(signGroup);
sceneB.add(signPivot);
function fitSign() {   // keep the sign inside the visible width at its depth (phones)
  const halfW = (7.6 + 3.2) * Math.tan(THREE.MathUtils.degToRad(21)) * camB.aspect;
  signGroup.scale.setScalar(Math.min(1, .92 * 2 * halfW / 6.4));
}
fitSign();

/* -------- spotlight + visible beam -------- */
const spot = new THREE.SpotLight(0xffd9a0, 0, 0, .38, .45, 1.35);
spot.position.set(.6, 8.2, 4.4);
spot.castShadow = true;
spot.shadow.mapSize.set(1024, 1024);
spot.shadow.bias = -.002;
spot.shadow.camera.near = 3; spot.shadow.camera.far = 14;
sceneB.add(spot);
spot.target.position.set(0, 1.1, 0);
sceneB.add(spot.target);

const lampDir = new THREE.Vector3().subVectors(spot.target.position, spot.position).normalize();
const beamLen = spot.position.distanceTo(new THREE.Vector3(0, 0, 0));
const beamGroup = new THREE.Group();
beamGroup.position.copy(spot.position);
beamGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), lampDir);
sceneB.add(beamGroup);

const beamUniforms = { uOpacity:{ value:0 }, uColor:{ value:new THREE.Color(0xffd9a0) }, uTime:{ value:0 } };
const beamMat = new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
  uniforms:beamUniforms,
  vertexShader:`
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){
      vUv = uv;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalMatrix * normal;
      vV = -mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader:`
    uniform float uOpacity; uniform vec3 uColor; uniform float uTime;
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){
      float hf = pow(vUv.y, 1.35);
      float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.7);
      float flick = .93 + .07 * sin(uTime * 1.9);
      gl_FragColor = vec4(uColor, hf * edge * uOpacity * flick);
    }`
});
const beamOuter = new THREE.Mesh(new THREE.CylinderGeometry(.26, 2.75, beamLen, 48, 1, true), beamMat);
beamOuter.position.y = -beamLen/2;
const beamInner = new THREE.Mesh(new THREE.CylinderGeometry(.16, 1.7, beamLen, 40, 1, true), beamMat);
beamInner.position.y = -beamLen/2;
beamGroup.add(beamOuter, beamInner);

/* lamp housing */
const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.34, .48, .72, 24),
  new THREE.MeshStandardMaterial({ color:0x14100f, roughness:.55, metalness:.5 }));
barrel.position.y = .3;
const lensMat = new THREE.MeshStandardMaterial({ color:0x110d0c, emissive:0xffd9a0, emissiveIntensity:0 });
const lens = new THREE.Mesh(new THREE.CircleGeometry(.34, 24), lensMat);
lens.rotation.x = -Math.PI/2;
lens.position.y = -.07;
beamGroup.add(barrel, lens);

/* pool of light on the floor */
const pool = new THREE.Mesh(new THREE.CircleGeometry(3, 40),
  new THREE.MeshBasicMaterial({ map:glowTex, transparent:true, depthWrite:false,
    blending:THREE.AdditiveBlending, opacity:0, color:0xffc98d }));
pool.rotation.x = -Math.PI/2;
pool.position.y = .015;
sceneB.add(pool);

const fillLight = new THREE.PointLight(0xffd2b0, 0, 15, 2);
fillLight.position.set(0, 2.7, 7.2);
sceneB.add(fillLight);

function setSpot(v) {
  spot.intensity = 240 * v;
  fillLight.intensity = 8 * v;
  beamUniforms.uOpacity.value = .38 * v;
  pool.material.opacity = .17 * v;
  lensMat.emissiveIntensity = 3.2 * v;
}
const spotState = { v:0 };

/* dust motes inside the beam */
{
  const N = 130;
  const pos = new Float32Array(N*3), aP = new Float32Array(N), aR = new Float32Array(N),
        aT = new Float32Array(N), aS = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    aP[i] = Math.random() * beamLen;
    aR[i] = Math.pow(Math.random(), .6);
    aT[i] = Math.random() * Math.PI * 2;
    aS[i] = .5 + Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aP', new THREE.BufferAttribute(aP, 1));
  geo.setAttribute('aR', new THREE.BufferAttribute(aR, 1));
  geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
  geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  const mat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uTime:{ value:0 }, uAlpha:{ value:0 }, uPR:{ value:renderer.getPixelRatio() }, uLen:{ value:beamLen } },
    vertexShader:`
      uniform float uTime; uniform float uPR; uniform float uLen;
      attribute float aP; attribute float aR; attribute float aT; attribute float aS;
      varying float vA;
      void main(){
        float p = mod(aP + uTime * aS * .28, uLen);
        float rad = (2.55 * (p / uLen) + .1) * aR;
        float th = aT + uTime * .06 * aS;
        vec3 pp = vec3(cos(th) * rad, -p, sin(th) * rad);
        vec4 mv = modelViewMatrix * vec4(pp, 1.0);
        vA = smoothstep(0.0, 1.2, p) * smoothstep(uLen, uLen - 1.5, p);
        gl_PointSize = (4.0 + 6.0 * aR) * uPR * (7.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader:`
      uniform float uAlpha; varying float vA;
      void main(){
        float d = length(gl_PointCoord - .5);
        float a = pow(smoothstep(.5, .0, d), 2.2);
        gl_FragColor = vec4(vec3(1.0, .87, .7), a * vA * uAlpha);
      }`
  });
  const dust = new THREE.Points(geo, mat);
  dust.frustumCulled = false;
  beamGroup.add(dust);
  beamGroup.userData.dustMat = mat;
}

/* -------- curtains -------- */
function waveCurtain(w, h, segs, amp) {
  const geo = new THREE.PlaneGeometry(w, h, segs, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, Math.sin(x * 1.15) * amp + Math.sin(x * 2.9 + 1.3) * amp * .35);
  }
  geo.computeVertexNormals();
  return geo;
}
const curtainMat = new THREE.MeshStandardMaterial({ color:0x8e4360, roughness:.85 });
const backdrop = new THREE.Mesh(waveCurtain(26, 11, 110, .38), curtainMat);
backdrop.position.set(0, 5.5, -6.5);
sceneB.add(backdrop);
for (const sx of [-1, 1]) {
  const leg = new THREE.Mesh(waveCurtain(4.4, 12, 30, .42), curtainMat);
  leg.position.set(sx * 7.6, 6, -4.6);
  leg.rotation.y = -sx * .28;
  sceneB.add(leg);
}

/* -------- confetti -------- */
const CONF_N = RM ? 100 : 240;
const CONF_COLORS = ['#f6a9c1','#a9dcc4','#c9b1ec','#ffd98e','#9fd0f2','#e8b84b','#fff3e2'];
const confetti = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(.065, .095),
  new THREE.MeshStandardMaterial({ side:THREE.DoubleSide, roughness:.6, metalness:.15 }), CONF_N);
confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
{
  const c = new THREE.Color();
  for (let i = 0; i < CONF_N; i++) {
    confetti.setColorAt(i, c.set(CONF_COLORS[i % CONF_COLORS.length]));
    dummy.position.set(0, -50, 0); dummy.updateMatrix();
    confetti.setMatrixAt(i, dummy.matrix);
  }
}
sceneB.add(confetti);
const confPieces = Array.from({ length:CONF_N }, () => ({
  active:false, rest:0,
  p:new THREE.Vector3(0,-50,0), v:new THREE.Vector3(), r:new THREE.Euler(),
  rv:new THREE.Vector3(), sway:Math.random()*Math.PI*2, scale:1
}));
function confettiBurst(count, origin, power) {
  let fired = 0;
  for (const pc of confPieces) {
    if (fired >= count) break;
    if (pc.active && pc.rest < 6) continue;
    pc.active = true; pc.rest = 0; pc.scale = 1;
    pc.p.set(origin.x + (Math.random()-.5)*.5, origin.y + (Math.random()-.5)*.3, origin.z + (Math.random()-.5)*.5);
    const a = Math.random()*Math.PI*2;
    const rr = (Math.random()*.9 + .35) * power;
    pc.v.set(Math.cos(a)*rr, (1.6 + Math.random()*2.4) * power * .8, Math.sin(a)*rr*.8);
    pc.r.set(Math.random()*7, Math.random()*7, Math.random()*7);
    pc.rv.set((Math.random()-.5)*9, (Math.random()-.5)*9, (Math.random()-.5)*9);
    fired++;
  }
}
function updateConfetti(dt) {
  let dirty = false;
  for (let i = 0; i < CONF_N; i++) {
    const pc = confPieces[i];
    if (!pc.active) continue;
    dirty = true;
    if (pc.p.y > .02) {
      pc.v.y -= 3.6 * dt;
      pc.v.multiplyScalar(1 - .6*dt);
      pc.sway += dt * 3;
      pc.p.x += (pc.v.x + Math.sin(pc.sway)*.35) * dt;
      pc.p.y += pc.v.y * dt;
      pc.p.z += pc.v.z * dt;
      pc.r.x += pc.rv.x * dt; pc.r.y += pc.rv.y * dt; pc.r.z += pc.rv.z * dt;
      if (pc.p.y <= .02) { pc.p.y = .02; pc.r.set(-Math.PI/2 + (Math.random()-.5)*.4, 0, Math.random()*7); }
    } else {
      pc.rest += dt;
      if (pc.rest > 7) {
        pc.scale = Math.max(0, pc.scale - dt);
        if (pc.scale === 0) { pc.active = false; pc.p.y = -50; }
      }
    }
    dummy.position.copy(pc.p);
    dummy.rotation.copy(pc.r);
    dummy.scale.setScalar(pc.scale);
    dummy.updateMatrix();
    confetti.setMatrixAt(i, dummy.matrix);
  }
  if (dirty) confetti.instanceMatrix.needsUpdate = true;
}

/* -------- balloons -------- */
const balloons = [];
const BALLOON_COLORS = [0xf291b1, 0x9fd8bf, 0xc9b1e8, 0xffce7a, 0x9fc7ef, 0xf6c3d0];
for (let i = 0; i < 6; i++) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color:BALLOON_COLORS[i], roughness:.28, metalness:.05,
    emissive:BALLOON_COLORS[i], emissiveIntensity:.3 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.3, 22, 18), mat);
  ball.scale.set(1, 1.16, 1);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(.05, .07, 10), mat);
  knot.position.y = -.38; knot.rotation.x = Math.PI;
  const strGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-.42,0), new THREE.Vector3(.04,-1.7,0)]);
  const string = new THREE.Line(strGeo, new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:.35 }));
  g.add(ball, knot, string);
  const side = i % 2 === 0 ? -1 : 1;
  g.visible = false;
  sceneB.add(g);
  balloons.push({ g, side, phase:Math.random()*9, rise:.4, going:false });
}
function placeBalloon(b, y) {   // x spread depends on aspect so phones keep them in view
  const t = THREE.MathUtils.clamp((camB.aspect - .45) / 1.45, 0, 1);   // 0 = phone portrait, 1 = wide screen
  b.g.position.set(
    b.side * (THREE.MathUtils.lerp(1.15, 2.4, t) + Math.random() * THREE.MathUtils.lerp(.35, 1.4, t)),
    y, -2 - Math.random() * 1.8);
  b.rise = .38 + Math.random() * .25;
}
function launchBalloons() {
  balloons.forEach((b, i) => { placeBalloon(b, 1.2 - i * .9 + Math.random() * .3); b.g.visible = true; b.going = true; });
}

/* ============================================================================
   AUDIO — all synthesized
============================================================================ */
const sfx = (() => {
  let ctx = null, master = null, echo = null, noiseBuf = null;
  let muted = !CONFIG.sound;
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return false; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : .5;
    master.connect(ctx.destination);
    echo = ctx.createDelay(1);
    echo.delayTime.value = .29;
    const fb = ctx.createGain(); fb.gain.value = .24;
    const wet = ctx.createGain(); wet.gain.value = .32;
    echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1;
    return true;
  }
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
  function note(freq, t, vel = .16, dec = 1.35) {
    if (!ctx) return;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + .008);
    g.gain.exponentialRampToValueAtTime(.0001, t + dec);
    o.connect(g); g.connect(master); g.connect(echo);
    o.start(t); o.stop(t + dec + .05);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.76;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(.0001, t);
    g2.gain.exponentialRampToValueAtTime(vel * .14, t + .006);
    g2.gain.exponentialRampToValueAtTime(.0001, t + dec * .3);
    o2.connect(g2); g2.connect(master);
    o2.start(t); o2.stop(t + dec * .35);
  }
  function noise(t, dur, { type = 'bandpass', f0 = 800, f1 = 800, q = 1, vel = .3 } = {}) {
    if (!ctx) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(f1, 30), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + dur * .25);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + .05);
  }
  const MELODY = [
    [74,.75],[74,.25],[76,1],[74,1],[79,1],[78,1.75],[0,.25],
    [74,.75],[74,.25],[76,1],[74,1],[81,1],[79,1.75],[0,.25],
    [74,.75],[74,.25],[86,1],[83,1],[79,1],[78,1],[76,1.75],[0,.25],
    [84,.75],[84,.25],[83,1],[79,1],[81,1],[79,2]
  ];
  return {
    ensure,
    toggle() {
      muted = !muted;
      if (ctx) {
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.linearRampToValueAtTime(muted ? 0 : .5, now + .15);
      }
      return muted;
    },
    get muted() { return muted; },
    pop() { if (!ensure()) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(340, t);
      o.frequency.exponentialRampToValueAtTime(68, t + .1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(.5, t);
      g.gain.exponentialRampToValueAtTime(.0001, t + .13);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + .15);
      noise(t, .05, { type:'highpass', f0:2500, f1:2500, vel:.18 });
    },
    chime() { if (!ensure()) return;
      const t = ctx.currentTime;
      [88, 91, 95, 98].forEach((m, i) => note(midiHz(m), t + i * .07, .09, .9));
    },
    whoosh() { if (!ensure()) return;
      const t = ctx.currentTime;
      noise(t, 1.5, { type:'lowpass', f0:160, f1:2400, q:.7, vel:.34 });
    },
    snap() { if (!ensure()) return;
      const t = ctx.currentTime;
      noise(t, .05, { type:'highpass', f0:1800, f1:1800, vel:.3 });
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 66;
      const g = ctx.createGain();
      g.gain.setValueAtTime(.55, t);
      g.gain.exponentialRampToValueAtTime(.0001, t + .3);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + .32);
    },
    tink(i) { if (!ensure()) return;
      const t = ctx.currentTime;
      note(midiHz([91, 93, 95, 98, 100][i % 5]), t, .08, .7);
    },
    puff(i) { if (!ensure()) return;
      const t = ctx.currentTime;
      noise(t, .22, { type:'bandpass', f0:520 + i * 60, f1:260, q:1.4, vel:.3 });
    },
    sparkle() { if (!ensure()) return;
      const t = ctx.currentTime;
      for (let i = 0; i < 7; i++)
        note(midiHz([93, 95, 98, 100, 103][Math.floor(Math.random()*5)]), t + i * .045, .06, .55);
    },
    melody() { if (!ensure()) return;
      let t = ctx.currentTime + .55;
      const beat = .52;
      for (const [m, b] of MELODY) {
        if (m > 0) note(midiHz(m), t, .15, Math.max(1.1, b * beat * 1.9));
        t += b * beat;
      }
    }
  };
})();

/* ============================================================================
   INPUT + UI
============================================================================ */
const pointer = { x:0, y:0, sx:0, sy:0 };
addEventListener('pointermove', e => {
  if (TOUCH) return;
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = (e.clientY / innerHeight) * 2 - 1;
});

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
let hoverEnv = false;
addEventListener('pointermove', e => {
  if (phase !== 'idle') { if (hoverEnv) { hoverEnv = false; document.body.style.cursor = ''; } return; }
  pointerNDC.set((e.clientX/innerWidth)*2 - 1, -(e.clientY/innerHeight)*2 + 1);
  raycaster.setFromCamera(pointerNDC, camA);
  const hit = raycaster.intersectObjects([slab, flapOuter, wax], false);
  const h = hit.length > 0;
  if (h !== hoverEnv) {
    hoverEnv = h;
    document.body.style.cursor = h ? 'pointer' : '';
    gsap.to(env.scale, { x:h?1.035:1, y:h?1.035:1, z:h?1.035:1, duration:.45, ease:'back.out(2)' });
  }
});

addEventListener('pointerdown', () => {
  if (phase === 'idle') openEnvelope();
  else if (phase === 'lit') blowOut();
});

ui.mute.addEventListener('click', e => {
  e.stopPropagation();
  sfx.ensure();
  ui.mute.textContent = sfx.toggle() ? '🔇' : '🔊';
});
ui.mute.addEventListener('pointerdown', e => e.stopPropagation());
$('#replay').addEventListener('click', () => location.reload());
$('#relight').addEventListener('click', e => { e.stopPropagation(); relight(); });
ui.actions.addEventListener('pointerdown', e => e.stopPropagation());
if (!CONFIG.sound) ui.mute.textContent = '🔇';

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  for (const c of [camA, camB]) { c.aspect = innerWidth/innerHeight; c.updateProjectionMatrix(); }
  camABaseZ = envelopeFitZ();
  if (phase === 'idle') camA.position.z = camABaseZ;
  fitSign();
});

/* ============================================================================
   CHOREOGRAPHY
============================================================================ */
let idleWeight = { v:1 };
let parallaxW = { v:1 };

function openEnvelope() {
  phase = 'opening';
  sfx.ensure();
  document.body.style.cursor = '';
  gsap.killTweensOf(ui.hint);
  gsap.to(ui.hint, { opacity:0, duration:.4 });
  gsap.to(idleWeight, { v:0, duration:.6 });
  gsap.to(parallaxW, { v:0, duration:.6 });

  const tl = gsap.timeline({ defaults:{ ease:'power2.inOut' } });

  tl.to(env.rotation, { x:0, y:0, z:0, duration:.55, ease:'power2.out' }, 0)
    .to(env.position, { x:0, y:0, z:0, duration:.55, ease:'power2.out' }, 0)
    .to(env.scale, { x:1.05, y:1.05, z:1.05, duration:.55, ease:'back.out(1.8)' }, 0)
    .to(camA.position, { x:0, y:.2, z:camABaseZ, duration:.55, ease:'power2.out' }, 0);

  tl.addLabel('seal', .42);
  tl.to(seal.rotation, { z:.16, duration:.06, repeat:5, yoyo:true, ease:'none' }, 'seal')
    .call(() => sfx.pop(), null, 'seal+=.36')
    .to(seal.position, { z:'+=1.6', duration:.6, ease:'power1.out' }, 'seal+=.36')
    .to(seal.position, { y:'+=.7', duration:.24, ease:'power2.out' }, 'seal+=.36')
    .to(seal.position, { y:'-=2.6', duration:.42, ease:'power2.in' }, 'seal+=.6')
    .to(seal.rotation, { x:-6.5, duration:.66, ease:'power1.in' }, 'seal+=.36')
    .to([waxMat, heartMat], { opacity:0, duration:.2, ease:'power1.in' }, 'seal+=.82');

  tl.addLabel('flap', 'seal+=.5');
  tl.to(flap.rotation, { x:3.02, duration:1.05, ease:'back.out(1.15)' }, 'flap');

  tl.addLabel('glow', 'flap+=.45');
  tl.call(() => { sfx.chime(); fireBurst(); }, null, 'glow')
    .to(mouthGlow.material, { opacity:.9, duration:.5, ease:'power1.out' }, 'glow')
    .to(mouthGlow.scale, { x:1.45, y:1.45, z:1.45, duration:.6, ease:'power2.out' }, 'glow');

  tl.addLabel('dive', 'glow+=.75');
  if (RM) {
    tl.call(() => sfx.whoosh(), null, 'dive')
      .to(ui.fade, { opacity:1, duration:.7, ease:'power1.inOut' }, 'dive')
      .call(enterStage, null, 'dive+=.75');
  } else {
    const curve = new THREE.QuadraticBezierCurve3(
      camA.position.clone(),
      new THREE.Vector3(0, 1.2, 2.3),
      new THREE.Vector3(0, .88, .3)
    );
    const dive = { p:0 };
    const lookFrom = lookA.clone(), lookTo = new THREE.Vector3(0, .6, -.15);
    tl.call(() => { sfx.whoosh(); curve.v0.copy(camA.position); }, null, 'dive')
      .to(dive, {
        p:1, duration:1.5, ease:'power2.in',
        onUpdate:() => {
          curve.getPoint(dive.p, camA.position);
          lookA.lerpVectors(lookFrom, lookTo, dive.p);
        }
      }, 'dive')
      .to(camA, { fov:60, duration:1.5, ease:'power2.in', onUpdate:() => camA.updateProjectionMatrix() }, 'dive')
      .to(mouthGlow.scale, { x:7, y:7, z:7, duration:1.4, ease:'power2.in' }, 'dive')
      .to(ui.fade, { opacity:1, duration:.42, ease:'power1.in' }, 'dive+=1.05')
      .call(enterStage, null, 'dive+=1.5');
  }
}

function enterStage() {
  phase = 'dark';
  setSpot(0);
  reveal();
}

function reveal() {
  const tl = gsap.timeline();
  tl.to(ui.fade, { opacity:0, duration:.5, ease:'power1.out' }, .15);

  tl.addLabel('snap', .95);
  const S = (v, at) => tl.call(() => setSpot(v), null, at);
  tl.call(() => sfx.snap(), null, 'snap');
  S(1,   'snap');
  S(0,   'snap+=.07');
  S(.85, 'snap+=.14');
  S(.1,  'snap+=.2');
  S(.55, 'snap+=.27');
  tl.call(() => {
    spotState.v = .55;
    gsap.to(spotState, { v:1, duration:.7, ease:'power2.out', onUpdate:() => setSpot(spotState.v) });
    gsap.to(beamGroup.userData.dustMat.uniforms.uAlpha, { value:.55, duration:1.2 });
  }, null, 'snap+=.34');

  tl.call(() => { phase = 'reveal'; sfx.melody(); }, null, 'snap+=.55');

  for (let i = 0; i < CONFIG.candles; i++)
    tl.call(() => igniteFlame(i), null, `snap+=${(1.05 + i * .27).toFixed(2)}`);

  tl.to(hemiB, { intensity:.34, duration:2.4, ease:'sine.inOut' }, 'snap+=1.5')
    .to(rimB, { intensity:.8, duration:2.4, ease:'sine.inOut' }, 'snap+=1.5');

  tl.call(() => {
    gsap.to(sign.material, { opacity:1, duration:1.6, ease:'power2.out' });
    gsap.fromTo(sign.scale, { x:.9, y:.9, z:.9 }, { x:1, y:1, z:1, duration:1.6, ease:'power2.out' });
  }, null, 'snap+=2.35');

  tl.call(() => {
    confettiBurst(RM ? 70 : 150, new THREE.Vector3(0, 3.6, .4), 1.15);
    sfx.sparkle();
  }, null, 'snap+=2.6');

  tl.call(launchBalloons, null, 'snap+=2.9');
  tl.call(() => { phase = 'lit'; }, null, 'snap+=3');

  const dollyZ = Math.min(7.6, Math.max(6.15, 1.35 / (Math.tan(THREE.MathUtils.degToRad(21)) * camB.aspect)));
  if (!RM) tl.to(camB.position, { z:dollyZ, duration:8, ease:'sine.inOut' }, 'snap+=.4');

  tl.call(() => {
    if (phase === 'lit') gsap.to(ui.wish, { opacity:1, duration:.9 });
  }, null, 'snap+=5');
}

function blowOut() {
  phase = 'blowing';
  gsap.killTweensOf(ui.wish);
  gsap.to(ui.wish, { opacity:0, duration:.3 });
  const tl = gsap.timeline();
  for (let i = 0; i < CONFIG.candles; i++)
    tl.call(() => { blowFlame(i); sfx.puff(i); }, null, i * .09);
  tl.to(candleLight.userData, { base:0, duration:.5 }, .1);
  tl.call(() => {
    gsap.to(spotState, { v:.62, duration:.9, ease:'sine.inOut', onUpdate:() => setSpot(spotState.v) });
  }, null, .3);
  tl.call(() => {
    gsap.fromTo(ui.toast, { opacity:0, y:8 }, { opacity:1, y:0, duration:.8 });
    confettiBurst(RM ? 60 : 130, new THREE.Vector3(0, 3.5, .6), 1.35);
    sfx.sparkle();
  }, null, .9);
  tl.call(() => {
    phase = 'blown';
    ui.actions.style.pointerEvents = 'auto';
    gsap.to(ui.actions, { opacity:1, duration:.7 });
  }, null, 1.7);
}

function relight() {
  if (phase !== 'blown') return;
  phase = 'reveal';
  ui.actions.style.pointerEvents = 'none';
  gsap.to(ui.actions, { opacity:0, duration:.4 });
  gsap.to(ui.toast, { opacity:0, duration:.4 });
  gsap.to(spotState, { v:1, duration:1, ease:'sine.inOut', onUpdate:() => setSpot(spotState.v) });
  const tl = gsap.timeline();
  for (let i = 0; i < CONFIG.candles; i++)
    tl.call(() => igniteFlame(i), null, .3 + i * .22);
  tl.call(() => sfx.melody(), null, .2);
  tl.call(() => { phase = 'lit'; }, null, .3 + CONFIG.candles * .22 + .3);
  tl.call(() => { if (phase === 'lit') gsap.to(ui.wish, { opacity:1, duration:.9 }); }, null, 6);
}

/* ============================================================================
   FRAME LOOP
============================================================================ */
let firstFrame = false;
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), .05);
  elapsed += dt;
  pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 4);
  pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 4);

  const inA = phase === 'idle' || phase === 'opening';

  if (inA) {
    const w = idleWeight.v * (RM ? .25 : 1);
    env.position.y = Math.sin(elapsed * 1.1) * .06 * w;
    env.rotation.z = .02 + Math.sin(elapsed * .7 + 1) * .02 * w;
    env.rotation.y = .12 * idleWeight.v + Math.sin(elapsed * .5) * .045 * w + pointer.sx * .1 * parallaxW.v;
    env.rotation.x = -.06 * idleWeight.v + pointer.sy * .06 * parallaxW.v;
    if (phase === 'idle') {
      camA.position.x = pointer.sx * .35 * parallaxW.v;
      camA.position.y = .2 - pointer.sy * .22 * parallaxW.v;
    }
    camA.lookAt(lookA);
    sparklesA.material.uniforms.uTime.value = elapsed;
    mouthGlow.material.opacity && (mouthGlow.material.rotation += dt * .3);
    if (burstLife >= 0) {
      burstLife += dt;
      const p = burstGeo.attributes.position.array;
      for (let i = 0; i < BURST_N; i++) {
        p[i*3]   += burstVel[i].x * dt;
        p[i*3+1] += (burstVel[i].y - burstLife * 1.6) * dt;
        p[i*3+2] += burstVel[i].z * dt;
      }
      burstGeo.attributes.position.needsUpdate = true;
      burstMat.opacity = Math.max(0, 1 - burstLife / 1.6);
      if (burstLife > 1.7) burstLife = -1;
    }
    renderer.render(sceneA, camA);
  } else {
    stageT += dt;
    rig.rotation.y = Math.sin(stageT * .07) * (RM ? .05 : .12) + pointer.sx * (RM ? .04 : .15);
    rig.rotation.x = pointer.sy * .05;
    signPivot.rotation.y = rig.rotation.y * .8;
    camB.lookAt(0, 1.5, 0);

    const flick = Math.sin(elapsed*11.3) + .6*Math.sin(elapsed*17.7) + .4*Math.sin(elapsed*29.1);
    for (const f of flames) {
      const L = f.lit.v;
      const n = Math.sin(elapsed*11.3 + f.phase) + .6*Math.sin(elapsed*19.7 + f.phase*1.7);
      f.body.material.opacity = L * .85;
      f.core.material.opacity = L;
      f.glow.material.opacity = L * .26;
      const s = 1 + .1 * n;
      f.body.scale.set(.18 * (2 - s) * L + .001, .36 * s * L + .001, 1);
      f.core.scale.set(.085 * L + .001, .145 * s * L + .001, 1);
      f.glow.scale.setScalar(.42 * (1 + .07*n) * L + .001);
      f.body.position.x = Math.sin(elapsed*7 + f.phase) * .006;
      f.body.position.y = .0;
    }
    candleLight.intensity = candleLight.userData.base * (1 + .13 * flick * .3);

    beamUniforms.uTime.value = elapsed;
    beamGroup.userData.dustMat.uniforms.uTime.value = elapsed;

    updateConfetti(dt);

    for (const b of balloons) {
      if (!b.going) continue;
      b.g.position.y += b.rise * dt;                                         // float up and out of frame…
      b.g.position.x += Math.sin(elapsed * .4 + b.phase) * .0011;
      b.g.rotation.z = Math.sin(elapsed * .5 + b.phase) * .07;
      if (b.g.position.y > 7.5) placeBalloon(b, -1.5 - Math.random() * 2);   // …then drift back in from below
    }

    topCard.rotation.z = Math.sin(elapsed * .9) * .02;
    signGroup.position.y = 3.7 + Math.sin(elapsed * .6) * .06;

    renderer.render(sceneB, camB);
  }

  if (!firstFrame) {
    firstFrame = true;
    setTimeout(() => {
      ui.loader.classList.add('hidden');
      gsap.to(ui.hint, { opacity:1, duration:1, delay:.5 });
    }, 350);
  }
}
tick();

/* redraw text-bearing textures once the script fonts arrive */
document.fonts.ready.then(() => {
  document.fonts.load('150px "Great Vibes"').then(() => { redrawTex(topperTex); redrawTex(signTex); });
});
