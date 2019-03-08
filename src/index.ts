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

export type Mapping = {
  [DataType.String]?: (str: string) => any;
  [DataType.Number]?: (num: number) => any;
  [DataType.Boolean]?: (bool: boolean) => any;
  [DataType.Function]?: (func: Function) => any;
  [DataType.Null]?: (val: null) => any;
  [DataType.Undefined]?: (val: undefined) => any;
  [DataType.Date]?: (date: Date) => any;
  [DataType.Array]?: (arr: any[]) => any;
  [DataType.Object]?: (obj: object) => any;
  [DataType.Unknown]?: (val: any) => any;

  custom?: [
    // use this mapping?
    (data: any, dataType: DataType) => boolean,
    // do the mapping
    (data: any, dataType: DataType) => any,
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

export const mapper = <D>(data: D, mapping: Mapping = {}): any => {
  const dataType = toDataType(data);

  if (mapping.custom) {
    const func = mapping.custom.find(([useThisMapping]) => useThisMapping(data, dataType));

    if (func) {
      return func[1](data, dataType);
    }
  }

  const mappingFunc = mapping[dataType];

  if (mappingFunc) {
    return mappingFunc(data as never);
  }

  switch (dataType) {
    case DataType.Array:
      // have to use Array.from because of array-like objects
      return Array.from(data as any).map(val => mapper(val, mapping)) as unknown as D;

    case DataType.Object:
      const output: any = {};
      for (const [key, value] of Object.entries(data)) {
        output[key] = mapper(value, mapping);
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
