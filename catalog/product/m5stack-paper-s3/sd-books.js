// FAT32/VFAT: Microsoft FAT Specification v1.03, BPB/FAT/FSInfo and long directory entries.
// https://www.cs.fsu.edu/~cop4610t/assignments/project3/spec/fatspec.pdf
// Imports TXT files into /book; the input image and all existing file contents stay untouched.
const EOC=0x0fffffff, MASK=0x0fffffff;
const LFN_OFFSETS=[1,3,5,7,9,14,16,18,20,22,24,28,30];
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
const invalid=message=>fail('INVALID_SD_IMAGE',message);
const bytesOf=value=>value instanceof Uint8Array?value:value instanceof ArrayBuffer?new Uint8Array(value):null;
const key=name=>name.normalize('NFC').toUpperCase();
const checksum=alias=>alias.reduce((sum,byte)=>(((sum&1)<<7)+(sum>>1)+byte)&255,0);

function volume(bytes) {
  if(!bytes||bytes.length<1024*1024||bytes.length>128*1024*1024||bytes.length%512)invalid('Invalid virtual TF card size.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=at=>view.getUint16(at,true),u32=at=>view.getUint32(at,true);
  if(u16(510)!==0xaa55)invalid('The card has no valid partition table.');
  const partitions=[];
  for(let i=0;i<4;i++){const at=446+i*16;if([0x0b,0x0c].includes(bytes[at+4]))partitions.push({start:u32(at+8),sectors:u32(at+12)});}
  if(partitions.length!==1)fail('UNSUPPORTED_SD_IMAGE','Use a card with one FAT32 partition.');
  const {start,sectors}=partitions[0],boot=start*512;
  if(!start||!sectors||boot+sectors*512>bytes.length||sectors<1)invalid('FAT32 partition is outside the card.');
  if(u16(boot+510)!==0xaa55)invalid('Invalid FAT32 boot signature.');
  if(u16(boot+11)!==512)fail('UNSUPPORTED_SD_IMAGE','Only 512-byte FAT32 sectors are supported.');
  const clusterSectors=bytes[boot+13],reserved=u16(boot+14),copies=bytes[boot+16],fatSectors=u32(boot+36),total=u32(boot+32),flags=u16(boot+40);
  if(!clusterSectors||(clusterSectors&(clusterSectors-1))||clusterSectors>128||!reserved||copies<1||copies>2||!fatSectors||u16(boot+17)||u16(boot+19)||u16(boot+22)||u16(boot+42))invalid('Unsupported or damaged FAT32 geometry.');
  const overhead=reserved+copies*fatSectors,clusters=Math.floor((total-overhead)/clusterSectors),max=clusters+1;
  if(total>sectors||total<=overhead||clusters<65525||max>=0x0ffffff0||(clusters+2)*4>fatSectors*512)invalid('FAT32 cluster layout is outside the partition.');
  const mirrored=!(flags&0x80),active=mirrored?0:flags&15;
  if(active>=copies)invalid('Invalid active FAT index.');
  const fat=boot+reserved*512,fatBytes=fatSectors*512,data=boot+overhead*512,clusterBytes=clusterSectors*512;
  const get=c=>u32(fat+active*fatBytes+c*4)&MASK;
  if((get(0)&255)!==bytes[boot+21]||get(0)<0x0ffffff8||(get(1)&0x03ffffff)!==0x03ffffff)invalid('Invalid reserved FAT entries.');
  const free=[];
  for(let c=0;c<=max;c++){
    const value=get(c);
    if(mirrored)for(let i=1;i<copies;i++)if((u32(fat+i*fatBytes+c*4)&MASK)!==value)invalid('The FAT copies disagree.');
    if(c<2)continue;
    if(value===0)free.push(c);
    else if(value!==0x0ffffff7&&value<0x0ffffff8&&(value<2||value>max))invalid('A FAT chain points outside the volume.');
  }
  const root=u32(boot+44)&MASK;
  if(root<2||root>max)invalid('Invalid root directory cluster.');
  const infos=[],infoSector=u16(boot+48),backup=u16(boot+50);
  const addInfo=sector=>{
    if(sector<=0||sector>=reserved)invalid('FSInfo lies outside reserved sectors.');
    const at=boot+sector*512;
    if(u32(at)!==0x41615252||u32(at+484)!==0x61417272||u32(at+508)!==0xaa550000)invalid('Invalid FAT32 FSInfo signatures.');
    infos.push(at);
  };
  if(infoSector!==0xffff&&infoSector!==0){addInfo(infoSector);if(backup!==0xffff&&backup!==0){if(backup>=reserved||u16(boot+backup*512+510)!==0xaa55)invalid('Invalid backup boot sector.');addInfo(backup+infoSector);}}
  return {bytes,view,boot,fat,fatBytes,data,clusterBytes,clusters,max,root,copies,active,mirrored,get,free,infos,offset:c=>data+(c-2)*clusterBytes};
}

function shortName(bytes,at) {
  const decode=(start,length)=>String.fromCharCode(...bytes.subarray(start,start+length)).trimEnd();
  let base=decode(at,8),ext=decode(at+8,3);
  if(bytes[at]===5)base=String.fromCharCode(0xe5)+base.slice(1);
  if(bytes[at+12]&8)base=base.toLowerCase();if(bytes[at+12]&16)ext=ext.toLowerCase();
  return base+(ext?'.'+ext:'');
}
function inspect(v) {
  const owned=new Uint8Array(v.max+1);
  const chain=start=>{
    const result=[];let cluster=start;
    while(true){
      if(cluster<2||cluster>v.max||owned[cluster])invalid('A file has a cyclic or shared FAT chain.');
      owned[cluster]=1;result.push(cluster);const next=v.get(cluster);
      if(next>=0x0ffffff8)break;
      if(next<2||next>v.max)invalid('A live file refers to a free, bad or invalid cluster.');
      cluster=next;
    }
    return result;
  };
  const directory=chain=>({chain,slots:[],end:null,names:new Set(),aliases:new Set()});
  const root=directory(chain(v.root)),directories=[root];let books=null;
  for(let cursor=0;cursor<directories.length;cursor++){
    const current=directories[cursor],selected=current===root||current===books;let ended=false,long=null;
    for(const cluster of current.chain)for(let at=v.offset(cluster);at<v.offset(cluster)+v.clusterBytes;at+=32){
      const first=v.bytes[at],slot=selected?current.slots.length:0;
      if(selected)current.slots.push(at);
      if(ended)continue;
      if(first===0){ended=true;if(selected)current.end=slot;continue;}
      if(first===0xe5){long=null;continue;}
      const attr=v.bytes[at+11];
      if(attr===15){
        const ordinal=first&31;
        if(first&64)long=ordinal>=1&&ordinal<=20?{next:ordinal,parts:[],checksum:v.bytes[at+13]}:null;
        if(!long||first&0xa0||ordinal!==long.next||v.bytes[at+12]||v.view.getUint16(at+26,true)||v.bytes[at+13]!==long.checksum){long=null;continue;}
        long.parts[ordinal-1]=LFN_OFFSETS.map(i=>v.view.getUint16(at+i,true));long.next--;continue;
      }
      const short=shortName(v.bytes,at),raw=v.bytes.subarray(at,at+11);
      let name=short;
      if(long&&long.next===0&&long.checksum===checksum(raw)){
        const units=long.parts.flat(),end=units.findIndex(n=>n===0||n===0xffff);name=String.fromCharCode(...(end<0?units:units.slice(0,end)));
      }
      long=null;
      if(selected){current.names.add(key(short));current.names.add(key(name));current.aliases.add(String.fromCharCode(...raw));}
      if(attr&8||short==='.'||short==='..')continue;
      const isBooks=current===root&&(key(name)==='BOOK'||key(short)==='BOOK');
      if(isBooks&&!(attr&16))fail('UNSUPPORTED_SD_IMAGE','The card contains a file named book; the /book directory cannot be created.');
      const firstCluster=((v.view.getUint16(at+20,true)<<16)|v.view.getUint16(at+26,true))&MASK,size=v.view.getUint32(at+28,true);
      if(!firstCluster){if(size||attr&16)invalid('A nonempty file or directory has no cluster.');continue;}
      const contents=chain(firstCluster);
      if(attr&16){const child=directory(contents);directories.push(child);if(isBooks){if(books)invalid('The card contains ambiguous book directories.');books=child;}}
      else if(size>contents.length*v.clusterBytes)invalid('A file size exceeds its FAT chain.');
    }
  }
  return {root,books};
}
function validateBook(file) {
  const name=file?.name,data=bytesOf(file?.data);
  if(typeof name!=='string'||!name.length||name.length>255||!data||data.length>0xffffffff||!/^.+\.txt$/i.test(name)||/[\x00-\x1f\uffff"*/:<>?\\|]/.test(name)||/[ .]$/.test(name)||/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])\./i.test(name))fail('INVALID_BOOK','Choose TXT files with valid filenames of at most 255 characters.');
  for(let i=0;i<name.length;i++){
    const unit=name.charCodeAt(i);
    if(unit>=0xd800&&unit<=0xdbff){const low=name.charCodeAt(++i);if(!(low>=0xdc00&&low<=0xdfff))fail('INVALID_BOOK','The filename contains an invalid Unicode character.');}
    else if(unit>=0xdc00&&unit<=0xdfff)fail('INVALID_BOOK','The filename contains an invalid Unicode character.');
  }
  return {name,data};
}
function uniqueName(name,names) {
  if(!names.has(key(name)))return name;
  const dot=name.lastIndexOf('.'),base=name.slice(0,dot),ext=name.slice(dot);
  for(let n=2;n<1000000;n++){
    const suffix=` (${n})${ext}`;let stem=base.slice(0,255-suffix.length);
    if(/[\ud800-\udbff]$/.test(stem))stem=stem.slice(0,-1);
    const candidate=stem+suffix;if(!names.has(key(candidate)))return candidate;
  }
  fail('SD_FULL','No unused filename is available.');
}
function shortAlias(name,names,aliases) {
  const dot=name.lastIndexOf('.'),base=name.slice(0,dot).toUpperCase(),ext=name.slice(dot+1).toUpperCase();
  const alias=(stem,extension)=>stem.padEnd(8,' ')+extension.padEnd(3,' ');
  const available=(stem,extension)=>!aliases.has(alias(stem,extension))&&!names.has(key(stem+(extension?'.'+extension:'')));
  if(/^[A-Z0-9_$~!#%&'()@^`{}-]{1,8}$/.test(base)&&/^[A-Z0-9]{1,3}$/.test(ext)&&available(base,ext))return alias(base,ext);
  const stem=base.replace(/[^A-Z0-9_]/g,'')||'BOOK',extension=ext.replace(/[^A-Z0-9]/g,'').slice(0,3);
  for(let n=1;n<1000000;n++){const suffix=`~${n}`,candidate=stem.slice(0,8-suffix.length)+suffix;if(available(candidate,extension))return alias(candidate,extension);}
  fail('SD_FULL','No unused short filename is available.');
}
function directoryEntries(name,alias,cluster,size,attr=32) {
  const count=Math.ceil(name.length/13),entries=Array.from({length:count+1},()=>new Uint8Array(32)),aliasBytes=Uint8Array.from(alias,c=>c.charCodeAt(0)),sum=checksum(aliasBytes);
  for(let physical=0;physical<count;physical++){
    const ordinal=count-physical,e=entries[physical],d=new DataView(e.buffer);e[0]=ordinal|(physical===0?64:0);e[11]=15;e[13]=sum;
    for(let i=0;i<13;i++){const at=(ordinal-1)*13+i;d.setUint16(LFN_OFFSETS[i],at<name.length?name.charCodeAt(at):at===name.length?0:0xffff,true);}
  }
  const e=entries[count],d=new DataView(e.buffer);e.set(aliasBytes);e[11]=attr;d.setUint16(20,cluster>>>16,true);d.setUint16(26,cluster&65535,true);d.setUint32(28,size,true);
  const now=new Date(),year=Math.min(2107,Math.max(1980,now.getUTCFullYear())),date=((year-1980)<<9)|((now.getUTCMonth()+1)<<5)|now.getUTCDate(),time=(now.getUTCHours()<<11)|(now.getUTCMinutes()<<5)|(now.getUTCSeconds()>>1);
  for(const at of [16,18,24])d.setUint16(at,date,true);for(const at of [14,22])d.setUint16(at,time,true);
  return entries;
}

/** Copy a FAT32 card and add TXT files to /book. Throws atomically; never changes image or file data. */
export function hasBookOnSd(image,name) {
  return inspect(volume(bytesOf(image))).books?.names.has(key(name))??false;
}

export function addBooksToSd(image,files) {
  if(!Array.isArray(files)||!files.length)fail('INVALID_BOOK','Choose at least one TXT file.');
  const books=files.map(validateBook),source=volume(bytesOf(image)),directories=inspect(source);
  const bytes=source.bytes.slice(),view=new DataView(bytes.buffer),v={...source,bytes,view};let allocated=0;
  const setFat=(cluster,next)=>{for(let i=0;i<v.copies;i++){if(!v.mirrored&&i!==v.active)continue;const at=v.fat+i*v.fatBytes+cluster*4;view.setUint32(at,(view.getUint32(at,true)&0xf0000000)|next,true);}};
  const allocate=()=>{if(allocated===v.free.length)fail('SD_FULL','The virtual TF card has insufficient free space.');const c=v.free[allocated++];setFat(c,EOC);bytes.fill(0,v.offset(c),v.offset(c)+v.clusterBytes);return c;};
  const slots=(directory,count)=>{
    let run=0,start=0;
    for(let i=0;;i++){
      if(i===directory.slots.length){
        const cluster=allocate();setFat(directory.chain.at(-1),cluster);directory.chain.push(cluster);
        if(directory.end===null)directory.end=i;
        for(let at=v.offset(cluster);at<v.offset(cluster)+v.clusterBytes;at+=32)directory.slots.push(at);
      }
      if((directory.end!==null&&i>=directory.end)||bytes[directory.slots[i]]===0xe5){if(!run)start=i;if(++run===count){if(directory.end!==null&&start+count>directory.end){directory.end=start+count;if(directory.end<directory.slots.length)bytes[directory.slots[directory.end]]=0;}return directory.slots.slice(start,start+count);}}
      else run=0;
    }
  };
  let directory=directories.books;
  if(!directory){
    const cluster=allocate(),at=v.offset(cluster);
    // FAT32's root-parent '..' entry uses cluster 0, not BPB_RootClus.
    bytes.set(directoryEntries('','.          ',cluster,0,16)[0],at);
    bytes.set(directoryEntries('','..         ',0,0,16)[0],at+32);
    const entries=directoryEntries('book','BOOK       ',cluster,0,16),locations=slots(directories.root,entries.length);
    entries.forEach((entry,i)=>bytes.set(entry,locations[i]));
    directory={chain:[cluster],slots:Array.from({length:v.clusterBytes/32},(_,i)=>at+i*32),end:2,names:new Set(['.','..']),aliases:new Set(['.          ','..         '])};
  }
  const imported=[];
  for(const book of books){
    const name=uniqueName(book.name,directory.names),alias=shortAlias(name,directory.names,directory.aliases);let first=0,previous=0;
    for(let pos=0;pos<book.data.length;pos+=v.clusterBytes){const cluster=allocate();if(previous)setFat(previous,cluster);else first=cluster;previous=cluster;bytes.set(book.data.subarray(pos,pos+v.clusterBytes),v.offset(cluster));}
    const entries=directoryEntries(name,alias,first,book.data.length),locations=slots(directory,entries.length);
    entries.forEach((entry,i)=>bytes.set(entry,locations[i]));directory.names.add(key(name));directory.names.add(key(alias.slice(0,8).trimEnd()+'.'+alias.slice(8).trimEnd()));directory.aliases.add(alias);
    imported.push({originalName:book.name,name,bytes:book.data.length});
  }
  for(const at of v.infos){view.setUint32(at+488,v.free.length-allocated,true);view.setUint32(at+492,v.free[allocated]??0xffffffff,true);}
  return {image:bytes,files:imported,freeBytes:(v.free.length-allocated)*v.clusterBytes};
}
