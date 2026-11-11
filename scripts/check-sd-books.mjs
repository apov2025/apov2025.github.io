import test from 'node:test';
import assert from 'node:assert/strict';
import {createFat32Image} from '../catalog/product/m5stack-paper-s3/vendor/platform/sd-card-image.js';
import {addBooksToSd,hasBookOnSd} from '../catalog/product/m5stack-paper-s3/sd-books.js';

// Independent FAT directory/chain reader: this does not import the writer's internals.
function reader(bytes) {
  const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),b=d.getUint32(454,true)*512;
  const sector=d.getUint16(b+11,true),clusterBytes=sector*bytes[b+13],fat=b+d.getUint16(b+14,true)*sector;
  const fatBytes=d.getUint32(b+36,true)*sector,data=fat+bytes[b+16]*fatBytes,root=d.getUint32(b+44,true);
  const next=c=>d.getUint32(fat+4*c,true)&0x0fffffff,offset=c=>data+(c-2)*clusterBytes;
  const chain=c=>{const result=[];while(c>=2&&c<0x0ffffff8){assert(!result.includes(c),'cyclic chain');result.push(c);c=next(c);}return result;};
  const entries=c=>{const result=[];let long=[];for(const cluster of chain(c))for(let at=offset(cluster);at<offset(cluster)+clusterBytes;at+=32){if(bytes[at]===0)return result;if(bytes[at]===0xe5){long=[];continue;}if(bytes[at+11]===15){const part=[];for(const i of [1,3,5,7,9,14,16,18,20,22,24,28,30])part.push(d.getUint16(at+i,true));long.unshift(part);continue;}const short=String.fromCharCode(...bytes.subarray(at,at+8)).trimEnd(),ext=String.fromCharCode(...bytes.subarray(at+8,at+11)).trimEnd();const units=long.flat(),end=units.findIndex(n=>n===0||n===65535);result.push({name:long.length?String.fromCharCode(...(end<0?units:units.slice(0,end))):short+(ext?'.'+ext:''),short:short+(ext?'.'+ext:''),at,attr:bytes[at+11],cluster:(d.getUint16(at+20,true)<<16)|d.getUint16(at+26,true),size:d.getUint32(at+28,true)});long=[];}return result;};
  const read=e=>{const out=new Uint8Array(e.size);let pos=0;for(const c of chain(e.cluster)){const n=Math.min(out.length-pos,clusterBytes);out.set(bytes.subarray(offset(c),offset(c)+n),pos);pos+=n;if(pos===out.length)break;}assert.equal(pos,e.size);return out;};
  const setFat=(c,n)=>{for(let i=0;i<bytes[b+16];i++)d.setUint32(fat+i*fatBytes+c*4,n,true);};
  return {d,b,fat,fatBytes,data,clusterBytes,root,next,offset,chain,entries,read,setFat};
}
const text=s=>new TextEncoder().encode(s);
const bookDirectory=r=>r.entries(r.root).find(e=>e.name.toLowerCase()==='book');
const books=r=>r.entries(bookDirectory(r).cluster);
function fixture() {
  const image=createFat32Image(),r=reader(image);
  const entry=(at,name,attr,cluster,size)=>{image.set(text(name),at);image[at+11]=attr;r.d.setUint16(at+26,cluster,true);r.d.setUint32(at+28,size,true);};
  for(const c of [3,4,5,6,7,8])r.setFat(c,0x0fffffff);
  r.setFat(4,5);
  entry(r.offset(2)+32,'CONFIG     ',16,3,0);
  entry(r.offset(2)+64,'KEEP    TXT',32,6,9);image.set(text('keep me!\n'),r.offset(6));
  entry(r.offset(3),'.          ',16,3,0);entry(r.offset(3)+32,'..         ',16,0,0);
  entry(r.offset(3)+64,'SETTING JSN',32,4,700);
  entry(r.offset(2)+96,'BOOK       ',16,7,0);
  entry(r.offset(7),'.          ',16,7,0);entry(r.offset(7)+32,'..         ',16,0,0);
  entry(r.offset(7)+64,'KEEP    TXT',32,8,9);image.set(text('keep me!\n'),r.offset(8));image.fill(0xa7,r.offset(4),r.offset(4)+512);image.fill(0x39,r.offset(5),r.offset(5)+188);
  return image;
}
test('Unicode names and original bytes survive; existing nested settings and files are unchanged',()=>{
  const original=fixture(),snapshot=original.slice(),content=text('第一章\r\n真实书籍内容\n😀');
  const result=addBooksToSd(original,[{name:'测试电子书 😀.txt',data:content},{name:'Empty.txt',data:new Uint8Array()}]);
  assert.deepEqual(original,snapshot);assert.notEqual(result.image.buffer,original.buffer);
  const r=reader(result.image),entries=r.entries(r.root),book=books(r).find(e=>e.name==='测试电子书 😀.txt');
  assert(book);assert.deepEqual(r.read(book),content);assert.equal(books(r).find(e=>e.name==='Empty.txt').cluster,0);
  assert.equal(new TextDecoder().decode(r.read(entries.find(e=>e.name==='KEEP.TXT'))),'keep me!\n');
  const settings=r.entries(entries.find(e=>e.name==='CONFIG').cluster).find(e=>e.short==='SETTING.JSN');
  assert.deepEqual(r.read(settings),reader(snapshot).read(reader(snapshot).entries(3).find(e=>e.short==='SETTING.JSN')));
  assert.deepEqual(result.files.map(f=>[f.originalName,f.name,f.bytes]),[['测试电子书 😀.txt','测试电子书 😀.txt',content.length],['Empty.txt','Empty.txt',0]]);
});
test('case-insensitive collisions rename instead of overwriting and 8.3 aliases stay unique',()=>{
  const first=addBooksToSd(fixture(),[{name:'keep.txt',data:text('new')},{name:'你好.txt',data:text('一')},{name:'你好.TXT',data:text('二')},{name:'BOOK~1.TXT',data:text('三')}]);
  const entries=books(reader(first.image));assert.equal(first.files[0].name,'keep (2).txt');assert.equal(first.files[2].name,'你好 (2).TXT');
  assert.equal(new Set(entries.map(e=>e.short)).size,entries.length);
  for(const file of first.files)assert(entries.some(e=>e.name===file.name));
});
test('fragmented file chains and an expanded book directory retain every book and FAT copy',()=>{
  const original=fixture(),r=reader(original);for(let c=9;c<150;c+=3)r.setFat(c,0x0ffffff7);
  const files=Array.from({length:30},(_,i)=>({name:`长文件名第${i}本😀.txt`,data:new Uint8Array(1700+i).fill(i+1)}));
  const result=addBooksToSd(original,files),after=reader(result.image);assert(after.chain(bookDirectory(after).cluster).length>1);
  for(const file of files)assert.deepEqual(after.read(books(after).find(e=>e.name===file.name)),file.data);
  assert.deepEqual(result.image.subarray(after.fat,after.fat+after.fatBytes),result.image.subarray(after.fat+after.fatBytes,after.fat+2*after.fatBytes));
  const count=Math.floor((result.image.length-after.data)/after.clusterBytes);let free=0;for(let c=2;c<count+2;c++)if(after.next(c)===0)free++;
  for(const sector of [1,7])assert.equal(after.d.getUint32(after.b+sector*512+488,true),free);
  assert.equal(result.freeBytes,free*after.clusterBytes);
});
test('full-card and malformed-chain failures never mutate the original card',()=>{
  const image=createFat32Image(),r=reader(image),count=Math.floor((image.length-r.data)/r.clusterBytes);
  for(let c=4;c<count+2;c++)r.setFat(c,0x0ffffff7);const snapshot=image.slice();
  assert.throws(()=>addBooksToSd(image,[{name:'first.txt',data:text('first')},{name:'too-big.txt',data:new Uint8Array(1024)}]),e=>e.code==='SD_FULL');assert.deepEqual(image,snapshot);
  for(const next of [2,0,0x0ffffff7,count+10]){const bad=createFat32Image(),b=reader(bad);b.setFat(2,next);const copy=bad.slice();assert.throws(()=>addBooksToSd(bad,[{name:'x.txt',data:text('x')}]),e=>e.code==='INVALID_SD_IMAGE');assert.deepEqual(bad,copy);}
});
test('reject invalid filenames, inconsistent FAT copies and truncated images',()=>{
  for(const name of ['../bad.txt','bad?.txt','bad.txt ','bad.epub','\ud800.txt'])assert.throws(()=>addBooksToSd(createFat32Image(),[{name,data:text('x')}]),e=>e.code==='INVALID_BOOK');
  const mismatch=createFat32Image(),r=reader(mismatch);r.d.setUint32(r.fat+r.fatBytes+12,0x0fffffff,true);
  assert.throws(()=>addBooksToSd(mismatch,[{name:'x.txt',data:text('x')}]),e=>e.code==='INVALID_SD_IMAGE');
  assert.throws(()=>addBooksToSd(createFat32Image().subarray(0,4096),[{name:'x.txt',data:text('x')}]),e=>e.code==='INVALID_SD_IMAGE');
});

