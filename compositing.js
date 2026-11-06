// Original, dependency-free WarLike compositing math.
export const DEFAULT_KEYFRAME=Object.freeze({scale:100,x:0,y:0,rotation:0,opacity:100});
export const DEFAULT_GRADE=Object.freeze({brightness:100,contrast:100,saturation:100,warmth:0});
export const PRESETS=Object.freeze({
 none:{...DEFAULT_GRADE},
 cinema:{brightness:98,contrast:115,saturation:90,warmth:30},
 cold:{brightness:90,contrast:118,saturation:75,warmth:-30},
 mono:{brightness:105,contrast:125,saturation:0,warmth:0},
 vibrant:{brightness:108,contrast:110,saturation:155,warmth:5}
});
const bounds={scale:[20,400],x:[-100,100],y:[-100,100],rotation:[-360,360],opacity:[0,100],brightness:[30,200],contrast:[30,200],saturation:[0,250],warmth:[-100,100]};
export function limit(value,key,defaultValue){
 const n=Number(value),[low,high]=bounds[key];
 return Number.isFinite(n)?Math.min(high,Math.max(low,n)):defaultValue;
}
export function normalizeKeyframe(value={}){
 return Object.fromEntries(Object.entries(DEFAULT_KEYFRAME).map(([key,fallback])=>[key,limit(value?.[key],key,fallback)]));
}
export function normalizeGrade(value={}){
 return Object.fromEntries(Object.entries(DEFAULT_GRADE).map(([key,fallback])=>[key,limit(value?.[key],key,fallback)]));
}
export function normalizeEffects(value={}){
 return {grade:normalizeGrade(value.grade),start:normalizeKeyframe(value.start),end:normalizeKeyframe(value.end)};
}
export function motionAt(effects,progress){
 const e=normalizeEffects(effects),t=Math.min(1,Math.max(0,Number(progress)||0));
 return Object.fromEntries(Object.keys(DEFAULT_KEYFRAME).map(key=>[key,e.start[key]+(e.end[key]-e.start[key])*t]));
}
export function cssFilter(grade){
 const g=normalizeGrade(grade);
 // CSS and Canvas2D both implement these filters, so preview and export share parameters.
 return `brightness(${g.brightness}%) contrast(${g.contrast}%) saturate(${g.saturation}%) sepia(${Math.abs(g.warmth)*.002}) hue-rotate(${g.warmth*.20}deg)`;
}
export function renderVideoFrame(ctx,video,canvas,effects,progress,background='#090d14'){
 const {width:w,height:h}=canvas,e=normalizeEffects(effects),motion=motionAt(e,progress);
 ctx.save();
 ctx.fillStyle=/^#[\da-f]{6}$/i.test(background)?background:'#090d14';
 ctx.fillRect(0,0,w,h);
 if(video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0){
  const fit=Math.min(w/video.videoWidth,h/video.videoHeight);
  const dw=video.videoWidth*fit,dh=video.videoHeight*fit;
  ctx.save();
  ctx.translate(w/2+motion.x/100*w,h/2+motion.y/100*h);
  ctx.rotate(motion.rotation*Math.PI/180);
  ctx.scale(motion.scale/100,motion.scale/100);
  ctx.globalAlpha=motion.opacity/100;
  ctx.filter=cssFilter(e.grade);
  ctx.drawImage(video,-dw/2,-dh/2,dw,dh);
  ctx.restore();
 }
 ctx.restore();
}
