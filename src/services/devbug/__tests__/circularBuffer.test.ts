import { describe, it, expect } from 'vitest';
import { CircularBuffer } from '../circularBuffer';

describe('CircularBuffer', () => {
  describe('push and toArray', () => {
    it('returns an empty array when nothing has been pushed', () => {
      // #when
      const buf = new CircularBuffer<number>(5);

      // #then
      expect(buf.toArray()).toEqual([]);
    });

    it('stores items in insertion order', () => {
      // #given
      const buf = new CircularBuffer<number>(5);

      // #when
      buf.push(1);
      buf.push(2);
      buf.push(3);

      // #then
      expect(buf.toArray()).toEqual([1, 2, 3]);
    });

    it('fills to capacity without eviction', () => {
      // #given
      const buf = new CircularBuffer<number>(3);

      // #when
      buf.push(1);
      buf.push(2);
      buf.push(3);

      // #then
      expect(buf.toArray()).toEqual([1, 2, 3]);
      expect(buf.length).toBe(3);
    });
  });

  describe('FIFO eviction on overflow', () => {
    it('evicts the oldest item when capacity is exceeded', () => {
      // #given
      const buf = new CircularBuffer<number>(3);
      buf.push(1);
      buf.push(2);
      buf.push(3);

      // #when
      buf.push(4);

      // #then
      expect(buf.toArray()).toEqual([2, 3, 4]);
    });

    it('evicts multiple oldest items as more are pushed', () => {
      // #given
      const buf = new CircularBuffer<number>(3);
      buf.push(1);
      buf.push(2);
      buf.push(3);

      // #when
      buf.push(4);
      buf.push(5);

      // #then
      expect(buf.toArray()).toEqual([3, 4, 5]);
    });

    it('handles pushing twice the capacity gracefully', () => {
      // #given
      const buf = new CircularBuffer<number>(3);

      // #when
      for (let i = 1; i <= 6; i++) buf.push(i);

      // #then
      expect(buf.toArray()).toEqual([4, 5, 6]);
    });

    it('keeps length at capacity after overflow', () => {
      // #given
      const buf = new CircularBuffer<number>(3);
      for (let i = 0; i < 10; i++) buf.push(i);

      // #then
      expect(buf.length).toBe(3);
    });
  });

  describe('clear', () => {
    it('empties the buffer', () => {
      // #given
      const buf = new CircularBuffer<number>(5);
      buf.push(1);
      buf.push(2);

      // #when
      buf.clear();

      // #then
      expect(buf.toArray()).toEqual([]);
      expect(buf.length).toBe(0);
    });

    it('allows pushing after clear', () => {
      // #given
      const buf = new CircularBuffer<number>(3);
      buf.push(1);
      buf.push(2);
      buf.push(3);
      buf.clear();

      // #when
      buf.push(4);

      // #then
      expect(buf.toArray()).toEqual([4]);
    });
  });

  describe('length', () => {
    it('tracks the current number of items', () => {
      // #given
      const buf = new CircularBuffer<string>(10);

      // #then
      expect(buf.length).toBe(0);

      buf.push('a');
      expect(buf.length).toBe(1);

      buf.push('b');
      expect(buf.length).toBe(2);
    });
  });

  describe('generic type support', () => {
    it('stores and retrieves objects', () => {
      // #given
      const buf = new CircularBuffer<{ id: number; name: string }>(2);

      // #when
      buf.push({ id: 1, name: 'alpha' });
      buf.push({ id: 2, name: 'beta' });

      // #then
      expect(buf.toArray()).toEqual([
        { id: 1, name: 'alpha' },
        { id: 2, name: 'beta' },
      ]);
    });

    it('evicts oldest object on overflow', () => {
      // #given
      const buf = new CircularBuffer<{ id: number }>(2);
      buf.push({ id: 1 });
      buf.push({ id: 2 });

      // #when
      buf.push({ id: 3 });

      // #then
      expect(buf.toArray()).toEqual([{ id: 2 }, { id: 3 }]);
    });
  });

  describe('capacity of 1', () => {
    it('only retains the most recent item', () => {
      // #given
      const buf = new CircularBuffer<number>(1);

      // #when
      buf.push(10);
      buf.push(20);
      buf.push(30);

      // #then
      expect(buf.toArray()).toEqual([30]);
    });
  });
});
