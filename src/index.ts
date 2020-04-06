/* eslint-disable max-classes-per-file */

export enum DataType {
  String,
  Number,
  Boolean,
  Function,
  Null,
  Undefined,
  Date,
  Array,
  Object,
  Unknown,
}

type MappingFunc<T> = (val: T, key?: string, contextualKey?: string) => any;

export type Mapping = {
  [DataType.String]?: MappingFunc<string>;
  [DataType.Number]?: MappingFunc<number>;
  [DataType.Boolean]?: MappingFunc<boolean>;
  [DataType.Function]?: MappingFunc<Function>;
  [DataType.Null]?: MappingFunc<null>;
  [DataType.Undefined]?: MappingFunc<undefined>;
  [DataType.Date]?: MappingFunc<Date>;
  [DataType.Array]?: MappingFunc<any[]>;
  [DataType.Object]?: MappingFunc<object>;
  [DataType.Unknown]?: MappingFunc<any>;

  custom?: [
    // use this mapping?
    (data: any, dataType: DataType, key?: string, contextualKey?: string) => boolean,
    // do the mapping
    (data: any, dataType: DataType, key?: string, contextualKey?: string) => any,
  ][];
};

export const toDataType = (data?: any): DataType => {
  if (data === null) {
    return DataType.Null;
  }

  if (data === undefined) {
    return DataType.Undefined;
  }

  if (data === true || data === false) {
    return DataType.Boolean;
  }

  if (Array.isArray(data)) {
    return DataType.Array;
  }

  if (data instanceof Date) {
    return DataType.Date;
  }

  if (typeof data === 'string' || data instanceof String) {
    return DataType.String;
  }

  if (typeof data === 'number' || !Number.isNaN(+data)) {
    return DataType.Number;
  }

  if (typeof data === 'function' || data instanceof Function) {
    return DataType.Function;
  }

  if (typeof data === 'object') {
    return DataType.Object;
  }

  return DataType.Unknown;
};

export const mapper = <D>(
  data: D,
  mapping: Mapping = {},
  key?: string,
  contextualKey?: string,
): any => {
  const dataType = toDataType(data);

  if (mapping.custom) {
    const funcs = mapping.custom.filter(([useThisMapping]) =>
      useThisMapping(data, dataType, key, contextualKey),
    );

    if (funcs.length) {
      return funcs.reduce((acc, [, fn]) => fn(acc, dataType, key, contextualKey), data);
    }
  }

  const mappingFunc = mapping[dataType];

  if (mappingFunc) {
    const result = mappingFunc(data as never, key, contextualKey);

    // in short, a transform of:
    //
    // (obj, key) => { key === 'something' ? 12 : obj }
    //
    // when obj is an Object, we should recurse into it
    if (result !== data || toDataType(result) !== DataType.Object) {
      return result;
    }
  }

  switch (dataType) {
    case DataType.Array:
      // have to use Array.from because of array-like objects
      return Array.from(data as any).map((val, i) =>
        mapper(val, mapping, key, contextualKey ? `${contextualKey}[${i}]` : `[${i}]`),
      );

    case DataType.Object: {
      const output: any = {};

      if ((data as any).constructor.name !== 'Object') {
        console.warn(
          `Iterating over a ${
            (data as any).constructor.name
          }, which will lose your class instance type`,
        );
      }

      for (const [key, value] of Object.entries(data)) {
        output[key] = mapper(value, mapping, key, contextualKey ? `${contextualKey}.${key}` : key);
      }

      return output as D;
    }

    case DataType.String:
    case DataType.Number:
    case DataType.Boolean:
    case DataType.Function:
    case DataType.Null:
    case DataType.Undefined:
    case DataType.Unknown:
    default:
      return data;
  }
};

const buildNestedPropertyAccessors = (
  obj: any,
  exclude: string[] = [],
  ctx: string[] = [],
): string[][] => {
  const props: string[][] = [];

  if (toDataType(obj) !== DataType.Object) {
    return [];
  }

  for (const [key] of Object.entries(obj)) {
    const nested = buildNestedPropertyAccessors(obj[key], exclude, ctx.concat(key));

    if (nested.length) {
      props.push(...nested);
    } else {
      props.push(ctx.concat(key));
    }
  }

  return props;
};

