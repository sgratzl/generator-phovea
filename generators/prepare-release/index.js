'use strict';
const Base = require('yeoman-generator');
const chalk = require('chalk');
const fs = require('fs-extra');
var rp = require('request-promise');
const semver = require('semver');
const {parseRequirements} = require('../../utils/pip');
const logSymbols = require('log-symbols');
const {failed} = require('../../utils/release');


class Release extends Base {

  constructor(args, options) {
    super(args, options);
  }

  /**
   * Spawn command and return the output. `This.spawnCommandSync()` doesn't return output by default.
   * @param {string} command Command to execute, i.e, `git`.
   * @param {string[]} flags Flags to run the command with, i.e, `['checkout','develop']`
   */
  _spawnOnHost(command, flags) {
    const options = {
      stdio: ['inherit', 'pipe', 'pipe'] // pipe `stdout` and `stderr` to host process
    };
    return this.spawnCommandSync(command, flags, options).stdout.toString().trim(); // git log returns extra spaces
  }

   initializing() {
    this.repository = this._getRepositoryName();
    if (this._isNotDevelopBranch()) {
      throw new Error(`${logSymbols.error} ${chalk.red('Current branch is not develop. Please switch to develop branch.')} `);
    } else if (this._notValidRepository()) {
      throw new Error(`${logSymbols.error} ${chalk.red('File .yo-rc.json not found.')} `);
    }
    this.organization = this._getOrganization();
    this.baseName = `${this.organization}/${this.repository}`;
    return this._getAccessTokens();
  }

  _getAccessTokens() {
    return this.prompt([
      {
        type: "password",
        name: "datavisyn",
        message: `Enter the github ${chalk.underline('datavisyn-bot')} access token`,
        store: true,
        mask: true,
        validate: ((d) => d.length === 40)
      },
      {
        type: "password",
        name: "caleydo",
        message: `Enter the github ${chalk.underline('caleydo-bot')} access token`,
        default: this.config.get('caleydo'),
        store: true,
        mask: true,
        validate: ((d) => d.length === 40)
      }
    ]).then(({datavisyn, caleydo}) => {
      this.datavisyn = {name: 'datavisyn-bot', token: datavisyn};
      this.caleydo = {name: 'caleydo-bot', token: caleydo};
      this.token = this._isDatavisynRepo(this.organization) ? this.datavisyn : this.caleydo;
    });
  }

  _isDatavisynRepo(org) {
    return org === 'datavisyn';
  }

  /**
   * Read the name of the package from `package.json`.
   */
  _getRepositoryName() {
    const {name} = this.fs.readJSON('package.json');
    return name;
  }

  /**
   * Read the url of the package and parse it to get the github organization, i.e, `phovea`, or `caleydo`,`datavisyn`.
   */
  _getOrganization() {
    const {repository} = this.fs.readJSON('package.json');
    // const regex = new RegExp(`https:\/\/github.com\/(.*)\/${this.repository}`); // parse organization link to get organization, i.e, `phovea`
    const regex = /datavisyn|phovea|caleydo/;
    return repository.url.toLowerCase().match(regex)[0];
  }

  /**
   * Check that the current branch is not the develop branch.
   */
  _isNotDevelopBranch() {
    return this._spawnOnHost('git', ['rev-parse', '--abbrev-ref', 'HEAD']) !== 'develop';
  }

  /**
   * Check that the current directory has no `.yo-rc.json` file.
   */
  _notValidRepository() {
    return !fs.existsSync('.yo-rc.json');
  }

  /**
   * Read dependencies, filter out third party ones and get their latest versions.
   * @param {}knownDeps datavisyn, caleydo
   */
  async _prepareDependencies(knownDeps, dependencies) {
    this.log(logSymbols.info, chalk.bold('Calculating dependencies...'));
    const formatted = knownDeps.map((dep) => {
      return {name: dep, org: this._getDependencyOrg(dep, dependencies[dep]), originalVersion: dependencies[dep]};
    });
    this.dependencies = await this._getDependenciesVersion(formatted);
    return Promise.resolve(this.dependencies);
  }

  /**
   * Parse dependency's version and get the github organization.
   * Example: `github:datavisyn/tdp_core#develop` -->`datavisyn`.
   * @param {string} dependencyName Name of the dependency.
   * @param {*} versionString Version string to be parsed.
   */
  _getDependencyOrg(dependencyName, versionString) {
    const regex = new RegExp(`github:(.*)\/${dependencyName}`);
    return versionString.match(regex)[1];
  }

