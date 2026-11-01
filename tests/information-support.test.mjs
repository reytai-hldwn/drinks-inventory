import test from 'node:test';
import assert from 'node:assert/strict';
import { wishSupportDetails, wishSupportPreview } from '../js/wish-support.js';
import { DRINK_INFORMATION, findDrinkInformation, renderDrinkInformation } from '../js/drink-information.js';

test('support lists preserve unnamed legacy votes and only use names attached to accepted voter IDs', () => {
  const wish = { votes: 4, voterIds: ['old', 'named', 'named', 'other'], voterNames: { named: ' 小王 ', other: '小王', rejected: '不應顯示' } };
  const before = structuredClone(wish);
  assert.deepEqual(wishSupportDetails(wish), { votes: 4, names: ['小王', '小王'], unnamed: 2 });
  assert.equal(wishSupportPreview(wish), '小王、小王；2 位未留姓名');
  assert.deepEqual(wish, before);
  assert.deepEqual(wishSupportDetails({ votes: 2, supporters: ['小李'] }), { votes: 2, names: ['小李'], unnamed: 1 });
  assert.equal(wishSupportPreview({ votes: 0 }), '還沒有人贊同這個提案。');
});

test('support lists do not invent names for missing metadata or expose browser identifiers', () => {
  assert.deepEqual(wishSupportDetails({ votes: 3 }), { votes: 3, names: [], unnamed: 3 });
  assert.deepEqual(wishSupportDetails({ votes: 1, supporters: ['', null, 'x'.repeat(81), '小王', '多出的人'] }), { votes: 1, names: ['小王'], unnamed: 0 });
  assert.equal(wishSupportPreview({ votes: 1, voterIds: ['browser-private-identifier'] }), '1 位未留姓名');
});

test('checked labels replace package-front partials and still match exact names and packaging', () => {
  const fin = findDrinkInformation({ name: 'Fin' });
  assert.equal(findDrinkInformation('FIN'), fin);
  assert.equal(fin.nutrition.energyKcal, 52.5);
  assert.equal(fin.nutrition.sugarG, 12.8);
  assert.match(fin.ingredients, /菊糖/);
  assert.equal(fin.allergens, null);
  assert.equal(findDrinkInformation({ id: 'company-drink-13', name: '不同飲料' }), null);
  assert.equal(findDrinkInformation({ id: 'company-drink-13', name: 'Fin', packaging: '寶特瓶' }), null);
  const known = renderDrinkInformation({ id: 'company-drink-13', name: 'Fin' });
  assert.match(known, /52\.5 大卡/);
  assert.match(known, /每份 300 毫升/);
  assert.match(known, /尚待核對完整包裝標示/);
  assert.match(known, /PChome 24h/);
  assert.match(known, /查看營養標籤原圖/);
  assert.doesNotMatch(known, /查看官方營養標籤/);
  assert.match(known, /0 公克/);
  assert.match(renderDrinkInformation({ id: 'new', name: '未核對新品' }), /尚待核對完整包裝標示/);
});


test('official information matches the checked package and keeps zero distinct from unverified fields', () => {
  const milk = findDrinkInformation({ name: '光泉牛乳', packaging: '窄瓶鋁箔包' });
  assert.equal(milk.container, '200 毫升');
  assert.equal(milk.ingredients, '100%生乳');
  assert.match(milk.allergens, /本產品含牛奶/);
  assert.equal(milk.source.type, 'official');
  assert.equal(milk.nutrition.energyKcal, 132.2);
  assert.equal(milk.nutrition.per100.energyKcal, 66.1);
  const orange = renderDrinkInformation({ id: 'orange', name: '光泉柳橙汁', packaging: '窄瓶鋁箔包' });
  assert.match(orange, /0 公克/);
  assert.match(orange, /每 100 毫升/);
  assert.match(orange, /查看官方營養標籤/);
  assert.match(orange, /https:\/\/www.kuangchuan.com\/KCGO\/Item\/202411822137/);
  assert.doesNotMatch(orange, /無過敏原/);
  assert.equal(findDrinkInformation({ name: '光泉牛乳', packaging: '大瓶裝' }), null);
  assert.equal(findDrinkInformation({ id: 'company-drink-01', name: '改名的飲料', packaging: '窄瓶鋁箔包' }), null);
});


