'use strict';
const Base = require('yeoman-generator').Base;
const glob = require('glob').sync;
const resolve = require('path').resolve;


class Generator extends Base {

  initializing() {
    this.props = {
      guestIp: '192.168.50.52',
      hostPort: 9000
    };
  }

  _generateScripts() {
    const files = glob('*/requirements.txt', {
      cwd: this.destinationPath()
    });
    const plugins = files.map(path.dirname);

    var scripts = {};

    plugins.forEach((p) => {
      const pkg = this.fs.readJSON(this.destinationPath(p + '/package.json'));
      // vagrantify commands

      // no pre post test tasks
      Object.keys(pkg.scripts).filter((s) => !/^(pre|post).*/g.test(s)).forEach((s) => {
        // generate scoped tasks
        let cmd = `${resolve('./withinEnv')} 'cd /vagrant/${p} && npm run ${s}'`;
        if (/^(start|watch)/g.test(s)) {
          //special case for start to have the right working directory
          let fixedscript = pkg.scripts[s].replace(/__main__\.py/, p);
          cmd = `${resolve('./withinEnv')} 'cd /vagrant && ${fixedscript}'`;
        }
        scripts[`${s}:${p}`] = cmd;
      });
    });

    return {
      scripts: scripts
    };
  }

  writing() {
    const config = this.props;
    const includeDot = {
      globOptions: {
        dot: true
      }
    };
    this.fs.copy(this.templatePath('plain/**/*'), this.destinationPath(), includeDot);
    this.fs.copyTpl(this.templatePath('processed/**/*'), this.destinationPath(), config, includeDot);

    const scripts = this._generateScripts();
    this.fs.extendJSON(this.destinationPath('package.json'), scripts);
  }

  install() {

  }
}

module.exports = Generator;