  /**
   * Check if dependency has `datavisyn`,`caleydo`,`phovea` in it's version string.
   * @param {string} versionString Version as read from pkg.json.
   */
  _isKnownDependency(versionString) {
    versionString = versionString.toLowerCase();
    return versionString.includes('phovea') || versionString.includes('caleydo') || versionString.includes('datavisyn');
  }

  /**
   * @typedef {Object} Dependency
   * @property {string} name Name of dependency.
   * @property {string} org Organization.
   * @property {string} originalVersion Dependency's version as read from pkg.json.
   * @property {string} version Dependency's latest github/npm version.
   */

  /**
   * Get latest version from `npm` if it is published.
   * Get it from github if not.
   * @param {Object<string,string>[]} dependencies Non third party dependencies
   * @returns {Promise<Dependency[]>}
   */
  _getDependenciesVersion(dependencies) {
    return Promise.all(dependencies.map((dependency) => {
      const npmVersion = this._spawnOnHost('npm', ['view', dependency.name, 'version']);
      if (npmVersion) {
        dependency.rawVersion = npmVersion;
        dependency.version = '^' + npmVersion;
        return Promise.resolve(dependency);
      } else {
        const token = this._isDatavisynRepo(dependency.org) ? this.datavisyn : null; // phovea and caleydo repositories are public. No token necessary.
        return this._getGithubVersion(dependency, token).then((version) => {
          dependency.rawVersion = version.replace('v', '');
          dependency.version = `github:${dependency.org}/${dependency.name}#semver:^${version.replace('v', '')}`;
          return dependency;
        });
      }
    }));
  }

  /**
   * Get latest version of repo from github.
   * @param {Object<string,string>} dependency
   */
  _getGithubVersion(dependency, token) {
    const authString = token ? `${token.name}:${token.token}@` : '';
    const options = {
      url: `https://${authString}api.github.com/repos/${dependency.org}/${dependency.name}/releases/latest`,
      headers: {
        'User-Agent': 'request'
      }
    };
    return rp(options).then((d) => JSON.parse(d).name);
  }

  /**
   *  Filter out third party dependencies.
   * @param {Object<string,string>} dependencies
   * @returns {string[]}
   */
  _knownDependencies(dependencies) {
    if (dependencies) {
      return Object.keys(dependencies).filter((dep) => this._isKnownDependency(dependencies[dep]));
    }
  }

  _writeDependencies(updatedDeps, pkg) {
    Object.keys(updatedDeps).forEach((dep) => {
      pkg.dependencies[dep] = updatedDeps[dep];
    });
    this.pkg = pkg;
    return Promise.resolve().then(() => fs.writeJsonSync(`package.json`, this.pkg, {spaces: 2}));
  }
  _toObject(deps) {
    return deps.reduce((acc, dep) => (acc[dep.name] = dep.version, acc), {});
  }

  _confirmDependencies(dependencies) {
    this._logDependencies(dependencies);
    return this.prompt([
      {
        type: 'confirm',
        name: 'confirmDeps',
        message: `Press ${chalk.cyan('Enter')} to confirm changes. Type ${chalk.cyan('No')} and press ${chalk.cyan('Enter')} to open visual studio code and edit package.json.`,
      }]).then(({confirmDeps}) => {
        if (confirmDeps) {
          return confirmDeps;
        }
        this.spawnCommandSync('code', ['package.json']);
        return Promise.resolve();
      }).then((confirmDeps) => {
        return this.prompt([
          {
            type: 'confirm',
            name: 'saved',
            message: 'Saved changes?',
            when: !confirmDeps,
          }]);
      });
  }

  _logDependencies(dependencies) {
    this.log(chalk.bold('The dependencies in package.json have been updated: \n'));
    this.log((dependencies.map((d) => chalk.red.bold('- ') + chalk.red(`${d.name}: ${d.originalVersion}`) + '\n' + chalk.green.bold('+ ') + chalk.green(`${d.name}: ${d.version}`)).join('\n')) + '\n');
  }

