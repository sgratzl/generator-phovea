
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
const name = 'app';


/**
 * Directory path to run the generator
 */
const target = '../' + name;

/**
 * Subgenerators composed with the `init-app` subgenerator.
 */
const GENERATOR_DEPENDENCIES = [
  '../generators/_node',
  '../generators/init-lib',
  '../generators/_init-web',
  '../generators/_check-own-version',
  '../generators/check-node-version',
];

describe('generate app plugin with prompt `app: appName` and the rest default prompt values', () => {


  beforeAll(() => {
    return helpers
      .run(path.join(__dirname, '../generators/init-app'))
      .inDir(path.join(__dirname, target), () => null)
      .withPrompts({
          app:'appName'
      })
      .withGenerators(GENERATOR_DEPENDENCIES);
  });

  afterAll(() => {
    rimraf.sync(path.join(__dirname, target));
  });

  it('generates `package.json` with correct devDependencies', () => {
    const initWebDevDeps = fse.readJSONSync(testUtils.templatePath('_init-web', 'package.tmpl.json')).devDependencies;
    const nodeDevDeps = fse.readJSONSync(testUtils.templatePath('_node', 'package.tmpl.json')).devDependencies;
    assert.jsonFileContent('package.json', {devDependencies: Object.assign(initWebDevDeps, nodeDevDeps)});
  });

  it('generates `package.json` with the correct scripts', () => {
    const initWebScripts = JSON.parse(template(JSON.stringify(fse.readJSONSync(testUtils.templatePath('_init-web', 'package.tmpl.json'))))({name})).scripts;
    assert.jsonFileContent('package.json', {scripts: initWebScripts});
  });
});