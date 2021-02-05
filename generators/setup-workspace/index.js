'use strict';
const Base = require('yeoman-generator');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const RepoUtils = require('../../utils/RepoUtils');
const SpawnUtils = require('../../utils/SpawnUtils');
const WorkspaceUtils = require('../../utils/WorkspaceUtils');
const GeneratorUtils = require('../../utils/GeneratorUtils');
const {findDefaultApp} = require('../../utils/WorkspaceUtils');

function downloadFileImpl(url, dest) {
  const http = require(url.startsWith('https') ? 'https' : 'http');
  console.log(chalk.blue('Download file', url));
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    http.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', reject);
  });
}

function downloadDataUrl(url, dest) {
  if (!url.startsWith('http')) {
    url = `https://s3.eu-central-1.amazonaws.com/phovea-data-packages/${url}`;
  }
  return downloadFileImpl(url, dest);
}

function downloadBackupUrl(url, dest) {
  if (!url.startsWith('http')) {
    url = `https://s3.eu-central-1.amazonaws.com/phovea-volume-backups/${url}`;
  }
  return downloadFileImpl(url, dest);
}

function toDownloadName(url) {
  if (!url.startsWith('http')) {
    return url;
  }
  return url.substring(url.lastIndexOf('/') + 1);
}
class Generator extends Base {

  constructor(args, options) {
    super(args, options);

    this.option('ssh', {
      alias: 's',
      defaults: false,
      type: Boolean
    });

    this.option('branch', {
      alias: 'b',
      defaults: 'master',
      type: String
    });

    this.option('skip', {
      defaults: '',
      type: String
    });

    this.argument('product', {
      required: true
    });
  }

  initializing() {
    this.composeWith(['phovea:_check-own-version', 'phovea:check-node-version']);
  }

  prompting() {
    return this.prompt([{
      type: 'input',
      name: 'productName',
      message: 'Product',
      default: this.args.length > 0 ? this.args[0] : undefined,
      when: this.args.length === 0,
      validate: (d) => d.length > 0
    }, {
      type: 'confirm',
      name: 'cloneSSH',
      message: 'SSH clone',
      store: true,
      default: this.options.ssh,
      when: !this.options.ssh
    }]).then((props) => {
      this.productName = RepoUtils.toBaseName(props.productName || this.args[0]);
      this.cwd = RepoUtils.toCWD(this.productName);
      this.cloneSSH = props.cloneSSH || this.options.ssh;
    });
  }

  /**
   * Removes/renames files of the cloned product that conflict with the workspace files.
   */
  _removeUnnecessaryProductFiles() {
    if (fs.existsSync(this.cwd + '/.yo-rc.json')) {
      fs.unlinkSync(this.cwd + '/.yo-rc.json');
    }

    fs.rmdirSync(this.cwd + '/.git', { recursive: true });
    fs.renameSync(this.cwd + '/package.json', this.cwd + '/package_product.json');
  }

  /**
   * Copies/merges the template files of the product into the workspace.
   * @param {string} templatePath Path to the template directory of the product.
   */
  _copyProductTemplates(templatePath) {
    const dirs = fs.readdirSync(templatePath).filter(f => fs.statSync(path.join(templatePath, f)).isDirectory());
    dirs.forEach((dir) => fs.copySync(templatePath + '/' + dir, this.destinationPath(this.cwd)));
  }

  /**
   * Clones the product into the workspace and generates the `yo-rc-workspace.json` file.
   * @returns The parsed phovea_product.json file.
   */
  _getProduct() {
    return WorkspaceUtils.cloneRepo(this.productName, this.options.branch || 'master', null, '.', this.cwd, this.cloneSSH)
      .then(() => {
        this._removeUnnecessaryProductFiles();
        const phoveaProductJSON = `${this.cwd}/phovea_product.json`;
        if (!fs.existsSync(phoveaProductJSON)) {
          throw new Error('No phovea_product.json file found! Did you enter a valid phovea product repository?');
        }

        this.product = fs.readJSONSync(phoveaProductJSON);
        const defaultApp = findDefaultApp(this.product);
        this.defaultApp = defaultApp.name;

        this._createYoRcWorkspace(defaultApp);
        return RepoUtils.parsePhoveaProduct(this.product);
      });
  }

