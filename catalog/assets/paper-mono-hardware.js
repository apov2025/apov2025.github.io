import {GLTFLoader} from '../product/prototype/vendor/three-runtime.js';

// Visible inserts follow the manufacturer's CAD openings and side photographs.
// They replace the original flat port placeholders, without changing the shell.
export async function addPaperMonoHardware(root) {
  const chassis=root.getObjectByName('PaperMono_chassis');
  if(!chassis)return;
  const {scene}=await new GLTFLoader().loadAsync(new URL('../product/paper-mono-v2/models/hardware.glb',import.meta.url).href);
  for(const name of ['PaperMono_USB-C','PaperMono_microSD_slot','PaperMono_indicator']){
    const placeholder=root.getObjectByName(name);
    if(placeholder)placeholder.visible=false;
  }
  scene.name='PaperMono_visible_hardware';
  chassis.parent.add(scene);
}
