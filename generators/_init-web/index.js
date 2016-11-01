'use strict';
const extend = require('deep-extend');
const Base = require('yeoman-generator').Base;
const {writeTemplates, patchPackageJSON} = require('../../utils');

const knownPlugins = require('../../knownPhoveaPlugins.json');
const knownPluginNames = knownPlugins.plugins.map((d) => d.name);
const knownLibraryNames = knownPlugins.libraries.map((d) => d.name);

function toLibraryAliasMap(moduleNames, libraryNames) {
  var r = {};
  moduleNames.forEach((m) => {
    const plugin = knownPlugins.plugins[knownPluginNames.indexOf(m)];
    libraryNames.push(...(plugin.libraries || []));
  });
  libraryNames.forEach((l) => {
    const lib = knownPlugins.libraries[knownLibraryNames.indexOf(l)];
    r[lib.name] = lib.alias || lib.name;
  });
  return r;
}

class PluginGenerator extends Base {

  constructor(args, options) {
    super(args, options);

    // readme content
    this.option('readme');
    this.option('longDescription');
  }

  initializing() {
    this.config.defaults({
      type: 'lib',
      libraries: [],
      libraryAliases: {},
      modules: ['phovea_core'],
      entries: './index.js',
      ignores: [],
      extensions: []
    });
  }

  prompting() {
    return this.prompt([{
      type: 'checkbox',
      name: 'modules',
      message: 'Included Modules',
      choices: knownPluginNames,
      default: this.config.get('modules')
    }, {
      type: 'checkbox',
      name: 'libraries',
      message: 'Included Libraries',
      choices: knownLibraryNames,
      default: this.config.get('libraries')
    }]).then((props) => {
      this.config.set('modules', props.modules);
      this.config.set('libraries', props.libraries);
      this.config.set('libraryAliases', toLibraryAliasMap(props.modules, props.libraries));
    });
  }

  default() {
    this.composeWith('phovea:_node', {
      options: this.options
    }, {
      local: require.resolve('../_node')
    });
  }

  _generateDependencies() {
    var r = {};
    // merge dependencies
    this.config.get('modules').forEach((m) => {
      extend(r, knownPlugins.plugins[knownPluginNames.indexOf(m)].dependencies);
    });
    this.config.get('libraries').forEach((m) => {
      extend(r, knownPlugins.libraries[knownLibraryNames.indexOf(m)].dependencies);
    });
    return r;
  }

  writing() {
    const config = this.config.getAll();
    patchPackageJSON.call(this, config, [], {
      dependencies: this._generateDependencies()
    });
    writeTemplates.call(this, config);
  }

  install() {
    if (this.options.install) {
      this.installDependencies({
        bower: false
      });
    }
  }
}

module.exports = PluginGenerator;