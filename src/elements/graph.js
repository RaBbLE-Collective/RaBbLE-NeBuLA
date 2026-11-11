/**
 * elements/graph.js — <rabble-graph> custom element
 *
 * Cosmic Grimoire knowledge graph: entity eyes + portals + force-directed graph.
 * Self-contained — no external DOM hooks required. Three.js r160 lazy-loaded from CDN.
 *
 * Usage:
 *   <rabble-graph></rabble-graph>
 *   el.setData({ docs, kinds, seals, memberUV });
 *   el.zoomIn(); el.zoomOut(); el.resetView();
 *
 * Events (bubbles + composed):
 *   rabble-graph-ready    — after scene is mounted
 *   rabble-graph-select   — on node selection; detail: { doc, kind, seal, col }
 *   rabble-graph-deselect — on deselection
 *
 * Public methods:
 *   setData(data)         — { docs[], kinds[], seals{}, memberUV{} }
 *   zoomIn()
 *   zoomOut()
 *   resetView()
 *   focusOwner(ownerKey)
 *   narrateRandom(ownerKey?)
 *   owners()
 */

import { ensureThree } from '../utils/three-loader.js';

// Bilinear color field: magenta→pink / cyan→violet
const C00 = [0xff, 0x2d, 0x78]; // magenta (#ff2d78)
const C10 = [0xff, 0x79, 0xc6]; // pink    (#ff79c6)
const C01 = [0x00, 0xf5, 0xff]; // cyan    (#00f5ff)
const C11 = [0xbf, 0x5f, 0xff]; // violet  (#bf5fff)

const DEFAULT_MEMBER_UV = {
  'self':       [0.50, 0.50],
  'grimoire':   [0.50, 1.00],
  'aether':     [0.95, 0.90],
  'sCoRE':      [0.05, 0.05],
  'os':         [0.90, 0.10],
  'substrate':  [0.80, 0.15],
  'world':      [0.50, 0.10],
  'collective': [0.15, 0.60],
};

const DEFAULT_GRAPH_EDGES = [
  ['identity','palette'],   ['identity','roadmap'],  ['identity','ethos'],
  ['identity','lexicon'],   ['identity','e-rabble'],
  ['palette','e-aether'],   ['palette','identity'],
  ['roadmap','e-nebula'],   ['roadmap','e-aether'],  ['roadmap','e-score'],
  ['roadmap','e-os'],       ['roadmap','e-scribble'],['roadmap','e-rabble'],
  ['ethos','origin'],       ['ethos','collective'],  ['ethos','e-rabble'],
  ['collective','e-rabble'],['collective','e-aether'],['collective','e-nebula'],
  ['collective','e-score'], ['collective','e-os'],   ['collective','e-scribble'],
  ['origin','first'],       ['first','e-rabble'],
  ['lexicon','collective'], ['lexicon','ethos'],
  ['e-nebula','e-aether'],  ['e-nebula','e-rabble'], ['e-nebula','identity'],
  ['e-os','e-score'],       ['e-os','bootstrap'],
  ['e-score','e-rabble'],
  ['e-aether','runes'],     ['e-aether','orbital-b'],['e-aether','waveform'],
  ['e-aether','cast-aether'],
  ['pulse-proto','identity'],['pulse-proto','e-rabble'],
  ['sync','collective'],    ['status','collective'], ['status','e-score'],
  ['init','e-rabble'],      ['init','bootstrap'],    ['bootstrap','e-os'],
  ['summon','collective'],  ['cast-aether','palette'],
  ['s048','e-score'],       ['s047','e-score'],      ['s046','e-score'],
  ['s048','e-rabble'],
];

function bilinearRGB(u, v) {
  const r=Math.round(C00[0]*(1-u)*(1-v)+C10[0]*u*(1-v)+C01[0]*(1-u)*v+C11[0]*u*v);
  const g=Math.round(C00[1]*(1-u)*(1-v)+C10[1]*u*(1-v)+C01[1]*(1-u)*v+C11[1]*u*v);
  const b=Math.round(C00[2]*(1-u)*(1-v)+C10[2]*u*(1-v)+C01[2]*(1-u)*v+C11[2]*u*v);
  return { hex:(r<<16)|(g<<8)|b, css:`rgb(${r},${g},${b})` };
}

