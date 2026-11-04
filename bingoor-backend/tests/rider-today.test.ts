import './env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startOfTodayIST } from '../src/services/rider.service';

test("a rider's day starts at midnight India time", () => {
  // 10:30 in the morning IST on 4 Nov = 05:00 UTC -> the day began at 18:30 UTC on 3 Nov
  assert.equal(startOfTodayIST(new Date('2026-11-04T05:00:00Z')).toISOString(), '2026-11-03T18:30:00.000Z');
  // 00:10 IST on 5 Nov (18:40 UTC on 4 Nov) is already the next day
  assert.equal(startOfTodayIST(new Date('2026-11-04T18:40:00Z')).toISOString(), '2026-11-04T18:30:00.000Z');
  // 23:50 IST on 4 Nov (18:20 UTC) is still 4 Nov
  assert.equal(startOfTodayIST(new Date('2026-11-04T18:20:00Z')).toISOString(), '2026-11-03T18:30:00.000Z');
});
