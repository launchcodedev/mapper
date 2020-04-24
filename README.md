# Object Mapper
[![Licensed under MPL 2.0](https://img.shields.io/badge/license-MPL_2.0-green.svg)](https://www.mozilla.org/en-US/MPL/2.0/)
[![Build Status](https://github.com/servall/mapper/workflows/CI/badge.svg)](https://github.com/servall/mapper/actions)
[![npm](https://img.shields.io/npm/v/@lcdev/mapper.svg)](https://www.npmjs.com/package/@lcdev/mapper)
[![BundlePhobia](https://badgen.net/bundlephobia/minzip/@lcdev/mapper)](https://bundlephobia.com/result?p=@lcdev/mapper)

Our internal utility package for describing object transformations in javascript.
This package contains a few functions for extraction, property mapping and a few
other types of transforms.

At the moment, the functions that this package exports have typescript types, but
are not fully type safe. That is, we can't infer types correctly, so it's your
responsibility to cast as required.

### Quick Start
```bash
yarn add @lcdev/mapper@0.1
```

There are three main functions:

1. The `extract` function: decides which fields of an object to keep, stripping others out.
2. The `structuredMapper` function: transforms fields of an object, based on the key name of of that field.
3. The `mapper` function: operates on all fields of an object, discriminating based on the type of values.

# The `extract` Function
Extraction is the simplest but most practical function. It take any javascript object in, and outputs a
new object with only the fields you want.

```typescript
import { extract } from '@lcdev/mapper';

const user = await myDatabase.select('* from user where id = 1');

const userWithSpecificFields = extract(user, {
  firstname: true,
  lastname: true,
  permissions: [{
    role: true,
    authority: ['access'],
  }],
});
```

For this example, we'll pretend that `user` comes back as a nested object from an ORM.

```typescript
const user = {
  firstname: 'John',
  lastname: 'Doe',
  password: '$hashed',
  socialSecurityNumber: '111222333',
  permissions: [
    {
      role: 'admin',
      authority: { access: 'read-write', id: 42 },
      privateInfo: 'secret!',
    },
  ],
};
```

Given this, our `extract` function looks at the declarative object passed as a second argument,
and decides which fields to keep and which to ignore.

Our output looks like:

```typescript
const userWithSpecificFields = {
  firstname: 'John',
  lastname: 'Doe',
  permissions: [
    { role: 'admin', authority: { access: 'read-write' } },
  ],
};
```

Notice how `password`, `privateInfo`, `id` and others were disgarded. This can be quite helpful for ensuring
that your API responses come back as you expect them to, especially when using an ORM where you don't want to
be manually selecting columns for every route.

#### Patterns
Here are the patterns that `extract` supports:

- `['foo']` means "pull these fields from the object" - it's the same as `{ foo: true }`
- `[{ ... }]` means "map arrays, taking these fields"
- `{ foo: true }` means "take only 'foo' from the object"

Mismatching types, like an array selector when the return is an object, are ignored.

# The `structuredMapper` Function
This function transforms a given javascript object into another, by transforming each field, by name.

```typescript
import { structuredMapper } from '@lcdev/mapper';

const rawJsonResponse = await fetch('/foo/bar').then(v => v.json());

// similar to extract, we give it data as the first argument, and how to map it in the second argument
const response = structuredMapper(rawJsonResponse, {
  firstname: true,
  lastname: true,
  birthdate(value, dataType) {
    return new Date(value);
  },
  eyeColor: {
    optional: true,
    map(value, dataTpe) {
      return value;
    },
  },
});
```

The rules are pretty simple:
- `true` means keep the value around
- a named function means to pass the original value (and inferred DataType) to the function, and use the return value in the output
- an object with a `map` function is like a named function, but allows `optional` and `nullable` meta properties
- specifying `array: true` implies to map each element in an array, instead of assuming a single value
- `fallback` is the value to use when an optional value isn't present in the input object
- `rename` renames a field in the output object
- `flatten` moves the field "up" in the object
- `additionalProperties` passes through any fields that were on the input, but not specified in the mapping

You may find looking at our test suite for `structuredMapper` helpful, since these concepts in isolation don't tend to look practical.

# The `mapper` Function
Similar to `structuredMapper`, the plain `mapper` function is a little more heavy-handed. It transforms all values, deeply nested.

```typescript
import { mapper, Mapping, DataType } from '@lcdev/mapper';
import { isValid, parseISO } from 'date-fns';

const mapping: Mapping = {
  custom: [
    [
      (data, dataType) => {
        if (dataType === DataType.String) {
          return isValid(parseISO(data));
        }

        return dataType === DataType.Date;
      },
      (data, dataType) => (dataType === DataType.Date) ? data : parseISO(data),
    ],
  ],
};

const parseAllDates = (object) => mapper(object, mapping);
```

This package will iterate through arrays, objects, etc. So doing an operation to all nested
properties of an object is easy.

Our `parseAllDates` function deeply introspects the input object, and will transform any
fields that look like a date.

Notice that we used `custom` above. Let's look at the 'normal' case.

```typescript
const mapping: Mapping = {
  [DataType.Number]: num => num * 2,
  [DataType.String]: str => {
    const parsed = parseISO(str);
    return isValid(parsed) ? parsed : str;
  },
};
```

The more typical use of `mapper` differentiates based on `DataType`.

## Alternatives
- [class-transformer](https://github.com/typestack/class-transformer)
- [ts-object-transformer](https://github.com/fcamblor/ts-object-transformer)
- [ramda evolve](https://ramdajs.com/docs/#evolve)
