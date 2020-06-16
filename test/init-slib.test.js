
'use strict';
const path = require('path');
const assert = require('yeoman-assert');
const helpers = require('yeoman-test');
const rimraf = require('rimraf');
const fse = require('fs-extra');
const testUtils = require('./testUtils');
const {template} = require('lodash');

/**
 * Directory name to run the generator
 */
const name = 'slib';


/**
 * Directory path to run the generator
 */
const target = '../' + name;

/**
 * Subgenerators composed with the `init-slib` subgenerator.
 */
const GENERATOR_DEPENDENCIES = [
  '../generators/_node',
  '../generators/_init-python',
  '../generators/_check-own-version',
  '../generators/check-node-version',
];

describe('generate slib plugin with default prompt values', () => {


  beforeAll(() => {
    return helpers
      .run(path.join(__dirname, '../generators/init-slib'))
      .inDir(path.join(__dirname, target), () => null)
      .withGenerators(GENERATOR_DEPENDENCIES);
  });

  afterAll(() => {
    rimraf.sync(path.join(__dirname, target));
  });

  it('generates `package.json` with the correct devDependencies', () => {
    const nodeDevDeps = fse.readJSONSync(testUtils.templatePath('_node', 'package.tmpl.json')).devDependencies;
    assert.jsonFileContent('package.json', {devDependencies: nodeDevDeps});
  });

  it('generates `package.json` with the correct scripts', () => {
    const initPythonScripts = JSON.parse(template(JSON.stringify(fse.readJSONSync(testUtils.templatePath('_init-python', 'package.tmpl.json'))))({name})).scripts;
    assert.jsonFileContent('package.json', {scripts: initPythonScripts});
  });
});