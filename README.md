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

Be warned: Object detection is `typeof val === 'object'`. Any Object match (those in
`DataType` excluded) will iterate through the key/value pairs found (e.g. an XMLHttpRequest
object) and modify the properties if it matches. This may produce undesirable results.

```typescript
const mapping: Mapping = {
  [DataType.Number]: num => num * 2,
};

const mapped = mapper({ nested: { property: 2 }, arr: [12] }, mapping);

expect(mapped).toEqual({ nested: { property: 4 }, arr: [24] });
```

We also have a `structuredMapper` for more complex use cases. For example:

```typescript
const mapUser = (user) => structuredMapper({
  info: {
    birthday(str) {
      return moment(str);
    },

    firstName(str) {
      return str.trim();
    },
  },

  id: {
    optional: true,
    map: (val) => parseInt(val),
  },

  friends: {
    array: true,
    optional: true, // :(
    map(value, dataType) {
      if (dataType === DataType.String) {
        return { name: value };
      }

      return value;
    },
  },
});

const users = structuredMapper(await fetch('/users'), {
  success: val => (val !== true) ? throw 'Error!' : undefined,
  allUsers: {
    array: true,
    map: mapUser,
  },
});
```
