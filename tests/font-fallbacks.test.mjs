import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('published heading-font shards cover ordered ranges with present WOFF2 files and no runtime complete-font download',async()=>{
 const manifest=JSON.parse(await readFile(new URL('assets/pantry-font-fallbacks.json',root),'utf8'));
 const css=await readFile(new URL('pantry.css',root),'utf8');assert.ok(manifest.length>1);let end=-1;
 for(const row of manifest){
  assert.match(row.file,/^\.\/assets\/fonts\/pantry-hand-\d+\.woff2$/);assert.ok(Number.isSafeInteger(row.start)&&row.start>end&&row.end>=row.start&&row.end<=0x10FFFF);end=row.end;
  assert.ok(row.glyphs>0&&row.glyphs<=512);const bytes=await readFile(new URL(row.file,root));assert.equal(bytes.subarray(0,4).toString(),'wOF2');assert.equal(bytes.length,row.bytes);assert.ok(row.bytes<300000);
  assert.ok(css.includes(row.file));assert.ok(css.includes(`unicode-range:U+${row.start.toString(16).toUpperCase()}-${row.end.toString(16).toUpperCase()}`));
 }
 assert.ok(!css.includes("url('./assets/pantry-hand-complete.woff2')"));assert.ok(css.includes('--heading-font:"Pantry Product Characters","Pantry Hand","Pantry Hand Complete",serif'));
});
