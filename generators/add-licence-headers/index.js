'use strict';
const fs = require('fs');
const Base = require('yeoman-generator').Base;
const chalk = require('chalk');

const defaultLicenceFileName = 'licence.txt';
const defaultLicencePath = `./${defaultLicenceFileName}`;

const supportedFileTypes = ['ts', 'py', 'scss'];

// const comments = {
//   ts: {
//     begin: '/*',
//     body: '*',
//     end: '*/'
//   },
//   py: {
//     begin: '#',
//     body: '#',
//     end: '#'
//   },
//   scss: {
//     begin: '/*',
//     body: '*',
//     end: '*/'
//   }
// };

function walkThroughFileSystem(directory, fileAction) {
  if (typeof fileAction !== 'function') {
    throw new Error('No file action provided!');
  }

  const contents = fs.readdirSync(directory);
  contents.forEach((element) => {
    const path = directory + '/' + element;
    if (isDirectory(path)) {
      walkThroughFileSystem(path, fileAction);
    } else {
      fileAction(path);
    }
  });
}

function isDirectory(path) {
  const stat = fs.statSync(path);
  return stat.isDirectory();
}

class Generator extends Base {
  constructor(args, options) {
    super(args, options);

    this.option('licencePath', {
      alias: 'l',
      default: defaultLicencePath,
      type: String,
      desc: `Relative path to a ${chalk.blue(defaultLicenceFileName)} file`
    });

    this.option('plugins', {
      alias: 'p',
      default: '',
      type: String,
      desc: 'Comma separated list (without spaces) of plugins to prepend the licence to'
    });

    this.option('excludedFileTypes', {
      alias: 'e',
      default: '',
      type: String,
      desc: 'Comma separated list (without spaces) to exclude specific file types (e.g. only add to .ts files by excluding .scss and .py)'
    });
  }

  initializing() {
    this.plugins = this._readAvailablePlugins();
  }

  prompting() {
    return this.prompt([
      {
        type: 'input',
        name: 'licencePath',
        message: `Please enter the relative path to the ${chalk.blue(defaultLicenceFileName)} file`,
        when: this.options.licencePath === defaultLicencePath
      },
      {
        type: 'checkbox',
        name: 'plugins',
        message: 'Please select the plugins to add licence headers',
        choices: this.plugins,
        when: this.options.plugins.length === 0
      },
      {
        type: 'checkbox',
        name: 'excludedFileTypes',
        message: 'Exclude file types from adding headers',
        choices: supportedFileTypes,
        when: this.options.excludedFileTypes.length === 0
      }
    ]).then((props) => {
      this.licencePath = props.licencePath || this.options.licencePath;
      this.plugins = props.plugins || this.options.plugins.split(',');
      this.excludedFileTypes = props.excludedFileTypes || this.options.excludedFileTypes.split(',');

      if (this.plugins.length === 0) {
        throw new Error('No plugins given. Run the generator with the -h option to see the manual.');
      }
      this._readLicenceFile();
    }).catch((err) => this.log(err));
  }

  _readLicenceFile() {
    try {
      this.licenceText = fs.readFileSync(this.licencePath).toString();
    } catch (e) {
      this.log(e);
    }
  }

  writing() {
    const pluginName = this.plugins[0];

    const sourceFolders = this._getSourceFolders(pluginName);

    if (sourceFolders.length === 0) {
      return;
    }

    const action = (path) => {
      const fileExtension = path.split('.').pop();
      console.log('Extension: ', fileExtension);
    };

    sourceFolders.forEach((folderName) => {
      walkThroughFileSystem(this.destinationPath(pluginName, folderName), action);
    });
  }

  _getSourceFolders(pluginName) {
    const currentPluginConfig = JSON.parse(fs.readFileSync(this.destinationPath(pluginName + '/.yo-rc.json')));
    const pluginType = currentPluginConfig['generator-phovea'].type;

    if (pluginType.length === 0) {
      return;
    }

    switch (pluginType) {
      case 'app':
      case 'lib':
        return ['src'];
      case 'slib':
        return [pluginName];
      case 'lib-slib':
      case 'app-slib':
        return ['src', pluginName];
      default:
        return [];
    }
  }

  /**
   * read workspace contents and only return plugins
   * @private
   */
  _readAvailablePlugins() {
    const folderContents = fs.readdirSync(this.destinationPath());
    return folderContents
      .filter((element) => {
        return isDirectory(this.destinationPath(element)) && // the element is a directory
          element !== 'node_modules' && // the element is not the node_modules folder
          !element.startsWith('_') && // the element does not start with "_" (e.g. _data, ...)
          !element.startsWith('.') && // the element is not a hidden directory
          fs.existsSync(this.destinationPath(element, 'phovea.js')); // the element (directory) contains a phovea.js file
      });
  }
}

module.exports = Generator;