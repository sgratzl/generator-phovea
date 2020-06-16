
'use strict';
const path = require('path');
const assert = require('yeoman-assert');
const helpers = require('yeoman-test');
const rimraf = require('rimraf');
const fse = require('fs-extra');
const testUtils=require('./testUtils');
const {template} = require('lodash');

/**
 * Directory name to run the generator
 */
const name = 'appslib';


/**
 * Directory path to run the generator
 */
const target = '../' + name;
/**
 * Subgenerators composed with the `init-app-slib` subgenerator.
 */
const GENERATOR_DEPENDENCIES = [
  '../generators/_node',
  '../generators/_init-hybrid',
  '../generators/init-app',
  '../generators/_init-web',
  '../generators/init-slib',
  '../generators/_init-python',
  '../generators/_check-own-version',
  '../generators/check-node-version',
];



describe('generate app-slib plugin with prompt `app: appName` and the rest default prompt values', () => {


  beforeAll(() => {
    return helpers
      .run(path.join(__dirname, '../generators/init-app-slib'))
      .inDir(path.join(__dirname, target), () => null)
      .withPrompts({
        app:'appName'
    })
      .withGenerators(GENERATOR_DEPENDENCIES);
  });

  afterAll(() => {
    rimraf.sync(path.join(__dirname, target));
  });

  it('generates `package.json` with the correct devDependencies', () => {
    const initWebDevDeps = fse.readJSONSync(testUtils.templatePath('_init-web', 'package.tmpl.json')).devDependencies;
    const nodeDevDeps = fse.readJSONSync(testUtils.templatePath('_node', 'package.tmpl.json')).devDependencies;
    assert.jsonFileContent('package.json', {devDependencies: Object.assign(initWebDevDeps, nodeDevDeps)});
  });

  it('generates `package.json` with the correct scripts', () => {
    const initHybridScripts = JSON.parse(template(JSON.stringify(fse.readJSONSync(testUtils.templatePath('_init-hybrid', 'package.tmpl.json'))))({name})).scripts;
    assert.jsonFileContent('package.json', {scripts: initHybridScripts});
  });
});