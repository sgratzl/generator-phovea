'use strict';
const _ = require('lodash');
const chalk = require('chalk');
const Base = require('yeoman-generator');
const {writeTemplates, patchPackageJSON, stringifyAble, useDevVersion} = require('../../utils');
const fs = require('fs');

const known = () => require('../../utils/known');

function toLibraryAliasMap(moduleNames = [], libraryNames = []) {
  let r = {};
  moduleNames.forEach((m) => {
    const plugin = known().plugin.byName(m);
    if (!plugin) {
      this.log('cant find plugin: ', m);
      return;
    }
    libraryNames.push(...(plugin.libraries || []));
  });
  libraryNames.forEach((l) => {
    const lib = known().lib.byName(l);
    if (!lib) {
      this.log('cant find library: ', l);
      return;
    }
    _.merge(r, lib.aliases);
  });
  return r;
}

function toLibraryExternals(moduleNames = [], libraryNames = []) {
  let r = [];
  moduleNames.forEach((m) => {
    const plugin = known().plugin.byName(m);
    if (!plugin) {
      this.log('cant find plugin: ', m);
      return;
    }
    r.push(...(plugin.externals || []));
    libraryNames.push(...(plugin.libraries || []));
  });
  libraryNames.forEach((l) => {
    const lib = known().lib.byName(l);
    if (!lib) {
      this.log('cant find library: ', l);
      return;
    }
    r.push(lib.name);
    r.push(...(lib.externals || []));
  });
  return Array.from(new Set(r));
}

class Generator extends Base {

  constructor(args, options) {
    super(args, options);

    // readme content
    this.option('install');
    this.option('readme');
    this.option('longDescription');
    this.option('useDefaults');
  }

  initializing() {
    this.config.defaults({
      type: 'lib',
      libraries: [],
      libraryAliases: {},
      libraryExternals: [],
      modules: ['phovea_core'],
      entries: './index.js',
      ignores: [],
      extensions: []
    });
  }

  prompting() {
    if (this.config.get('type').includes('-')) {
      return; // hybrid
    }
    return this.prompt([{
      type: 'checkbox',
      name: 'modules',
      message: 'Included Modules',
      choices: known().plugin.listWebNamesWithDescription,
      default: this.config.get('modules'),
      when: !this.options.useDefaults
    }, {
      type: 'checkbox',
      name: 'libraries',
      message: 'Included Libraries',
      choices: known().lib.listWebNamesWithDescription,
      default: this.config.get('libraries'),
      when: !this.options.useDefaults
    }]).then((props) => {
      if (!this.options.useDefaults) {
        this.config.set('modules', props.modules);
        this.config.set('libraries', props.libraries);
      }
      this.config.set('libraryAliases', toLibraryAliasMap.call(this, this.config.get('modules'), this.config.get('libraries')));
      this.config.set('libraryExternals', toLibraryExternals.call(this, this.config.get('modules'), this.config.get('libraries')));
    });
  }

  default() {
    if (this.config.get('type').includes('-')) {
      return; // hybrid
    }
    this.composeWith('phovea:_node', {
      options: this.options,
      isWorkspace: this.options.isWorkspace
    });
  }

  _generateDependencies(useDevelopDependencies) {
    let r = {};
    // merge dependencies
    this.config.get('modules').filter(known().plugin.isTypeWeb).forEach((m) => {
      const d = known().plugin.byName(m);
      _.assign(r, (useDevelopDependencies ? d.develop : d).dependencies);
    });
    this.config.get('libraries').filter(known().lib.isTypeWeb).forEach((m) => {
      _.assign(r, known().lib.byName(m).dependencies);
    });
    return r;
  }

  writing() {
    const config = this.config.getAll();
    this.cwd = this.options.isWorkspace ? (config.app || config.name) + '/' : '';
    patchPackageJSON.call(this, config, [], {
      dependencies: this._generateDependencies(useDevVersion.call(this, this.cwd))
    }, null, this.cwd);
    this.fs.copy(this.templatePath('_gitignore'), this.destinationPath(this.cwd + '.gitignore'));
    writeTemplates.call(this, config, null, this.cwd);

    // do not overwrite existing registry file
    if (!fs.existsSync(this.destinationPath(this.cwd + 'src/phovea.ts'))) {
      this.fs.copyTpl(this.templatePath('phovea.tmpl.ts'), this.destinationPath(this.cwd + 'src/phovea.ts'), stringifyAble(config));
    }
  }

  install() {
    if (this.options.options.install) {
      const options = this.cwd ? {cwd: this.cwd} : {}
      this.spawnCommand("npm", ["install"], options);
    }
  }

  end() {
    if (fs.existsSync(this.destinationPath(this.cwd + 'phovea.js'))) {
      this.log('\r\n');
      this.log(chalk.red(`ACTION REQUIRED!`));
      this.log(chalk.default(`Please migrate the content of`), chalk.yellow(`phovea.js`), chalk.default(`to`), chalk.yellow(`/src/phovea.ts`) + chalk.default(` now!`));
      this.log(chalk.default(`Afterwards you can remove the`), chalk.yellow(`phovea.js`), chalk.default(`file from this plugin repository.`));
      this.log(chalk.default(`If you do not migrate the content the registered extension points will be unavailable.`));
    }
  }
}

module.exports = Generator;
module.exports.toLibraryAliasMap = toLibraryAliasMap;
module.exports.toLibraryExternals = toLibraryExternals;
