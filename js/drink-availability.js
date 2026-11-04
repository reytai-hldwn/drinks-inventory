import { hasRecordedStock } from './restock-preferences.js';

/** Zero is historical; unknown quantities remain available for a first count. */
export function drinkAvailability(item) {
  if (hasRecordedStock(item) && item.stock === 0 && item.active !== false) return {...item,active:false,autoArchived:true};
  if (item.autoArchived && item.stock > 0) return {...item,active:true,autoArchived:false};
  return item;
}
