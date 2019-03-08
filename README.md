# Object Mapper
Simple object mapping with visitor support. Does the difficult JS data type parsing.


```typescript
import { mapper, Mapping } from '@servall/mapper';

const mapping: Mapping = {
  custom: [
    [
      (data, dataType) => {
        if (dataType === DataType.String) {
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
```

This package will iterate through arrays, objects, etc. So doing an operation to all nested
properties of an object is easy.

```typescript
const mapping: Mapping = {
  [DataType.Number]: num => num * 2,
};

const mapped = mapper({ nested: { property: 2 }, arr: [12] }, mapping);

expect(mapped).toEqual({ nested: { property: 4 }, arr: [24] });
```