  /**
   * Run these steps only if `package.json` contains `phovea`, `caleydo`, `datavisyn` dependencies
   */
  _runForFrontend() {
    const pkg = this.fs.readJSON('package.json');
    const {dependencies} = pkg;
    if (dependencies) {
      const knownDeps = this._knownDependencies(dependencies);
      if (knownDeps) {
        return Promise.resolve()
          .then(() => this._prepareDependencies(knownDeps, dependencies))
          .then((updatedDeps) => this._writeDependencies(this._toObject(updatedDeps), pkg))
          .then(() => this._confirmDependencies(this.dependencies));
      }
    }

    return Promise.resolve();
  }

  /**
   * Run these steps only if requirements.txt contains `phovea`, `caleydo`, `datavisyn` dependencies.
   */
  _runForBackend() {
    if (fs.existsSync('requirements.txt')) {
      const requirements = parseRequirements(this.fs.read('requirements.txt')); // parsed to object requirements
      const knownRequirements = Object.keys(requirements).filter((req) => this._isKnownDependency(req));
      const rest = Object.keys(requirements).filter((req) => !this._isKnownDependency(req)).map((r) => {return [r] + requirements[r];});
      if (knownRequirements && knownRequirements.length) {
        return Promise.resolve()
          .then(() => this._prepareRequirements(knownRequirements, requirements))
          .then((reqs) => this._writeRequirements(reqs.map((req) => req.version), rest))
          .then(() => this._confirmRequirements(this.requirements));
      }
    }
    return Promise.resolve();
  }

  _logRequirements(requirements) {
    this.log(chalk.bold('The requirements in requirements.tx have been updated: \n'));
    this.log((requirements.map((d) => chalk.red('- ') + chalk.red(d.raw + d.originalVersion) + '\n' + chalk.green.bold('+ ') + chalk.green(d.version) + '\n').join('\n')) + '\n');
  }

  _confirmRequirements(requirements) {
    this._logRequirements(requirements);
    return this.prompt([
      {
        type: 'confirm',
        name: 'confirmReqs',
        message: `Press ${chalk.cyan('Enter')} to confirm changes. Type ${chalk.cyan('No')} and press ${chalk.cyan('Enter')} to open visual studio code and edit requirements.txt.`,
      }]).then(({confirmReqs}) => {
        if (confirmReqs) {
          return confirmReqs;
        }
        this.spawnCommandSync('code', ['requirements.txt']);
        return Promise.resolve();
      }).then((confirmReqs) => {
        return this.prompt([
          {
            type: 'confirm',
            name: 'saved',
            message: 'Saved changes?',
            when: !confirmReqs,
          }]);
      });
  }

  _writeRequirements(known, rest) {
    return Promise.resolve(1).then(() => fs.writeFileSync('requirements.txt', [...known, ...rest].join('\n')));
  }

  async _prepareRequirements(known, requirements) {
    this.log(logSymbols.info, chalk.bold('Calculating requirements... '));
    return this.requirements = await Promise.all(known.map(async (d) => {
      const regex = /datavisyn|phovea|caleydo/;
      const org = d.match(regex)[0];
      const name = this._parsePyPiVersion(d, org);
      const token = this._isDatavisynRepo(org) ? this.datavisyn : null;

      const version = await this._getRequirementVersion(name, d, org, token);

      return {
        raw: d,
        org,
        name,
        originalVersion: requirements[d],
        version: version.version,
        rawVersion: version.rawVersion,
        token
      };
    }));
  }

  _parsePyPiVersion(versionString, org) {
    const regex = new RegExp(`${org}/(.*).git`);
    return versionString.match(regex)[1];
  }

  _getPyPiVersion(name) {
    const options = {
      url: `https://pypi.org/pypi/${name.replace('_', '-')}/json`,
    };
    return rp(options)
      .then((d) => JSON.parse(d)).then(({info}) => info.version);
  }

  _getRequirementVersion(name, raw, org, token) {
    return this._getPyPiVersion(name)
      .then((version) => {
        return {rawVersion: version, version: `${name}>=${version},<${semver.valid(semver.coerce(parseInt(version) + 1))}`};
      }).catch(async () => {
        const version = await this._getGithubVersion({name, org}, token);
        return {rawVersion: version, version: `${raw}@${version}#egg=${name}`};
      });
  }

