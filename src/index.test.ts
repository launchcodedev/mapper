/* eslint-disable */
import * as moment from 'moment';
import {
  DataType,
  Mapping,
  StructuredMapping,
  toDataType,
  mapper,
  extract,
  structuredMapper,
  rename,
  transform,
} from './index';

describe('data type', () => {
  // these do bad things like new String()
  test('string', () => {
    expect(toDataType('')).toBe(DataType.String);
    expect(toDataType('string')).toBe(DataType.String);
    expect(toDataType(new String('string'))).toBe(DataType.String);
    expect(toDataType(String('string'))).toBe(DataType.String);
    expect(toDataType([].toString())).toBe(DataType.String);
  });

  test('number', () => {
    expect(toDataType(0)).toBe(DataType.Number);
    expect(toDataType(-1)).toBe(DataType.Number);
    expect(toDataType(+1)).toBe(DataType.Number);
    expect(toDataType(-Infinity)).toBe(DataType.Number);
    expect(toDataType(+Infinity)).toBe(DataType.Number);
    expect(toDataType(NaN)).toBe(DataType.Number);
    expect(toDataType(Number(1))).toBe(DataType.Number);
  });

  test('boolean', () => {
    expect(toDataType(true)).toBe(DataType.Boolean);
    expect(toDataType(false)).toBe(DataType.Boolean);
  });

  test('function', () => {
    expect(toDataType(() => {})).toBe(DataType.Function);
    expect(toDataType(function() {})).toBe(DataType.Function);
    expect(toDataType(parseFloat)).toBe(DataType.Function);
    expect(toDataType([].map)).toBe(DataType.Function);
  });

  test('null', () => {
    expect(toDataType(null)).toBe(DataType.Null);
  });

  test('undefined', () => {
    expect(toDataType()).toBe(DataType.Undefined);
    expect(toDataType(undefined)).toBe(DataType.Undefined);
  });

  test('date', () => {
    expect(toDataType(new Date())).toBe(DataType.Date);
  });

  test('array', () => {
    expect(toDataType([])).toBe(DataType.Array);
    expect(toDataType([1, 2, 3])).toBe(DataType.Array);
    expect(toDataType(new Array())).toBe(DataType.Array);
    expect(toDataType(Array.from([]))).toBe(DataType.Array);
  });

  test('object', () => {
    expect(toDataType({})).toBe(DataType.Object);
    expect(toDataType(new Map())).toBe(DataType.Object);
    expect(toDataType(new Object())).toBe(DataType.Object);

    (function(this: any, ...args: any) {
      expect(toDataType(this)).toBe(DataType.Object);
      // arguments is array-like, args is an array
      expect(toDataType(arguments)).toBe(DataType.Object);
      expect(toDataType(args)).toBe(DataType.Array);
    }.call({}, 1, 2, 3));
  });
  // tslint:enable
});

