# Object Mapper
Simple object mapping with visitor support. Does the difficult JS data type parsing.

### Quick Start
```bash
yarn add @lcdev/mapper@0.1
```

```typescript
import { mapper, Mapping } from '@lcdev/mapper';

const mapping: Mapping = {
  custom: [
    [
      (data, dataType) => {
        if (dataType === DataType.String) {
          return moment(data, moment.ISO_8601).isValid();
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

## Extraction
Taking an example route action:

```typescript
{
  path: '/users',
  method: HttpMethod.GET,
  async action(ctx, next) {
    return myDatabase.select('* from user');
  },
},
```

You might prefer not to include the `password` field here (excuse the contrived example).

To do so, the manual approach is:

```typescript
const { values, to, return } = { ... };

return { values, to, return };
```

This is clearly not great. Lots of duplication and possibility for errors. It doesn't work
for nesting objects well, and with multiple branches in an action, requires duplication.

You might opt to use `extract` to take what you want:

```typescript
import { extract } from '@lcdev/mapper';

const users = await myDatabase.select('* from user');

return extract(users, {
  firstName: true,
  lastName: true,
  permissions: [{
    role: true,
    authority: ['access'],
  }],
});
```

Some examples of this:

```
INPUT:
{
  firstName: 'Bob',
  lastName: 'Albert',
  password: 'secure!',
  permissions: [
    { role: 'admin', timestamp: new Date(), authority: { access: 33 } },
    { role: 'user', timestamp: new Date(), extra: false },
  ],
}

RETURNING:
{
  firstName: true,
  lastName: true,
  permissions: [{
    role: true,
    authority: ['access'],
  }],
}

RESULT:
{
  firstName: 'Bob',
  lastName: 'Albert',
  permissions: [
    { role: 'admin', authority: { access: 33 } },
    { role: 'user' },
  ],
}
```

Note a couple things:

- `['access']` means "pull these fields from the object" - it's the same as `{ access: true }`
- `[{ ... }]` means "map this array with this selector"
- `{ foo: true }` means "take only 'foo'"

Mismatching types, like an array selector when the return is an object, are ignored.