  /**
   * Generate release notes from the Pull Request merged into the develop branch
   * using the `git log` command.
   */
  _collectReleaseNotes() {
    const pullRequestsDescriptions = this._spawnOnHost('git', ['log', 'origin/master..develop', '--merges', '--pretty=format:"%s']).split('\n');
    const pullRequestsTitles = this._spawnOnHost('git', ['log', 'origin/master..develop', '--merges', '--pretty=format:"%b']).split('\n');
    const pullRequestsNumbers = this._extractPullRequestsNumbers(pullRequestsDescriptions);
    this.releaseNotes = this._formatReleaseNotes(pullRequestsTitles, pullRequestsNumbers, `${this.organization}/${this.repository}`);
    return Promise.resolve(this.releaseNotes);
  }

  /**
   * Format the Pull Request to the template `Update requirements.txt (phovea/phovea_server#22)`
   * @param {string []} pullRequestsTitles Array containing the Pull Requests title.
   * @param {string []} pullRequestsNumbers Array containing the Pull Requests descriptions.
   * @param {*} repo Current repository , i.e., phovea/phovea_server
   */
  _formatReleaseNotes(pullRequestsTitles, pullRequestsNumbers, repo) {
    const title = pullRequestsTitles.filter((title) => title.trim() && title.trim().length > 2) // remove empty strings and invalid titles
      .map((message) => message.replace('"', '')); // `git log` creates extra newline characters and quotes
    return title.map((t, i) => `* ${t} (${repo}#${pullRequestsNumbers[i]})`).join('\n');
  }

