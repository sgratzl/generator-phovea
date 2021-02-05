/**
 * Created by Samuel Gratzl on 28.11.2016.
 */
const WorkspaceUtils = require('../../utils/WorkspaceUtils');
const chalk = require('chalk');
const fs = require('fs');
const BasePhoveaGenerator = require('../../base/BasePhoveaGenerator');

const isRequired = (v) => v.toString().length > 0;

class Generator extends BasePhoveaGenerator {

  initializing() {
    if (fs.existsSync(this.destinationPath('.yo-rc-workspace.json'))) {
      throw new Error(chalk.red('Found a ".yo-rc-workspace.json" file in the current directory. Please initialize a new product in an empty directory.'));
    }
    this.services = {};

    // for the update
    this.config.defaults({
      type: 'product'
    });

    this.composeWith('phovea:_node', {
      options: this.options
    });
  }

  _addCustomAdditional(service) {
    return this.prompt([{
      name: 'name',
      message: 'plugin name:',
      validate: isRequired
    }, {
      name: 'repo',
      message: 'repository (<githubAccount>/<repo>):',
      default: (act) => `Caleydo/${act.name}`,
      validate: isRequired
    }, {
      name: 'branch',
      message: 'repository branch (master) or tag (tags/v1.0.0): ',
      default: 'master',
      validate: isRequired
    }, {
      name: 'custom',
      type: 'confirm',
      message: 'add another custom additional plugin?: ',
      default: false
    }]).then((extra) => {
      service.additionals[extra.name] = {repo: extra.repo, branch: extra.branch};
      const custom = extra.custom === true;
      delete extra.custom;
      return custom ? this._addCustomAdditional(service) : Promise.resolve(service);
    });
  }

  _addService() {
    return this.prompt([{
      type: 'list',
      name: 'type',
      message: 'service type:',
      choices: [
        {name: 'Web', value: 'web'},
        {name: 'Web without Rest-API connection', value: 'static'},
        {name: 'Rest-API', value: 'api'},
        {name: 'Service', value: 'service'}],
      default: 'web'
    }, {
      name: 'name',
      message: 'service name:',
      validate: isRequired
    }, {
      name: 'repo',
      message: 'primary repository (<githubAccount>/<repo>):',
      default: (act) => act.type === 'api' ? 'phovea/phovea_server' : null,
      validate: isRequired
    }, {
      name: 'branch',
      message: 'primary repository branch (master) or tag (tags/v1.0.0): ',
      default: 'master',
      validate: isRequired
    }, {
      name: 'additional',
      type: 'checkbox',
      message: 'additional plugins: ',
      choices: (act) => WorkspaceUtils.buildPossibleAdditionalPlugins(act.type)
    }, {
      name: 'custom',
      type: 'confirm',
      message: 'add custom additional plugin?',
      default: false
    }]).then((service) => {
      this.services[service.name] =  {type: service.type, repo: service.repo, branch: service.branch };
      const custom = service.custom === true;
      delete service.custom;
      this.services[service.name].additionals = service.additional.reduce((obj, item) => Object.assign(obj,item), {});
      return custom ? this._addCustomAdditional(this.services[service.name]) : Promise.resolve(service);
    }).then(() => this.prompt({
      name: 'custom',
      type: 'confirm',
      message: 'add another service?: ',
      default: false
    })).then((sel) => sel.custom ? this._addService() : Promise.resolve(this.services));
  }

  default() {
    if (this.options.useDefaults) {
      return;
    }
    return this._addService();
  }

  writing() {
    const config = this.config.getAll();
    this._patchPackageJSON.call(this, config);
    this._writeTemplates.call(this, config);
    this.fs.copy(this.templatePath('_gitignore'), this.destinationPath('.gitignore'));
    // don't overwrite existing registry file
    if (!fs.existsSync(this.destinationPath('phovea_product.json'))) {
      this.fs.writeJSON(this.destinationPath('phovea_product.json'), this.services);
    }
  }

  end() {
    this.log('\n\nuseful commands: ');
    this.log(chalk.yellow(' npm run build'), '             ... regular build');
    this.log(chalk.yellow(' node build.js --skipTests'), ' ... skip tests');
    this.log(chalk.yellow(' node build.js --quiet'), '     ... reduce log output');

    this.log('\n\nnext steps: ');
    this.log(chalk.yellow(' npm install'));
    this.log(chalk.yellow(' npm run build'));
  }
}

module.exports = Generator;