test('create /book with valid dot entries and expand a completely full root directory',()=>{
  const image=createFat32Image(),r=reader(image);
  for(let i=1;i<16;i++){const at=r.offset(2)+i*32;image.set(text(`OLD${i}`.padEnd(8,' ')+'TXT'),at);image[at+11]=32;}
  const result=addBooksToSd(image,[{name:'新书.txt',data:text('正文')}]),after=reader(result.image),folder=bookDirectory(after);
  assert(folder);assert.equal(folder.attr,16);assert(after.chain(2).length>1);
  assert.deepEqual(books(after).slice(0,2).map(e=>[e.name,e.cluster]),[['.',folder.cluster],['..',0]]);
  assert.deepEqual(after.read(books(after).find(e=>e.name==='新书.txt')),text('正文'));
  assert.equal(after.entries(2).filter(e=>e.name.startsWith('OLD')).length,15);
});

test('maximum UTF-16 names remain intact and collisions never split a surrogate pair',()=>{
  const name='中'.repeat(246)+'😀abc.txt';assert.equal(name.length,255);
  const result=addBooksToSd(createFat32Image(),[{name,data:text('one')},{name,data:text('two')}]),r=reader(result.image);
  assert.equal(result.files[0].name,name);assert(result.files[1].name.endsWith(' (2).txt'));assert(result.files[1].name.isWellFormed());
  assert.deepEqual(books(r).filter(e=>!(e.attr&16)).map(e=>e.name),result.files.map(f=>f.name));
  assert.throws(()=>addBooksToSd(createFat32Image(),[{name:'bad\uffff.txt',data:text('bad')}]),e=>e.code==='INVALID_BOOK');
});
test('reuse deleted directory slots and keep an end marker before stale bytes',()=>{
  const image=fixture(),r=reader(image),start=r.offset(7);
  for(let i=3;i<6;i++)image[start+i*32]=0xe5;
  image.fill(0x41,start+7*32,start+12*32);
  const result=addBooksToSd(image,[{name:'a.txt',data:text('A')},{name:'a rather long title.txt',data:text('B')}]),after=reader(result.image);
  assert.equal(after.chain(7).length,1);assert.deepEqual(books(after).filter(e=>!(e.attr&16)).map(e=>e.name),['KEEP.TXT','a.txt','a rather long title.txt']);
});
test('respect an active FAT, preserve reserved high bits and accept offset Uint8Array views',()=>{
  const original=fixture(),r=reader(original);r.d.setUint16(r.b+40,0x81,true);r.d.setUint16(r.b+6*512+40,0x81,true);
  r.d.setUint32(r.fat+9*4,0x0ffffff7,true);r.d.setUint32(r.fat+r.fatBytes+9*4,0xa0000000,true);
  const wrapper=new Uint8Array(original.length+64);wrapper.set(original,32);
  const result=addBooksToSd(wrapper.subarray(32,32+original.length),[{name:'active.txt',data:text('ok')}]),after=reader(result.image);
  assert.deepEqual(result.image.subarray(r.fat,r.fat+r.fatBytes),original.subarray(r.fat,r.fat+r.fatBytes));
  assert.equal(after.d.getUint32(r.fat+r.fatBytes+9*4,true),0xafffffff);assert.deepEqual(wrapper.subarray(32,32+original.length),original);
});
test('a root file named book is not replaced by a directory',()=>{
  const image=createFat32Image(),r=reader(image),at=r.offset(2)+32;image.set(text('BOOK       '),at);image[at+11]=32;const snapshot=image.slice();
  assert.throws(()=>addBooksToSd(image,[{name:'x.txt',data:text('x')}]),e=>e.code==='UNSUPPORTED_SD_IMAGE');assert.deepEqual(image,snapshot);
});

test('bundled book presence is read-only and prevents a second preload',()=>{
  let image=fixture();const data=text('西游记第一回');
  assert.equal(hasBookOnSd(image,'西游记.txt'),false);
  image=addBooksToSd(image,[{name:'西游记.txt',data}]).image;
  const before=image.slice();
  if(!hasBookOnSd(image,'西游记.TXT'))image=addBooksToSd(image,[{name:'西游记.txt',data}]).image;
  assert.deepEqual(image,before);
  assert.equal(books(reader(image)).filter(e=>e.name==='西游记.txt').length,1);
  assert.equal(hasBookOnSd(image,'红楼梦.txt'),false);
});
