import {
  DataType,
  Mapping,
  StructuredMapping,
  toDataType,
  mapper,
  extract,
  structuredMapper,
} from './index';
import * as moment from 'moment';

test('to data type', () => {
  const mappings: [any, DataType][] = [
    [undefined, DataType.Undefined],
    [null, DataType.Null],
    ['', DataType.String],
    ['string', DataType.String],
    [String('string'), DataType.String],
    [`string ${1}`, DataType.String],
    [0, DataType.Number],
    [+1000, DataType.Number],
    [-1000, DataType.Number],
    [Infinity, DataType.Number],
    [-Infinity, DataType.Number],
    [NaN, DataType.Number],
    [Number(10), DataType.Number],
    [true, DataType.Boolean],
    [false, DataType.Boolean],
    [() => {}, DataType.Function],
    [function () {}, DataType.Function],
    [Number.isNaN, DataType.Function],
    [[], DataType.Array],
    [Array(), DataType.Array],
    [{}, DataType.Object],
    [new Object, DataType.Object],
    [global, DataType.Object],
    [new Date, DataType.Date],
  ];

  expect(toDataType()).toBe(DataType.Undefined);

  for (const [val, dataType] of mappings) {
    expect(toDataType(val)).toBe(dataType);
  }

  (function (this: any, ...args: any) {
    expect(toDataType(this)).toBe(DataType.Object);
    // array-like, but not really
    expect(toDataType(arguments)).toBe(DataType.Object);
  }).call({}, 1, 2, 3);
});

test('mapper without options', () => {
  const objs: any[] = [
    0, 1, -1, Infinity, -Infinity,
    null, undefined,
    '', 'string', String('str'),
    new Date(), new Date('1995-12-17T03:24:00'),
    () => {}, function () {},
    {}, { foo: 'bar' }, { bar: { baz: 'foo' }, foo: 'baz' },
  ];

  for (const obj of objs) {
    expect(mapper(obj)).toEqual(obj);
  }
});

test('number mapper', () => {
  const objs: [any, any][] = [
    [{}, {}],
    [{ foo: 'bar' }, { foo: 'bar' }],
    [{ foo: Infinity }, { foo: Infinity }],
    [{ foo: 0 }, { foo: 0 }],
    [{ foo: 1 }, { foo: 2 }],
    [{ foo: -1 }, { foo: -2 }],
    [{ foo: { bar: 22 } }, { foo: { bar: 44 } }],
  ];

  const mapping: Mapping = {
    [DataType.Number]: num => num * 2,
  };

  for (const [input, output] of objs) {
    expect(mapper(input, mapping)).toEqual(output);
  }
});

test('string mapper', () => {
  const objs: [any, any][] = [
    [{}, {}],
    [{ foo: 0 }, { foo: 0 }],
    [{ foo: 'bar' }, { foo: 'prefixed bar' }],
    [{ foo: { bar: 'foo' } }, { foo: { bar: 'prefixed foo' } }],
  ];

  const mapping: Mapping = {
    [DataType.String]: str => `prefixed ${str}`,
  };

  for (const [input, output] of objs) {
    expect(mapper(input, mapping)).toEqual(output);
  }
});

test('array mapping', () => {
  const objs: [any, any][] = [
    [[0, 1, 2, 3], [0, 2, 4, 6]],
  ];

  const mapping: Mapping = {
    [DataType.Number]: num => num * 2,
  };

  for (const [input, output] of objs) {
    expect(mapper(input, mapping)).toEqual(output);
  }
});

test('date mapper', () => {
  const objs: [any, any][] = [
    [{}, {}],
    [{ foo: 0 }, { foo: 0 }],
    [{ foo: new Date('1995-12-17T03:24:00') }, { foo: new Date('2000-12-17T03:24:00') }],
  ];

  const mapping: Mapping = {
    [DataType.Date]: (date) => { date.setFullYear(2000); return date; },
  };

  for (const [input, output] of objs) {
    expect(mapper(input, mapping)).toEqual(output);
  }
});

