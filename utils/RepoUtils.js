const known = require('./known');

module.exports = class RepoUtils {

  /**
   * Transforms repo name or SSH url to an https url
   * @param {string} repo Repo
   */
  static toHTTPRepoUrl(repo) {
    if (repo.startsWith('http')) {
      return repo;
    }
    if (repo.startsWith('git@')) {
      const m = repo.match(/(https?:\/\/([^/]+)\/|git@(.+):)([\w\d-_/]+)(.git)?/);
      return `https://${m[3]}/${m[4]}.git`;
    }
    if (!repo.includes('/')) {
      repo = `Caleydo/${repo}`;
    }
    return `https://github.com/${repo}.git`;
  }


  /**
   * Transforms repo name or http(s) url to an SSH url
   * @param {string} repo Repo
   */
  static toSSHRepoUrl(repo) {
    if (repo.startsWith('git@')) {
      return repo;
    }
    if (repo.startsWith('http')) {
      const m = repo.match(/(https?:\/\/([^/]+)\/|git@(.+):)([\w\d-_/]+)(.git)?/);
      return `git@${m[2]}:${m[4]}.git`;
    }
    if (!repo.includes('/')) {
      repo = `Caleydo/${repo}`;
    }
    return `git@github.com:${repo}.git`;
  }

  /**
   * Transforms repo http(s) url to an SSH url.
   * @param {string} repo Repo.
   */
  static toSSHRepoUrlFromHTTP(repo) {
    if (repo.startsWith('git@')) {
      return repo;
    }
    const m = repo.match(/(https?:\/\/([^/]+)\/|git@(.+):)([\w\d-_/]+)(.git)?/);
    if (m) {
      return `git@${m[2]}:${m[4]}.git`;
    }
    return repo;
  }

  /**
   * Extracts organization and repo names from a SSH or an http url.
   * @param {string} repo Repo.
   */
  static simplifyRepoUrl(repo) {
    // matches http and git urls
    const m = repo.match(/(https?:\/\/[^/]+\/|git@.+:)([\w\d-_/]+)(.git)?/);
    if (m) {
      // just the repo part
      return m[2];
    }
    return repo;
  }
  /**
   * Checks if repo name includes organization. If not it adds `Caleydo/` prefix.
   * @param {string} name Name of the repo.
   */
  static toBaseName(name) {
    if (name.includes('/')) {
      return name;
    }
    return `Caleydo/${name}`;
  }

  /**
   * Extracts repo name and removes `_product` suffix from name.
   * @param {string} basename Repo name optionaly prefixed with the organization name, i.e, `Caleydo/ordino`.
   */
  static toCWD(basename) {
    try {
      let match = basename.match(/.*\/(.*)/)[1];
      if (match.endsWith('_product')) {
        match = match.slice(0, -8);
      }
      return match;

    } catch {
      return basename;
    }
  }

  static toRepository(plugin, useSSH) {
    const p = known.plugin.byName(plugin);
    return useSSH ? RepoUtils.RtoSSHRepoUrl(p.repository) : RepoUtils.toHTTPRepoUrl(p.repository);
  }
  /**
   * Parses the `phovea_product.json` file and returns an array of objects containing the repo name and branch
   * @param {{}} product 
   */
  static parsePhoveaProduct(product) {
    const names = new Set();
    const repos = [];
    product.forEach((p) => {
      const repo = p.repo || 'phovea/' + p.name;
      if (!names.has(repo)) {
        names.add(repo);
        repos.push({
          repo,
          branch: p.branch || 'master'
        });
      }
      (p.additional || []).forEach((pi) => {
        const repo = pi.repo || 'phovea/' + pi.name;
        if (!names.has(repo)) {
          names.add(repo);
          repos.push({
            repo,
            branch: pi.branch || 'master'
          });
        }
      });
    });
    return repos;
  }
};