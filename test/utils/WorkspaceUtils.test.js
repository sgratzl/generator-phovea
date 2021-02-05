'use strict';
const WorkspaceUtils = require('../../utils/WorkspaceUtils');
jest.mock('../../utils/known');

describe('Find default app in product object', () => {

    it('returns null if product is undefined', () => {
        const product = undefined;
        expect(WorkspaceUtils.findDefaultApp(product)).toBe(null);
    });

    it('returns null if product has no entry type `web`', () => {
        const product = {
            "api":
            {
                type: 'api',
                repo: 'phovea/phovea_ui',
                branch: 'develop',
                additionals: {}

            }};
        expect(WorkspaceUtils.findDefaultApp(product)).toBe(null);
    });

    it('returns parsed repo name when entry has type `web`', () => {
        const product = {
               web: {
                type: 'web',
                repo: 'Caleydo/ordino_public',
                branch: 'develop',
                additionals: {
                    'phovea_core': {
                        'repo': 'phovea/phovea_core',
                        'branch': 'develop'
                    },
                    'phovea_ui': {
                        'repo': 'phovea/phovea_ui',
                        'branch': 'develop'
                    }
                }

            },
            api: {
                type: 'api',
                repo: 'org/repo',
                branch: 'develop',
                additionals: {}

            }};
        expect(WorkspaceUtils.findDefaultApp(product)).toMatchObject({name: 'ordino_public', additionals: {'phovea_core': {}, 'phovea_ui': {}}});
    });
});

describe('Test `buildPossibleAdditionalPlugins()`', () => {


    const known = require('../../utils/known');
    known.plugin = {
        listWeb: [{
            'name': 'phovea_core',
            'type': 'lib',
            'description': 'Phovea Core Plugin',
            'repository': 'https://github.com/phovea/phovea_core.git',
            'dependencies': {
                'phovea_core': '^4.0.0'
            },
            'develop': {
                'dependencies': {
                    'phovea_core': 'github:phovea/phovea_core#develop'
                }
            },
            'libraries': []
        },],
        listServer: [{
            'name': 'phovea_server',
            'type': 'service',
            'description': 'Phovea Server Plugin',
            'repository': 'https://github.com/phovea/phovea_server.git',
            'requirements': {
                'phovea_server': '>=5.0.1,<6.0.0'
            },
            'develop': {
                'requirements': {
                    '-e git+https://github.com/phovea/phovea_server.git': '@develop#egg=phovea_server'
                }
            }
        }],
    };
    it('builds additional web plugins', () => {

    const result = [{
        'name': 'phovea_core: Phovea Core Plugin',
        'short': 'phovea_core',
        'value': {
            'phovea_core': {
                'repo': 'phovea/phovea_core'
            }
        },
    }];
        expect(WorkspaceUtils.buildPossibleAdditionalPlugins('web')).toMatchObject(result);
        expect(WorkspaceUtils.buildPossibleAdditionalPlugins('static')).toMatchObject(result);
    });

    it('builds additional python plugins', () => {
        const result = [{
            'name': 'phovea_server: Phovea Server Plugin',
            'short': 'phovea_server',
            'value': {
                'phovea_server': {
                    'repo': 'phovea/phovea_server'
                }
            },
        }];
        expect(WorkspaceUtils.buildPossibleAdditionalPlugins('python')).toMatchObject(result);
    });
});