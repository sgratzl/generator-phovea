'use strict';
const BasePluginGenerator = require('../../utils').Base;

class PluginGenerator extends BasePluginGenerator {

  initializing() {
    super.initializing();
    this.config.defaults({
      app: '',
      clientOnly: false,
      entries: {
        app: './src/index.ts'
      },
      libraries: ['d3'],
      modules: ['phovea_core', 'phovea_ui']
    });
  }

  prompting() {
    if (this.options.useDefaults) {
      return;
    }
    return this.prompt([{
      type: 'input',
      name: 'app',
      message: 'Application Title',
      default: this.config.get('name')
    }, {
      type: 'confirm',
      name: 'clientOnly',
      message: 'Client Only (no communication to the server)',
      default: this.config.get('clientOnly')
    }]).then((props) => {
      this.config.set('app', props.app);
      this.config.set('clientOnly', props.clientOnly);
    });
  }

  default() {
    super.default();
  }

  writing() {
    const config = this.config.getAll();
    this._patchPackageJSON(config, ['main']);
    this._writeTemplates(config, !this.options.noSamples);
  }

  end() {
    this.log('\n\nnext steps: ');
    this.log(chalk.yellow(' npm install'));
    this.log(chalk.yellow(` npm start`));
  }
}

module.exports = PluginGenerator;
