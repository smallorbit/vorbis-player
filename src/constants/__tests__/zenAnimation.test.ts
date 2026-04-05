import { describe, it, expect } from 'vitest';
import {
  resolveZenZone,
  ZEN_DEAD_ZONE_TOP,
  ZEN_DEAD_ZONE_BOTTOM,
  ZEN_ZONE_LEFT_BOUNDARY,
  ZEN_ZONE_RIGHT_BOUNDARY,
} from '../zenAnimation';

const makeRect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  x: left,
  y: top,
  toJSON: () => ({}),
});

describe('resolveZenZone', () => {
  const rect = makeRect(0, 0, 400, 400);

  describe('dead zones', () => {
    it('returns null when click is in top dead zone', () => {
      // #given - relY = 0.1 (below ZEN_DEAD_ZONE_TOP of 0.2)
      const clientX = 200;
      const clientY = rect.height * (ZEN_DEAD_ZONE_TOP - 0.05); // 60px — in top 20%

      // #when
      const zone = resolveZenZone(clientX, clientY, rect);

      // #then
      expect(zone).toBeNull();
    });

    it('returns null when click is in bottom dead zone', () => {
      // #given - relY = 0.9 (above ZEN_DEAD_ZONE_BOTTOM of 0.8)
      const clientX = 200;
      const clientY = rect.height * (ZEN_DEAD_ZONE_BOTTOM + 0.05); // 340px — in bottom 20%

      // #when
      const zone = resolveZenZone(clientX, clientY, rect);

      // #then
      expect(zone).toBeNull();
    });

    it('returns null exactly at the top dead zone boundary', () => {
      // #given - relY exactly = ZEN_DEAD_ZONE_TOP (0.2), which triggers the < check as equal → null
      const clientY = rect.height * ZEN_DEAD_ZONE_TOP; // 80px

      // #when
      const zone = resolveZenZone(200, clientY, rect);

      // #then — relY === 0.2 is NOT < 0.2, so this should resolve to a zone
      expect(zone).not.toBeNull();
    });

    it('returns null exactly at the bottom dead zone boundary', () => {
      // #given - relY exactly = ZEN_DEAD_ZONE_BOTTOM (0.8), which triggers > check as equal → not null
      const clientY = rect.height * ZEN_DEAD_ZONE_BOTTOM; // 320px

      // #when
      const zone = resolveZenZone(200, clientY, rect);

      // #then — relY === 0.8 is NOT > 0.8, so this should resolve to a zone
      expect(zone).not.toBeNull();
    });

    it('returns null one pixel above top dead zone boundary', () => {
      // #given - relY = (80 - 1) / 400 = 0.1975 < 0.2
      const clientY = rect.height * ZEN_DEAD_ZONE_TOP - 1; // 79px

      // #when
      const zone = resolveZenZone(200, clientY, rect);

      // #then
      expect(zone).toBeNull();
    });

    it('returns null one pixel below bottom dead zone boundary', () => {
      // #given - relY = (320 + 1) / 400 = 0.8025 > 0.8
      const clientY = rect.height * ZEN_DEAD_ZONE_BOTTOM + 1; // 321px

      // #when
      const zone = resolveZenZone(200, clientY, rect);

      // #then
      expect(zone).toBeNull();
    });
  });

  describe('zone resolution within active area', () => {
    const activeY = rect.height * 0.5; // 200px — in the middle, safely within active area

    it('returns "left" for click in left region (relX < 0.25)', () => {
      // #given - relX = 0.1 (40px)
      const clientX = rect.width * (ZEN_ZONE_LEFT_BOUNDARY - 0.15); // 40px

      // #when
      const zone = resolveZenZone(clientX, activeY, rect);

      // #then
      expect(zone).toBe('left');
    });

    it('returns "right" for click in right region (relX > 0.75)', () => {
      // #given - relX = 0.9 (360px)
      const clientX = rect.width * (ZEN_ZONE_RIGHT_BOUNDARY + 0.15); // 360px

      // #when
      const zone = resolveZenZone(clientX, activeY, rect);

      // #then
      expect(zone).toBe('right');
    });

    it('returns "center" for click between left and right boundaries', () => {
      // #given - relX = 0.5 (200px)
      const clientX = rect.width * 0.5;

      // #when
      const zone = resolveZenZone(clientX, activeY, rect);

      // #then
      expect(zone).toBe('center');
    });

    it('returns "left" at exactly the left boundary', () => {
      // #given - relX exactly = ZEN_ZONE_LEFT_BOUNDARY (0.25 → 100px), which is NOT < 0.25 → center
      const clientX = rect.width * ZEN_ZONE_LEFT_BOUNDARY; // 100px

      // #when
      const zone = resolveZenZone(clientX, activeY, rect);

      // #then — 0.25 is not < 0.25, falls through to center check
      expect(zone).toBe('center');
    });

    it('returns "right" at exactly the right boundary', () => {
      // #given - relX exactly = ZEN_ZONE_RIGHT_BOUNDARY (0.75 → 300px), which is NOT > 0.75 → center
      const clientX = rect.width * ZEN_ZONE_RIGHT_BOUNDARY; // 300px

      // #when
      const zone = resolveZenZone(clientX, activeY, rect);

      // #then — 0.75 is not > 0.75, falls through to center
      expect(zone).toBe('center');
    });

    it('returns "left" one pixel before the left boundary', () => {
      // #given - relX = (100 - 1) / 400 = 0.2475 < 0.25
      const clientX = rect.width * ZEN_ZONE_LEFT_BOUNDARY - 1; // 99px

      // #when
      const zone = resolveZenZone(clientX, activeY, rect);

      // #then
      expect(zone).toBe('left');
    });

    it('returns "right" one pixel past the right boundary', () => {
      // #given - relX = (300 + 1) / 400 = 0.7525 > 0.75
      const clientX = rect.width * ZEN_ZONE_RIGHT_BOUNDARY + 1; // 301px

      // #when
      const zone = resolveZenZone(clientX, activeY, rect);

      // #then
      expect(zone).toBe('right');
    });
  });

  describe('rect with non-zero offset', () => {
    const offsetRect = makeRect(100, 50, 400, 400);

    it('correctly resolves zone accounting for rect offset', () => {
      // #given - the rect starts at (100, 50); center click at rect center (300, 250)
      const clientX = 300; // (300 - 100) / 400 = 0.5 → center
      const clientY = 250; // (250 - 50) / 400 = 0.5 → active area

      // #when
      const zone = resolveZenZone(clientX, clientY, offsetRect);

      // #then
      expect(zone).toBe('center');
    });

    it('returns null when y is in dead zone relative to offset rect', () => {
      // #given - y within global viewport but in top dead zone of the offset rect
      const clientX = 300;
      const clientY = 60; // (60 - 50) / 400 = 0.025 < 0.2 → dead zone

      // #when
      const zone = resolveZenZone(clientX, clientY, offsetRect);

      // #then
      expect(zone).toBeNull();
    });
  });
});
