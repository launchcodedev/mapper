const { Suite } = require('benchmark');
const { structuredMapper } = require('..');

const suite = new Suite();

const array = Array(100000)
  .fill(undefined)
  .map(_ => Math.random());

// this is within the margin of error
suite
  .add('array mapping', () => {
    const _ = array.map(f => f.toString());
  })
  .add('structured mapping', () => {
    const _ = structuredMapper(array, { array: true, map: val => val.toString() });
  });

suite
  .on('cycle', function(event) {
    console.log(String(event.target));
  })
  .on('complete', function() {
    console.log(`Fastest is ${this.filter('fastest').map('name')}`);
  })
  .run();