test('provided Moriyama labels replace the earlier gram reference with explicit milliliter servings', () => {
  const info = findDrinkInformation({ name: 'Moriyama奶茶', packaging: '大瓶裝' });
  assert.match(info.nutrition.basis, /每份 100 毫升.*10 份/);
  assert.equal(info.nutrition.energyKcal, 75.4);
  assert.equal(info.nutrition.sodiumMg, 47);
  assert.equal(info.nutrition.sugarG, 5.8);
  assert.equal(info.nutrition.saturatedFatG, 1);
  const html = renderDrinkInformation({ name: 'Moriyama奶茶', packaging: '大瓶裝' });
  assert.match(html, /每份 100 毫升/);
  assert.doesNotMatch(html, /食鹽相當量|每 100 公克|0.03～0.12 公克/);
  const tea = findDrinkInformation('Moriyama紅茶');
  assert.equal(tea.nutrition.sodiumMg, 10);
  assert.match(tea.nutrition.basis, /100 毫升.*10 份/);
});

test('multi-serving labels preserve serving size and fruit concentration remains separate from nutrition', () => {
  const green = findDrinkInformation({ name: '原萃綠茶', packaging: '寶特瓶' });
  assert.equal(green.container, '580 毫升');
  assert.match(green.nutrition.basis, /290 毫升.*2 份/);
  assert.equal(green.nutrition.energyKcal, 4);
  const lychee = findDrinkInformation({ name: '荔枝氣泡水', packaging: '鐵罐' });
  assert.equal(lychee.nutrition.energyKcal, 176);
  assert.equal(lychee.nutrition.sugarG, 42);
  const html = renderDrinkInformation({ id: 'lychee', name: '荔枝氣泡水', packaging: '鐵罐' });
  assert.match(html, /果汁含量/);
  assert.match(html, /3%/);
  assert.doesNotMatch(html, /酒精濃度/);
  assert.match(html, /全聯小時達/);
});

