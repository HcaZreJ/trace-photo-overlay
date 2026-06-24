import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  mercatorX, mercatorY, smoothTrack, projectTrack,
  extractGeoJSONCoords, extractTextCoords, crc32, buildStoreZip, trackDistanceKm,
  trackDurationSec, avgSpeedKmh, paceSecPerKm, elevationGainM, formatDuration, formatPace,
} from './core.mjs';

// ==================== 运动指标 ====================
test('trackDurationSec: 首尾时间差(秒)', () => {
  const t0 = 1_700_000_000_000;
  assert.equal(trackDurationSec([{ time: t0 }, { time: t0 + 50_000 }, { time: t0 + 8520_000 }]), 8520);
});
test('trackDurationSec: 无时间戳返回 null', () => {
  assert.equal(trackDurationSec([{ lng: 0, lat: 0 }, { lng: 1, lat: 1 }]), null);
});
test('formatDuration: 时分格式', () => {
  assert.equal(formatDuration(8520), '2小时22分');
  assert.equal(formatDuration(2880), '48分');
  assert.equal(formatDuration(3900), '1小时05分');
  assert.equal(formatDuration(null), null);
});
test('avgSpeedKmh: 距离÷时长', () => {
  const pts = [{ lng: 0, lat: 0, time: 0 }, { lng: 1, lat: 0, time: 3600_000 }]; // 111.19km / 1h
  assert.ok(Math.abs(avgSpeedKmh(pts) - 111.19) < 0.5, `实际 ${avgSpeedKmh(pts)}`);
});
test('avgSpeedKmh: 无时间返回 null', () => {
  assert.equal(avgSpeedKmh([{ lng: 0, lat: 0 }, { lng: 1, lat: 0 }]), null);
});
test('paceSecPerKm: 10km/50min ≈ 300 s/km', () => {
  const pts = [{ lng: 0, lat: 0, time: 0 }, { lng: 0, lat: 0.0899322, time: 3000_000 }];
  assert.ok(Math.abs(paceSecPerKm(pts) - 300) < 5, `实际 ${paceSecPerKm(pts)}`);
});
test('formatPace: 配速格式', () => {
  assert.equal(formatPace(330), `5'30"`);
  assert.equal(formatPace(300), `5'00"`);
  assert.equal(formatPace(null), null);
});
test('elevationGainM: 累加正海拔增量', () => {
  assert.equal(elevationGainM([{ ele: 100 }, { ele: 110 }, { ele: 105 }, { ele: 120 }, { ele: 118 }]), 25);
});
test('elevationGainM: 无海拔返回 null', () => {
  assert.equal(elevationGainM([{ lng: 0, lat: 0 }, { lng: 1, lat: 1 }]), null);
});

// ==================== trackDistanceKm ====================
test('trackDistanceKm: 空/单点为 0', () => {
  assert.equal(trackDistanceKm([]), 0);
  assert.equal(trackDistanceKm([{ lng: 1, lat: 1 }]), 0);
});
test('trackDistanceKm: 赤道经度 1° ≈ 111.2km', () => {
  const d = trackDistanceKm([{ lng: 0, lat: 0 }, { lng: 1, lat: 0 }]);
  assert.ok(Math.abs(d - 111.19) < 0.5, `实际 ${d}`);
});
test('trackDistanceKm: 纬度 1° ≈ 111.2km', () => {
  const d = trackDistanceKm([{ lng: 0, lat: 0 }, { lng: 0, lat: 1 }]);
  assert.ok(Math.abs(d - 111.19) < 0.5, `实际 ${d}`);
});
test('trackDistanceKm: 北京→上海 ≈ 1067km', () => {
  const d = trackDistanceKm([{ lng: 116.4, lat: 39.9 }, { lng: 121.5, lat: 31.2 }]);
  assert.ok(Math.abs(d - 1067) < 25, `实际 ${d}`);
});
test('trackDistanceKm: 多段累加等于分段和', () => {
  const a = { lng: 0, lat: 0 }, b = { lng: 0.5, lat: 0.3 }, c = { lng: 1, lat: 0.1 };
  const total = trackDistanceKm([a, b, c]);
  const seg = trackDistanceKm([a, b]) + trackDistanceKm([b, c]);
  assert.ok(Math.abs(total - seg) < 1e-9, `total=${total} seg=${seg}`);
});