  // /**
  //  * Extract Numbers from Pull Requests titles.
  //  * @param {string []} pullRequests
  //  */
  _extractPullRequestsNumbers(pullRequestsDescriptions) {
    return this.issueNumbers = pullRequestsDescriptions
      .map((description) => {
        const number = /(?:#)(\d+)/g.exec(description); // match number that comes after `#`
        return number ? number[1] : null;
      })
      .filter((number) => number != null); // filter empty values
  }


  _hasMajorReleasedDependency() {
    const dependencies = this.dependencies || [];
    const requirements = this.requirements || [];
    return [...dependencies, ...requirements].some((dep) => semver.minor(dep.rawVersion) === 0 && semver.patch(dep.rawVersion) === 0);
  }

  /**
   * Calculate if release is `major`,`minor`,`patch`.
   */
  async _getReleaseTag() {
    let release;
    if (this._hasMajorReleasedDependency()) {
      release = 'major';
      // this.log(logSymbols.info, 'Next release:', chalk.cyan.bold(release), `(One or more dependencies latest tag is a major)`);
    } else {
      const labels = await this._getGitLabels(this.issueNumbers);
      if (labels.length) {
        release = labels.includes('major') ? 'major' : labels.includes('minor') ? 'minor' : 'patch';
        // this.log(logSymbols.info, 'Next release:', chalk.cyan.bold(release), `Computed from the labels set on PRs`);
      } else {
        throw new Error('No release labels were found on Pull Requests:\nPlease add at least one release label in one of the Pull Requests'); // labels empty throw error
      }
    }
    const result = await this._determineReleaseVersion(release);
    this.release = result.release;
    this.version = result.version;
    return this.branch = `release-test-${this.version}`;
  }

  /**
  * Get the release labels of the Pull Requests numbers that have been merged into develop.
  * @param {string []} issueNumbers Array containing the Pull Requests numbers that have been merged into develop.
  * @param {string} baseName Current repository, i.e., `phovea/phovea_server`
  */
  async _getGitLabels(issueNumbers, baseName) {
    const allLabels = await Promise.all(issueNumbers.map((n) => {
      const options = {
        url: `https://${this.token.name}:${this.token.token}@api.github.com/repos/${baseName}/issues/${n}/labels`,
        headers: {
          'User-Agent': 'request'
        }
      };
      return rp(options).then((d) => JSON.parse(d));
    }));
    return this.releaseLabels = [].concat.apply([], allLabels)
      .filter((label) => label.name.trim().startsWith('release:'))
      .map((s) => s.name.replace('release:', '').trim());
  }


  _calculateVersion(version, release) {
    const semver = require('semver');
    return semver.inc(version, release);
  }

  /**
   * Determine release tag from release labels of the Pull Requests.
   */
  async _determineReleaseVersion(release) {
    const pkg = this.fs.readJSON(`package.json`);
    let originalVersion = pkg.version;
    if (originalVersion.endsWith('-SNAPSHOT')) {
      originalVersion = originalVersion.slice(0, originalVersion.length - 9);
    }
    const version = this._calculateVersion(originalVersion, release);
    return this._editReleaseVersion(version, release, originalVersion);
  }

  /**
   * Allow user to change release version.
   * @param {*} version
   * @param {*} release
   */
  _editReleaseVersion(version, release, originalVersion) {
    return this.prompt([
      {
        type: 'confirm',
        name: 'keepTag',
        message: `Next version: ${chalk.cyan.bold(version)}`,
      }
    ]).then(({keepTag}) => {
      if (!keepTag) {
        return this.prompt([{
          type: 'input',
          name: 'newTag',
          message: `Enter release version`,
          validate: (version) => this._validateReleaseVersion(version, originalVersion),
          default: version,
        }]).then(({newTag}) => {
          this.log(logSymbols.info, 'New Version: ' + chalk.cyan(newTag));
          return {release: semver.diff(newTag, originalVersion), version: newTag};
        });
      }
      return {version, release};
    });
  }

  _validateReleaseVersion(version, originalVersion) {
    if (semver.valid(version) && semver.gta(version, originalVersion)) {
      return true;
    }
    return `Please enter a valid and greater than or equal to ${originalVersion} version (i.e, 4.0.0)`;
  }


  _writeNewVersion() {
    this.pkg.version = this.version;
    return Promise.resolve().then(() => fs.writeJsonSync(`package.json`, this.pkg, {spaces: 2}));
  }

  /**
   * Checkout branch
   * @param {string} branch to be checked out
   * @param {string} cwd injected data
   */
  _checkoutBranch(branch) {
    const line = `checkout ${branch}`;
    this.log(`Checkout new branch: `, chalk.cyan(`git ${line}`));
    return this._spawnOrAbort('git', line.split(' '));
  }

  /**
   * Executes cmd or returns error message if it failed
   * @param {string} cmd command we want to run i.e. `git`
   * @param {Array} argline arguments of command i.e. `['clone', '-b']`
   * @param {string|undefined} cwd directory to execute command
   * @param {any} returnValue
   */
  _spawnOrAbort(cmd, argline, cwd, returnValue) {
    const r = this._spawn(cmd, argline, cwd);
    returnValue = returnValue || cmd;
    if (failed(r)) {
      this.log(r);
      return this._abort('failed: ' + cmd + ' - status code: ' + r.status);
    }
    return Promise.resolve(returnValue);
  }

  /**
   *executes a command line cmd
   * @param {string} cmd command to execute
   * @param {array} argline cmd arguments
   * @param {string} cwd optional directory
   */
  _spawn(cmd, argline, cwd) {
    const options = cwd || {};
    return this.spawnCommandSync(cmd, Array.isArray(argline) ? argline : argline.split(' '), options);
  }

  /**
   * reject promise with error message
   * @param {string} msg
   */
  _abort(msg) {
    return Promise.reject(msg ? msg : 'Step Failed: Aborting');
  }

  /**
   * Prompt user to edit the release notes.
   */
  _editReleaseNotes() {
    this.log(`\n${chalk.bold('Release Notes:')}\n${chalk.italic(this.releaseNotes)}\n`);
    return this.prompt([
      {
        type: 'editor',
        name: 'releaseNotes',
        default: this.releaseNotes,
        message: 'Edit Release Notes'
      }
    ]).then(({releaseNotes}) => {
      this.releaseNotes = releaseNotes;
    });
  }

  /**
   * Read CHANGELOG.md and merge it with the new release notes.
   */
  _writeToChangelog() {
    const path = 'CHANGELOG.md';
    const oldChangelog = fs.existsSync(path) ?
      this.fs.read(path) : '# Changelog';
    const mergedChangelog = oldChangelog.replace('# Changelog', `# Changelog\n\n## v${this.version}\n\n${this.releaseNotes}`);
    return Promise.resolve().then(() => fs.writeFileSync(path, mergedChangelog));
  }

  _commitFiles() {
    const line = `commit -am "prepare release-${this.version}"`;
    this.log(chalk.bold(`Commit changes:`), chalk.italic(`git ${line}`));

    const filesToCommit = this.requirements ? ['package.json', 'CHANGELOG.md', 'requirements.txt'] : ['package.json', 'CHANGELOG.md'];
    return this._spawnOrAbort('git', ['add', ...filesToCommit], null).then(() => this._spawnOrAbort('git', ['commit', '-am', `prepare release-${this.version}`], null));
  }

  _pushBranch(branch) {
    const line = `push origin ${branch}`;
    this.log(chalk.bold(`Push branch:`), chalk.italic(`git ${line}`));
    return Promise.resolve().then(() => this._spawnOnHost('git', line.split(' ')));
  }

  /**
  * Get username to send api calls to github
  */
  async _getAssignees() {
    const gitUser = this._spawnOnHost('git', ['config', 'user.name']);
    return this.assignees = await this.prompt([
      {
        type: 'confirm',
        name: 'keepUser',
        message: `Confirm assignee ${chalk.cyan(gitUser)}. (No to choose someone else.)`,
      }
    ]).then(({keepUser}) => {
      if (keepUser) {
        return [gitUser];
      }
      return this._getReviewersList()
        .then(async (assignees) => {
          return this._chooseAssignees(assignees);
        });
    });
  }

  async _getReviewersList() {
    const options = {
      url: `https://${this.datavisyn.name}:${this.datavisyn.token}@api.github.com/orgs/datavisyn/teams/dev/members`,
      headers: {
        'User-Agent': 'request'
      },
      role: 'admin'
    };
    return rp(options).then((d) => JSON.parse(d)).then((b) => {
      return b.map((d) => d.login);
    });
  }

  _chooseAssignees(assignees) {
    return this.prompt([{
      type: 'checkbox',
      name: 'assignees',
      message: ('Choose assignee/s.'),
      choices: assignees
    }]).then(({assignees}) => {
      return assignees;
    });
  }

  _getReleaseTemplate() {
    const releaseTemplate = this.fs.read(this.templatePath(`release.md`));
    const merged = releaseTemplate.replace('*List of addressed issues and PRs since the last release*', this.releaseNotes);
    return merged;
  }

  _createPullRequest(title, base, head, template) {
    this.log(chalk.bold('Drafting Pull Request...'));
    const postOptions = {
      method: 'POST',
      uri: `https://${this.token.name}:${this.token.token}@api.github.com/repos/${this.baseName}/pulls`,
      body: {
        title: title,
        head: head,
        body: template,
        base: base
      },
      headers: {
        'User-Agent': 'request'
      },
      json: true
    };
    this.log(postOptions);
    return rp(postOptions).then((d) => {
      return d.number;
    })
      .then((prNumber) => this._setLabels(prNumber))
      .then((prNumber) => this._setAssignees(prNumber));
  }

  _setLabels(prNumber) {
    const postOptions = {
      method: 'POST',
      uri: `https://${this.token.name}:${this.token.token}@api.github.com/repos/${this.baseName}/issues/${prNumber}/labels`,
      body: {
        labels: ['release: ' + this.release]
      },
      headers: {
        'User-Agent': 'request'
      },
      json: true
    };
    return rp(postOptions).then(() => prNumber);
  }

  _setAssignees(prNumber) {
    const assigneeOptions = {
      method: 'POST',
      uri: `https://${this.token.name}:${this.token.token}@api.github.com/repos/${this.baseName}/issues/${prNumber}/assignees`,
      body: {
        assignees: this.assignees
      },
      headers: {
        'User-Agent': 'request'
      },
      json: true
    };
    this.log(chalk.bold('Open Pull Request in browser: ') + `https://github.com/${this.baseName}/pull/${prNumber}`);
    return rp(assigneeOptions).then(() => prNumber);
  }

  writing() {
    return Promise.resolve(1)
      .then(() => this._runForFrontend())
      .then(() => this._runForBackend())
      .then(() => this._collectReleaseNotes())
      .then(() => this._getReleaseTag())
      .then((branch) => this._checkoutBranch('-b' + branch))
      .then(() => this._writeNewVersion())
      .then(() => this._editReleaseNotes())
      .then(() => this._writeToChangelog())
      .then(() => this._commitFiles())
      .then(() => this._pushBranch(this.branch))
      .then(() => this._getAssignees())
      .then(() => this._getReleaseTemplate())
      .then((template) => this._createPullRequest(`Release test ${this.version}`, 'master', this.branch, template))
      .catch((msg) => {
        this.log(chalk.red(`Error: ${msg}`));
        return Promise.reject(msg);
      });
  }
}

module.exports = Release;
