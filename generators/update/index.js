'use strict';
const Base = require('yeoman-generator').Base;

function extractFromReadme(content) {
  const safe = (p) => p ? p[1] : '';
  // between header and installation
  const longDescription = safe(content.match(/=====$\s([\s\S]*)^Installation/m)).trim();
  // usage till end line
  const readme = safe(content.match(/(^Usage[\s\S]*)^\*\*\*$/m)).trim();

  return {longDescription, readme};
}

function toPhoveaName(name) {
  return name.replace(/^caleydo_/, 'phovea_');
}

function toExtension(name, desc) {
  const copy = _.merge({}, desc);
  delete copy.type;
  delete copy.id;
  delete copy.file;
  return {
    type: desc.type,
    id: desc.id || name,
    module: desc.file || '',
    extras: copy
  };
}

class Generator extends Base {

  initializing() {
    this.isWorkspace = this.fs.exists(this.destinationPath('.yo-rc-workspace.json'));

    if (!this.isWorkspace) {
      this._initializingPlugin();
    }
  }

  _initializingPlugin() {
    const pkg = this.fs.readJSON(this.destinationPath('package.json'));

    const {longDescription, readme} = extractFromReadme(this.fs.read(this.destinationPath('README.md')));

    // migrate type
    const type = this.config.get('type');
    if (type === 'server') {
      this.config.set('type', 'slib');
    } else if (type === 'app-server') {
      this.config.set('type', 'app-slib');
    } else if (type === 'lib-server') {
      this.config.set('type', 'lib-slib');
    }

    this.props = {
      useDefaults: true,
      noSamples: true,
      description: (pkg.description || ''),
      longDescription: longDescription,
      readme: readme
    };
  }

  default() {
    if (this.isWorkspace) {
      this.composeWith(`phovea:workspace`, {}, {
        local: require.resolve(`../workspace`)
      });
    } else {
      const type = this.config.get('type');
      this.composeWith(`phovea:init-${type}`, {
        options: this.props
      }, {
        local: require.resolve(`../init-${type}`)
      });
    }
  }
}

module.exports = Generator;