// ==================== Mercator ====================
test('mercator: 原点映射为 0', () => {
  assert.equal(mercatorX(0), 0);
  assert.ok(Math.abs(mercatorY(0)) < 1e-6);
});
test('mercator: 经度线性、180° 为半周长', () => {
  const expect180 = Math.PI * 6378137;
  assert.ok(Math.abs(mercatorX(180) - expect180) < 1);
  assert.ok(Math.abs(mercatorX(90) - expect180 / 2) < 1);
});
test('mercator: 纬度随纬度单调递增', () => {
  assert.ok(mercatorY(60) > mercatorY(30));
  assert.ok(mercatorY(30) > mercatorY(0));
  assert.ok(mercatorY(0) > mercatorY(-30));
});

// ==================== smoothTrack ====================
test('smoothTrack: 稀疏点被加密到接近目标数', () => {
  const pts = [{ lng: 0, lat: 0 }, { lng: 1, lat: 1 }, { lng: 2, lat: 0 }, { lng: 3, lat: 1 }, { lng: 4, lat: 0 }];
  const out = smoothTrack(pts, 500);
  assert.ok(out.length > pts.length, '应被加密');
  assert.ok(out.length >= 400 && out.length <= 600, `点数应接近 500，实际 ${out.length}`);
});
test('smoothTrack: 已足够密集则原样返回', () => {
  const pts = Array.from({ length: 600 }, (_, i) => ({ lng: i, lat: i }));
  assert.equal(smoothTrack(pts, 500), pts);
});
test('smoothTrack: 少于 3 点原样返回', () => {
  const pts = [{ lng: 0, lat: 0 }, { lng: 1, lat: 1 }];
  assert.equal(smoothTrack(pts, 500), pts);
});
test('smoothTrack: 保留首尾端点', () => {
  const pts = [{ lng: 10, lat: 20 }, { lng: 11, lat: 22 }, { lng: 13, lat: 21 }, { lng: 15, lat: 25 }];
  const out = smoothTrack(pts, 500);
  assert.ok(Math.abs(out[0].lng - 10) < 0.01 && Math.abs(out[0].lat - 20) < 0.01, '首点保持');
  assert.ok(Math.abs(out[out.length - 1].lng - 15) < 1e-9 && Math.abs(out[out.length - 1].lat - 25) < 1e-9, '末点精确保持');
});

// ==================== projectTrack ====================
test('projectTrack: 所有点落在画布内 [0, fullSize]', () => {
  const pts = [{ lng: 116.0, lat: 39.9 }, { lng: 116.4, lat: 40.1 }, { lng: 116.8, lat: 39.8 }, { lng: 117.0, lat: 40.3 }];
  const { points, fullSize } = projectTrack(pts, 2400);
  assert.equal(fullSize, 2400);
  for (const p of points) {
    assert.ok(p.x >= 0 && p.x <= 2400, `x 越界: ${p.x}`);
    assert.ok(p.y >= 0 && p.y <= 2400, `y 越界: ${p.y}`);
  }
});
test('projectTrack: 保持长宽比，不拉伸（横向轨迹横向更宽）', () => {
  // 东西跨度大、南北跨度小的轨迹
  const pts = [{ lng: 100, lat: 30 }, { lng: 110, lat: 30.2 }, { lng: 120, lat: 29.9 }, { lng: 130, lat: 30.1 }];
  const { points } = projectTrack(pts, 2400);
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const xSpan = Math.max(...xs) - Math.min(...xs);
  const ySpan = Math.max(...ys) - Math.min(...ys);
  assert.ok(xSpan > ySpan * 3, `横向轨迹应明显更宽: xSpan=${xSpan.toFixed(0)} ySpan=${ySpan.toFixed(0)}`);
});
test('projectTrack: 含 padding，主轴不贴满边缘', () => {
  const pts = [{ lng: 100, lat: 30 }, { lng: 110, lat: 30.2 }, { lng: 120, lat: 29.9 }, { lng: 130, lat: 30.1 }];
  const { points } = projectTrack(pts, 2400);
  const xs = points.map(p => p.x);
  assert.ok(Math.min(...xs) > 1, '左侧应有 padding');
  assert.ok(Math.max(...xs) < 2399, '右侧应有 padding');
});

