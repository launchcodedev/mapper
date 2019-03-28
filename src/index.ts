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

type MappingFunc<T> = (val: T, key?: string) => any;

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
    (data: any, dataType: DataType, key?: string) => boolean,
    // do the mapping
    (data: any, dataType: DataType, key?: string) => any,
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

export const mapper = <D>(data: D, mapping: Mapping = {}, key?: string): any => {
  const dataType = toDataType(data);

  if (mapping.custom) {
    const func = mapping.custom.find(([useThisMapping]) => useThisMapping(data, dataType, key));

    if (func) {
      return func[1](data, dataType, key);
    }
  }

  const mappingFunc = mapping[dataType];

  if (mappingFunc) {
    const result = mappingFunc(data as never, key);

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
      return Array.from(data as any).map(val => mapper(val, mapping)) as unknown as D;

    case DataType.Object:
      const output: any = {};
      for (const [key, value] of Object.entries(data)) {
        output[key] = mapper(value, mapping, key);
      }

      return output as D;

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

  for (const [key, nested] of Object.entries(obj)) {
    const nested = buildNestedPropertyAccessors(obj[key], exclude, ctx.concat(key));

    if (nested.length) {
      props.push(...nested);
    } else {
      props.push(ctx.concat(key));
    }
  }

  return props;
};

const getProperty = (obj: any, accessor: string[]) => accessor.reduce((obj, property) => {
  if (obj[property] !== undefined) {
    return obj[property];
  }
  throw new Error(`cannot getProperty ${accessor.join('.')}`);
}, obj);

const setProperty = (obj: any, accessor: string[], value: any, createObjs = false) => {
  if (accessor.length === 1) {
    obj[accessor[0]] = value;
  } else if (accessor.length > 1) {
    if (createObjs && obj[accessor[0]] === undefined) {
      obj[accessor[0]] = {};
    }

    setProperty(obj[accessor[0]], accessor.slice(1), value, createObjs);
  }
};

export type StructuredMappingFunc<I, O = I> = (val: I, dataType: DataType) => O;

export type StructuredMappingOptions<I, O = I> = StructuredMappingFunc<I, O> | {
  map: StructuredMappingFunc<I, O>;
  optional?: boolean;
  array?: boolean;
};

export type StructuredMapping<I = any, O = I> = StructuredMappingOptions<I, O> | {
  [key: string]: StructuredMapping<any>;
};

export const structuredMapper = <D, O = D>(data: D, mapping: StructuredMapping<D, O>): O => {
  if (typeof mapping === 'function') {
    return structuredMapper(data, { map: mapping });
  }

  if (mapping.map) {
    if (data === undefined && !mapping.optional) {
      throw new Error('Cannot do a structured map on undefined');
    }

    if (mapping.array) {
      if (toDataType(data) !== DataType.Array) {
        throw new Error('received an array mapping, but input data was not');
      }

      return (data as unknown as any[])
        .map(v => (mapping.map as StructuredMappingFunc<D, O>)(v, toDataType(v))) as unknown as O;
    }

    return (mapping.map as StructuredMappingFunc<D, O>)(data, toDataType(data));
  }

  if (data === undefined) {
    throw new Error('Cannot do a structured map on undefined');
  } else if (typeof data !== 'object') {
    throw new Error(`Cannot do a structured map on a non-object (${data})`);
  }

  // get mappings without the trailing .map or .optional
  const exclude = ['map', 'optional', 'array'];
  const mappings = buildNestedPropertyAccessors(mapping).map((prop) => {
    if (exclude.includes(prop[prop.length - 1])) {
      return prop.slice(0, -1);
    }

    return prop;
  });

  const output = {};

  mappings.map(prop => [prop, getProperty(mapping, prop)]).forEach(([prop, mapping]) => {
    let input;

    try {
      input = getProperty(data, prop);
    } catch (err) {
      if (!mapping.optional) {
        throw err;
      } else {
        return;
      }
    }

    setProperty(output, prop, structuredMapper(input, mapping), true);
  });

  return output as O;
};

export interface ExtractionArr extends Array<Extraction> {}

export type Extraction = ExtractionArr | string[] | boolean | {
  [key: string]: Extraction,
};

export const extract = (body: any, extraction: Extraction): any => {
  const output: any = {};

  if (typeof body !== 'object') return body;
  if (body === null) return null;

  if (Array.isArray(body)) {
    // edge case for [...] and [{ ...mapping }]
    if (Array.isArray(extraction) && extraction.length === 1 && typeof extraction[0] === 'object') {
      return body.map(v => extract(v, extraction[0] as any));
    }

    return body;
  }

  for (const [field, extractField] of Object.entries(extraction)) {
    // either [{ bar: true }] or ['fieldA', 'fieldB']
    if (Array.isArray(extractField)) {
      // this is when mapping is [{ bar: true }]
      // [{bar:1,baz:2},{bar:2,baz:3}] -> [{bar:1},{bar:2}]
      const isObjectMapping = (extractField as any[]).some(v => (typeof v !== 'string'));

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
    } else {
      // { foo: { bar: ... } } - recurse into foo
      output[field] = extract(body[field], extractField);
    }
  }

  return output;
};
