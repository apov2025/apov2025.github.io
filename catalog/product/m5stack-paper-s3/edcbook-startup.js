// Host navigation for the pinned, unmodified EDCBook 3.1.2 image only.
// Fingerprints cover fixed labels in real 540×960 firmware frames, excluding
// the clock, battery, book titles and user content. Unknown screens get no taps.
function fingerprint(frame,x0,y0,x1,y1) {
  let hash=2166136261;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)hash=Math.imul(hash^(frame.pixels[(y*frame.width+x)*4]<128?1:0),16777619)>>>0;
  return hash;
}
export function edcbookScreen(frame) {
  if(frame?.width!==540||frame.height!==960||frame.pixels?.length!==540*960*4)return null;
  const header=fingerprint(frame,180,18,360,50);
  if(header===0xe10d372e)return 'books'; // /book
  const footer=fingerprint(frame,175,870,365,940);
  if(header===0x36629bb0&&footer===0x6809134b)return 'recent';
  if(header===0x7169ed3b&&footer===0xa73db9b3)return 'services';
  if(header===0x160a0179&&fingerprint(frame,160,865,380,920)===0x7ea496d2)return 'off';
  if(header===0x0ec7afc5&&footer===0xfe36e5d5){
    const menu=fingerprint(frame,140,730,400,785);
    if(menu===0x7ffbad39)return 'welcome';
    if(menu===0xe4e4184d)return 'open-library';
  }
  return null;
}

export async function enterEdcbookLibrary({state,frame,tap,restart,active,onProgress}) {
  const deadline=performance.now()+120000;
  let observed=null,changedAt=0,acted=null,restarts=0;
  while(active()&&performance.now()<deadline){
    const current=state();
    if(current.status==='error')throw current.lastError||new Error('Emulator stopped');
    if(current.status==='disposed')return false;
    const image=frame(),time=current.stats.time||0;
    if(image!==observed){observed=image;changedAt=time;}
    // Wait for the firmware's refresh to settle in guest time. Never tap an
    // intermediate e-paper scan, and never repeat a tap while its UI is busy.
    if(image&&image!==acted&&time-changedAt>=.3){
      const screen=edcbookScreen(image);
      if(screen==='books'){onProgress({phase:'ready',restarts});return true;}
      if(screen==='off'&&restarts===0){
        acted=image;restarts++;onProgress({phase:'starting',restarts});await restart();observed=null;continue;
      }
      const point=screen==='welcome'?[478,753]:screen==='open-library'?[267,753]:['recent','services'].includes(screen)?[265,905]:null;
      if(point){acted=image;await tap(...point);}
    }
    await new Promise(resolve=>setTimeout(resolve,40));
  }
  if(active())onProgress({phase:'manual',restarts});
  return false;
}