function buildGraph(hostEl, THREE, data, dispatch) {
  const docs      = Array.isArray(data.docs)   ? data.docs   : [];
  const KINDS_MAP = {};
  if (Array.isArray(data.kinds)) data.kinds.forEach(k=>{KINDS_MAP[k.id]=k;});
  const SEALS_MAP = (data.seals&&typeof data.seals==='object')?data.seals:{};
  const MEMBER_UV = data.memberUV||DEFAULT_MEMBER_UV;
  const GRAPH_EDGES = data.edges||DEFAULT_GRAPH_EDGES;

  function ownerColor(owner){return bilinearRGB(...(MEMBER_UV[owner]||[0.5,0.5]));}

  let W=hostEl.clientWidth||window.innerWidth;
  let H=hostEl.clientHeight||window.innerHeight;

  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setSize(W,H);
  renderer.setClearColor(0x000000,0);
  renderer.sortObjects=true;
  renderer.domElement.style.cssText='position:absolute;inset:0;';
  hostEl.appendChild(renderer.domElement);

  const scene=new THREE.Scene();
  let camX=0, camY=0, camZoom=1;
  const camera=new THREE.OrthographicCamera(-W/2,W/2,H/2,-H/2,0.1,1000);
  camera.position.z=500;

  // Eye constants
  const EYE_W=18, EYE_H=52, EYE_GAP=38, EYE_Y=0;
  const PRTF_W=60, PRTF_H=16, PRT_Y=68, PRT_RX=60, PRT_RY=16;
  const EXCLUSION_R=105;

  function ellipseMesh(rx,ry,color,opacity,blending,segs){
    segs=segs||32;
    const shape=new THREE.Shape();shape.absellipse(0,0,rx,ry,0,Math.PI*2,false,0);
    return new THREE.Mesh(new THREE.ShapeGeometry(shape,segs),
      new THREE.MeshBasicMaterial({color,transparent:true,opacity,blending:blending||THREE.NormalBlending,depthTest:false,depthWrite:false}));
  }
  function ringLine(rx,ry,color,opacity,segs,blending){
    segs=segs||80;blending=blending||THREE.NormalBlending;
    const pts=[];
    for(let i=0;i<=segs;i++){const a=(i/segs)*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*rx,Math.sin(a)*ry,0));}
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({color,transparent:true,opacity,blending,depthTest:false,depthWrite:false}));
  }
  function ellipseRingMesh(outerRx,outerRy,innerRx,innerRy,color,opacity,segs){
    segs=segs||64;
    const shape=new THREE.Shape();shape.absellipse(0,0,outerRx,outerRy,0,Math.PI*2,false);
    const hole=new THREE.Path();hole.absellipse(0,0,innerRx,innerRy,0,Math.PI*2,false);
    shape.holes.push(hole);
    return new THREE.Mesh(new THREE.ShapeGeometry(shape,segs),
      new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));
  }
  function drawInArc(rx,ry,color,baseOpacity,segs){
    segs=segs||80;
    const positions=new Float32Array((segs+1)*3);
    for(let i=0;i<=segs;i++){const a=(i/segs)*Math.PI*2;positions[i*3]=Math.cos(a)*rx;positions[i*3+1]=Math.sin(a)*ry;}
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setDrawRange(0,0);
    const mat=new THREE.LineBasicMaterial({color,transparent:true,opacity:0,depthTest:false,depthWrite:false});
    return{line:new THREE.Line(geo,mat),geo,mat,segs,baseOpacity};
  }

  // Eye scene objects
  const leftCorona=ellipseMesh(EYE_W+40,EYE_H+30,0x00f5ff,0.12,THREE.AdditiveBlending,24);
  const rightCorona=ellipseMesh(EYE_W+40,EYE_H+30,0xff2d78,0.12,THREE.AdditiveBlending,24);
  leftCorona.position.set(-EYE_GAP,EYE_Y,0);leftCorona.renderOrder=9;
  rightCorona.position.set(EYE_GAP,EYE_Y,0);rightCorona.renderOrder=9;
  scene.add(leftCorona,rightCorona);

  const leftPortalFill=ellipseMesh(PRTF_W,PRTF_H,0x010108,0.95,THREE.NormalBlending,32);
  const rightPortalFill=ellipseMesh(PRTF_W,PRTF_H,0x010108,0.95,THREE.NormalBlending,32);
  leftPortalFill.position.set(-EYE_GAP,EYE_Y+PRT_Y,0);leftPortalFill.renderOrder=10;
  rightPortalFill.position.set(EYE_GAP,EYE_Y-PRT_Y,0);rightPortalFill.renderOrder=10;
  scene.add(leftPortalFill,rightPortalFill);

  const leftEye=ellipseMesh(EYE_W,EYE_H,0xf8faff,1.0,THREE.NormalBlending);
  const rightEye=ellipseMesh(EYE_W,EYE_H,0xf8faff,1.0,THREE.NormalBlending);
  leftEye.position.set(-EYE_GAP,EYE_Y,0);leftEye.renderOrder=11;
  rightEye.position.set(EYE_GAP,EYE_Y,0);rightEye.renderOrder=11;
  scene.add(leftEye,rightEye);

  const leftInner=ellipseMesh(EYE_W+4,EYE_H+6,0x00f5ff,0.28,THREE.AdditiveBlending,24);
  const rightInner=ellipseMesh(EYE_W+4,EYE_H+6,0xff2d78,0.28,THREE.AdditiveBlending,24);
  leftInner.position.set(-EYE_GAP,EYE_Y,0);leftInner.renderOrder=11;
  rightInner.position.set(EYE_GAP,EYE_Y,0);rightInner.renderOrder=11;
  scene.add(leftInner,rightInner);

  const leftRingGlow=ellipseMesh(EYE_W+16,EYE_H+20,0x00f5ff,0.20,THREE.AdditiveBlending,32);
  const rightRingGlow=ellipseMesh(EYE_W+16,EYE_H+20,0xff2d78,0.20,THREE.AdditiveBlending,32);
  leftRingGlow.position.set(-EYE_GAP,EYE_Y,0);leftRingGlow.renderOrder=11;
  rightRingGlow.position.set(EYE_GAP,EYE_Y,0);rightRingGlow.renderOrder=11;
  scene.add(leftRingGlow,rightRingGlow);

  const leftRing=ellipseRingMesh(EYE_W+5,EYE_H+10,EYE_W,EYE_H,0x00f5ff,0.85);
  const rightRing=ellipseRingMesh(EYE_W+5,EYE_H+10,EYE_W,EYE_H,0xff2d78,0.85);
  leftRing.position.set(-EYE_GAP,EYE_Y,0);leftRing.renderOrder=12;
  rightRing.position.set(EYE_GAP,EYE_Y,0);rightRing.renderOrder=12;
  scene.add(leftRing,rightRing);

  function addPortalHalos(cx,cy,color,rOrder){
    [[10,0.12],[6,0.18],[3,0.22]].forEach(function(pair){
      const dr=pair[0],opacity=pair[1];
      const ring=ringLine(PRT_RX+dr,PRT_RY+Math.round(dr*0.5),color,opacity,80,THREE.AdditiveBlending);
      ring.position.set(cx,cy,0);ring.renderOrder=rOrder;scene.add(ring);
    });
  }
  addPortalHalos(-EYE_GAP,EYE_Y+PRT_Y,0x00f5ff,12);
  addPortalHalos(EYE_GAP,EYE_Y-PRT_Y,0xff2d78,12);

  const leftPortalGlow=ringLine(PRT_RX+2,PRT_RY+1,0x00f5ff,0.60,80,THREE.AdditiveBlending);
  const rightPortalGlow=ringLine(PRT_RX+2,PRT_RY+1,0xff2d78,0.60,80,THREE.AdditiveBlending);
  leftPortalGlow.position.set(-EYE_GAP,EYE_Y+PRT_Y,0);leftPortalGlow.renderOrder=12;
  rightPortalGlow.position.set(EYE_GAP,EYE_Y-PRT_Y,0);rightPortalGlow.renderOrder=12;
  scene.add(leftPortalGlow,rightPortalGlow);

  const leftArc=drawInArc(PRT_RX,PRT_RY,0x00f5ff,0.85);
  const rightArc=drawInArc(PRT_RX,PRT_RY,0xff2d78,0.85);
  leftArc.line.position.set(-EYE_GAP,EYE_Y+PRT_Y,0);leftArc.line.renderOrder=13;
  rightArc.line.position.set(EYE_GAP,EYE_Y-PRT_Y,0);rightArc.line.renderOrder=13;
  scene.add(leftArc.line,rightArc.line);

  // Neural connections
  const NEURAL_COUNT=4;
  const neuralBuf=new Float32Array(NEURAL_COUNT*2*2*6);
  const neuralGeo=new THREE.BufferGeometry();
  neuralGeo.setAttribute('position',new THREE.BufferAttribute(neuralBuf,3));
  neuralGeo.setDrawRange(0,0);
  const neuralMat=new THREE.LineBasicMaterial({color:0x00f5ff,transparent:true,opacity:0.18,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false});
  const neuralLines=new THREE.LineSegments(neuralGeo,neuralMat);
  neuralLines.renderOrder=8;scene.add(neuralLines);

  // Labels container
  const labelsEl=document.createElement('div');
  labelsEl.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden;';
  hostEl.appendChild(labelsEl);

  // Graph nodes
  const NODE_R=10, HALO_R=20;
  const nodeMap={}, nodeList=[];

  docs.forEach(function(doc,i){
    const angle=(i/docs.length)*Math.PI*2+Math.random()*0.4;
    const spread=EXCLUSION_R+70+Math.random()*160;
    const x=Math.cos(angle)*spread, y=Math.sin(angle)*spread;
    const col=ownerColor(doc.owner);
    const mesh=new THREE.Mesh(new THREE.CircleGeometry(NODE_R,20),
      new THREE.MeshBasicMaterial({color:col.hex,transparent:true,opacity:0.92}));
    mesh.position.set(x,y,0);mesh.renderOrder=1;scene.add(mesh);
    const hMesh=new THREE.Mesh(new THREE.CircleGeometry(HALO_R,20),
      new THREE.MeshBasicMaterial({color:col.hex,transparent:true,opacity:0.18,blending:THREE.AdditiveBlending,depthWrite:false}));
    hMesh.position.set(x,y,0);hMesh.renderOrder=0;scene.add(hMesh);
    const label=document.createElement('div');
    label.className='graph-label';label.textContent=doc.name;
    labelsEl.appendChild(label);
    const node={i,x,y,vx:0,vy:0,pinned:false,mesh,hMesh,label,doc,col};
    nodeMap[doc.id]=node;nodeList.push(node);
  });

  // Graph edges
  const validEdges=GRAPH_EDGES.filter(e=>nodeMap[e[0]]&&nodeMap[e[1]]);
  const eBuf=new Float32Array(validEdges.length*6);
  const eGeo=new THREE.BufferGeometry();eGeo.setAttribute('position',new THREE.BufferAttribute(eBuf,3));
  const eLines=new THREE.LineSegments(eGeo,new THREE.LineBasicMaterial({color:0x1a2a44,transparent:true,opacity:0.5}));
  eLines.renderOrder=0;scene.add(eLines);
  const hEBuf=new Float32Array(validEdges.length*6);
  const hEGeo=new THREE.BufferGeometry();hEGeo.setAttribute('position',new THREE.BufferAttribute(hEBuf,3));
  hEGeo.setDrawRange(0,0);
  const hELines=new THREE.LineSegments(hEGeo,new THREE.LineBasicMaterial({color:0x00f5ff,transparent:true,opacity:0.85,depthTest:false}));
  hELines.renderOrder=7;scene.add(hELines);

  function updateEdges(){
    let i=0;
    for(let ei=0;ei<validEdges.length;ei++){
      const na=nodeMap[validEdges[ei][0]],nb=nodeMap[validEdges[ei][1]];
      eBuf[i++]=na.x;eBuf[i++]=na.y;eBuf[i++]=0;eBuf[i++]=nb.x;eBuf[i++]=nb.y;eBuf[i++]=0;
    }
    eGeo.attributes.position.needsUpdate=true;
  }

  function updateHighlightEdges(nodeId){
    if(!nodeId){hEGeo.setDrawRange(0,0);return;}
    let c=0;
    for(let ei=0;ei<validEdges.length;ei++){
      const a=validEdges[ei][0],b=validEdges[ei][1];
      if(a===nodeId||b===nodeId){
        const na=nodeMap[a],nb=nodeMap[b];
        hEBuf[c*6]=na.x;hEBuf[c*6+1]=na.y;hEBuf[c*6+2]=0;hEBuf[c*6+3]=nb.x;hEBuf[c*6+4]=nb.y;hEBuf[c*6+5]=0;c++;
      }
    }
    hEGeo.attributes.position.needsUpdate=true;hEGeo.setDrawRange(0,c*2);
  }

  // Force simulation
  const REPULSION=5000,SPRING_K=0.028,REST_LEN=140,GRAVITY=0.001,COHESION=0.0025,DAMPING=0.84,MAX_V=12;
  function simStep(){
    const n=nodeList.length;
    for(let i=0;i<n;i++){
      const a=nodeList[i];
      for(let j=i+1;j<n;j++){
        const b=nodeList[j];
        const dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy+1,d=Math.sqrt(d2),inv=1/d;
        const rep=REPULSION/d2;
        const fx=dx*inv*rep,fy=dy*inv*rep;
        if(!a.pinned){a.vx+=fx;a.vy+=fy;}if(!b.pinned){b.vx-=fx;b.vy-=fy;}
        if(a.doc.owner===b.doc.owner){
          const cF=COHESION*d;
          if(!a.pinned){a.vx-=dx*inv*cF;a.vy-=dy*inv*cF;}
          if(!b.pinned){b.vx+=dx*inv*cF;b.vy+=dy*inv*cF;}
        }
      }
    }
    for(let ei=0;ei<validEdges.length;ei++){
      const a=nodeMap[validEdges[ei][0]],b=nodeMap[validEdges[ei][1]];
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)+0.01,f=SPRING_K*(d-REST_LEN);
      const fx=dx/d*f,fy=dy/d*f;
      if(!a.pinned){a.vx+=fx;a.vy+=fy;}if(!b.pinned){b.vx-=fx;b.vy-=fy;}
    }
    for(let ni=0;ni<nodeList.length;ni++){
      const nn=nodeList[ni];if(nn.pinned)continue;
      nn.vx-=nn.x*GRAVITY;nn.vy-=nn.y*GRAVITY;
      nn.vx*=DAMPING;nn.vy*=DAMPING;
      nn.vx=Math.max(-MAX_V,Math.min(MAX_V,nn.vx));nn.vy=Math.max(-MAX_V,Math.min(MAX_V,nn.vy));
      nn.x+=nn.vx;nn.y+=nn.vy;
      const dc=Math.sqrt(nn.x*nn.x+nn.y*nn.y);
      if(dc<EXCLUSION_R){
        const pf=EXCLUSION_R/(dc+0.01);nn.x*=pf;nn.y*=pf;
        const ux=nn.x/(dc+0.01),uy=nn.y/(dc+0.01),inw=nn.vx*(-ux)+nn.vy*(-uy);
        if(inw>0){nn.vx+=ux*inw;nn.vy+=uy*inw;}
      }
      nn.mesh.position.set(nn.x,nn.y,0);nn.hMesh.position.set(nn.x,nn.y,0);
    }
  }

  // Camera
  function applyCam(){
    const hw=W/2/camZoom,hh=H/2/camZoom;
    camera.left=camX-hw;camera.right=camX+hw;camera.top=camY+hh;camera.bottom=camY-hh;
    camera.updateProjectionMatrix();
  }
  const tmpVec=new THREE.Vector3();
  function worldToScreen(wx,wy){tmpVec.set(wx,wy,0);tmpVec.project(camera);return{sx:(tmpVec.x*0.5+0.5)*W,sy:(-tmpVec.y*0.5+0.5)*H};}
  function screenToWorld(cx,cy){return{x:((cx/W)*2-1)*(W/2/camZoom)+camX,y:(-(cy/H)*2+1)*(H/2/camZoom)+camY};}

  // Animation state
  let t=0,irisX=0,irisY=0,irisTargX=0,irisTargY=0;
  let blinkTimer=2500+Math.random()*3000,blinkPhase='idle',blinkT=0,eyeScaleY=1;
  let bootAlpha=0,portalProgress=0;

  function updateEyeAnimation(dt){
    bootAlpha=Math.min(1,bootAlpha+dt/1000);portalProgress=Math.min(1,portalProgress+dt/1400);
    blinkTimer-=dt;
    if(blinkTimer<=0&&blinkPhase==='idle'){blinkPhase='closing';blinkT=0;blinkTimer=2800+Math.random()*3500;}
    if(blinkPhase==='closing'){blinkT+=dt/80;if(blinkT>=1){blinkPhase='opening';blinkT=0;}eyeScaleY=1-blinkT*0.97;}
    else if(blinkPhase==='opening'){blinkT+=dt/130;if(blinkT>=1){blinkPhase='idle';blinkT=0;eyeScaleY=1;}else eyeScaleY=0.03+blinkT*0.97;}
    const sy=eyeScaleY*bootAlpha;
    [leftEye,leftInner,leftCorona,leftRingGlow,leftRing].forEach(m=>{m.scale.y=sy;});
    [rightEye,rightInner,rightCorona,rightRingGlow,rightRing].forEach(m=>{m.scale.y=sy;});
    leftPortalFill.material.opacity=0.95*bootAlpha;rightPortalFill.material.opacity=0.95*bootAlpha;
    const lp=portalProgress,rp=Math.max(0,portalProgress-0.08)*1.09;
    leftArc.geo.setDrawRange(0,Math.min(leftArc.segs,Math.floor(lp*leftArc.segs))+1);
    rightArc.geo.setDrawRange(0,Math.min(rightArc.segs,Math.floor(rp*rightArc.segs))+1);
    leftArc.mat.opacity=leftArc.baseOpacity*Math.min(1,lp*2);rightArc.mat.opacity=rightArc.baseOpacity*Math.min(1,rp*2);
    const pp=0.16+0.07*Math.sin(t*0.032);
    leftPortalGlow.material.opacity=pp*Math.min(1,lp*2);rightPortalGlow.material.opacity=pp*Math.min(1,rp*2);
    const gp=0.10+0.04*Math.sin(t*0.035);
    leftCorona.material.opacity=gp*bootAlpha;rightCorona.material.opacity=gp*bootAlpha;
    const gi=0.22+0.08*Math.sin(t*0.040+1.0);
    leftInner.material.opacity=gi*bootAlpha;rightInner.material.opacity=gi*bootAlpha;
    const rb=0.75+0.12*Math.sin(t*0.028+0.5);
    leftRing.material.opacity=rb*bootAlpha;rightRing.material.opacity=rb*bootAlpha;
    leftRingGlow.material.opacity=rb*0.22*bootAlpha;rightRingGlow.material.opacity=rb*0.22*bootAlpha;
    irisX+=(irisTargX-irisX)*0.07;irisY+=(irisTargY-irisY)*0.07;
    leftEye.position.set(-EYE_GAP+irisX*0.7,EYE_Y+irisY*0.7,0);
    rightEye.position.set(EYE_GAP+irisX*0.7,EYE_Y+irisY*0.7,0);
    leftInner.position.set(-EYE_GAP+irisX,EYE_Y+irisY,0);
    rightInner.position.set(EYE_GAP+irisX,EYE_Y+irisY,0);
  }

  function updateNeural(){
    const lx=-EYE_GAP,ly=EYE_Y,rx=EYE_GAP,ry=EYE_Y;
    const byLeft=nodeList.slice().sort((a,b)=>Math.hypot(a.x-lx,a.y-ly)-Math.hypot(b.x-lx,b.y-ly));
    const byRight=nodeList.slice().sort((a,b)=>Math.hypot(a.x-rx,a.y-ry)-Math.hypot(b.x-rx,b.y-ry));
    let ci=0;const pulse=0.1+0.09*Math.sin(t*0.04+1.2);neuralMat.opacity=pulse*bootAlpha;
    const nc=Math.min(NEURAL_COUNT,byLeft.length,byRight.length);
    for(let k=0;k<nc;k++){const nn=byLeft[k];if(!nn)break;neuralBuf[ci++]=lx;neuralBuf[ci++]=ly;neuralBuf[ci++]=0;neuralBuf[ci++]=nn.x;neuralBuf[ci++]=nn.y;neuralBuf[ci++]=0;}
    for(let k=0;k<nc;k++){const nn=byRight[k];if(!nn)break;neuralBuf[ci++]=rx;neuralBuf[ci++]=ry;neuralBuf[ci++]=0;neuralBuf[ci++]=nn.x;neuralBuf[ci++]=nn.y;neuralBuf[ci++]=0;}
    neuralGeo.attributes.position.needsUpdate=true;neuralGeo.setDrawRange(0,NEURAL_COUNT*2*2);
  }

  function updateLabels(){
    const sr=NODE_R*camZoom;
    for(let ni=0;ni<nodeList.length;ni++){
      const nn=nodeList[ni];const s=worldToScreen(nn.x,nn.y);
      nn.label.style.left=s.sx+'px';nn.label.style.top=(s.sy+sr+5)+'px';
    }
  }

  // Interaction
  const MIN_ZOOM=0.25,MAX_ZOOM=4;
  let dragNode=null,isPanning=false,panStart={x:0,y:0},panCamOrig={x:0,y:0};
  let hoveredNode=null,selectedNode=null;

  function pickNode(clientX,clientY){
    const rect=renderer.domElement.getBoundingClientRect();
    const {x,y}=screenToWorld(clientX-rect.left,clientY-rect.top);
    let best=null,bestD=Infinity;
    for(let ni=0;ni<nodeList.length;ni++){const nn=nodeList[ni];const d=Math.hypot(nn.x-x,nn.y-y);if(d<HALO_R&&d<bestD){bestD=d;best=nn;}}
    return best;
  }

  function aimEyesAt(wx,wy){
    const dist=Math.sqrt(wx*wx+wy*wy)+0.01;
    irisTargX=(wx/dist)*(EYE_W*0.38);irisTargY=(wy/dist)*(EYE_H*0.32);
  }

  function selectNode(node){
    selectedNode=node;
    if(node&&dispatch){
      const doc=node.doc,kind=KINDS_MAP[doc.kind]||{},seal=SEALS_MAP[doc.seal]||{};
      dispatch('select',{doc,kind,seal,col:node.col});
    }
  }
  function deselectNode(){selectedNode=null;updateHighlightEdges(null);if(dispatch)dispatch('deselect',{});}

  function onDoubleClick(node){
    node.hMesh.material.opacity=0.75;setTimeout(()=>{node.hMesh.material.opacity=0.18;},320);
    aimEyesAt(node.x,node.y);selectNode(node);
  }

  const canvas=renderer.domElement;
  canvas.addEventListener('mousedown',e=>{
    const node=pickNode(e.clientX,e.clientY);
    if(node){dragNode=node;node.pinned=true;canvas.style.cursor='grabbing';}
    else{isPanning=true;panStart={x:e.clientX,y:e.clientY};panCamOrig={x:camX,y:camY};canvas.style.cursor='move';}
  });
  canvas.addEventListener('mousemove',e=>{
    const rect=canvas.getBoundingClientRect();
    const{x,y}=screenToWorld(e.clientX-rect.left,e.clientY-rect.top);
    const dist=Math.sqrt(x*x+y*y);const fac=Math.min(1,180/(dist+1))*0.55;
    irisTargX=(x/(dist+0.01))*(EYE_W*0.38)*fac;irisTargY=(y/(dist+0.01))*(EYE_H*0.32)*fac;
    if(dragNode){dragNode.x=x;dragNode.y=y;dragNode.vx=0;dragNode.vy=0;return;}
    if(isPanning){camX=panCamOrig.x-(e.clientX-panStart.x)/camZoom;camY=panCamOrig.y+(e.clientY-panStart.y)/camZoom;applyCam();return;}
    const node=pickNode(e.clientX,e.clientY);
    if(node!==hoveredNode){
      if(hoveredNode){hoveredNode.hMesh.material.opacity=0.18;hoveredNode.label.classList.remove('label-hover');}
      hoveredNode=node;
      if(node){node.hMesh.material.opacity=0.55;node.label.classList.add('label-hover');canvas.style.cursor='grab';}
      else{canvas.style.cursor='';}
      updateHighlightEdges(node?node.doc.id:null);
    }
  });
  canvas.addEventListener('mouseup',()=>{
    if(dragNode){dragNode.pinned=false;dragNode=null;}isPanning=false;canvas.style.cursor=hoveredNode?'grab':'';
  });
  let lastClickTime=0,lastClickTarget=null;
  canvas.addEventListener('click',e=>{
    if(dragNode)return;
    const node=pickNode(e.clientX,e.clientY);const now=Date.now();
    if(node&&node===lastClickTarget&&now-lastClickTime<380){onDoubleClick(node);lastClickTime=0;lastClickTarget=null;return;}
    lastClickTime=now;lastClickTarget=node;
    node?selectNode(node):deselectNode();
  });
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();camZoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,camZoom*(e.deltaY<0?1.12:0.89)));applyCam();
  },{passive:false});
  canvas.addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;const tc=e.touches[0];
    const node=pickNode(tc.clientX,tc.clientY);
    if(node){dragNode=node;node.pinned=true;}else{isPanning=true;panStart={x:tc.clientX,y:tc.clientY};panCamOrig={x:camX,y:camY};}
  },{passive:true});
  canvas.addEventListener('touchmove',e=>{
    if(e.touches.length!==1)return;const tc=e.touches[0];
    if(dragNode){const rect=canvas.getBoundingClientRect();const{x,y}=screenToWorld(tc.clientX-rect.left,tc.clientY-rect.top);dragNode.x=x;dragNode.y=y;dragNode.vx=0;dragNode.vy=0;}
    else if(isPanning){camX=panCamOrig.x-(tc.clientX-panStart.x)/camZoom;camY=panCamOrig.y+(tc.clientY-panStart.y)/camZoom;applyCam();}
  },{passive:true});
  canvas.addEventListener('touchend',()=>{if(dragNode){dragNode.pinned=false;dragNode=null;}isPanning=false;});

  // Resize
  let _ro=null;
  function handleResize(){
    W=hostEl.clientWidth||window.innerWidth;H=hostEl.clientHeight||window.innerHeight;
    renderer.setSize(W,H);applyCam();
  }
  if(typeof ResizeObserver!=='undefined'){_ro=new ResizeObserver(handleResize);_ro.observe(hostEl);}
  else{window.addEventListener('resize',handleResize);}

  // Render loop
  let lastTs=performance.now(),running=true;
  function animate(ts){
    if(!running)return;requestAnimationFrame(animate);
    const dt=Math.min(ts-lastTs,50);lastTs=ts;t++;
    simStep();updateEdges();updateHighlightEdges(hoveredNode?hoveredNode.doc.id:null);
    updateEyeAnimation(dt);updateNeural();updateLabels();
    renderer.render(scene,camera);
  }
  applyCam();animate(performance.now());
  setTimeout(()=>nodeList.forEach(nn=>nn.label.classList.add('label-visible')),2800);

  // Owner helpers
  const realmOwners=[...new Set(docs.map(d=>d.owner))].filter(o=>!!MEMBER_UV[o]);
  function ownerNodes(owner){return nodeList.filter(nn=>nn.doc.owner===owner);}
  function ownerCentroid(owner){
    const ns=ownerNodes(owner);if(!ns.length)return null;
    let sx=0,sy=0;ns.forEach(nn=>{sx+=nn.x;sy+=nn.y;});return{x:sx/ns.length,y:sy/ns.length};
  }
  function representativeNode(owner){
    const ns=ownerNodes(owner);if(!ns.length)return null;
    return ns.find(nn=>String(nn.doc.id).toLowerCase().indexOf(String(owner).toLowerCase())>=0)||ns[0];
  }
  function pulseOwner(owner){
    ownerNodes(owner).forEach(nn=>{nn.hMesh.material.opacity=0.8;setTimeout(()=>{nn.hMesh.material.opacity=0.18;},520);});
  }

  return {
    dispose(){
      running=false;
      if(_ro)_ro.disconnect();else window.removeEventListener('resize',handleResize);
      renderer.dispose();renderer.domElement.remove();labelsEl.remove();
    },
    owners(){return realmOwners.slice();},
    focusOwner(owner){
      const c=ownerCentroid(owner);if(!c)return false;
      camX=c.x;camY=c.y;camZoom=Math.min(MAX_ZOOM,2.2);
      applyCam();aimEyesAt(c.x,c.y);pulseOwner(owner);return true;
    },
    traceOwner(owner){
      const nn=representativeNode(owner);if(!nn)return null;
      selectNode(nn);onDoubleClick(nn);return nn.doc;
    },
    narrateRandom(owner){
      const ns=owner?ownerNodes(owner):nodeList;if(!ns.length)return null;
      const nn=ns[Math.floor(Math.random()*ns.length)];selectNode(nn);aimEyesAt(nn.x,nn.y);return nn.doc;
    },
    ownerScreenPos(owner){const c=ownerCentroid(owner);if(!c)return null;return worldToScreen(c.x,c.y);},
    centerScreenPos(){return worldToScreen(0,0);},
    resetView(){camX=0;camY=0;camZoom=1;applyCam();deselectNode();},
    zoomIn(){camZoom=Math.min(MAX_ZOOM,camZoom*1.25);applyCam();},
    zoomOut(){camZoom=Math.max(MIN_ZOOM,camZoom/1.25);applyCam();},
  };
}

