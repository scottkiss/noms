// @flow

import {invariant} from './assert.js';
import List from './list.js';
import {newStruct} from './struct.js';
import type Value from './value.js';

type JSON = string | number | boolean | null | JSONObject | JSONArray;
type JSONObject = { [key:string]: JSON };
type JSONArray = Array<JSON>;

// TODO: Can we return a more specific type?
export default function jsonToNoms(v: JSON): Value {
  switch (typeof v) {
    case 'boolean':
    case 'number':
    case 'string':
      return v;
  }

  if (v instanceof Array) {
    return new List(v.map(c => jsonToNoms(c)));
  }

  if (v instanceof Object) {
    const props = {};
    Object.keys(v).forEach(k => {
      invariant(v instanceof Object);
      props[k] = jsonToNoms(v[k]);
    });
    return newStruct('', props);
  }

  throw new Error('unexpected type: ' + String(v));
}