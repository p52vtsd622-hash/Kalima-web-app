// Retargetable physical springs. Position and velocity survive interruption.
export const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const live=new Set();
export class Spring {
 constructor(value,paint,{stiffness=420,damping=41}={}){this.x=value;this.target=value;this.v=0;this.paint=paint;this.k=stiffness;this.d=damping;this.frame=0;this.last=0;this.done=null;}
 set(value){cancelAnimationFrame(this.frame);live.delete(this);this.frame=0;this.x=value;this.v=0;this.paint(this.x);}
 to(target,done=null){this.target=target;this.done=done;if(reduceMotion()){this.set(target);this.complete();return;}live.add(this);if(!this.frame){this.last=0;this.frame=requestAnimationFrame(t=>this.tick(t));}}
 tick(t){const dt=Math.min((t-(this.last||t-16.667))/1000,.032);this.last=t;const steps=Math.ceil(dt/.006),h=dt/steps;for(let i=0;i<steps;i++){this.v+=(this.k*(this.target-this.x)-this.d*this.v)*h;this.x+=this.v*h;}this.paint(this.x);if(Math.abs(this.target-this.x)<.02&&Math.abs(this.v)<.08){this.frame=0;live.delete(this);this.x=this.target;this.v=0;this.paint(this.x);this.complete();}else this.frame=requestAnimationFrame(t=>this.tick(t));}
 complete(){const fn=this.done;this.done=null;fn?.();}
 cancel(){cancelAnimationFrame(this.frame);this.frame=0;live.delete(this);this.done=null;}
}
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{if(reduceMotion())for(const s of [...live]){s.set(s.target);s.complete();}});
export function installPressMotion(){
 const states=new WeakMap();let active=null;
 function release(){if(active){states.get(active)?.to(1);active=null;}}
 document.addEventListener('pointerdown',e=>{if(e.button!==0)return;const b=e.target.closest('button,summary');if(!b||b.disabled||b.closest('#navigation')||b.classList.contains('flash-face'))return;release();let s=states.get(b);if(!s){s=new Spring(1,x=>{if(!b.isConnected){s.cancel();return;}b.style.scale=String(x);},{stiffness:700,damping:43.4});states.set(b,s);}active=b;s.to(.97);},{passive:true});
 for(const name of ['pointerup','pointercancel','blur'])window.addEventListener(name,release);
 document.addEventListener('pointermove',e=>{if(active&&!active.contains(document.elementFromPoint(e.clientX,e.clientY)))release();},{passive:true});
}