// ==================== GeoJSON ====================
test('extractGeoJSONCoords: LineString', () => {
  const g = { type: 'LineString', coordinates: [[1, 2], [3, 4], [5, 6]] };
  assert.deepEqual(extractGeoJSONCoords(g), [{ lng: 1, lat: 2 }, { lng: 3, lat: 4 }, { lng: 5, lat: 6 }]);
});
test('extractGeoJSONCoords: MultiLineString', () => {
  const g = { type: 'MultiLineString', coordinates: [[[1, 2], [3, 4]], [[5, 6]]] };
  assert.equal(extractGeoJSONCoords(g).length, 3);
});
test('extractGeoJSONCoords: FeatureCollection 嵌套', () => {
  const g = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[10, 20], [30, 40]] } }] };
  assert.deepEqual(extractGeoJSONCoords(g), [{ lng: 10, lat: 20 }, { lng: 30, lat: 40 }]);
});
test('extractGeoJSONCoords: 无几何返回空', () => {
  assert.deepEqual(extractGeoJSONCoords({ type: 'Point', coordinates: [1, 2] }), []);
});

// ==================== 文本坐标 ====================
test('extractTextCoords: lat,lng 顺序（上海，lng>90）', () => {
  const out = extractTextCoords('31.23,121.47\n31.24,121.48');
  assert.deepEqual(out[0], { lng: 121.47, lat: 31.23 });
});
test('extractTextCoords: lng,lat 顺序（经度在前）', () => {
  const out = extractTextCoords('121.47,31.23');
  assert.deepEqual(out[0], { lng: 121.47, lat: 31.23 });
});
test('extractTextCoords: 都在 ±90 内默认 lat,lng', () => {
  const out = extractTextCoords('30.1,40.2');
  assert.deepEqual(out[0], { lng: 40.2, lat: 30.1 });
});

// ==================== CRC32 ====================
test('crc32: 标准测试向量 "123456789" = 0xCBF43926', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});
test('crc32: 空输入为 0', () => {
  assert.equal(crc32(new Uint8Array(0)), 0);
});

// ==================== ZIP ====================
test('buildStoreZip: 产出可被系统 unzip 校验并解出原内容', () => {
  const enc = new TextEncoder();
  const files = [
    { name: 'a.txt', data: enc.encode('hello 旅图') },
    { name: 'pic_2.txt', data: enc.encode('second file content') },
  ];
  const zip = buildStoreZip(files);
  // 头部签名
  assert.equal(zip[0], 0x50); assert.equal(zip[1], 0x4b);
  assert.equal(zip[2], 0x03); assert.equal(zip[3], 0x04);

  const dir = mkdtempSync(join(tmpdir(), 'ziptest-'));
  const zipPath = join(dir, 'out.zip');
  writeFileSync(zipPath, zip);
  // 完整性校验
  const t = execSync(`unzip -t ${zipPath}`).toString();
  assert.ok(/No errors detected/.test(t), 'unzip -t 应无错误');
  // 内容比对
  const c1 = execSync(`unzip -p ${zipPath} a.txt`).toString();
  assert.equal(c1, 'hello 旅图');
  const c2 = execSync(`unzip -p ${zipPath} pic_2.txt`).toString();
  assert.equal(c2, 'second file content');
});
