// Copyright © 2026 HacknFix. Developed by Pritam Nath Dipta. All rights reserved.
(function(){
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let scene=null,stage=null,loading=null,failed=false;
  function candidate(){
    if(reduced.matches||document.hidden||document.body.classList.contains('exam-live'))return null;
    const splash=document.getElementById('splash');
    if(splash&&!splash.classList.contains('fade-out'))return null;
    return [...document.querySelectorAll('[data-three-stage]')].find(host=>host.getClientRects().length&&host.clientWidth>0)||null;
  }
  async function sync(){
    const next=candidate();
    if(next===stage&&scene)return;
    if(scene){scene.destroy();scene=null;stage=null;}
    if(!next||failed)return;
    if(!loading)loading=import('./vendor/portal-three.min.js?v=1').catch(()=>{failed=true;return null;});
    const module=await loading;
    if(!module||next!==candidate())return;
    if(scene&&stage===next)return;
    if(scene){scene.destroy();scene=null;stage=null;}
    try{scene=module.createMotion(next);stage=next;}catch(_){failed=true;next.dataset.threeState='fallback';}
  }
  window.addEventListener('hnf:screenchange',sync);
  window.addEventListener('hnf:splashhidden',sync);
  document.addEventListener('visibilitychange',sync);
  if(reduced.addEventListener)reduced.addEventListener('change',sync);
  else if(reduced.addListener)reduced.addListener(sync);
  sync();
})();
