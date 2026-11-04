import test from 'node:test';
import assert from 'node:assert/strict';
import { workingDaysBetween } from '../js/workdays.js';
import { websiteBackend } from './helpers/google-website.mjs';
import { getWeeklyPopularity } from '../js/domain.js';
import { buildConsumptionRecords, consumptionPeriod } from '../js/consumption.js';

test('Taiwan working days exclude weekends and preserve the count times',()=>{
 const cases=[
  ['2026-11-02T09:00:00+08:00','2026-11-04T09:00:00+08:00',2],
  ['2026-11-02T09:00:00+08:00','2026-11-09T09:00:00+08:00',5],
  ['2026-11-06T16:00:00+08:00','2026-11-09T16:00:00+08:00',1],
  ['2026-11-06T15:00:00+08:00','2026-11-09T09:00:00+08:00',.75],
  // Friday 16:00 UTC is Saturday midnight in Taiwan.
  ['2026-11-06T16:00:00Z','2026-11-08T16:00:00Z',0],
  ['2026-11-08T16:00:00Z','2026-11-09T04:00:00Z',.5],
  ['2026-11-02T09:00:00+08:00','2026-11-16T09:00:00+08:00',10],
  ['2026-11-04T09:00:00+08:00','2026-11-02T09:00:00+08:00',0],
 ];
 const backend=websiteBackend();
 for(const [start,end,expected] of cases){
  assert.equal(workingDaysBetween(start,end),expected);
  assert.equal(backend.ctx.websiteWorkingDaysBetween_(start,end),expected);
 }
 assert.equal(workingDaysBetween('invalid',Date.now()),0);
});

test('Friday-to-Monday consumption uses one working day in both rankings and server summary',()=>{
 const drinks=[{id:'tea',name:'測試飲料',unit:'包',active:true}];
 const events=[
  {id:'fri',drinkId:'tea',type:'count',quantity:10,createdAt:'2026-11-06T09:00:00+08:00'},
  {id:'delivery',drinkId:'tea',type:'restock',quantity:2,createdAt:'2026-11-09T08:00:00+08:00'},
  {id:'mon',drinkId:'tea',type:'count',quantity:7,createdAt:'2026-11-09T09:00:00+08:00'},
 ],now=new Date('2026-11-10T09:00:00+08:00');
 const [row]=consumptionPeriod(buildConsumptionRecords({drinks,events},now),{now});
 assert.equal(row.observedDays,1);
 assert.equal(row.consumed,5);
 assert.equal(row.weekly,25);
 const popular=getWeeklyPopularity(drinks,events,now);
 assert.equal(popular.rows[0].weeklyRate,25);
 assert.deepEqual(JSON.parse(JSON.stringify(websiteBackend().ctx.websiteWeeklyPopularity_(drinks,events,now))),popular);
});

test('monthly public popularity excludes old and boundary-crossing usage in browser and backend',()=>{
 const drinks=[{id:'tea',name:'測試飲料',unit:'包',active:true}],now=new Date('2026-11-04T09:00:00+08:00');
 const events=[['old',1000,'2026-09-25'],['start',100,'2026-10-05'],['end',80,'2026-10-12']].map(([id,quantity,date])=>({id,drinkId:'tea',type:'count',quantity,createdAt:date+'T09:00:00+08:00'}));
 const summary=getWeeklyPopularity(drinks,events,now);
 assert.equal(summary.rows[0].weeklyRate,20);
 assert.equal(summary.windowDays,30);
 assert.equal(summary.windowStartAt,'2026-10-05T01:00:00.000Z');
 assert.deepEqual(JSON.parse(JSON.stringify(websiteBackend().ctx.websiteWeeklyPopularity_(drinks,events,now))),summary);
 assert.equal(getWeeklyPopularity(drinks,events,new Date(+now+86400000)).rows.length,0);
});
