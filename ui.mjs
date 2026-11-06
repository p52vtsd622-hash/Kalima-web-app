import {Spring} from './spring.mjs';
let translate=x=>x;
export const setTranslator=fn=>{translate=fn;};
export const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
export function el(tag,props={},...children) {
  const node=document.createElement(tag);
  for(const [key,value] of Object.entries(props)){
    if(value===undefined||value===null||value===false)continue;
    if(key==='text')node.textContent=translate(String(value));
    else if(key==='raw')node.textContent=String(value);
    else if(key==='class')node.className=value;
    else if(key.startsWith('on'))node.addEventListener(key.slice(2).toLowerCase(),value);
    else if(key==='checked'||key==='disabled'||key==='hidden'||key==='open')node[key]=!!value;
    else node.setAttribute(key,['aria-label','title','placeholder'].includes(key)?translate(value):value===true?'':value);
  }
  children.flat(Infinity).filter(x=>x!==null&&x!==undefined&&x!==false).forEach(x=>node.append(x instanceof Node?x:document.createTextNode(String(x))));
  return node;
}
export const arabic=(value,cls='')=>el('p',{class:'arabic '+cls,lang:'ar',dir:'rtl',raw:value});
export const prose=(value,lang,cls='')=>el('p',{class:cls,lang,dir:['ar','ur','fa'].includes(lang)?'rtl':'auto',raw:value});
export const button=(label,action,cls='',props={})=>el('button',{type:'button',class:cls,text:label,onclick:action,...props});
export const row=(...children)=>el('div',{class:'row'},children);
export const card=(...children)=>el('section',{class:'card'},children);
const paths={listen:'M4 9h4l5-4v14l-5-4H4z M16 8c3 2 3 6 0 8 M19 5c5 4 5 10 0 14',previous:'m14 6-6 6 6 6',next:'m10 6 6 6-6 6',chevron:'m6 9 6 6 6-6',back:'m14 6-6 6 6 6',bookmark:'M6 3h12v18l-6-4-6 4z',check:'m3 12 6 6L21 5'};
export function icon(name) {
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [k,v] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(k,v);
  const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]||paths.chevron);svg.append(path);return svg;
}
export const iconButton=(name,label,action)=>el('button',{type:'button',class:'icon','aria-label':label,title:label,onclick:action},icon(name));
export function section(title,children,key,states,onOpen,initiallyExpanded=false) {
  if(!states.has(key))states.set(key,initiallyExpanded);
  const details=el('details',{open:states.get(key)||false});
  const summary=el('summary',{},el('span',{text:title}),el('span',{class:'chevron'},icon('chevron')));
  const inner=el('div',{class:'section-inner'},children),body=el('div',{class:'section-body'},inner);details.append(summary,body);
  let loaded=false,targetOpen=details.open;
  const spring=new Spring(0,height=>{body.style.height=Math.max(0,height)+'px';});
  const load=()=>{if(!loaded&&onOpen){loaded=true;onOpen(inner);}};
  if(details.open)queueMicrotask(load);
  const height=()=>inner.getBoundingClientRect().height;
  const observer=new ResizeObserver(()=>{if(targetOpen&&spring.frame)spring.to(height(),()=>{body.style.height='auto';body.style.overflow='';});});
  observer.observe(inner); // Retarget if async section content arrives mid-expansion.
  summary.addEventListener('click',event=>{
    event.preventDefault();
    const current=details.open?body.getBoundingClientRect().height:0;
    if(!spring.frame)spring.set(current);
    targetOpen=!targetOpen;states.set(key,targetOpen);
    summary.setAttribute('aria-expanded',String(targetOpen));
    if(targetOpen){details.open=true;load();}
    body.style.overflow='hidden';
    spring.to(targetOpen?height():0,()=>{details.open=targetOpen;body.style.height='auto';body.style.overflow='';});
  });
  summary.setAttribute('aria-expanded',String(targetOpen));
  return details;
}
export function loading(label) {return el('section',{class:'card section-feedback'},row(el('span',{class:'spinner','aria-hidden':'true'}),el('p',{role:'status',text:label})),el('div',{class:'skeleton','aria-hidden':'true'},[1,2,3,4].map(()=>el('i'))));}
export function sectionError(error,retry) {return el('section',{class:'card section-feedback',role:'status'},row(el('div',{class:'grow'},el('p',{class:'error-heading',text:"Couldn't finish this section"}),el('p',{text:error})),button('Retry',retry,'quiet')));}
let closer=null;
let closeImmediate=null;
window.addEventListener('popstate',()=>{if(document.querySelector('#sheet')?.open)closeImmediate?.();});
export function openSheet(title,body,onClose=()=>{},options={}) {
  const dialog=document.querySelector('#sheet'),panel=dialog.querySelector('.sheet-panel');
  if(dialog.open)closeImmediate?.();
  dialog.classList.toggle('centered',!!options.centered);dialog.classList.toggle('preview-sheet',!!options.preview);
  dialog.classList.remove('closing');document.querySelector('#sheet-title').textContent=translate(title);
  document.querySelector('#sheet-body').replaceChildren(...(Array.isArray(body)?body:[body]).filter(Boolean));
  document.querySelector('#sheet-close').textContent=translate('Close');
  const previous=document.activeElement;let closing=false,timer,afterClose=null,finished=false;
  const centered=!!options.centered;
  const motion=new Spring(centered?0:panel.getBoundingClientRect().height||400,y=>{panel.style.transform=centered?'translate(-50%,-50%)':`translate(-50%,${y}px)`;},{stiffness:420,damping:38});
  if(!history.state?.modal)history.pushState({...history.state,modal:true},'');
  const finish=(consume=true)=>{if(finished)return;clearTimeout(timer);if(consume&&history.state?.modal){history.back();return;}finished=true;motion.cancel();if(!closing){closing=true;onClose();}dialog.close();dialog.classList.remove('closing');panel.style.removeProperty('transform');previous?.isConnected&&previous.focus({preventScroll:true});if(afterClose)queueMicrotask(afterClose);};
  closeImmediate=()=>finish(false);
  closer=action=>{if(typeof action==='function')afterClose=action;if(closing)return;closing=true;onClose();dialog.classList.add('closing');motion.to(centered?0:panel.getBoundingClientRect().height+24,()=>finish());};
  document.querySelector('#sheet-close').onclick=closer;
  dialog.oncancel=event=>{event.preventDefault();closer();};
  dialog.onclick=event=>{if(event.target===dialog)closer();};
  let start=null;
  const grabber=dialog.querySelector('.grabber');
  grabber.onpointerdown=e=>{if(centered||closing)return;start={y:e.clientY,offset:motion.x,last:e.clientY,time:e.timeStamp,v:0};motion.cancel();grabber.setPointerCapture(e.pointerId);};
  grabber.onpointermove=e=>{if(!start)return;const dt=(e.timeStamp-start.time)/1000;start.v=dt>0?Math.max(-1600,Math.min(1600,(e.clientY-start.last)/dt)):0;start.last=e.clientY;start.time=e.timeStamp;motion.set(Math.max(0,start.offset+e.clientY-start.y));};
  grabber.onpointerup=e=>{if(!start)return;motion.v=start.v;const dismiss=(motion.x>75&&start.v>=-250)||start.v>700;start=null;if(dismiss)closer();else motion.to(0);};
  grabber.onpointercancel=()=>{start=null;motion.to(0);};
  // Preserve native scrolling until a downward drag begins at the sheet's top.
  let touch=null;
  panel.ontouchstart=e=>{if(centered||closing||e.touches.length!==1||e.target.closest('button,input,textarea,select,.grabber'))return;const t=e.touches[0];touch={x:t.clientX,y:t.clientY,last:t.clientY,time:e.timeStamp,v:0,offset:motion.x,dragging:false};};
  panel.ontouchmove=e=>{if(!touch||e.touches.length!==1)return;const t=e.touches[0],dy=t.clientY-touch.y;if(!touch.dragging){if(panel.scrollTop>0||dy<0||Math.abs(t.clientX-touch.x)>Math.abs(dy)){touch=null;return;}if(dy<8)return;touch.dragging=true;motion.cancel();}if(e.cancelable)e.preventDefault();const dt=(e.timeStamp-touch.time)/1000;touch.v=dt>0?Math.max(-1600,Math.min(1600,(t.clientY-touch.last)/dt)):0;touch.last=t.clientY;touch.time=e.timeStamp;motion.set(Math.max(0,touch.offset+dy));};
  panel.ontouchend=()=>{if(!touch)return;const t=touch;touch=null;if(!t.dragging)return;motion.v=t.v;if((motion.x>75&&t.v>=-250)||t.v>700)closer();else motion.to(0);};
  panel.ontouchcancel=()=>{if(touch?.dragging)motion.to(0);touch=null;};
  dialog.showModal();dialog.scrollTop=0;motion.set(centered?0:panel.getBoundingClientRect().height+24);motion.to(0);
  return {close:()=>closer?.(),finish};
}
export const closeSheet=action=>closer?.(action);
export function choiceSheet(title,description,choices,selected,onSelect) {
  let chosen=false;
  const nodes=choices.map(({value,label,native})=>el('button',{type:'button',class:'choice'+(value===selected?' selected':''),role:'radio','aria-checked':String(value===selected),onclick:()=>{
    if(chosen)return;
    try{onSelect(value);}catch{return;}
    chosen=true;for(const node of nodes){node.disabled=true;node.classList.remove('selected');node.setAttribute('aria-checked','false');}
    const current=nodes[choices.findIndex(c=>c.value===value)];current.classList.add('selected');current.setAttribute('aria-checked','true');closeSheet();
  }},el('span',{class:'choice-label',text:label}),native?el('span',{class:'native',lang:value,raw:native}):null,el('span',{class:'radio','aria-hidden':'true'})));
  return openSheet(title,[description?el('p',{class:'muted',text:description}):null,el('div',{role:'radiogroup','aria-label':title},nodes)]);
}
export function swipe(node,onEnd,onMove=()=>{},enabled=()=>true) {
  let start=null,horizontal=false,suppress=false;
  node.addEventListener('pointerdown',e=>{if(e.button!==0||!enabled())return;start={x:e.clientX,y:e.clientY,id:e.pointerId};horizontal=false;});
  node.addEventListener('pointermove',e=>{
    if(!start)return;const x=e.clientX-start.x,y=e.clientY-start.y;
    if(!horizontal&&Math.abs(y)>12&&Math.abs(y)>Math.abs(x)){start=null;return;}
    if(Math.abs(x)>10&&Math.abs(x)>Math.abs(y)){horizontal=true;node.setPointerCapture(e.pointerId);e.preventDefault();onMove(x);}
  },{passive:false});
  const finish=e=>{if(!start)return;const x=e.clientX-start.x;start=null;if(horizontal){suppress=true;onEnd(x);setTimeout(()=>{suppress=false;},0);}else onMove(0);};
  node.addEventListener('pointerup',finish);node.addEventListener('pointercancel',()=>{start=null;onMove(0);onEnd(0);});
  node.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation();}},true);
}
let travel=null;
export const cancelWordMotion=()=>travel?.cancel();
export function springFrames(stiffness,damping,duration,frame) {
  const omega=Math.sqrt(stiffness),wd=omega*Math.sqrt(Math.max(0,1-damping*damping));
  return Array.from({length:61},(_,i)=>{const t=i/60*duration/1000,p=i===60?1:damping>=1?1-(1+omega*t)*Math.exp(-omega*t):1-Math.exp(-damping*omega*t)*(Math.cos(wd*t)+damping*omega/wd*Math.sin(wd*t));return {...frame(p),offset:i/60};});
}
export function animateWord(source,target,value) {
  cancelWordMotion();
  if(reduced()||!source||!target)return;
  const a=source.rect||source.getBoundingClientRect(),b=target.getBoundingClientRect();
  if(!a.width||!b.width||a.height>140||b.height>180)return;
  const ghost=el('p',{class:'moving-word',raw:value,dir:'rtl'});document.body.append(ghost);
  const from=source.fontSize||Number.parseFloat(getComputedStyle(source).fontSize),to=Number.parseFloat(getComputedStyle(target).fontSize);
  Object.assign(ghost.style,{left:a.left+'px',top:a.top+'px',width:a.width+'px',fontSize:from+'px'});
  target.style.visibility='hidden';
  const animation=ghost.animate(springFrames(420,1,500,p=>({left:a.left+(b.left-a.left)*p+'px',top:a.top+(b.top-a.top)*p+'px',width:a.width+(b.width-a.width)*p+'px',fontSize:from+(to-from)*p+'px'})),{duration:500,easing:'linear',fill:'forwards'});
  travel=animation;
  animation.finished.catch(()=>{}).finally(()=>{ghost.remove();target.style.visibility='';if(travel===animation)travel=null;});
}
export const wordSnapshot=node=>node?{rect:node.getBoundingClientRect(),fontSize:Number.parseFloat(getComputedStyle(node).fontSize)}:null;
