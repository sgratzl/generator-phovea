'use strict';
const fs = require('fs');
const Base = require('yeoman-generator').Base;
const chalk = require('chalk');

const defaultLicenceFileName = 'licence.txt';
const defaultLicencePath = `./${defaultLicenceFileName}`;

const comments = {
  ts: {
    begin: '/*',
    body: '*',
    end: '*/',
    aligningSpaces: 1
  },
  py: {
    begin: '#',
    body: '#',
    end: '#',
    aligningSpaces: 0
  },
  scss: {
    begin: '/*',
    body: '*',
    end: '*/',
    aligningSpaces: 1
  }
};

/**
 * walk through file system recursively and execute the fileAction whenever a file is encountered
 * @param currentDirectoryPath string
 * @param fileAction function
 */
function walkThroughFileSystem(currentDirectoryPath, fileAction) {
  if (typeof fileAction !== 'function') {
    throw new Error('No file action provided!');
  }

  // read folder contents
  const contents = fs.readdirSync(currentDirectoryPath);

  contents.forEach((element) => {
    // append the current element to the path and check whether it's a directory or not
    const newPath = currentDirectoryPath + '/' + element;
    if (isDirectory(newPath)) {
      // if a directory is encountered, walk deeper
      walkThroughFileSystem(newPath, fileAction);
    } else {
      // else execute the file action
      fileAction(newPath);
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

    this.comments = {};

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
        choices: Object.keys(comments),
        when: this.options.excludedFileTypes.length === 0
      }
    ]).then((props) => {
      this.licencePath = props.licencePath || this.options.licencePath;
      this.plugins = props.plugins || this.options.plugins.split(',');
      this.excludedFileTypes = props.excludedFileTypes || this.options.excludedFileTypes.split(',');

      if (this.plugins.length === 0) {
        throw new Error('No plugins given. Run the generator with the -h option to see the manual.');
      }
      // TODO: How to abort the generator correctly?
      return this._readLicenceFile();
    }).catch((err) => this.log(err));
  }

  writing() {
    this._generateComments();

    const action = (path) => {
      const fileExtension = path.split('.').pop();
      if (!Object.keys(comments).includes(fileExtension) || this.excludedFileTypes.includes(fileExtension)) {
        return;
      }
      const fileContents = this.fs.read(path);

      // TODO: override any comment if the file starts with one (e.g. when the licence changes)
      // whenever a file starts with our licence header skip for now
      if (fileContents.startsWith(this.comments[fileExtension])) {
        return;
      }

      const newContents = this.comments[fileExtension] + '\n\n' + fileContents;
      this.fs.write(path, newContents);
    };

    try {
      this.plugins.forEach((pluginName) => {
        const sourceFolders = this._getSourceFolders(pluginName);

        if (sourceFolders.length === 0) {
          return;
        }

        sourceFolders.forEach((folderName) => {
          walkThroughFileSystem(this.destinationPath(pluginName, folderName), action);
        });
      });
    } catch (e) {
      this.log(e);
    }
  }

  _readLicenceFile() {
    try {
      this.licenceText = fs.readFileSync(this.licencePath).toString();
    } catch (e) {
      return this._abort(e);
    }
  }

  _generateComments() {
    // get maximum line length by looping through all lines, returning the line length and passing them to Math.max
    const lineArray = this.licenceText.split('\n');
    const maxLineLength = Math.max(...lineArray.map((line) => line.length));

    const align = (string, threshold, timesSpaces) => {
      if (!timesSpaces) {
        timesSpaces = threshold;
      }

      if (string.length > threshold) {
        return ' '.repeat(timesSpaces);
      }
      return '';
    };

    Object.keys(comments).forEach((fileType) => {
      const commentStyle = comments[fileType];
      let comment = commentStyle.begin + commentStyle.body.repeat(maxLineLength) + '\n';
      lineArray.forEach((line) => {
        // only add a space character when the opening comment contains more than one charcters (e.g. to align the asterisks in .ts files vs. aligning the hashes in .py files)
        comment += align(commentStyle.begin, commentStyle.aligningSpaces);
        comment += `${commentStyle.body}${align(line, 0, 1) + line}\n`;
      });

      comment += align(commentStyle.begin, commentStyle.aligningSpaces);
      comment += `${commentStyle.body.repeat(maxLineLength)}${commentStyle.end}`;
      this.comments[fileType] = comment;
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

  _abort(msg) {
    console.log('ABORTING');
    return Promise.reject(msg ? msg : 'Step Failed: Aborting');
  }
}

module.exports = Generator;
