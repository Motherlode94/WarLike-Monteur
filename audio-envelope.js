// Shared by real-time monitoring and WebM render: a smooth, deterministic
// per-track envelope. Legacy tracks without fades retain their old gain.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function audioEnvelope(track,position,assetDuration){
 const offset=Number(track?.offset)||0,duration=Number(assetDuration);
 if(!Number.isFinite(position)||!Number.isFinite(duration)||duration<=0)return 0;
 const elapsed=position-offset;
 if(elapsed<0||elapsed>=duration)return 0;
 const fadeIn=clamp(Number(track?.fadeIn)||0,0,duration/2);
 const fadeOut=clamp(Number(track?.fadeOut)||0,0,duration/2);
 const intro=fadeIn>0?clamp(elapsed/fadeIn,0,1):1;
 const outro=fadeOut>0?clamp((duration-elapsed)/fadeOut,0,1):1;
 return Math.min(intro,outro);
}
export function audioTrackGain(track,position,assetDuration,masterVolume=100){
 const volume=clamp(Number(track?.volume)||0,0,100)/100;
 const master=clamp(Number(masterVolume)||0,0,100)/100;
 return volume*master*(track?.muted?0:audioEnvelope(track,position,assetDuration));
}