test('custom mapper', () => {
  const mapping: Mapping = {
    custom: [
      [
        (_, dataType) => dataType === DataType.Number,
        data => data / 2,
      ],
    ],
  };

  const objs: [any, any][] = [
    [{}, {}],
    [1, 0.5],
    [2, 1],
    [{ foo: 0 }, { foo: 0 }],
    [{ foo: 2 }, { foo: 1 }],
  ];

  for (const [input, output] of objs) {
    expect(mapper(input, mapping)).toEqual(output);
  }
});

test('moment mapper', () => {
  const mapping: Mapping = {
    custom: [
      [
        (data, dataType) => {
          if (dataType === DataType.String) {
            // for whatever reason, there is no way to strict-parse without providing a format
            (moment as any).suppressDeprecationWarnings = true;

            return moment(data).isValid();
          }

          return dataType === DataType.Date || moment.isMoment(data);
        },
        data => moment(data),
      ],
    ],
  };

  expect(moment('1995-12-17T03:24:00').isSame(mapper(new Date('1995-12-17T03:24:00'), mapping)));
  expect(moment('1995-12-17T03:24:00').isSame(mapper(moment('1995-12-17T03:24:00'), mapping)));
  expect(moment('1995-12-17T03:24:00').isSame(mapper('1995-12-17T03:24:00', mapping)));
  expect(mapper('plain string', mapping)).toBe('plain string');
});

test('mapping key', () => {
  const mapping: Mapping = {
    [DataType.String]: (str, key) => key ? `${key}: ${str}` : str,
    custom: [
      [
        (_, __, key) => key === '$key',
        data => `KEY:${data}`,
      ],
    ],
  };

  expect(mapper('raw', mapping)).toEqual('raw');
  expect(mapper({ str: 'raw' }, mapping)).toEqual({ str: 'str: raw' });
  expect(mapper({ $key: 'foo' }, mapping)).toEqual({ $key: 'KEY:foo' });
});

test('structure mapping', () => {
  const mapping: StructuredMapping = {
    foo: {
      bar(value, dataType) {
        return 'replaced';
      },
    },
  };

  expect(structuredMapper({ foo: { bar: 12 } }, mapping))
    .toEqual({ foo: { bar: 'replaced' } });

  expect(structuredMapper({ foo: { bar: 'baz' } }, mapping))
    .toEqual({ foo: { bar: 'replaced' } });
});

test('structure mapping optional', () => {
  const mapping: StructuredMapping = {
    foo: {
      bar: {
        optional: true,
        map(value, dataType) {
          return 'replaced';
        },
      },
    },
  };

  expect(structuredMapper({ foo: { bar: 12 } }, mapping))
    .toEqual({ foo: { bar: 'replaced' } });

  expect(structuredMapper({ foo: {} }, mapping))
    .toEqual({});

  expect(structuredMapper({}, mapping))
    .toEqual({});

  expect(structuredMapper({ foo: { bar: [] } }, mapping))
    .toEqual({ foo: { bar: 'replaced' } });

  expect(structuredMapper({ foo: [] }, mapping))
    .toEqual({});
});

test('structure mapping optional fallback', () => {
  const mapping: StructuredMapping = {
    foo: {
      bar: {
        fallback: 'fallback',
        optional: true,
        map(value, dataType) {
          return 'replaced';
        },
      },
    },
  };

  expect(structuredMapper({ foo: { bar: 12 } }, mapping))
    .toEqual({ foo: { bar: 'replaced' } });

  expect(structuredMapper({ foo: {} }, mapping))
    .toEqual({ foo: { bar: 'fallback' } });

  expect(structuredMapper({}, mapping))
    .toEqual({ foo: { bar: 'fallback' } });

  expect(structuredMapper({ foo: { bar: [] } }, mapping))
    .toEqual({ foo: { bar: 'replaced' } });

  expect(structuredMapper({ foo: [] }, mapping))
    .toEqual({ foo: { bar: 'fallback' } });
});

