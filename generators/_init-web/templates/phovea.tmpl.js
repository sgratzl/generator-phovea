/* *****************************************************************************
 * Caleydo - Visualization for Molecular Biology - http://caleydo.org
 * Copyright (c) The Caleydo Team. All rights reserved.
 * Licensed under the new BSD license, available at http://caleydo.org/license
 **************************************************************************** */

//register all extensions in the registry following the given pattern
module.exports = function(registry) {
  /// #if include('extension-type', 'extension-id')	
  //registry.push('extension-type', 'extension-id', function() { return import('./src/extension_impl'); }, {});
  /// #endif
  // generator-phovea:begin
<%- extensions.map((d) => `  registry.push('${d.type}', '${d.id}', function() { return import('./src/${d.module}'); }, ${stringify(d.extras, ' ')});`).join('\n\n') %>
  // generator-phovea:end
};

