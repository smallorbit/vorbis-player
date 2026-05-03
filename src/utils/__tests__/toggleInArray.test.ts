import { describe, it, expect } from 'vitest';
import { toggleInArray } from '../toggleInArray';

describe('toggleInArray', () => {
  it('adds an item when the array is empty', () => {
    // #given
    const arr: string[] = [];

    // #when
    const result = toggleInArray(arr, 'a');

    // #then
    expect(result).toEqual(['a']);
  });

  it('appends an item when not present in a non-empty array', () => {
    // #given
    const arr = ['a', 'b'];

    // #when
    const result = toggleInArray(arr, 'c');

    // #then
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('removes an item that already exists', () => {
    // #given
    const arr = ['a', 'b', 'c'];

    // #when
    const result = toggleInArray(arr, 'b');

    // #then
    expect(result).toEqual(['a', 'c']);
  });

  it('removes every occurrence when the item appears multiple times', () => {
    // #given
    const arr = ['a', 'b', 'a', 'c', 'a'];

    // #when
    const result = toggleInArray(arr, 'a');

    // #then
    expect(result).toEqual(['b', 'c']);
  });

  it('does not mutate the input array', () => {
    // #given
    const arr = ['a', 'b'];
    const snapshot = [...arr];

    // #when
    toggleInArray(arr, 'a');
    toggleInArray(arr, 'c');

    // #then
    expect(arr).toEqual(snapshot);
  });

  it('uses identity (===) for object items', () => {
    // #given
    const a = { id: 1 };
    const b = { id: 2 };
    const aClone = { id: 1 };
    const arr = [a, b];

    // #when — clone has same shape but different identity, so it gets appended
    const result = toggleInArray(arr, aClone);

    // #then
    expect(result).toEqual([a, b, aClone]);
    expect(result).toHaveLength(3);
  });
});