test('structure mapping rename', () => {
  const mapping: StructuredMapping = {
    bat: {
      rename: 'loo',
      map: v => v,
    },
    foo: {
      bar: {
        optional: true,
        rename: 'bat',
        map(value, dataType) {
          return 'replaced';
        },
      },
    },
  };

  expect(structuredMapper({ bat: 3, foo: { bar: 12 } }, mapping))
    .toEqual({ loo: 3, foo: { bat: 'replaced' } });

  expect(structuredMapper({ bat: 3, foo: {} }, mapping))
    .toEqual({ loo: 3 });

  expect(structuredMapper({ bat: 3 }, mapping))
    .toEqual({ loo: 3 });

  expect(structuredMapper({ bat: 3, foo: { bar: [] } }, mapping))
    .toEqual({ loo: 3, foo: { bat: 'replaced' } });

  expect(structuredMapper({ bat: 3, foo: [] }, mapping))
    .toEqual({ loo: 3 });
});

test('structure mapping array', () => {
  const mapping: StructuredMapping = {
    foo: {
      bar: {
        array: true,
        map(value, dataType) {
          if (dataType === DataType.Number) {
            return value * 2;
          }

          return 'unknown';
        },
      },
    },
  };

  expect(structuredMapper({ foo: { bar: [] } }, mapping))
    .toEqual({ foo: { bar: [] } });

  expect(structuredMapper({ foo: { bar: [0, 1, 2, 3, 4, 5] } }, mapping))
    .toEqual({ foo: { bar: [0, 2, 4, 6, 8, 10] } });

  expect(structuredMapper({ foo: { bar: [1, '2', 3] } }, mapping))
    .toEqual({ foo: { bar: [2, 'unknown', 6] } });
});

test('complex structure mapping', () => {
  const mapping: StructuredMapping = {
    top: value => value + 10,
    foo: {
      nest: {
        optional: true,
        map: value => value * 10,
      },
      more: {
        more: {
          array: true,
          optional: true,
          map(value, dataType) {
            if (dataType === DataType.String) return 'str';

            return value;
          },
        },
      },
    },

    arr: {
      array: true,
      map: val => val ** 10,
    },
  };

  expect(() => structuredMapper({ top: 1 }, mapping)).toThrow();
  expect(() => structuredMapper({ arr: [] }, mapping)).toThrow();

  expect(structuredMapper({
    top: 1,
    arr: [5, 10],
  }, mapping)).toEqual({
    top: 11,
    arr: [5 ** 10, 10 ** 10],
  });

  expect(structuredMapper({
    top: 1,
    arr: [5, 10],
    foo: { nest: 1 },
  }, mapping)).toEqual({
    top: 11,
    arr: [5 ** 10, 10 ** 10],
    foo: { nest: 10 },
  });

  expect(structuredMapper({
    top: 1,
    arr: [5, 10],
    foo: {
      more: {},
    },
  }, mapping)).toEqual({
    top: 11,
    arr: [5 ** 10, 10 ** 10],
  });

  expect(structuredMapper({
    top: 1,
    arr: [5, 10],
    foo: {
      more: {
        more: [],
      },
    },
  }, mapping)).toEqual({
    top: 11,
    arr: [5 ** 10, 10 ** 10],
    foo: { more: { more: [] } },
  });

  expect(structuredMapper({
    top: 1,
    arr: [5, 10],
    foo: {
      more: {
        more: [1, 'dfkj', []],
      },
    },
  }, mapping)).toEqual({
    top: 11,
    arr: [5 ** 10, 10 ** 10],
    foo: { more: { more: [1, 'str', []] } },
  });
});