const getProperty = (obj: any, accessor: string[]) =>
  accessor.reduce((obj, property) => {
    if (obj[property] !== undefined) {
      return obj[property];
    }

    throw new Error(`@lcdev/mapper could not access property '${accessor.join('.')}'`);
  }, obj);

const setProperty = (obj: any, accessor: string[], value: any, createObjs = false) => {
  if (accessor.length === 1) {
    obj[accessor[0]] = value;
  } else if (accessor.length > 1) {
    if (createObjs && obj[accessor[0]] === undefined) {
      obj[accessor[0]] = {};
    }

    setProperty(obj[accessor[0]], accessor.slice(1), value, createObjs);
  } else if (accessor.length === 0) {
    Object.assign(obj, value);
  }
};

export type StructuredMappingFunc<I, O = I> = (val: I, dataType: DataType) => O;

export type StructuredMappingObject<I, O = I> =
  | {
      map: StructuredMappingFunc<I, O>;
      rename?: string;
      array?: true;
      optional?: never;
      nullable?: never;
      fallback?: never;
      flatten?: never;
      additionalProperties?: never;
    }
  | {
      map: StructuredMappingFunc<I, O>;
      rename?: string;
      optional: boolean;
      nullable?: never;
      fallback?: O;
      array?: true;
      flatten?: never;
      additionalProperties?: never;
    }
  | {
      map: StructuredMappingFunc<I, O>;
      rename?: string;
      optional?: boolean;
      nullable: boolean;
      fallback?: O;
      array?: true;
      flatten?: never;
      additionalProperties?: never;
    }
  | {
      flatten: StructuredMapping<I, O>;
      map?: never;
      rename?: never;
      array?: never;
      optional?: never;
      nullable?: never;
      fallback?: never;
      additionalProperties?: never;
    };

export type StructuredMappingStructure<I, O = I> = {
  [key: string]: StructuredMapping<any> | undefined;
  additionalProperties?: boolean;

  // disallowed keys, because they're special in StructuredMappingObject
  map?: never;
  rename?: never;
  array?: never;
  optional?: never;
  nullable?: never;
  fallback?: never;
  flatten?: never;
};

export type StructuredMappingOptions<I, O = I> =
  | boolean
  | StructuredMappingFunc<I, O>
  | StructuredMappingObject<I, O>
  | StructuredMappingStructure<I, O>;

export type StructuredMapping<I = any, O = I> =
  | [
      | boolean
      // using O[0] to extract the type of array elements that it maps to
      | StructuredMappingFunc<I, O extends any[] ? O[0] : never>
      | StructuredMappingStructure<I, O extends any[] ? O[0] : never>,
    ]
  | StructuredMappingOptions<I, O>;

export const structuredMapper = <D, O = D>(data: D, mapping: StructuredMapping<D, O>): O => {
  if (typeof mapping === 'function') {
    return structuredMapper(data, { map: mapping });
  }

  if (mapping === true) {
    return structuredMapper(data, { map: (v: any) => v });
  }

  if (mapping === false) {
    return (undefined as unknown) as O;
  }

  if (Array.isArray(mapping)) {
    if (mapping.length !== 1) {
      throw new Error('Array mapping shorthand should be [bool | {} | v => v] syntax');
    }

    return structuredMapper(data, {
      array: true,
      map: (v: any) => structuredMapper(v, mapping[0] as any),
    });
  }

  if ('map' in mapping) {
    if (data === undefined && 'optional' in mapping && mapping.optional) {
      return (undefined as unknown) as O;
    }

    if (data === null && 'nullable' in mapping && mapping.nullable) {
      if ('fallback' in mapping) {
        return mapping.fallback as any;
      }

      return (null as unknown) as O;
    }

    if (mapping.array) {
      if (toDataType(data) !== DataType.Array) {
        throw new Error('received an array mapping, but input data was not');
      }

      return (((data as unknown) as any[]).map(v => mapping.map(v, toDataType(v))) as unknown) as O;
    }

    return (mapping.map as StructuredMappingFunc<D, O>)(data, toDataType(data));
  }

  if (data === undefined) {
    throw new Error('Cannot do a structured map on undefined');
  } else if (typeof data !== 'object') {
    throw new Error(`Cannot do a structured map on a non-object (${data})`);
  }

  // get mappings without the trailing .map or .optional
  const exclude = [
    'map',
    'fallback',
    'optional',
    'nullable',
    'rename',
    'array',
    'additionalProperties',
  ];
  const mappings = buildNestedPropertyAccessors(mapping)
    .map(prop => {
      if (exclude.includes(prop[prop.length - 1])) {
        return prop.slice(0, -1);
      }

      return prop;
    })
    .filter(v => v.length > 0);

  const output = {};

  if (mapping.additionalProperties) {
    Object.assign(output, data);
  }

  mappings
    .map(prop => [prop, getProperty(mapping, prop)])
    .forEach(([prop, mapping]) => {
      let input;

      try {
        // when getting the property, we ignore 'flatten'
        input = getProperty(
          data,
          prop.filter((p: string) => p !== 'flatten'),
        );
      } catch (err) {
        if (!mapping.optional) {
          throw err;
        } else if ('fallback' in mapping) {
          setProperty(output, prop, mapping.fallback, true);
        }

        return;
      }

      if (mapping.rename) {
        prop.splice(-1, 1, mapping.rename);
      }

      // when setting the property, we fold 'flatten' upwards
      const destProp = prop.reduce((acc: string[], p: string) => {
        if (p === 'flatten') return acc.slice(0, -1);
        return acc.concat(p);
      }, []);

      setProperty(output, destProp, structuredMapper(input, mapping), true);
    });

  return output as O;
};

