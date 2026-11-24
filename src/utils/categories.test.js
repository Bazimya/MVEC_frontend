import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { groupCategories, namesWithin } from './categories.js';

const list = [
  { id: '1', name: 'Fashion' },
  { id: '2', name: 'Shoes', parentId: '1' },
  { id: '3', name: 'Sneakers', parentId: '2' },
  { id: '4', name: 'Electronics' },
  { id: '5', name: 'Phones', parentId: '4' },
  { id: '6', name: 'Lost child', parentId: 'gone' },
];

describe('category menu', () => {
  it('lists main categories with their sub-categories, sorted by name', () => {
    const groups = groupCategories(list);
    assert.deepEqual(groups.map((g) => g.name), ['Electronics', 'Fashion', 'Lost child']);
    assert.deepEqual(groups.find((g) => g.name === 'Fashion').children.map((c) => c.name), ['Shoes']);
    assert.deepEqual(groups.find((g) => g.name === 'Electronics').children.map((c) => c.name), ['Phones']);
  });

  it('a sub-category whose parent is gone is still shown, as a main category', () => {
    assert.ok(groupCategories(list).some((g) => g.name === 'Lost child'));
  });

  it('copes with no list, and with a category pointing at itself', () => {
    assert.deepEqual(groupCategories(undefined), []);
    assert.deepEqual(groupCategories([{ id: '1', name: 'Loop', parentId: '1' }]).map((g) => g.name), ['Loop']);
  });
});

describe('shopping inside a category', () => {
  it('includes every sub-category beneath it', () => {
    assert.deepEqual([...namesWithin(list, 'Fashion')].sort(), ['Fashion', 'Shoes', 'Sneakers']);
    assert.deepEqual([...namesWithin(list, 'Shoes')].sort(), ['Shoes', 'Sneakers']);
  });

  it('a leaf or an unknown name matches only itself', () => {
    assert.deepEqual([...namesWithin(list, 'Phones')], ['Phones']);
    assert.deepEqual([...namesWithin(list, 'Nope')], ['Nope']);
  });

  it('a loop in the data cannot hang it', () => {
    const loop = [{ id: 'a', name: 'A', parentId: 'b' }, { id: 'b', name: 'B', parentId: 'a' }];
    assert.deepEqual([...namesWithin(loop, 'A')].sort(), ['A', 'B']);
  });
});
