// Maintenance only: requires ImageMagick and fontTools (with Brotli support).
// Originals remain intact. Commit the generated web display assets; CI simply
// publishes them and does not need these image/font conversion dependencies.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCT_PHOTOS } from '../js/product-photos.js';
const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
await mkdir('assets/display',{recursive:true});
const image=(...args)=>execFileSync('magick',args,{stdio:'inherit'});
image('assets/holdwin-mark.png','-resize','160x160','-define','webp:lossless=true','assets/holdwin-mark-small.webp');
image('assets/holdwin-mark.png','-resize','64x64','assets/holdwin-icon.png');
image('assets/pantry-scene-approved.png','-crop','347x475+1388+388','+repage','-define','webp:lossless=true','assets/pantry-mobile.webp');
image('assets/pantry-scene-approved.png','-crop','218x252+47+584','+repage','-define','webp:lossless=true','assets/pantry-coffee.webp');
for(const variant of ['wide','portrait']) image(`assets/pantry-office-${variant}.png`,'-quality','90',`assets/pantry-office-${variant}.webp`);
for(const photo of PRODUCT_PHOTOS.filter(photo=>photo.enabled!==false)){
  const height=photo.crop?.[3]||photo.height,scale=Math.min(1,396/height);
  image(photo.src,'-resize',`${(scale*100).toFixed(3)}%`,'-quality','91',resolve(root,photo.displaySrc));
}
const names=(await readdir('js')).filter(name=>name.endsWith('.js')).sort();
const text=(await Promise.all(['index.html',...names.map(name=>`js/${name}`)].map(name=>readFile(name,'utf8')))).join('\n');
await writeFile('/tmp/pantry-font-characters.txt',[...new Set(text+'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')].join(''));
execFileSync('pyftsubset',['assets/pantry-hand-complete.woff2','--text-file=/tmp/pantry-font-characters.txt','--flavor=woff2','--output-file=assets/pantry-ui.woff2','--layout-features=*','--name-IDs=*','--name-legacy','--name-languages=*'],{stdio:'inherit'});
console.log('Generated display assets from preserved originals.');
