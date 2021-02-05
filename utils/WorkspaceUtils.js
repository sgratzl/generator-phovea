const path = require('path');
const glob = require('glob').sync;
const RepoUtils = require('./RepoUtils');
const GeneratorUtils = require('./GeneratorUtils');
const known = require('./known');
const SpawnUtils = require('./SpawnUtils');

module.exports = class WorkspaceUtils {
  /**
   * Returns a list of all web plugins (i.e., the directory names) for a given workspace directory.
   * A valid web plugin must contain a `webpack.config.js` file. Otherwise the directory is ignored.
   *
   * @param {string} workspaceDirectory Workspace directory used as current work directory (cwd)
   * @returns {string[]} List of plugin names
   */
  static listWebPlugins(workspaceDirectory) {
    const files = glob('*/webpack.config.js', {
      cwd: workspaceDirectory
    });
    return files.map(path.dirname).sort();
  }

  /**
   * Returns a list of all server plugins (i.e., the directory names) for a given workspace directory.
   * A valid server plugin must contain a `requirements.txt` file. Otherwise the directory is ignored.
   *
   * @param {string} workspaceDirectory Workspace directory used as current work directory (cwd)
   * @returns {string[]} List of plugin names
   */
  static listServerPlugins(workspaceDirectory) {
    const files = glob('*/requirements.txt', {
      cwd: workspaceDirectory
    });
    return files.map(path.dirname).sort();
  }

  /**
 * Returns a list of all plugins (i.e., the directory names) for a given workspace directory.
 * A valid web plugin must contain a `webpack.config.js` file.
 * A valid server plugin must contain a `requirements.txt` file.
 * Otherwise the directory is ignored.
 *
 * @param {string} workspaceDirectory Workspace directory used as current work directory (cwd)
 * @returns {string[]} List of plugin names
 */
  static listAllPlugins(workspaceDirectory) {
    const webPlugins = WorkspaceUtils.listWebPlugins(workspaceDirectory);
    const serverPlugins = WorkspaceUtils.listServerPlugins(workspaceDirectory);
    return [...new Set([].concat(...webPlugins, ...serverPlugins))].sort();
  }

  /**
   * Extract default app from `phovea_product.json`.
   * @param {Object} product Content of the `phovea_product.json`.
   */
  static findDefaultApp(product) {
    if (!product) {
      return null;
    }
    for (let p of Object.keys(product)) {
      if (product[p].type === 'web') {
        return {
          name: product[p].repo.slice(product[p].repo.lastIndexOf('/') + 1).replace('.git', ''),
          additionals: product[p].additional.map(({name}) => name)
        };
      }
      return null;
    }
  }
  /**
   * Calls the clone repo generator with the name of the repo.
   * @param {string} repo Repository name.
   * @param {string} branch Branch to clone
   * @param {Object} extras Extra git options
   * @param {string} dir Where to clone the repo
   * @param {string} cwd Where to run the generator
   * @param {boolean} cloneSSH SSH or HTTP url
   */
  static cloneRepo(repo, branch, extras, dir = '', cwd, cloneSSH = true) {
    const repoUrl = cloneSSH ? RepoUtils.toSSHRepoUrl(repo) : RepoUtils.toHTTPRepoUrl(repo);
    return GeneratorUtils.yo(`clone-repo`, {
      branch,
      extras: extras || '',
      dir,
      cwd
    }, repoUrl, cwd); // repository URL as argument
  }

  static resolveNeighbors(plugins, useSSH, types, shallow, destinationPath) {
    let missing = [];
    const addMissing = (p) => {
      const configPath = path.join(destinationPath, p + '.yo-rc.json');
      console.log(configPath);
      const config = this.fs.readJSON(configPath, {'generator-phovea': {}})['generator-phovea'];
      let modules = [].concat(config.modules || [], config.smodules || []);
      console.log(`${p} => ${modules.join(' ')}`);
      if (types && types !== 'both') {
        // filter to just certain sub types
        const filter = types === 'web' ? known.plugin.isTypeWeb : known.plugin.isTypeServer;
        modules = modules.filter((m) => known.plugin.isTypeHybrid(m) || filter(m));
      }
      missing.push(...modules.filter((m) => plugins.indexOf(m) < 0));
    };

    plugins.forEach(addMissing);

    while (missing.length > 0) {
      let next = missing.shift();
      let repo = RepoUtils.toRepository(next, useSSH);
      let args = ['clone', repo];
      if (shallow) {
        args.splice(1, 0, '--depth', '1');
      }
      console.log(`git clone ${args.join(' ')}`);
      SpawnUtils.spaw('git', args, {
        cwd: destinationPath
      });
      plugins.push(next);
      addMissing(next);
    }
  }


  static resolveAllNeighbors(useSSH, types, destinationPath) {
    const files = glob('*/.yo-rc.json', {
      cwd: destinationPath
    });
    const plugins = files.map(path.dirname);
    return WorkspaceUtils.resolveNeighbors(plugins, useSSH, types, destinationPath);
  }


  /**
   * Creates an array of additional plugins depending on the type.
   * @param {string} type Type of the plugin. `web, static, python`
   */
  static buildPossibleAdditionalPlugins(type) {
    const toDescription = (d) => ({
      value: {[d.name]: {repo: RepoUtils.simplifyRepoUrl(d.repository)}},
      name: `${d.name}: ${d.description}`,
      short: d.name
    });

    const plugins = known.plugin;
    return ((type === 'web' || type === 'static') ? plugins.listWeb : plugins.listServer).map(toDescription);
  }

  /**
   * Gives the order in which the scss files should be imported in the workspace
   * @param {string} a Repo to compare
   * @param {string} b Repo to compare
   */
  static compareRepos(a, b) {
    const weight = (plugin) => {
      const orderedArr = ['ordino', 'tdp_core', 'phovea_clue', 'phovea_ui'];
      if (orderedArr.indexOf(plugin) == - 1) {
        return 100;
      }
      return orderedArr.indexOf(plugin);
    };

    if (weight(a) === weight(b)) {
      return a > b; // alphabetically
    }
    return weight(a) - weight(b);
  }
};