test('structure mapping bypass', () => {
  const mapping: StructuredMapping = {
    foo: {
      bar(value, dataType) {
        return 'replaced';
      },
      baz: true,
    },
    bat: true,
  };

  expect(structuredMapper({ foo: { bar: 12, baz: 13 }, bat: 44 }, mapping))
    .toEqual({ foo: { bar: 'replaced', baz: 13 }, bat: 44 });

  expect(structuredMapper({ foo: { bar: 'baz', baz: 13 }, bat: 44 }, mapping))
    .toEqual({ foo: { bar: 'replaced', baz: 13 }, bat: 44 });
});

test('flatten structured mapping', () => {
  expect(structuredMapper({
    a: { b: 2 },
  }, {
    a: { flatten: {} },
  })).toEqual({});

  expect(structuredMapper({
    a: { b: 2 },
  }, {
    a: { flatten: { b: true } },
  })).toEqual({ b: 2 });

  expect(structuredMapper({
    a: { b: 2 },
  }, {
    a: { flatten: { b: { optional: true, map: v => v } } },
  })).toEqual({ b: 2 });

  expect(structuredMapper({
    a: {},
  }, {
    a: { flatten: { b: { optional: true, map: v => v } } },
  })).toEqual({});

  expect(structuredMapper({
    a: { b: 2 },
  }, {
    a: { flatten: { b: { rename: 'bb', map: v => v } } },
  })).toEqual({ bb: 2 });
});

test('mapping object', () => {
  const mapping: Mapping = {
    [DataType.Object]: (obj, key) => {
      if (key === 'foo') return 'baz';
      return obj;
    },
    [DataType.String]: obj => 'replaced',
  };

  expect(mapper({ baz: '', foo: {}, bar: { foo: {} } }, mapping)).toEqual({
    baz: 'replaced',
    foo: 'baz',
    bar: { foo: 'baz' },
  });
});

test('extract basics', () => {
  expect(extract({}, {})).toEqual({});
  expect(extract({ foo: 1 }, {})).toEqual({});
  expect(extract({}, { foo: [] })).toEqual({});
  expect(extract({}, { foo: true })).toEqual({});
  expect(extract({ foo: 1 }, { foo: true })).toEqual({ foo: 1 });
  expect(extract({ foo: {} }, { foo: true })).toEqual({ foo: {} });
  expect(extract({ foo: 1 }, { foo: [] })).toEqual({});
  expect(extract({ foo: 1 }, { foo: ['bar'] })).toEqual({});
  expect(extract({ foo: { bar: 1 } }, { foo: ['bar'] })).toEqual({ foo: { bar: 1 } });
  expect(extract({ foo: { bar: 1, baz: 2 } }, { foo: ['bar'] })).toEqual({ foo: { bar: 1 } });
});

test('extract array', () => {
  expect(extract({ foo: [{ a:1, b:1 }, { b:2 }, { a:3 }] }, { foo: [{ b: true }] })).toEqual({
    foo: [
      { b:1 },
      { b:2 },
      {},
    ],
  });
});

test('extract deep', () => {
  const response = {
    firstName: 'Bob',
    lastName: 'Albert',
    password: 'secure!',
    permissions: [
      { role: 'admin', timestamp: new Date(), authority: { access: 33 } },
      { role: 'user', timestamp: new Date(), extra: false },
    ],
  };

  const extraction = {
    firstName: true,
    lastName: true,
    permissions: [{
      role: true,
      authority: ['access'],
    }],
  };

  const expected = {
    firstName: 'Bob',
    lastName: 'Albert',
    permissions: [
      { role: 'admin', authority: { access: 33 } },
      { role: 'user' },
    ],
  };

  expect(extract(response, extraction)).toEqual(expected);
});

test('extract shallow array', () => {
  expect(extract([{ a: 1, b: 2 }], [{ a: true }])).toEqual([{ a: 1 }]);
});

test('extract null', () => {
  expect(extract(null, { a: true })).toBe(null);
  expect(extract({ a: null }, { a: true })).toEqual({ a: null });
});
