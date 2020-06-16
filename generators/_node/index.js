'use strict';
const _ = require('lodash');
const parseAuthor = require('parse-author');
const Base = require('yeoman-generator');
const patchPackageJSON = require('../../utils').patchPackageJSON;
const originUrl = require('git-remote-origin-url');
const fs = require('fs-extra');

// based on https://github.com/yeoman/generator-node/blob/master/generators/app/index.js

class PackageJSONGenerator extends Base {

  constructor(args, options) {
    super(args, options);

    // readme content
    this.option('readme');
    this.option('longDescription');
    this.option('useDefaults');
    this.isWorkspace = this.options.isWorkspace;
  }

  initializing() {
    const pkg = this.isWorkspace ? {} : this.fs.readJSON(this.destinationPath('package.json'), {});

    this.props = {
      description: this.options.description || pkg.description || '',
      homepage: this.options.homepage || pkg.homepage || 'https://phovea.caleydo.org',
      authorEmail: this.options.authorEmail || this.user.git.email(),
      authorUrl: this.options.authorUrl || '',
      version: pkg.version || '1.0.0-SNAPSHOT'
    };

    let authorName = this.user.git.name() || 'Caleydo Team';
    if (_.isObject(pkg.author)) {
      authorName = pkg.author.name;
      this.props.authorEmail = pkg.author.email;
      this.props.authorUrl = pkg.author.url;
    } else if (_.isString(pkg.author)) {
      let info = parseAuthor(pkg.author);
      authorName = info.name;
      this.props.authorEmail = info.email;
      this.props.authorUrl = info.url;
    }

    this.config.defaults({
      name: pkg.name || this.determineAppname(),
      author: authorName,
      today: (new Date()).toUTCString(),
      githubAccount: this.github ? this.github.username() : 'phovea'
    });
    this.originUrl = '';
    if (!this.options.useDefaults) {
      return originUrl(this.destinationPath()).then((url) => {
        this.originUrl = url;
      }, () => {}); // ignore errors
    }
  }

  _promptForName() {
    if (this.options.useDefaults) {
      return Promise.resolve(null);
    }
    return this.prompt([{
      name: 'name',
      message: 'Plugin Name',
      default: this.isWorkspace ? null : this.config.get('name'), // avoid using the directory name of the workspace as default when initializing a plugin from the workspace.
      validate: this._hasNoWhitespace, // check if plugin name has no white space between
      filter: (name) => name.trim() // filter white space around plugin name
    }]).then((props) => {
      this.config.set('name', props.name);
    });
  }

  /**
   * Check if string is one continuous word with no spaces
   * i.e _hasNoWhiteSpace('my app')--> false
   * @param {string} string
   * @returns {boolean|string} Returns true if the given string does not contain white spaces. Otherwise it returns an error message string.
   */
  _hasNoWhitespace(string) {
    return string.trim().indexOf(' ') === -1 || 'The plugin name must not contain whitespace. Please use a dash (-) or an underscore (_) as separator.';
  }

  _promptDescription() {
    return this.prompt([{
      name: 'description',
      message: 'Description',
      default: this.props.description,
      when: !this.options.useDefaults
    }, {
      name: 'homepage',
      message: 'Project homepage url',
      default: this.props.homepage,
      when: !this.options.useDefaults
    }, {
      name: 'authorName',
      message: 'Author\'s Name',
      default: this.config.get('author'),
      store: true,
      when: !this.options.useDefaults
    }, {
      name: 'authorEmail',
      message: 'Author\'s Email',
      default: this.props.authorEmail,
      store: true,
      when: !this.options.useDefaults
    }, {
      name: 'authorUrl',
      message: 'Author\'s Homepage',
      default: this.props.authorUrl,
      store: true,
      when: !this.options.useDefaults
    }, {
      name: 'githubAccount',
      message: 'GitHub username or organization',
      default: this.config.get('githubAccount'),
      store: true,
      when: !this.options.useDefaults
    }]).then((props) => {
      if (!this.options.useDefaults) {
        this.props.description = props.description;
        this.config.set('description', props.description);
        this.props.homepage = props.homepage;
        this.config.set('author', props.authorName);
        this.props.authorEmail = props.authorEmail;
        this.props.authorUrl = props.authorUrl;
        this.config.set('githubAccount', props.githubAccount);
      }
    });
  }

  prompting() {
    return this._promptForName().then(() => this._promptDescription());
  }

  writing() {
    const config = _.extend({}, this.props, this.config.getAll());
    this.cwd = this.isWorkspace ? (config.cwd || config.name) + '/' : ''; // use config.cwd for init-app or init-service generators and config.name for the rest.
    if (this.originUrl) {
      config.repository = this.originUrl;
    } else {
      config.repository = `https://github.com/${config.githubAccount}/${config.name}.git`;
    }
    patchPackageJSON.call(this, config, null, null, null, this.cwd);

    config.content = this.options.readme || '';
    config.longDescription = this.options.longDescription || this.props.description || '';
    this.fs.copyTpl(this.templatePath('README.tmpl.md'), this.destinationPath(this.cwd + 'README.md'), config);

    const includeDot = {
      globOptions: {
        dot: true
      }
    };
    this.fs.copy(this.templatePath('plain/**/*'), this.destinationPath(this.cwd), includeDot);
  }

  /**
   * When initializing a plugin from the workspace the `.yo-rc.json` config file is saved in the workspace.
   * Therefore copy the file into the the new created plugin subdirectory and delete it from the workspace.
   */
  _moveConfigFile() {
    const currentPosition = this.destinationPath('.yo-rc.json');
    const targetPosition = this.destinationPath(this.cwd + '.yo-rc.json');
    if (fs.existsSync(currentPosition)) {
      this.fs.copy(currentPosition, targetPosition);
      this.fs.delete(currentPosition);
    }
  }

  end() {
    this.spawnCommandSync('git', ['init'], {
      cwd: this.destinationPath(this.cwd)
    });

    // after all the files have been written move the config file from the workspace to the plugin subdirectory
    if (this.isWorkspace) {
      this._moveConfigFile();
    }
  }
}

module.exports = PackageJSONGenerator;