// Custom element
class RaBbLEGraphElement extends HTMLElement {
  connectedCallback() {
    if(this._connected)return;
    this._connected=true;
    this.style.display=this.style.display||'block';
    this.style.position='relative';
    this.style.overflow='hidden';

    ensureThree().then(THREE=>{
      this._THREE=THREE;
      if(this._pendingData){this._mount(THREE,this._pendingData);this._pendingData=null;}
    }).catch(err=>console.error('[rabble-graph]',err));
  }

  disconnectedCallback(){
    if(this._api){this._api.dispose();this._api=null;}
    this._connected=false;
  }

  setData(data){
    this._pendingData=data;
    if(this._THREE&&this._connected){this._mount(this._THREE,data);this._pendingData=null;}
  }

  _mount(THREE,data){
    if(this._api){this._api.dispose();this._api=null;}
    const el=this;
    this._api=buildGraph(this,THREE,data,(type,detail)=>{
      el.dispatchEvent(new CustomEvent('rabble-graph-'+type,{bubbles:true,composed:true,detail}));
    });
    this.dispatchEvent(new CustomEvent('rabble-graph-ready',{bubbles:true,composed:true}));
  }

  // Proxy API
  owners()          {return this._api?.owners()       ??[];}
  focusOwner(k)     {return this._api?.focusOwner(k)  ??false;}
  traceOwner(k)     {return this._api?.traceOwner(k)  ??null;}
  narrateRandom(k)  {return this._api?.narrateRandom(k)??null;}
  ownerScreenPos(k) {return this._api?.ownerScreenPos(k)??null;}
  centerScreenPos() {return this._api?.centerScreenPos()??null;}
  resetView()       {this._api?.resetView();}
  zoomIn()          {this._api?.zoomIn();}
  zoomOut()         {this._api?.zoomOut();}
}

if(typeof customElements!=='undefined'&&!customElements.get('rabble-graph')){
  customElements.define('rabble-graph',RaBbLEGraphElement);
}
