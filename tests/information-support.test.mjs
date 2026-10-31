import test from 'node:test';
import assert from 'node:assert/strict';
import { wishSupportDetails, wishSupportPreview } from '../js/wish-support.js';
import { findDrinkInformation, renderDrinkInformation } from '../js/drink-information.js';

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

test('package facts match exact product names while unverified fields remain unknown', () => {
  const fin = findDrinkInformation({ name: 'Fin' });
  assert.equal(findDrinkInformation('FIN'), fin);
  assert.equal(fin.nutrition.energyKcal, 52.5);
  assert.equal(fin.nutrition.sugarG, null);
  assert.equal(fin.ingredients, null);
  assert.equal(findDrinkInformation({ id: 'company-drink-13', name: '不同飲料' }), null);
  assert.equal(findDrinkInformation({ id: 'company-drink-13', name: 'Fin', packaging: '寶特瓶' }), null);
  const known = renderDrinkInformation({ id: 'company-drink-13', name: 'Fin' });
  assert.match(known, /52\.5 大卡/);
  assert.match(known, /每份 300 毫升/);
  assert.match(known, /待補/);
  assert.match(known, /所提供的商品包裝正面/);
  assert.doesNotMatch(known, /0 公克/);
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