describe('mapper', () => {
  test('mapper without options', () => {
    const objs: any[] = [
      0,
      1,
      -1,
      Infinity,
      -Infinity,
      null,
      undefined,
      '',
      'string',
      String('str'),
      new Date(),
      new Date('1995-12-17T03:24:00'),
      () => {},
      function() {},
      {},
      { foo: 'bar' },
      { bar: { baz: 'foo' }, foo: 'baz' },
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
      [
        [0, 1, 2, 3],
        [0, 2, 4, 6],
      ],
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
      [DataType.Date]: date => {
        date.setFullYear(2000);
        return date;
      },
    };

    for (const [input, output] of objs) {
      expect(mapper(input, mapping)).toEqual(output);
    }
  });

  test('custom mapper', () => {
    const mapping: Mapping = {
      custom: [
        [(_, dataType) => dataType === DataType.Number, data => data * 2],
        [(_, __, key) => key === 'foo', data => data / 2],
        [(_, __, ___, cKey) => cKey === 'bar.baz', data => data * 4],
      ],
    };

    const objs: [any, any][] = [
      [{}, {}],
      [1, 2],
      [{ foo: 2 }, { foo: 2 }],
      [
        { foo: 1, bar: 1 },
        { foo: 1, bar: 2 },
      ],
      [{ bar: { baz: 1, bat: 1 } }, { bar: { baz: 8, bat: 2 } }],
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
      [DataType.String]: (str, key) => (key ? `${key}: ${str}` : str),
      custom: [[(_, __, key) => key === '$key', data => `KEY:${data}`]],
    };

    expect(mapper('raw', mapping)).toEqual('raw');
    expect(mapper({ str: 'raw' }, mapping)).toEqual({ str: 'str: raw' });
    expect(mapper({ $key: 'foo' }, mapping)).toEqual({ $key: 'KEY:foo' });
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

  test('contextual keys', () => {
    const keys: string[] = [];

    const mapping: Mapping = {
      [DataType.String]: (s, key, contextualKey) => {
        keys.push(contextualKey!);
        return s;
      },
    };

    mapper(
      {
        baz: '',
        foo: '',
        bar: {
          foo: '',
        },
        bao: {
          boo: [
            {
              baz: '',
            },
            {
              baz: '',
              joo: [
                {
                  pls: '',
                },
              ],
            },
          ],
        },
      },
      mapping,
    );

    expect(keys).toEqual([
      'baz',
      'foo',
      'bar.foo',
      'bao.boo[0].baz',
      'bao.boo[1].baz',
      'bao.boo[1].joo[0].pls',
    ]);
  });

  test('class object', () => {
    const spy = jest.spyOn(console, 'warn');

    class Testing {
      x = 1;
    }
    expect(mapper(new Testing(), {})).toEqual({ x: 1 });
    expect(mapper(new Map(), {})).toEqual({});
    expect(mapper(new Set(), {})).toEqual({});

    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenCalledWith(
      'Iterating over a Testing, which will lose your class instance type',
    );
    expect(spy).toHaveBeenCalledWith(
      'Iterating over a Map, which will lose your class instance type',
    );
    expect(spy).toHaveBeenCalledWith(
      'Iterating over a Set, which will lose your class instance type',
    );

    spy.mockRestore();
  });
});

describe('structuredMapper', () => {
  test('replace', () => {
    const mapping: StructuredMapping = {
      foo: {
        bar(value, dataType) {
          return 'replaced';
        },
      },
    };

    expect(structuredMapper({ foo: { bar: 12 } }, mapping)).toEqual({ foo: { bar: 'replaced' } });

    expect(structuredMapper({ foo: { bar: 'baz' } }, mapping)).toEqual({
      foo: { bar: 'replaced' },
    });
  });

  test('false mapping', () => {
    const mapping: StructuredMapping = {
      foo: false,
    };

    expect(structuredMapper({ foo: { bar: 12 } }, mapping)).toEqual({});
  });

  test('optional mapping', () => {
    const mapping: StructuredMapping = {
      foo: {
        bar: {
          optional: true,
          map() {
            return 'replaced';
          },
        },
      },
    };

    expect(structuredMapper({ foo: { bar: 12 } }, mapping)).toEqual({ foo: { bar: 'replaced' } });

    expect(structuredMapper({ foo: {} }, mapping)).toEqual({});

    expect(structuredMapper({}, mapping)).toEqual({});

    expect(structuredMapper({ foo: { bar: [] } }, mapping)).toEqual({ foo: { bar: 'replaced' } });

    expect(structuredMapper({ foo: [] }, mapping)).toEqual({});
  });

  test('optional with fallback', () => {
    const mapping: StructuredMapping = {
      foo: {
        bar: {
          fallback: 'fallback',
          optional: true,
          map() {
            return 'replaced';
          },
        },
      },
    };

    expect(structuredMapper({ foo: { bar: 12 } }, mapping)).toEqual({ foo: { bar: 'replaced' } });

    expect(structuredMapper({ foo: {} }, mapping)).toEqual({ foo: { bar: 'fallback' } });

    expect(structuredMapper({}, mapping)).toEqual({ foo: { bar: 'fallback' } });

    expect(structuredMapper({ foo: { bar: [] } }, mapping)).toEqual({ foo: { bar: 'replaced' } });

    expect(structuredMapper({ foo: [] }, mapping)).toEqual({ foo: { bar: 'fallback' } });
  });

  test('nullable mapping', () => {
    const mapping: StructuredMapping = {
      foo: {
        bar: {
          nullable: true,
          map() {
            return 'replaced';
          },
        },
      },
    };

    expect(structuredMapper({ foo: { bar: null } }, mapping)).toEqual({ foo: { bar: null } });

    expect(structuredMapper({ foo: { bar: 1 } }, mapping)).toEqual({ foo: { bar: 'replaced' } });
  });

  test('nullable with fallback', () => {
    const mapping: StructuredMapping = {
      foo: {
        bar: {
          fallback: 'fallback',
          nullable: true,
          map() {
            return 'replaced';
          },
        },
      },
    };

    expect(structuredMapper({ foo: { bar: 12 } }, mapping)).toEqual({ foo: { bar: 'replaced' } });

    expect(structuredMapper({ foo: { bar: null } }, mapping)).toEqual({ foo: { bar: 'fallback' } });
  });

  test('nullable and optional mapping', () => {
    const mapping: StructuredMapping = {
      foo: {
        bar: {
          nullable: true,
          optional: true,
          fallback: 'fallback',
          map() {
            return 'replaced';
          },
        },
      },
    };

    expect(structuredMapper({ foo: { bar: 12 } }, mapping)).toEqual({ foo: { bar: 'replaced' } });

    expect(structuredMapper({ foo: {} }, mapping)).toEqual({ foo: { bar: 'fallback' } });

    expect(structuredMapper({}, mapping)).toEqual({ foo: { bar: 'fallback' } });

    expect(structuredMapper({ foo: { bar: null } }, mapping)).toEqual({ foo: { bar: 'fallback' } });
  });

  test('property renaming', () => {
    const mapping: StructuredMapping = {
      bat: {
        rename: 'loo',
        map: (v: any) => v,
      },
      foo: {
        bar: {
          optional: true,
          rename: 'bat',
          map(value: any, dataType: DataType) {
            return 'replaced';
          },
        },
      },
    };

    expect(structuredMapper({ bat: 3, foo: { bar: 12 } }, mapping)).toEqual({
      loo: 3,
      foo: { bat: 'replaced' },
    });

    expect(structuredMapper({ bat: 3, foo: {} }, mapping)).toEqual({ loo: 3 });

    expect(structuredMapper({ bat: 3 }, mapping)).toEqual({ loo: 3 });

    expect(structuredMapper({ bat: 3, foo: { bar: [] } }, mapping)).toEqual({
      loo: 3,
      foo: { bat: 'replaced' },
    });

    expect(structuredMapper({ bat: 3, foo: [] }, mapping)).toEqual({ loo: 3 });
  });

  test('array mapping', () => {
    const mapping: StructuredMapping = {
      foo: {
        bar: {
          array: true,
          map(value: any, dataType: DataType) {
            if (dataType === DataType.Number) {
              return value * 2;
            }

            return 'unknown';
          },
        },
      },
    };

    expect(structuredMapper({ foo: { bar: [] } }, mapping)).toEqual({ foo: { bar: [] } });

    expect(structuredMapper({ foo: { bar: [0, 1, 2, 3, 4, 5] } }, mapping)).toEqual({
      foo: { bar: [0, 2, 4, 6, 8, 10] },
    });

    expect(structuredMapper({ foo: { bar: [1, '2', 3] } }, mapping)).toEqual({
      foo: { bar: [2, 'unknown', 6] },
    });
  });

  test('complex mapping', () => {
    const mapping: StructuredMapping = {
      top: value => value + 10,
      foo: {
        nest: {
          optional: true,
          map: (value: number) => value * 10,
        },
        more: {
          more: {
            array: true,
            optional: true,
            map(value: any, dataType: DataType) {
              if (dataType === DataType.String) return 'str';

              return value;
            },
          },
        },
      },

      arr: {
        array: true,
        map: (val: any) => val ** 10,
      },
    };

    expect(() => structuredMapper({ top: 1 }, mapping)).toThrow();
    expect(() => structuredMapper({ arr: [] }, mapping)).toThrow();

    expect(
      structuredMapper(
        {
          top: 1,
          arr: [5, 10],
        },
        mapping,
      ),
    ).toEqual({
      top: 11,
      arr: [5 ** 10, 10 ** 10],
    });

    expect(
      structuredMapper(
        {
          top: 1,
          arr: [5, 10],
          foo: { nest: 1 },
        },
        mapping,
      ),
    ).toEqual({
      top: 11,
      arr: [5 ** 10, 10 ** 10],
      foo: { nest: 10 },
    });

    expect(
      structuredMapper(
        {
          top: 1,
          arr: [5, 10],
          foo: {
            more: {},
          },
        },
        mapping,
      ),
    ).toEqual({
      top: 11,
      arr: [5 ** 10, 10 ** 10],
    });

    expect(
      structuredMapper(
        {
          top: 1,
          arr: [5, 10],
          foo: {
            more: {
              more: [],
            },
          },
        },
        mapping,
      ),
    ).toEqual({
      top: 11,
      arr: [5 ** 10, 10 ** 10],
      foo: { more: { more: [] } },
    });

    expect(
      structuredMapper(
        {
          top: 1,
          arr: [5, 10],
          foo: {
            more: {
              more: [1, 'dfkj', []],
            },
          },
        },
        mapping,
      ),
    ).toEqual({
      top: 11,
      arr: [5 ** 10, 10 ** 10],
      foo: { more: { more: [1, 'str', []] } },
    });
  });

  test('array shorthand', () => {
    const mapping: StructuredMapping = {
      foo: {
        bar: [{ id: true }],
        baz: [true],
        bat: [v => v * 10],
      },
    };

    expect(
      structuredMapper(
        {
          foo: {
            bar: [{ id: 1, b: 2 }, { id: 2, c: 3 }, { id: 3 }, { id: 4, a: 1 }],
            baz: [],
            bat: [],
          },
        },
        mapping,
      ),
    ).toEqual({
      foo: {
        bar: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
        baz: [],
        bat: [],
      },
    });

    expect(
      structuredMapper(
        {
          foo: {
            bar: [],
            baz: [1, '2', 3, '4'],
            bat: [1, 2, 3, 4],
          },
        },
        mapping,
      ),
    ).toEqual({
      foo: {
        bar: [],
        baz: [1, '2', 3, '4'],
        bat: [10, 20, 30, 40],
      },
    });

    expect(() => structuredMapper({ foo: { bar: [{ b: true }] } }, mapping)).toThrow();
  });

  test('array shorthand array', () => {
    const mapping: StructuredMapping = [{ foo: true }];

    expect(
      structuredMapper<{ foo: string; bar: string }[]>([{ foo: 'bar', bar: 'baz' }], mapping),
    ).toEqual([{ foo: 'bar' }]);
  });

  test('bypass replacement', () => {
    const mapping: StructuredMapping = {
      foo: {
        bar(value, dataType) {
          return 'replaced';
        },
        baz: true,
      },
      bat: true,
    };

    expect(structuredMapper({ foo: { bar: 12, baz: 13 }, bat: 44 }, mapping)).toEqual({
      foo: { bar: 'replaced', baz: 13 },
      bat: 44,
    });

    expect(structuredMapper({ foo: { bar: 'baz', baz: 13 }, bat: 44 }, mapping)).toEqual({
      foo: { bar: 'replaced', baz: 13 },
      bat: 44,
    });
  });

  test('flatten', () => {
    expect(
      structuredMapper(
        {
          a: { b: 2 },
        },
        {
          a: { flatten: {} },
        },
      ),
    ).toEqual({});

    expect(
      structuredMapper(
        {
          a: { b: 2 },
        },
        {
          a: { flatten: { b: true } },
        },
      ),
    ).toEqual({ b: 2 });

    expect(
      structuredMapper(
        {
          a: { b: 2 },
        },
        {
          a: { flatten: { b: { optional: true, map: (v: any) => v } } },
        },
      ),
    ).toEqual({ b: 2 });

    expect(
      structuredMapper(
        {
          a: {},
        },
        {
          a: { flatten: { b: { optional: true, map: (v: any) => v } } },
        },
      ),
    ).toEqual({});

    expect(
      structuredMapper(
        {
          a: { b: 2 },
        },
        {
          a: { flatten: { b: { rename: 'bb', map: (v: any) => v } } },
        },
      ),
    ).toEqual({ bb: 2 });

    expect(
      structuredMapper(
        {
          a: { b: { bb: 2 } },
        },
        {
          a: { flatten: { b: { flatten: true } } },
        },
      ),
    ).toEqual({ bb: 2 });
  });

  test('undefined with optional mapping', () => {
    expect(structuredMapper(undefined, { optional: true, map: (v: any) => v })).toEqual(undefined);
  });

  test('illegal', () => {
    expect(() => structuredMapper<any>({}, [true, true])).toThrow();
    expect(() => structuredMapper<any>([], { a: true })).toThrow();
    expect(() => structuredMapper<any>(1, { a: true })).toThrow();
    expect(() => structuredMapper<any>({}, [true])).toThrow();
    expect(() => structuredMapper<any>(undefined, {})).toThrow();
  });

  test('additionalProperties', () => {
    const input1 = {
      foo: 'bar',
    };

    expect(structuredMapper(input1, {})).toEqual({});
    expect(structuredMapper(input1, { additionalProperties: true })).toEqual({ foo: 'bar' });
    expect(structuredMapper(input1, { foo: false, additionalProperties: true })).toEqual({});

    const input2 = {
      foo: 'bar',
      bar: 'baz',
    };

    expect(
      structuredMapper(input2, {
        foo: false,
        additionalProperties: true,
      }),
    ).toEqual({ bar: 'baz' });

    const input3 = {
      foo: 'bar',
      bar: 'baz',
      bat: 12,
    };

    expect(
      structuredMapper(input3, {
        foo: false,
        bat: v => v * 2,
        additionalProperties: true,
      }),
    ).toEqual({
      bar: 'baz',
      bat: 24,
    });

    const input4 = {
      foo: 'bar',
      bar: {
        foo: 'bar',
        bar: {
          foo: 'bar',
        },
      },
    };

    expect(
      structuredMapper(input4, {
        bar: {
          foo: true,
          additionalProperties: true,
        },
      }),
    ).toEqual({
      bar: {
        foo: 'bar',
        bar: {
          foo: 'bar',
        },
      },
    });

    expect(
      structuredMapper(input4, {
        bar: {
          bar: {
            additionalProperties: true,
          },
        },
      }),
    ).toEqual({
      bar: {
        bar: {
          foo: 'bar',
        },
      },
    });
  });
});

describe('extract', () => {
  test('basics', () => {
    expect(extract({}, {})).toEqual({});
    expect(extract({ foo: 1 }, {})).toEqual({});
    expect(extract({}, { foo: [] })).toEqual({});
    expect(extract({}, { foo: true })).toEqual({});
    expect(extract({ foo: 1 }, { foo: true })).toEqual({ foo: 1 });
    expect(extract({ foo: {} }, { foo: true })).toEqual({ foo: {} });
    expect(extract({ foo: {} }, { foo: false })).toEqual({});
    expect(extract({ foo: 1 }, { foo: [] })).toEqual({});
    expect(extract({ foo: 1 }, { foo: ['bar'] })).toEqual({});
    expect(extract({ foo: { bar: 1 } }, { foo: ['bar'] })).toEqual({ foo: { bar: 1 } });
    expect(extract({ foo: { bar: 1, baz: 2 } }, { foo: ['bar'] })).toEqual({ foo: { bar: 1 } });
  });

  test('array', () => {
    expect(extract({ foo: [{ a: 1, b: 1 }, { b: 2 }, { a: 3 }] }, { foo: [{ b: true }] })).toEqual({
      foo: [{ b: 1 }, { b: 2 }, {}],
    });

    expect(extract([1, 2, 3], true)).toEqual([1, 2, 3]);
  });

  test('shallow array', () => {
    expect(extract([{ a: 1, b: 2 }], [{ a: true }])).toEqual([{ a: 1 }]);
  });

  test('array map on object', () => {
    expect(extract({ a: 1 }, [{}])).toEqual({ a: 1 });
    expect(extract({ a: { b: 1 } }, { a: [{}] })).toEqual({});
    expect(() => extract({}, { a: [{}, {}] })).toThrow();
  });

  test('deep', () => {
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
      permissions: [
        {
          role: true,
          authority: ['access'],
        },
      ],
    };

    const expected = {
      firstName: 'Bob',
      lastName: 'Albert',
      permissions: [{ role: 'admin', authority: { access: 33 } }, { role: 'user' }],
    };

    expect(extract(response, extraction)).toEqual(expected);
  });

  test('recurse', () => {
    expect(extract({}, { foo: { bar: { baz: true } } })).toEqual({});
    expect(extract({ foo: { bar: { baz: 1 } } }, { foo: { bar: { baz: true } } })).toEqual({
      foo: { bar: { baz: 1 } },
    });
  });

  test('null', () => {
    expect(extract(null, { a: true })).toBe(null);
    expect(extract({ a: null }, { a: true })).toEqual({ a: null });
  });

  test('undefined', () => {
    expect(extract(undefined, { a: true })).toBe(undefined);
    expect(extract({ a: undefined }, { a: true })).toEqual({ a: undefined });
  });

  test('rename', () => {
    expect(extract({ foo: 'bar', bar: 'baz' }, { foo: rename('baz'), bar: true })).toEqual({
      baz: 'bar',
      bar: 'baz',
    });
  });

  test('transform', () => {
    expect(extract({ foo: 'bar', bar: 'baz' }, { foo: transform(v => v + 1), bar: true })).toEqual({
      foo: 'bar1',
      bar: 'baz',
    });
  });
});
