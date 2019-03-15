import {
  DataType,
  Mapping,
  StructuredMapping,
  toDataType,
  mapper,
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
