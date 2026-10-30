/** Local product artwork; enable a photo only after its original is confirmed. */
export const PRODUCT_PHOTOS = Object.freeze([
  { src: './assets/milkis-original.png', enabled: true, height: 132, names: ['Miilkis', 'Miiki', 'Milkis'] },
  { src: './assets/milkis-peach.png', enabled: false, height: 132, names: ['Milkiis水蜜桃', 'Milkis水蜜桃', 'Miilkis水蜜桃', 'milkis水蜜桃'] },
  { src: './assets/uni-soy.png', enabled: false, height: 113, names: ['統一豆漿', '統一無糖豆漿', '統一陽光無加糖豆奶'] },
  { src: './assets/kuang-chuan-chocolate.png', enabled: false, height: 113, names: ['光泉巧克力牛乳', '光泉巧克力牛奶'] },
  { src: './assets/kuang-chuan-milk.png', enabled: false, height: 113, names: ['光泉牛乳', '光泉牛奶'] },
  { src: './assets/lipton-original.png', enabled: false, height: 113, names: ['立頓原味奶茶'] },
  { src: './assets/lipton-chocolate.png', enabled: false, height: 113, names: ['立頓巧克力奶茶'] },
  { src: './assets/lipton-green.png', enabled: false, height: 113, names: ['立頓沁香奶綠'] },
  { src: './assets/sun-moon-black-tea.png', enabled: false, height: 113, names: ['日月潭紅茶', '生活日月潭紅茶'] },
  { src: './assets/asahi-sixteen-tea.png', enabled: false, height: 113, names: ['十六茶', 'Asahi十六茶'] },
  { src: './assets/barley-tea.png', enabled: false, height: 132, names: ['麥萃麥茶', '麥萃'] },
  { src: './assets/tree-top-apple.png', enabled: false, height: 113, names: ['tree top瓶果汁', 'tree top蘋果汁'] },
  { src: './assets/vida-sparkling.png', enabled: false, height: 132, names: ['Vida氣泡飲', 'vida氣泡飲'] },
  { src: './assets/kuang-chuan-rice.png', enabled: false, height: 113, names: ['光泉薏仁糙米漿'] },
  { src: './assets/kuang-chuan-orange.png', enabled: false, height: 113, names: ['光泉柳橙汁'] },
  { src: './assets/bomy-vegetable.png', enabled: false, height: 113, names: ['波蜜一日蔬果', '波蜜果菜汁'] },
  { src: './assets/bomy-guava.png', enabled: false, height: 113, names: ['波利芭樂汁', '波蜜芭樂汁', '芭樂汁'] },
  { src: './assets/coke-zero.png', enabled: false, height: 132, names: ['零卡可口可樂', '無糖可口可樂'] },
  { src: './assets/coke-original.png', enabled: false, height: 132, names: ['可口可樂'] },
  { src: './assets/pepsi-original.png', enabled: false, height: 132, names: ['百事可樂'] },
  { src: './assets/heysong-sarsaparilla.png', enabled: false, height: 132, names: ['黑松沙士'] },
  { src: './assets/taisun-congee.png', enabled: false, height: 132, names: ['八寶粥', '泰山八寶粥'] },
  { src: './assets/pepsi-zero.png', enabled: false, height: 132, names: ['零卡百事可樂', '無糖百事可樂'] },
  { src: './assets/fin.png', enabled: false, height: 113, names: ['Fin', 'FIN'] },
  { src: './assets/redbull.png', enabled: false, height: 132, names: ['Redbull能量飲', 'Redbull', 'Red Bull'] },
  { src: './assets/original-green-tea.png', enabled: false, height: 132, names: ['原萃綠茶', '原萃日式綠茶'] },
  { src: './assets/cold-brew-jinxuan.png', enabled: false, height: 132, names: ['冷萃金萱烏龍'] },
  { src: './assets/moriyama-black-tea.png', enabled: false, height: 132, names: ['Moriyama紅茶', 'Moriyama 紅茶'] },
  { src: './assets/moriyama-milk-tea.png', enabled: false, height: 132, names: ['Moriyama奶茶', 'Moriyama 奶茶'] },
  { src: './assets/shih-chuan-vinegar.png', enabled: false, height: 113, names: ['十全果醋'] },
  { src: './assets/lychee-sparkling.png', enabled: false, height: 132, names: ['荔枝氣泡水'] },
  { src: './assets/agv-honey-oat.png', enabled: false, height: 132, names: ['蜂蜜燕麥', '愛之味蜂蜜燕麥', '愛之味燕麥'] },
  { src: './assets/agv-original-oat.png', enabled: false, height: 132, names: ['愛之味純濃燕麥'] },
  { src: './assets/kuang-chuan-oat-milk.png', enabled: false, height: 113, names: ['光泉燕麥奶'] },
  { src: './assets/sprite.png', enabled: false, height: 132, names: ['雪碧'] },
  { src: './assets/rico-honey-milk-tea.png', enabled: false, height: 113, names: ['紅牌蜂蜜奶茶'] },
  { src: './assets/lipton-honey-black-tea.png', enabled: false, height: 132, names: ['立頓蜂蜜紅茶'] },
  { src: './assets/apple-sidra.png', enabled: false, height: 132, names: ['蘋果西打'] },
  { src: './assets/klim-strawberry-yogurt.png', enabled: false, height: 113, names: ['克寧草莓優酪乳'] },
  { src: './assets/agv-barley-drink.png', enabled: false, height: 113, names: ['愛之味麥仔茶'] },
].map((photo) => Object.freeze({ ...photo, names: Object.freeze(photo.names) })));

const productPhotosByName = new Map(PRODUCT_PHOTOS.filter((photo) => photo.enabled !== false).flatMap((photo) => photo.names.map((name) => [name, photo])));

export function findProductPhoto(name) {
  return productPhotosByName.get(name) || null;
}
