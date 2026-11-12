import {test,expect} from '@playwright/test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

function command(cmd,args){
 const r=spawnSync(cmd,args,{encoding:'utf8',timeout:60000});
 if(r.status!==0)throw Error(cmd+' failed: '+(r.stderr||r.error));
 return r.stdout;
}
function fixture(dir,color,output){
 command('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c='+color+':s=320x180:r=25:d=1.4','-an','-c:v','libvpx-vp9','-b:v','350k',join(dir,output)]);
 return join(dir,output);
}
function audioFixture(dir){
 const out=join(dir,'sound.wav');
 command('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','sine=frequency=440:duration=4:sample_rate=48000','-c:a','pcm_s16le',out]);
 return out;
}
test('exports two real video clips with a separately imported audible audio track',async({page})=>{
 const dir=mkdtempSync(join(tmpdir(),'warlike-monteur-'));
 try{
  const a=fixture(dir,'red','one.webm'),b=fixture(dir,'blue','two.webm'),music=audioFixture(dir);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.locator('#files').setInputFiles([a,b]);
  await expect(page.locator('#assets .asset')).toHaveCount(2,{timeout:15000});
  await page.locator('#assets .asset button').first().click();
  await page.locator('#assets .asset button').nth(1).click();
  await expect(page.locator('#clips .clip')).toHaveCount(2);
  await page.locator('#audioFiles').setInputFiles(music);
  await expect(page.locator('#audioClips .audio-item')).toHaveCount(1,{timeout:15000});
  await page.locator('#audioClips .audio-item').click();
  await page.locator('#muteOriginal').check();
  await page.locator('#clipTitle').fill('Test WarLike');
  await page.locator('#clipTitle').dispatchEvent('change');
  await page.locator('#resolution').selectOption('480');
  const downloadPromise=page.waitForEvent('download',{timeout:85000});
  await page.locator('#exportVideo').click();
  const download=await downloadPromise.catch(async error=>{
   const status=await page.locator('#status').textContent().catch(()=>'(statut inaccessible)');
   const mode=await page.locator('#mode').textContent().catch(()=>'(mode inaccessible)');
   throw Error('Export WebM sans téléchargement : '+status+' | mode='+mode+' | page errors='+JSON.stringify(errors)+' | '+error.message);
  });
  await download.saveAs(join(dir,'render.webm'));
  await expect(page.locator('#status')).toContainText('Export WebM terminé');
  expect(errors).toEqual([]);
  const output=join(dir,'render.webm');
  const probe=JSON.parse(command('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output]));
  expect(probe.streams.some(s=>s.codec_type==='video')).toBeTruthy();
  expect(probe.streams.some(s=>s.codec_type==='audio')).toBeTruthy();
  // MediaRecorder WebM often omits Segment Info Duration even when its
  // actual audio/video packets have correct timestamps. Probe the packets
  // rather than assuming the optional format.duration metadata is present.
  const packets=JSON.parse(command('ffprobe',['-v','error','-show_packets','-show_entries',
   'packet=codec_type,pts_time,duration_time','-of','json',output])).packets||[];
  const videoPackets=packets.filter(p=>p.codec_type==='video'&&Number.isFinite(Number(p.pts_time)));
  const audioPackets=packets.filter(p=>p.codec_type==='audio'&&Number.isFinite(Number(p.pts_time)));
  expect(videoPackets.length).toBeGreaterThan(10);
  expect(audioPackets.length).toBeGreaterThan(10);
  const seconds=Number.isFinite(Number(probe.format.duration))&&Number(probe.format.duration)>0
   ?Number(probe.format.duration)
   :Math.max(...packets.map(p=>Number(p.pts_time)+Number(p.duration_time||0)).filter(Number.isFinite));
  expect(seconds).toBeGreaterThan(2);
  expect(seconds).toBeLessThan(7);
  // ffmpeg prints volumedetect metrics to stderr.
  const vol=spawnSync('ffmpeg',['-hide_banner','-nostats','-i',output,'-af','volumedetect','-f','null','-'],{encoding:'utf8',timeout:60000});
  expect(vol.status).toBe(0);
  const match=vol.stderr.match(/mean_volume:\s*(-?[\d.]+) dB/);
  expect(match,'Export must have measurable audio from the independent track').not.toBeNull();
  expect(Number(match[1])).toBeGreaterThan(-65);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