  /**
   * Generates `yo-rc-workspace.json` file
   * @param {string} defaultApp 
   */
  _createYoRcWorkspace(defaultApp) {
    const yoWorkspacePath = this.destinationPath(`${this.cwd}/.yo-rc-workspace.json`);
    if (!fs.existsSync(yoWorkspacePath && this.defaultApp)) {
      const frontendRepos = defaultApp.additionals;
      fs.writeJsonSync(yoWorkspacePath, {
        modules: [],
        defaultApp: this.defaultApp,
        frontendRepos,
        devRepos: [this.defaultApp]
      }, {spaces: 2});
    }
  }

  /**
   * Copies the generator's and the product's template files into the workspace.
   */
  _customizeWorkspace() {
    if (this.defaultApp) {
      this.fs.copyTpl(this.templatePath('start_defaultapp.tmpl.xml'), this.destinationPath(`${this.cwd}/.idea/runConfigurations/start_${this.defaultApp}.xml`), {
        defaultApp: this.defaultApp
      });
      this.fs.copyTpl(this.templatePath('lint_defaultapp.tmpl.xml'), this.destinationPath(`${this.cwd}/.idea/runConfigurations/lint_${this.defaultApp}.xml`), {
        defaultApp: this.defaultApp
      });
    }

    const productTemplatesPath = this.destinationPath(`${this.cwd}/templates`);
    if (fs.existsSync(productTemplatesPath)) {
      this._copyProductTemplates(productTemplatesPath);
    }
  }

  _downloadDataFile(desc, destDir) {
    if (typeof desc === 'string') {
      desc = {
        type: 'url',
        url: desc
      };
    }
    switch (desc.type) {
      case 'url':
        return downloadDataUrl(desc.url, path.join(destDir, toDownloadName(desc.url)));
      default:
        this.log(chalk.red('Cannot handle data type:', desc.type));
        return null;
    }
  }

  _downloadBackupFile(desc, destDir) {
    if (typeof desc === 'string') {
      desc = {
        type: 'url',
        url: desc
      };
    }
    switch (desc.type) {
      case 'url':
        return downloadBackupUrl(desc.url, path.join(destDir, toDownloadName(desc.url)));
      default:
        this.log(chalk.red('Cannot handle data type:', desc.type));
        return null;
    }
  }

  _downloadDataFiles() {
    const data = [];
    this.product.forEach((p) => {
      if (p.data) {
        data.push(...p.data);
      }
    });
    if (data.length === 0) {
      return Promise.resolve(null);
    }
    return GeneratorUtils.mkdir(this.cwd + '/_data')
      .then(() => Promise.all(data.map((d) => this._downloadDataFile(d, this.cwd + '/_data'))));
  }

  _downloadBackupFiles() {
    const data = [];
    this.product.forEach((p) => {
      if (p.backup) {
        data.push(...p.backup);
      }
    });
    if (data.length === 0) {
      return Promise.resolve(null);
    }
    return GeneratorUtils.mkdir(this.cwd + '/_backup')
      .then(() => Promise.all(data.map((d) => this._downloadBackupFile(d, this.cwd + '/_backup'))))
      .then(this._ifExecutable.bind(this, 'docker-compose', () => SpawnUtils.spawnOrAbort('./docker-backup', 'restore', this.cwd, true), 'please execute: "./docker-backup restore" manually'));
  }

  /**
   * Checks whether a command/cli tool is installed in the current system and executes provided command.
   * @param {string} cmd Cmd i.e, `docker-compose`.
   * @param {Function} ifExists Spawn this command if the cmd is executable.
   * @param {string} extraMessage Message to log if the cmd was not found.
   */
  _ifExecutable(cmd, ifExists, extraMessage = '') {
    const paths = process.env.PATH.split(path.delimiter);
    const pathExt = (process.env.PATHEXT || '').split(path.delimiter);

    const findIt = () => {
      for (const p of paths) {
        for (const ext of pathExt) {
          const fullPath = `${p}${path.sep}${cmd}${ext}`;
          if (fs.existsSync(fullPath)) {
            this.log(`found ${cmd} at ${fullPath}`);
            return true;
          }
        }
      }
      return false;
    };

    if (!findIt()) {
      this.log(chalk.red(`Error: ${cmd} not found${extraMessage}`));
      return Promise.resolve(null);
    }
    return ifExists();
  }

