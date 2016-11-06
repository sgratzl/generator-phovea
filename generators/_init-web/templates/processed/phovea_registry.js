/* *****************************************************************************
 * Caleydo - Visualization for Molecular Biology - http://caleydo.org
 * Copyright (c) The Caleydo Team. All rights reserved.
 * Licensed under the new BSD license, available at http://caleydo.org/license
 **************************************************************************** */

import {register} from 'phovea_core/src/plugin';

/**
 * build a registry by registering all phovea modules
 */
//other modules
<%- modules.filter(isWeb).map((d) => `import '${d}/phovea_registry.js';`).join('\n') %>
//self
register('<%-name%>',require('./phovea.js'));
