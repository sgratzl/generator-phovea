'use strict';
const Base = require('yeoman-generator').Base;
const path = require('path');
const glob = require('glob').sync;
const extend = require('lodash').extend;

const known = require('../../utils/known');
const writeTemplates = require('../../utils').writeTemplates;


function generateScripts() {
  const files = glob('*/requirements.txt', {
    cwd: this.destinationPath()
  });
  const plugins = files.map(path.dirname);

  var scripts = {};

  plugins.forEach((p) => {
    const pkg = this.fs.readJSON(this.destinationPath(p + '/package.json'));

    // vagrantify commands
    const cmds = Object.keys(pkg.scripts);

    var toPatch;
    if (cmds.includes('test:python')) { // hybrid
      toPatch = /^(check|(test|dist|start|watch):python)$/;
    } else { // regular server
      toPatch = /^(check|test|dist|start|watch)$/;
    }

    // no pre post test tasks
    cmds.filter((s) => toPatch.test(s)).forEach((s) => {
      // generate scoped tasks
      let cmd = `.${path.sep}withinEnv "exec 'cd ${p} && npm run ${s}'"`;
      if (/^(start|watch)/g.test(s)) {
        // special case for start to have the right working directory
        let fixedscript = pkg.scripts[s].replace(/__main__\.py/, p);
        cmd = `.${path.sep}withinEnv "${fixedscript}"`;
      }
      scripts[`${s}:${p}`] = cmd;
    });
  });

  return {
    scripts: scripts
  };
}


class Generator extends Base {

  constructor(args, options) {
    super(args, options);
  }

  initializing() {
    this.props = this.fs.readJSON(this.destinationPath('.yo-rc-workspace.json'), {modules: []});
  }

  prompting() {
    const isInstalled = glob('*/package.json', {cwd: this.destinationPath()}).map(path.dirname);
    return this.prompt([{
      type: 'checkbox',
      name: 'modules',
      message: 'Additional Plugins',
      choices: known.plugin.listNamesWithDescription.filter((d) => !isInstalled.includes(d.value)),
      default: this.props.modules
    }]).then((props) => {
      this.props.modules = props.modules;
    });
  }

  _generatePackage(additionalPlugins) {
    const files = glob('*/phovea.js', { // web plugin
      cwd: this.destinationPath()
    });
    const plugins = files.map(path.dirname);

    // generate dependencies
    let dependencies = {};
    let devDependencies = {};
    let scripts = {};
    plugins.forEach((p) => {
      const pkg = this.fs.readJSON(this.destinationPath(p + '/package.json'));
      extend(dependencies, pkg.dependencies);
      extend(devDependencies, pkg.devDependencies);

      // no pre post test tasks
      Object.keys(pkg.scripts).filter((s) => !/^(pre|post).*/g.test(s)).forEach((s) => {
        // generate scoped tasks
        scripts[`${s}:${p}`] = `cd ${p} && npm run ${s}`;
      });
    });

    // add additional to install plugins
    additionalPlugins.forEach((p) => {
      const k = known.plugin.byName(p);
      if (k && k.dependencies) {
        extend(dependencies, k.dependencies);
      }
    });

    // remove all plugins that are locally installed
    plugins.forEach((p) => {
      const k = known.plugin.byName(p);
      if (k && k.dependencies) {
        Object.keys(k.dependencies).forEach((pi) => {
          delete dependencies[pi];
        });
      } else {
        delete dependencies[p];
      }
    });

    return {plugins, dependencies, devDependencies, scripts};
  }

  _generateServerDependencies(additionalPlugins) {
    const files = glob('*/requirements.txt', { // server plugin
      cwd: this.destinationPath()
    });
    const plugins = files.map(path.dirname);

    const requirements = new Set();
    const devRequirements = new Set();
    const debianPackages = new Set();
    const redhatPackages = new Set();

    plugins.forEach((p) => {
      // generate dependencies
      const addAll = (name, set) => {
        const r = this.fs.read(this.destinationPath(`${p}/${name}`));
        r.split('\n').forEach((ri) => {
          set.add(ri.trim());
        });
      };
      addAll('requirements.txt', requirements);
      addAll('requirements_dev.txt', devRequirements);
      addAll('debian_packages.txt', debianPackages);
      addAll('redhat_packages.txt', redhatPackages);
    });

    // add additional to install plugins
    additionalPlugins.forEach((p) => {
      const k = known.plugin.byName(p);
      if (k && k.requirements) {
        Object.keys(k.requirements).forEach((ri) => requirements.add(ri + k.requirements[ri]));
      }
      if (k && k.debianPackages) {
        Object.keys(k.debianPackages).forEach((ri) => debianPackages.add(ri + known.debianPackages[ri]));
      }
      if (k && k.debianPackages) {
        Object.keys(k.debianPackages).forEach((ri) => redhatPackages.add(ri + k.debianPackages[ri]));
      }
    });

    // remove all plugins that are locally installed
    plugins.forEach((p) => {
      const k = known.plugin.byName(p);
      if (k && k.requirements) {
        Object.keys(k.requirements).forEach((pi) => {
          requirements.delete(pi + k.requirements[pi]);
        });
      } else {
        requirements.delete(p);
      }
    });

    return {
      requirements: [...requirements.values()],
      devRequirements: [...devRequirements.values()],
      debianPackages: [...debianPackages.values()],
      redhatPackages: [...redhatPackages.values()]
    };
  }

  writing() {
    this.fs.extendJSON(this.destinationPath('.yo-rc-workspace.json'), {modules: this.props.modules});

    const config = {};
    const {plugins, dependencies, devDependencies, scripts} = this._generatePackage(this.props.modules);

    config.modules = this.props.modules.concat(plugins);
    config.webmodules = plugins;

    writeTemplates.call(this, config, false);

    this.fs.copy(this.templatePath('package.tmpl.json'), this.destinationPath('package.json'));

    if (!this.fs.exists(this.destinationPath('config.json'))) {
      this.fs.copy(this.templatePath('config.tmpl.json'), this.destinationPath('config.json'));
    }
    extend(scripts, generateScripts.call(this));
    this.fs.extendJSON(this.destinationPath('package.json'), {devDependencies, dependencies, scripts});

    const sdeps = this._generateServerDependencies(this.props.modules);
    this.fs.write(this.destinationPath('requirements.txt'), sdeps.requirements.join('\n'));
    this.fs.write(this.destinationPath('requirements_dev.txt'), sdeps.devRequirements.join('\n'));
  }
}

module.exports = Generator;