  /**
   * Runs `docker-compose build` if `docker-compose.yml` exists in the workspace and user has installed `dokcer-compose` cli.
   */
  _buildDockerCompose() {
    const file = this.fs.read(this.destinationPath(`${this.cwd}/docker-compose.yml`), {defaults: ''});
    const isNotEmpty = file.trim().length > 0;
    if (isNotEmpty && !this.options.skip.includes('build')) {
      return this._ifExecutable('docker-compose', () => SpawnUtils.spawnOrAbort('docker-compose', 'build', this.cwd, true), ' please run "docker-compose build" manually"');
    }

    return null;
  }

  writing() {
    this.hasErrors = false;

    return Promise.resolve(1)
      .then(GeneratorUtils.mkdir(this.cwd))
      .then(this._getProduct.bind(this))
      .then((repos) => Promise.all(repos.map((r) => WorkspaceUtils.cloneRepo(r.repo, r.branch, null, '', this.cwd, this.cloneSSH))))
      .then(() => GeneratorUtils.yo('workspace', {defaultApp: this.defaultApp, skipNextStepsLog: true}, null, this.cwd, this.env.adapter))
      .then(this._customizeWorkspace.bind(this))
      .then(this._downloadDataFiles.bind(this))
      .then(() => this.options.skip.includes('install') ? null : SpawnUtils.spawnOrAbort('npm', 'install', this.cwd, true))
      .then(this._downloadBackupFiles.bind(this))
      .then(this._buildDockerCompose.bind(this))
      .catch((msg) => {
        this.log('\r\n');
        this.log(chalk.red(msg));
        this.hasErrors = true;
      });
  }

  end() {
    if (this.hasErrors) {
      return; // skip next steps on errors
    }

    if (fs.existsSync(this.destinationPath('.yo-rc.json'))) {
      fs.unlinkSync(this.destinationPath('.yo-rc.json'));
    }

    let stepCounter = 1;

    this.log('\n\nNext steps: ');

    this.log(chalk.green((stepCounter++) + '. Switch to the created directory: '), chalk.yellow(`cd ${this.cwd}`));

    if (this.options.skip.includes('install')) {
      this.log(chalk.green((stepCounter++) + '. Install npm dependencies: '), chalk.yellow('npm install'));
    }

    if (this.options.skip.includes('build')) {
      this.log(chalk.green((stepCounter++) + '. Build docker containers: '), chalk.yellow('docker-compose build'));
    }

    this.log(chalk.green((stepCounter++) + '. Open IDE (PyCharm or Visual Studio Code, Atom) and select:'), this.destinationPath(this.cwd));
    this.log(chalk.green('   In case of Visual Studio Code, the following should also work: '), chalk.yellow('code .'));
    this.log(chalk.green((stepCounter++) + '. Start server docker container in the background (-d): '), chalk.yellow('docker-compose up -d'));
    this.log(chalk.green((stepCounter++) + '. Start client application in the foreground: '), chalk.yellow('npm start'));
    this.log(chalk.green((stepCounter++) + '. Open web browser and navigate to'), chalk.yellow('http://localhost:8080'));

    this.log('\n\nUseful commands: ');

    this.log(chalk.red(' docker-compose up'), '                    ... starts the system');
    this.log(chalk.red(' docker-compose restart'), '               ... restart');
    this.log(chalk.red(' docker-compose stop'), '                  ... stop');
    this.log(chalk.red(' docker-compose build api'), '             ... rebuild api (in case of new dependencies)');
    this.log(chalk.red(' docker-compose logs -f --tail=50 api'), ' ... show the last 50 server log messages (-f to auto update)');
  }
}

module.exports = Generator;
