const path = require('path');

/**
 * Get the path to the templates of a specific subgenerator.
 * @param {string} subgenerator 
 * @param {string} file 
 */
const templatePath = (subgenerator, file) => path.join(__dirname, `../generators/${subgenerator}/templates/${file}`);

module.exports = {
    templatePath
}