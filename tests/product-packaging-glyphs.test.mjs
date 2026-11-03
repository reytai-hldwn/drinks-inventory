import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalDrinkPackaging, createCompanyData, prepareCompanyCatalog } from '../js/catalog.js';
import { normalizeGooglePublicData } from '../js/google-store.js';
import { websiteBackend } from './helpers/google-website.mjs';

const names=['午后時光重乳奶茶','義美寶吉葡萄汁','波蜜蜂蜜檸檬'];
test('the three confirmed cartons display their verified packaging without changing source quantities, identity or explicit alternatives',()=>{
  const b=websiteBackend();
  for(const [i,name]of names.entries())b.sheets.Catalog.rows.push(['confirmed-'+i,name,'其他','其他','包','',10,true]);
  const raw=JSON.parse(b.ctx.doGet({parameter:{action:'warehouse'}}).body),before=structuredClone(raw);
  const data=normalizeGooglePublicData(raw,{warehouse:true});
  for(const name of names){const source=before.drinks.find(d=>d.name===name),actual=data.data.drinks.find(d=>d.name===name);assert.equal(actual.packaging,'鋁箔包');assert.equal(actual.id,source.id);assert.equal(actual.stock,source.stock);assert.equal(actual.lastCountAt,source.lastCountAt);assert.equal(actual.unit,source.unit);}
  assert.deepEqual(raw,before);
  for(const name of names){assert.equal(canonicalDrinkPackaging('寶特瓶',name),'寶特瓶');assert.equal(canonicalDrinkPackaging('其他',name+'另一個規格'),'其他');}
  const local=createCompanyData();local.drinks.push({id:'local-carton',name:names[0],category:'其他',packaging:'其他',stock:8,lastCountAt:'2026-11-03T00:00:00Z',unit:'包',active:true});
  const next=prepareCompanyCatalog(local).drinks.find(d=>d.id==='local-carton');assert.equal(next.packaging,'鋁箔包');assert.equal(next.stock,8);assert.equal(local.drinks.at(-1).packaging,'其他');
});

test('product-character fallback is small, precedes the UI subset and is embedded in offline previews',async()=>{
  const root=new URL('../',import.meta.url),font=await readFile(new URL('assets/pantry-product-characters.woff2',root));
  assert.equal(font.subarray(0,4).toString(),'wOF2');assert.ok(font.length<16000);
  const css=await readFile(new URL('pantry.css',root),'utf8'),builder=await readFile(new URL('scripts/build-demo.mjs',root),'utf8');
  assert.ok(css.includes('--heading-font:"Pantry Product Characters","Pantry Hand","Pantry Hand Complete",serif'));
  for(const code of ['5409','540E','601D','723E'])assert.ok(css.includes('U+'+code));
  assert.ok(builder.includes("{ src: './assets/pantry-product-characters.woff2' }"));
});