export interface ExtractionArr extends Array<Extraction> {}

export type Extraction =
  | ExtractionArr
  | Rename
  | Transform
  | string[]
  | boolean
  | {
      [key: string]: Extraction;
    };

export class Rename {
  constructor(public readonly to: string) {}
}

export class Transform {
  constructor(public readonly fn: (from: any) => any) {}
}

export const rename = (to: string): any => new Rename(to);
export const transform = (fn: (from: any) => any): any => new Transform(fn);

export const extract = (body: any, extraction: Extraction): any => {
  const output: any = {};

  if (typeof body !== 'object') return body;
  if (body === null) return null;

  // for [...] and [{ ...mapping }]
  const isArrMap =
    Array.isArray(extraction) && extraction.length === 1 && typeof extraction[0] === 'object';

  if (!isArrMap && Array.isArray(extraction)) {
    if (extraction.length > 1) {
      throw new Error('It is invalid to pass an array with length > 1 as a property of extract');
    }

    // foo: [] or foo: [false] is equivalent to false
    if (extraction.length === 0 || extraction[0] === false) {
      extraction = false;
    }
  }

  if (extraction === false || extraction === null || extraction === undefined) {
    return undefined;
  }

  if (Array.isArray(body)) {
    if (isArrMap) {
      return body.map(v => extract(v, (extraction as any[])[0]));
    }

    return body;
  }

  // we know that body is not an array
  if (isArrMap) return body;

  for (const [field, extractField] of Object.entries(extraction)) {
    // either [{ bar: true }] or ['fieldA', 'fieldB']
    if (Array.isArray(extractField)) {
      // this is when mapping is [{ bar: true }]
      // [{bar:1,baz:2},{bar:2,baz:3}] -> [{bar:1},{bar:2}]
      const isObjectMapping = extractField.some(v => typeof v !== 'string');

      if (isObjectMapping) {
        if (extractField.length !== 1) {
          throw new Error('Bad [{}] syntax for extract');
        }

        if (!Array.isArray(body[field])) {
          continue;
        }

        // [{ bar: true }]
        const extractor = extractField[0] as Extraction;

        // map over fields, recursing
        output[field] = body[field].map((v: any) => extract(v, extractor));
      } else {
        if (typeof body[field] !== 'object') {
          continue;
        }

        output[field] = {};

        // this is when ['fieldA', 'fieldB']
        for (const arrField of extractField) {
          output[field][arrField as string] = body[field][arrField as string];
        }
      }
    } else if (extractField === true) {
      // { bar: true } means return anything in bar
      output[field] = body[field];
    } else if (extractField === false) {
      continue;
    } else if (extractField instanceof Rename) {
      output[extractField.to] = body[field];
    } else if (extractField instanceof Transform) {
      output[field] = extractField.fn(body[field]);
    } else {
      // { foo: { bar: ... } } - recurse into foo
      output[field] = extract(body[field], extractField);
    }
  }

  return output;
};
