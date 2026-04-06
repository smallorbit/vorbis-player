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
      // #given
      const clientX = 200;
      const clientY = rect.height * (ZEN_DEAD_ZONE_TOP - 0.05);

      // #when
      const zone = resolveZenZone(clientX, clientY, rect);

      // #then
      expect(zone).toBeNull();
    });

    it('returns null when click is in bottom dead zone', () => {
      // #given
      const clientX = 200;
      const clientY = rect.height * (ZEN_DEAD_ZONE_BOTTOM + 0.05);

      // #when
      const zone = resolveZenZone(clientX, clientY, rect);

      // #then
      expect(zone).toBeNull();
    });

    it('returns null exactly at the top dead zone boundary', () => {
      // #given
      const clientY = rect.height * ZEN_DEAD_ZONE_TOP;

      // #when
      const zone = resolveZenZone(200, clientY, rect);

      // #then
      expect(zone).not.toBeNull();
    });

    it('returns null exactly at the bottom dead zone boundary', () => {
      // #given
      const clientY = rect.height * ZEN_DEAD_ZONE_BOTTOM;

      // #when
      const zone = resolveZenZone(200, clientY, rect);

      // #then
      expect(zone).not.toBeNull();
    });

    it('returns null one pixel above top dead zone boundary', () => {
      // #given
      const clientY = rect.height * ZEN_DEAD_ZONE_TOP - 1;

      // #when
      const zone = resolveZenZone(200, clientY, rect);

      // #then
      expect(zone).toBeNull();
    });

    it('returns null one pixel below bottom dead zone boundary', () => {
      // #given
      const clientY = rect.height * ZEN_DEAD_ZONE_BOTTOM + 1;

      // #when
      const zone = resolveZenZone(200, clientY, rect);

      // #then
      expect(zone).toBeNull();
    });
  });

  describe('zone resolution within active area', () => {
    const activeY = rect.height * 0.5;

    it('returns "left" for click in left region (relX < 0.25)', () => {
      // #given
      const clientX = rect.width * (ZEN_ZONE_LEFT_BOUNDARY - 0.15);

      // #when
      const zone = resolveZenZone(clientX, activeY, rect);

      // #then
      expect(zone).toBe('left');
    });

    it('returns "right" for click in right region (relX > 0.75)', () => {
      // #given
      const clientX = rect.width * (ZEN_ZONE_RIGHT_BOUNDARY + 0.15);

      // #when
      const zone = resolveZenZone(clientX, activeY, rect);

      // #then
      expect(zone).toBe('right');
    });

    it('returns "center" for click between left and right boundaries', () => {
      // #given
      const clientX = rect.width * 0.5;

      // #when
      const zone = resolveZenZone(clientX, activeY, rect);

      // #then
      expect(zone).toBe('center');
    });

    it('returns "left" at exactly the left boundary', () => {
      // #given
      const clientX = rect.width * ZEN_ZONE_LEFT_BOUNDARY;

      // #when
      const zone = resolveZenZone(clientX, activeY, rect);

      // #then
      expect(zone).toBe('center');
    });

    it('returns "right" at exactly the right boundary', () => {
      // #given
      const clientX = rect.width * ZEN_ZONE_RIGHT_BOUNDARY;

      // #when
      const zone = resolveZenZone(clientX, activeY, rect);

      // #then
      expect(zone).toBe('center');
    });

    it('returns "left" one pixel before the left boundary', () => {
      // #given
      const clientX = rect.width * ZEN_ZONE_LEFT_BOUNDARY - 1;

      // #when
      const zone = resolveZenZone(clientX, activeY, rect);

      // #then
      expect(zone).toBe('left');
    });

    it('returns "right" one pixel past the right boundary', () => {
      // #given
      const clientX = rect.width * ZEN_ZONE_RIGHT_BOUNDARY + 1;

      // #when
      const zone = resolveZenZone(clientX, activeY, rect);

      // #then
      expect(zone).toBe('right');
    });
  });

  describe('rect with non-zero offset', () => {
    const offsetRect = makeRect(100, 50, 400, 400);

    it('correctly resolves zone accounting for rect offset', () => {
      // #given
      const clientX = 300;
      const clientY = 250;

      // #when
      const zone = resolveZenZone(clientX, clientY, offsetRect);

      // #then
      expect(zone).toBe('center');
    });

    it('returns null when y is in dead zone relative to offset rect', () => {
      // #given
      const clientX = 300;
      const clientY = 60;

      // #when
      const zone = resolveZenZone(clientX, clientY, offsetRect);

      // #then
      expect(zone).toBeNull();
    });
  });
});
