'use-strict';

const rimraf = require('rimraf');
const path = require('path');
const helpers = require('yeoman-test');
const assert = require('yeoman-assert');


beforeEach(() => {
  return helpers.run(path.join(__dirname, '../generators/test'))
    .inDir(path.join(__dirname, 'tmp'))
});

afterEach(() => {
  rimraf.sync(path.join(__dirname, 'tmp'));
});

describe('app generator functions correctly', () => {
  it('creates an index.html file in the target folder', () => {
    assert.file(path.join(__dirname,
      'tmp/public/index.html'
    ));
  })

  it('index.html folder has the right title', () => {
    assert.fileContent(path.join(__dirname,
      'tmp/public/index.html'
    ), 'Templating with Yeoman');
  })

});
