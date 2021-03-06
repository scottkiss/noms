// @flow

// Copyright 2016 Attic Labs, Inc. All rights reserved.
// Licensed under the Apache License, version 2.0:
// http://www.apache.org/licenses/LICENSE-2.0

import {TestDatabase} from './test-util.js';
import Struct, {
  newStruct,
  newStructWithType,
  StructMirror,
  structDiff,
  createStructClass,
  escapeStructField,
} from './struct.js';
import {assert} from 'chai';
import {
  boolType,
  makeCycleType,
  makeListType,
  makeStructType,
  numberType,
  stringType,
} from './type.js';
import {suite, test} from 'mocha';
import {equals} from './compare.js';
import List from './list.js';
import Map from './map.js';
import Set from './set.js';

suite('Struct', () => {
  test('equals', () => {
    const data1 = {x: true, o: 'hi'};
    const s1 = newStruct('S1', data1);
    const s2 = newStruct('S1', data1);

    assert.isTrue(equals(s1, s2));
  });

  test('chunks', () => {
    const db = new TestDatabase();

    const b = true;
    const r = db.writeValue(b);
    const s1 = newStruct('S1', {r: r});
    assert.strictEqual(1, s1.chunks.length);
    assert.isTrue(equals(r, s1.chunks[0]));
    return db.close();
  });

  test('new', () => {
    const s1 = newStruct('S2', {b: true, o: 'hi'});
    assert.strictEqual(s1.b, true);
    assert.strictEqual(s1.o, 'hi');

    const s2 = newStruct('S2', {b: false, o: 'hi'});
    assert.strictEqual(s2.b, false);
    assert.strictEqual(s2.o, 'hi');

    const s3 = newStruct('S2', {b: true, o: 'hi'});
    assert.isTrue(equals(s1, s3));
  });

  test('struct set', () => {
    const s1 = newStruct('S3', {b: true, o: 'hi'});
    const s2 = s1.setB(false);

    // TODO: assert throws on set wrong type
    assert.throws(() => {
      s1.setX(1);
    });

    const s3 = s2.setB(true);
    assert.isTrue(equals(s1, s3));

    const m = new StructMirror(s1);
    const s4 = m.set('b', false);
    assert.isTrue(equals(s2, s4));

    const s5 = s3.setO('bye');
    const s6 = new StructMirror(s3).set('o', 'bye');
    assert.isTrue(equals(s5, s6));
  });

  test('createStructClass', () => {
    const typeA = makeStructType('A',
      ['b', 'c'],
      [
        numberType,
        stringType,
      ]
    );
    const A = createStructClass(typeA);
    const a = new A({b: 1, c: 'hi'});
    assert.instanceOf(a, Struct);
    assert.instanceOf(a, A);
    assert.equal(a.b, 1);
    assert.equal(a.c, 'hi');
  });

  test('type validation', () => {
    const type = makeStructType('S1',
      ['o', 'x'],
      [
        stringType,
        boolType,
      ]
    );

    assert.throws(() => {
      newStructWithType(type, ['hi', 1]);
    });
    assert.throws(() => {
      newStructWithType(type, [1]);
    });

    newStructWithType(type, ['hi', true]);
  });

  test('type validation cyclic', () => {
    // struct S {
    //   b: Bool
    //   l: List<S>
    // }
    const type = makeStructType('S',
      ['b', 'l'],
      [
        boolType,
        makeListType(makeCycleType(0)),
      ]
    );

    const emptyList = new List([]);
    newStructWithType(type, [true, emptyList]);
    newStructWithType(type,
      [
        true,
        new List([newStructWithType(type, [false, emptyList])]),
      ]
    );

    assert.throws(() => {
      newStructWithType(type, [1]);
    });
    assert.throws(() => {
      newStructWithType(type, [true, 1]);
    });
  });

  function assertDiff(expect: [string], s1: Struct, s2: Struct) {
    const actual = structDiff(s1, s2);
    assert.deepEqual(expect, actual);
  }

  test('diff', async () => {
    const s1 = newStruct('', {a: true, b: 'hi', c: 4});

    assertDiff([], s1, newStruct('', {a: true, b: 'hi', c: 4}));
    assertDiff(['a', 'b'], s1, newStruct('', {a: false, b: 'bye', c: 4}));
    assertDiff(['b', 'c'], s1, newStruct('', {a: true, b: 'bye', c: 5}));
    assertDiff(['a', 'c'], s1, newStruct('', {a: false, b: 'hi', c: 10}));

    const s2 = newStruct('', {
      a: new List([0, 1]),
      b: new Map([['foo', false], ['bar', false]]),
      c: new Set([0, 1, 'foo']),
    });

    assertDiff([], s2, newStruct('', {
      a: new List([0, 1]),
      b: new Map([['foo', false], ['bar', false]]),
      c: new Set([0, 1, 'foo']),
    }));

    assertDiff(['a', 'b'], s2, newStruct('', {
      a: new List([1, 1]),
      b: new Map([['foo', false], ['bar', true]]),
      c: new Set([0, 1, 'foo']),
    }));

    assertDiff(['a', 'c'], s2, newStruct('', {
      a: new List([0]),
      b: new Map([['foo', false], ['bar', false]]),
      c: new Set([0, 1, 'bar']),
    }));

    assertDiff(['b', 'c'], s2, newStruct('', {
      a: new List([0, 1]),
      b: new Map([['boo', false], ['bar', true]]),
      c: new Set([0, 1, 'bar']),
    }));
  });

  test('escapeStructField', () => {
    const cases = [
      ['a', 'a'],
      ['AaZz19_', 'AaZz19_'],
      ['Q', 'Q51'],
      ['AQ1', 'AQ511'],
      ['INSPECTIONQ20STATUS', 'INSPECTIONQ5120STATUS'],
      ['$', 'Q24'],
      ['_content', 'Q5Fcontent'],
      ['Few ¢ents Short', 'FewQ20QC2A2entsQ20Short'],
      ['💩', 'QF09F92A9'],
    ];

    cases.forEach(c => {
      const [input, expected] = c;
      assert.equal(escapeStructField(input), expected);
    });
  });
});
