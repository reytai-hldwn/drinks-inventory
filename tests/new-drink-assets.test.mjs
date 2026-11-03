import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { findDrinkInformation, renderDrinkInformation } from '../js/drink-information.js';
import { findProductPhoto } from '../js/product-photos.js';
import { drinkPack } from '../js/fridge.js';

const arrivals = [
  ['午后時光重乳奶茶', '330 毫升', 190.2, 27.7],
  ['義美寶吉葡萄汁', '125 毫升', 67, 16.4],
  ['波蜜蜂蜜檸檬', '160 毫升', null, null],
];

test('confirmed new arrivals show the checked capacity while explicit package changes stay unmatched', () => {
  for (const [name, capacity] of arrivals) {
    const drink = { name, packaging: '其他', stock: 7, unit: '包' };
    const before = structuredClone(drink);
    const info = findDrinkInformation(drink);
    assert.equal(info.container, capacity);
    assert.equal(findDrinkInformation({ ...drink, packaging: '鋁箔包' }), info);
    assert.equal(findDrinkInformation({ ...drink, packaging: '寶特瓶' }), null);
    assert.equal(findDrinkInformation({ ...drink, name: name + '另一口味' }), null);
    assert.deepEqual(drink, before, 'photo/information lookup must not change real inventory');
  }
  assert.equal(findDrinkInformation({ name: 'Fin', packaging: '其他' }), null);
});

test('new labels retain original serving values and distinguish missing lemon information from zero', () => {
  for (const [name, capacity, energy, sugar] of arrivals) {
    const info = findDrinkInformation({ name, packaging: '其他' });
    const html = renderDrinkInformation({ id: 'test-new-arrival', name, packaging: '其他' });
    assert.ok(html.includes(capacity));
    assert.equal(info.source.checkedAt, '2026-11-03');
    if (energy === null) {
      assert.equal(info.nutrition, null);
      assert.equal(info.ingredients, null);
      assert.equal(info.allergens, null);
      assert.match(html, /尚待核對完整包裝標示/);
      assert.doesNotMatch(html, /0 大卡|0 公克|無過敏原|查看官方營養標籤/);
    } else {
      assert.equal(info.nutrition.energyKcal, energy);
      assert.equal(info.nutrition.sugarG, sugar);
      assert.ok(info.ingredients && info.allergens && info.source.labelUrl);
    }
  }
  const grape = findDrinkInformation('義美寶吉葡萄汁');
  assert.equal(grape.nutrition.per100.energyKcal, 53.6);
  assert.match(grape.allergens, /管線另有處理/);
  assert.equal(findDrinkInformation('午后時光重乳奶茶').nutrition.sodiumMg, 95);
});

test('new drink photos preserve source pixels, remove exterior backgrounds and use small local display files', async () => {
  const audit = JSON.parse(await readFile(new URL('../docs/PRODUCT-PHOTOS.json', import.meta.url)));
  for (const name of [...arrivals.map(([name]) => name), '可爾必思開心成長160ml']) {
    const photo = findProductPhoto(name);
    const source = await readFile(new URL('../' + photo.src, import.meta.url));
    const display = await readFile(new URL('../' + photo.displaySrc, import.meta.url));
    const record = audit.photos.find(row => photo.src.endsWith('/' + row.file));
    assert.equal(createHash('sha256').update(source).digest('hex'), record.sha256);
    assert.equal(display.subarray(8, 12).toString(), 'WEBP');
    assert.ok(display.length < 50000, 'shelf photo stays small');
    const markup = drinkPack({ name, packaging: '其他' });
    assert.match(markup, /clip-path:polygon\(/);
    assert.ok(markup.includes(photo.displaySrc));
    assert.ok(drinkPack({ name }, { fullSize: true }).includes(photo.src));
    assert.doesNotMatch(markup, /https:\/\//, 'viewing the fridge never contacts a merchant');
    assert.match(drinkPack({ name }, { defer: true }), /data-product-src=/);
  }
});

test('confirmed Taiwan Calpis carton has its own complete serving, calcium and allergen information', () => {
  const drink = { name: '可爾必思開心成長160ml', packaging: '鋁箔包', stock: null, unit: '包' };
  const info = findDrinkInformation(drink);
  assert.equal(info.container, '160 毫升');
  assert.deepEqual(info.nutrition, {
    basis:'每份 160 毫升，本包裝含 1 份', energyKcal:90, proteinG:0.5, fatG:0,
    saturatedFatG:0, transFatG:0, carbohydrateG:21.9, sugarG:20.9, sodiumMg:27, calciumMg:91,
    per100:{energyKcal:56,proteinG:0.3,fatG:0,saturatedFatG:0,transFatG:0,carbohydrateG:13.7,sugarG:13.1,sodiumMg:17,calciumMg:57},
  });
  assert.match(info.allergens, /乳製品及大豆/);
  assert.match(info.ingredients, /牛奶鈣/);
  assert.match(info.source.url, /momoshop\.com\.tw/);
  assert.equal(info.source.labelUrl, undefined, 'front photo must not be presented as a nutrition-label image');
  assert.equal(findDrinkInformation({ ...drink, packaging:'鐵罐' }), null);
  assert.equal(findDrinkInformation({ ...drink, name:'可爾必思開心成長330ml' }), null);
  assert.equal(findDrinkInformation({ ...drink, name:'可爾必思水語160ml' }), null);
  const html = renderDrinkInformation(drink);
  assert.match(html, /91 毫克/);
  assert.match(html, /160 毫升/);
  assert.equal(drink.stock, null);
});
