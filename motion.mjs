import {reduced} from './ui.mjs';
export function navigation(onSelect) {
  const nav=document.querySelector('#navigation'),lens=document.querySelector('#lens'),buttons=[...nav.querySelectorAll('button')];
  const overlay=document.createElement('div');overlay.className='glass-icons';overlay.setAttribute('aria-hidden','true');
  buttons.forEach(button=>{const span=document.createElement('span');span.append(button.querySelector('svg').cloneNode(true));overlay.append(span);});nav.append(overlay);
  let centers=[],width=0,x=0,target=0,velocity=0,frame=0,last=0,active=0,pointer=null,grab=0,dragged=false,origin=0;
  function paint(){lens.style.width=width+'px';lens.style.transform=`translateX(${x-width/2}px) scale(${pointer!==null&&!reduced()?1.025:1})`;overlay.style.clipPath=`inset(6px ${Math.max(0,nav.clientWidth-x-width/2)}px 6px ${Math.max(0,x-width/2)}px round 99px)`;}
  function measure(){const r=nav.getBoundingClientRect();centers=buttons.map(b=>{const v=b.getBoundingClientRect();return v.left-r.left+v.width/2;});width=buttons[0].getBoundingClientRect().width;target=centers[active];x=target;velocity=0;paint();}
  function tick(time){const dt=Math.min((time-(last||time-16))/1000,.032);last=time;const steps=Math.ceil(dt/.008),h=dt/steps;for(let i=0;i<steps;i++){velocity+=(460*(target-x)-31*velocity)*h;x+=velocity*h;}paint();if(Math.abs(target-x)>.05||Math.abs(velocity)>.1)frame=requestAnimationFrame(tick);else{frame=0;x=target;paint();}}
  function settle(){if(reduced()){cancelAnimationFrame(frame);frame=0;x=target;paint();}else if(!frame){last=0;frame=requestAnimationFrame(tick);}}
  function select(index,commit=true){active=index;buttons.forEach((b,i)=>{if(i===index)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});target=centers[index];settle();if(commit)onSelect(buttons[index].dataset.tab);}
  buttons.forEach((button,i)=>button.addEventListener('click',e=>{if(dragged){e.preventDefault();return;}select(i);}));
  nav.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer=e.pointerId;origin=e.clientX;dragged=false;cancelAnimationFrame(frame);frame=0;velocity=0;const local=e.clientX-nav.getBoundingClientRect().left;grab=Math.abs(local-x)<width/2?local-x:0;nav.classList.add('contact');nav.setPointerCapture(e.pointerId);paint();});
  nav.addEventListener('pointermove',e=>{if(pointer!==e.pointerId)return;if(Math.abs(e.clientX-origin)>6)dragged=true;if(!dragged)return;e.preventDefault();x=Math.max(centers[0],Math.min(centers.at(-1),e.clientX-nav.getBoundingClientRect().left-grab));target=x;paint();});
  function end(e,cancel=false){if(pointer!==e.pointerId)return;const local=dragged?x:e.clientX-nav.getBoundingClientRect().left;pointer=null;nav.classList.remove('contact');if(!cancel){const nearest=centers.reduce((a,c,i)=>Math.abs(c-local)<Math.abs(centers[a]-local)?i:a,0);dragged=true;select(nearest);}else{target=centers[active];settle();}setTimeout(()=>{dragged=false;},0);}
  nav.addEventListener('pointerup',e=>end(e));nav.addEventListener('pointercancel',e=>end(e,true));
  nav.addEventListener('keydown',e=>{const index=buttons.indexOf(document.activeElement);if(index<0)return;let next=index;if(e.key==='ArrowRight')next=(index+1)%4;else if(e.key==='ArrowLeft')next=(index+3)%4;else if(e.key==='Home')next=0;else if(e.key==='End')next=3;else return;e.preventDefault();buttons[next].focus();select(next);});
  new ResizeObserver(measure).observe(nav);measure();matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{target=centers[active];settle();});
  return tab=>{const index=buttons.findIndex(b=>b.dataset.tab===tab);if(index>=0)select(index,false);};
}
