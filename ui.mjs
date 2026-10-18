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
const paths={listen:'M4 9h4l5-4v14l-5-4H4z M16 8c3 2 3 6 0 8 M19 5c5 4 5 10 0 14',previous:'m14 6-6 6 6 6',next:'m10 6 6 6-6 6',chevron:'m6 9 6 6 6-6',back:'m14 6-6 6 6 6',bookmark:'M6 3h12v18l-6-4-6 4z'};
export function icon(name) {
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [k,v] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(k,v);
  const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]||paths.chevron);svg.append(path);return svg;
}
export const iconButton=(name,label,action)=>el('button',{type:'button',class:'icon','aria-label':label,title:label,onclick:action},icon(name));
export function section(title,children,key,states,onOpen) {
  const details=el('details',{open:states.get(key)||false});
  const summary=el('summary',{},el('span',{text:title}),el('span',{class:'chevron'},icon('chevron')));
  const body=el('div',{class:'section-body'},children);details.append(summary,body);
  let animation=null,loaded=false;
  const load=()=>{if(!loaded&&onOpen){loaded=true;onOpen(body);}};
  if(details.open)queueMicrotask(load);
  summary.addEventListener('click',event=>{
    event.preventDefault();animation?.cancel();
    if(!details.open){details.open=true;states.set(key,true);load();if(!reduced())animation=body.animate([{height:'0px',opacity:0},{height:body.scrollHeight+'px',opacity:1}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'});}
    else {states.set(key,false);if(reduced()){details.open=false;return;}animation=body.animate([{height:body.scrollHeight+'px',opacity:1},{height:'0px',opacity:0}],{duration:180,easing:'ease-in'});animation.onfinish=()=>{details.open=false;};}
  });
  return details;
}
export function loading(label) {return card(el('p',{role:'status',text:label}),el('div',{class:'skeleton','aria-hidden':'true'},[1,2,3,4].map(()=>el('i'))));}
export function sectionError(error,retry) {return card(el('p',{class:'error',role:'status',text:error}),button('Retry',retry,'quiet'));}
let closer=null;
let closeImmediate=null;
window.addEventListener('popstate',()=>{if(document.querySelector('#sheet')?.open)closeImmediate?.();});
export function openSheet(title,body,onClose=()=>{}) {
  const dialog=document.querySelector('#sheet'),panel=dialog.querySelector('.sheet-panel');
  if(dialog.open)closeImmediate?.();
  dialog.classList.remove('closing');document.querySelector('#sheet-title').textContent=translate(title);
  document.querySelector('#sheet-body').replaceChildren(...(Array.isArray(body)?body:[body]).filter(Boolean));
  document.querySelector('#sheet-close').textContent=translate('Close');
  const previous=document.activeElement;let closing=false,timer,afterClose=null,finished=false;
  if(!history.state?.modal)history.pushState({...history.state,modal:true},'');
  const finish=(consume=true)=>{if(finished)return;clearTimeout(timer);if(consume&&history.state?.modal){history.back();return;}finished=true;if(!closing){closing=true;onClose();}dialog.close();dialog.classList.remove('closing');panel.style.removeProperty('transform');previous?.isConnected&&previous.focus({preventScroll:true});if(afterClose)queueMicrotask(afterClose);};
  closeImmediate=()=>finish(false);
  closer=action=>{if(typeof action==='function')afterClose=action;if(closing)return;closing=true;onClose();dialog.classList.add('closing');timer=setTimeout(()=>finish(),reduced()?0:190);};
  document.querySelector('#sheet-close').onclick=closer;
  dialog.oncancel=event=>{event.preventDefault();closer();};
  dialog.onclick=event=>{if(event.target===dialog)closer();};
  let start=null;
  const grabber=dialog.querySelector('.grabber');
  grabber.onpointerdown=e=>{start=e.clientY;grabber.setPointerCapture(e.pointerId);};
  grabber.onpointermove=e=>{if(start!==null)panel.style.transform=`translate(-50%,${Math.max(0,e.clientY-start)}px)`;};
  grabber.onpointerup=e=>{if(start!==null&&e.clientY-start>75)closer();else panel.style.removeProperty('transform');start=null;};
  grabber.onpointercancel=()=>{start=null;panel.style.removeProperty('transform');};
  dialog.showModal();dialog.scrollTop=0;
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
export function animateWord(source,target,value) {
  cancelWordMotion();
  if(reduced()||!source||!target)return;
  const a=source.rect||source.getBoundingClientRect(),b=target.getBoundingClientRect();
  if(!a.width||!b.width||a.height>140||b.height>180)return;
  const ghost=el('p',{class:'moving-word',raw:value,dir:'rtl'});document.body.append(ghost);
  const from=source.fontSize||Number.parseFloat(getComputedStyle(source).fontSize),to=Number.parseFloat(getComputedStyle(target).fontSize);
  Object.assign(ghost.style,{left:a.left+'px',top:a.top+'px',width:a.width+'px',fontSize:from+'px'});
  target.style.visibility='hidden';
  const animation=ghost.animate([{left:a.left+'px',top:a.top+'px',width:a.width+'px',fontSize:from+'px'},{left:b.left+'px',top:b.top+'px',width:b.width+'px',fontSize:to+'px'}],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});
  travel=animation;
  animation.finished.catch(()=>{}).finally(()=>{ghost.remove();target.style.visibility='';if(travel===animation)travel=null;});
}
export const wordSnapshot=node=>node?{rect:node.getBoundingClientRect(),fontSize:Number.parseFloat(getComputedStyle(node).fontSize)}:null;