test('every checked name has one source and missing labels remain unknown', () => {
  const names = DRINK_INFORMATION.flatMap(info => info.names);
  assert.equal(new Set(names).size, names.length);
  const keys = ['energyKcal','proteinG','fatG','saturatedFatG','transFatG','carbohydrateG','sugarG','sodiumMg'];
  for (const info of DRINK_INFORMATION) {
    assert.ok(info.packaging && info.container && info.source.checkedAt && info.source.scope);
    if (!['provided-package', 'provided-label'].includes(info.source.type)) assert.match(info.source.url, /^https:\/\//);
    for (const key of keys) if (typeof info.nutrition?.[key] === 'number') assert.ok(Number.isFinite(info.nutrition[key]) && info.nutrition[key] >= 0);
  }
  assert.equal(findDrinkInformation('愛之味純濃燕麥').nutrition.energyKcal, 131.3);
  assert.match(findDrinkInformation('蜂蜜燕麥').allergens, /麩質蛋白/);
  assert.equal(findDrinkInformation({ id:'company-drink-27', name:'新口味麥茶', packaging:'寶特瓶' }), null);
});

test('a user-specified reference package keeps its capacity separate from the catalog package', () => {
  const drink = { name: '波蜜一日蔬果', packaging: '鋁箔包' };
  const info = findDrinkInformation(drink);
  assert.equal(findDrinkInformation('一日蔬果100%蘋果柳橙蔬果汁'), info);
  assert.match(info.container, /160 毫升罐裝.*參考/);
  assert.match(info.nutrition.basis, /參考罐裝.*160 毫升/);
  assert.equal(info.nutrition.energyKcal, 68.8);
  assert.equal(info.nutrition.per100.energyKcal, 43);
  assert.equal(info.nutrition.sugarG, 15.7);
  assert.equal(info.allergens, null);
  const html = renderDrinkInformation(drink);
  assert.match(html, /不是鋁箔包的整包數值/);
  assert.ok(html.indexOf('不是鋁箔包的整包數值') < html.indexOf('<h3>成分</h3>'));
  assert.match(html, /崇德發/);
  assert.doesNotMatch(html, /查看官方營養標籤/);
  assert.equal(findDrinkInformation({ ...drink, packaging: '大瓶裝' }), null);
  const honey = renderDrinkInformation({ name: '蜂蜜燕麥', packaging: '寶特瓶' });
  assert.match(honey, /880 毫升/);
  assert.match(honey, /每份 220 毫升/);
  assert.match(honey, /290 毫升品項整瓶數值仍待核對/);
  assert.match(honey, /1.1 公克/);
  assert.match(honey, /0.3 公克/);
  assert.doesNotMatch(honey, /data-action="view-drink-label"/);
});


test('solid-food labels use grams and no-added-sugar milk does not imply zero sugar', () => {
  const congee = renderDrinkInformation({ name: '八寶粥', packaging: '鐵罐' });
  assert.match(congee, /每 100 公克/);
  assert.match(congee, /來源為 24 入整箱標示/);
  assert.doesNotMatch(congee, /每 100 毫升/);
  const soy = findDrinkInformation({ name: '統一豆漿', packaging: '鋁箔包' });
  assert.ok(soy.nutrition.sugarG > 0);
  assert.match(soy.allergens, /大豆/);
  assert.match(soy.ingredients, /非基因改造黃豆/);
});

test('requested references distinguish calculated package totals and source-specific whole-can values', () => {
  const guava = findDrinkInformation({ name: '波蜜芭樂汁', packaging: '鋁箔包' });
  for (const key of ['energyKcal', 'proteinG', 'fatG', 'saturatedFatG', 'transFatG', 'carbohydrateG', 'sugarG', 'sodiumMg']) {
    assert.equal(guava.nutrition[key], guava.nutrition.per100[key] * 3);
  }
  const html = renderDrinkInformation({ name: '波蜜芭樂汁', packaging: '鋁箔包' });
  assert.match(html, /每包 300 毫升（換算）/);
  assert.match(html, /每 100 毫升/);
  assert.match(html, /不是鋁箔包的原始營養標籤/);
  const zero = findDrinkInformation({ name: '零卡百事可樂', packaging: '鐵罐' });
  assert.equal(zero.nutrition.sodiumMg, 59);
  assert.equal(zero.nutrition.sugarG, 0);
  assert.match(renderDrinkInformation('零卡百事可樂'), /整罐 330 毫升/);
  const pepsi = findDrinkInformation({ name: '百事可樂', packaging: '小型鐵罐' });
  assert.equal(pepsi.nutrition.energyKcal, 115.2);
  assert.equal(pepsi.nutrition.sugarG, 28.5);
  assert.equal(pepsi.nutrition.per100.energyKcal, 46.1);
  assert.match(renderDrinkInformation('百事可樂'), /每罐 250 毫升（換算）/);
  assert.match(pepsi.referenceNote, /並非 250 毫升罐的原始標籤/);
  assert.match(pepsi.source.scope, /單位.*不一致/);
  const sarsi = findDrinkInformation({ name: '黑松沙士', packaging: '小型鐵罐' });
  assert.equal(sarsi.nutrition.carbohydrateG, 25.7);
  assert.equal(sarsi.nutrition.sugarG, 24.5);
  assert.match(renderDrinkInformation('黑松沙士'), /全聯全電商/);
});
