import * as THREE from 'three';

// One small scene is mounted only on the visible entry banner. Exam answers,
// navigation and timers never depend on WebGL.
export function createMotion(host){
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power',stencil:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.setClearColor(0x000000,0);
  renderer.domElement.setAttribute('aria-hidden','true');
  host.append(renderer.domElement);

  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(40,1,.1,100);
  camera.position.z=5.6;
  const orbit=new THREE.Group();scene.add(orbit);
  const frame=new THREE.Mesh(new THREE.IcosahedronGeometry(1.18,1),
    new THREE.MeshBasicMaterial({color:0xb5c7ff,wireframe:true,transparent:true,opacity:.52}));
  orbit.add(frame);
  const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.6,1),
    new THREE.MeshPhongMaterial({color:0x7894db,emissive:0x233966,flatShading:true,shininess:70}));
  orbit.add(core);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.54,.018,6,72),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.74}));
  ring.rotation.set(.62,.25,.18);orbit.add(ring);
  const ringTwo=new THREE.Mesh(new THREE.TorusGeometry(1.38,.012,6,72),
    new THREE.MeshBasicMaterial({color:0x9eb8fa,transparent:true,opacity:.5}));
  ringTwo.rotation.set(-.52,.58,1.1);orbit.add(ringTwo);
  const light=new THREE.DirectionalLight(0xffffff,1.8);light.position.set(2,3,4);scene.add(light);
  scene.add(new THREE.AmbientLight(0x9cb2ed,1));
  const points=new Float32Array(45*3);
  for(let i=0;i<45;i++){
    const angle=i*2.39996,rad=1.85+(i%7)*.13;
    points[i*3]=Math.cos(angle)*rad;points[i*3+1]=Math.sin(angle)*rad*.76;
    points[i*3+2]=((i*13)%17-8)*.14;
  }
  const dotsGeometry=new THREE.BufferGeometry();dotsGeometry.setAttribute('position',new THREE.BufferAttribute(points,3));
  const dots=new THREE.Points(dotsGeometry,new THREE.PointsMaterial({color:0xffffff,size:.037,transparent:true,opacity:.8}));
  scene.add(dots);

  const parent=host.closest('.gmit-hero')||host;
  let pointerX=0,pointerY=0,last=0,destroyed=false,visible=false;
  function resize(){
    if(destroyed)return;
    const width=Math.max(host.clientWidth,1),height=Math.max(host.clientHeight,1);
    camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
  }
  function tick(now){
    if(now-last<33)return;
    const step=Math.min((now-last||33)/1000,.06);last=now;
    orbit.rotation.y+=step*.28;orbit.rotation.x+=(pointerY*.12-orbit.rotation.x)*.06;
    orbit.rotation.z+=(pointerX*.09-orbit.rotation.z)*.06;
    dots.rotation.z-=step*.035;
    renderer.render(scene,camera);
  }
  function onPointer(event){
    const box=parent.getBoundingClientRect();
    pointerX=((event.clientX-box.left)/Math.max(box.width,1)-.5)*2;
    pointerY=((event.clientY-box.top)/Math.max(box.height,1)-.5)*2;
  }
  const sizeObserver=new ResizeObserver(resize);
  sizeObserver.observe(host);
  const inView=new IntersectionObserver(entries=>{
    if(destroyed)return;
    const next=entries[0]?.isIntersecting&&document.visibilityState==='visible';
    if(next===visible)return;visible=next;
    renderer.setAnimationLoop(visible?tick:null);
  });
  inView.observe(host);
  parent.addEventListener('pointermove',onPointer,{passive:true});
  resize();renderer.render(scene,camera);
  return {destroy(){
    if(destroyed)return;destroyed=true;
    sizeObserver.disconnect();inView.disconnect();parent.removeEventListener('pointermove',onPointer);
    renderer.setAnimationLoop(null);
    frame.geometry.dispose();frame.material.dispose();core.geometry.dispose();core.material.dispose();
    ring.geometry.dispose();ring.material.dispose();ringTwo.geometry.dispose();ringTwo.material.dispose();
    dotsGeometry.dispose();dots.material.dispose();renderer.dispose();renderer.forceContextLoss();
    renderer.domElement.remove();
  }};
}
