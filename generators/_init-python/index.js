'use strict';
const _ = require('lodash');
const Base = require('yeoman-generator');
const {writeTemplates, patchPackageJSON, stringifyAble, useDevVersion} = require('../../utils');
const {parseRequirements} = require('../../utils/pip');
const fs = require('fs');

const known = () => require('../../utils/known');

class Generator extends Base {
  constructor(args, options) {
    super(args, options);

    // readme content
    this.option('readme');
    this.option('longDescription');
    this.option('useDefaults');
  }

  initializing() {
    this.config.defaults({
      modules: ['phovea_server'],
      libraries: [],
      sextensions: [],
      unknown: {
        requirements: [],
        dockerPackages: []
      }
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
      choices: known().plugin.listServerNamesWithDescription,
      default: this.config.get('modules'),
      when: !this.options.useDefaults
    }, {
      type: 'checkbox',
      name: 'libraries',
      message: 'Included Libraries',
      choices: known().lib.listServerNamesWithDescription,
      default: this.config.get('libraries'),
      when: !this.options.useDefaults
    }]).then((props) => {
      if (!this.options.useDefaults) {
        this.config.set('modules', props.modules);
        this.config.set('libraries', props.libraries);
      }
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

  _generateDependencies(useDevelopDependencies, cwd) {
    const requirements = parseRequirements(this.fs.read(this.destinationPath(cwd + 'requirements.txt'), {defaults: ''}));
    const dockerPackages = parseRequirements(this.fs.read(this.destinationPath(cwd + 'docker_packages.txt'), {defaults: ''}));

    const concat = (p) => Object.keys(p).map((pi) => pi + p[pi]);

    // merge dependencies
    // support old notation, too (smodules, slibraries)
    const modules = this.config.get('modules').concat(this.config.get('smodules') || []);
    this.config.delete('smodules');
    this.config.set('modules', modules);
    modules.filter(known().plugin.isTypeServer).forEach((m) => {
      const p = known().plugin.byName(m);
      _.assign(requirements, (useDevelopDependencies ? p.develop : p).requirements);
      _.assign(dockerPackages, (useDevelopDependencies ? p.develop : p).dockerPackages);
    });
    const libraries = this.config.get('libraries').concat(this.config.get('slibraries') || []);
    this.config.delete('slibraries');
    this.config.set('libraries', libraries);
    libraries.filter(known().lib.isTypeServer).forEach((m) => {
      const p = known().lib.byName(m);
      _.assign(requirements, p.requirements);
      _.assign(dockerPackages, p.dockerPackages);
    });

    return {
      requirements: concat(requirements),
      dockerPackages: concat(dockerPackages)
    };
  }

  writing() {
    const config = this.config.getAll();
    this.cwd = this.options.isWorkspace ? (config.cwd || config.name) + '/' : '';
    const deps = this._generateDependencies(useDevVersion.call(this, this.cwd), this.cwd);

    patchPackageJSON.call(this, config, [], null, null, this.cwd);
    writeTemplates.call(this, config, !this.options.noSamples, this.cwd);

    this.fs.write(this.destinationPath(this.cwd + 'requirements.txt'), deps.requirements.join('\n'));
    this.fs.write(this.destinationPath(this.cwd + 'docker_packages.txt'), deps.dockerPackages.join('\n'));

    // don't overwrite existing registry file
    if (!fs.existsSync(this.destinationPath(this.cwd + config.name.toLowerCase() + '/__init__.py'))) {
      this.fs.copyTpl(this.templatePath('__init__.tmpl.py'), this.destinationPath(this.cwd + config.name.toLowerCase() + '/__init__.py'), stringifyAble(config));
    }
    this.fs.copy(this.templatePath('_gitignore'), this.destinationPath(this.cwd + '.gitignore'));
    this.fs.copy(this.templatePath('docs_gitignore'), this.destinationPath(this.cwd + 'docs/.gitignore'));
  }

  install() {
    if (this.options.install) {
      // TODO requirements install
    }
  }
}

module.exports = Generator;
