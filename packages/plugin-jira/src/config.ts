import { elizaLogger, IAgentRuntime } from '@elizaos/core';
import { JiraServiceConfig } from './types.js';
import { JiraService } from './jira-service.js';

export async function validateConfig(runtime: IAgentRuntime): Promise<boolean> {
    // Check all possible paths for each config value
    const host = runtime.getSetting('JIRA_HOST') || runtime.getSetting('jira.host') || runtime.getSetting('configs.jira.host');
    const email = runtime.getSetting('JIRA_EMAIL') || runtime.getSetting('jira.email') || runtime.getSetting('configs.jira.email');
    const apiToken = runtime.getSetting('JIRA_API_TOKEN') || runtime.getSetting('jira.apiToken') || runtime.getSetting('configs.jira.apiToken');
    
    // Check all possible paths for project key
    const projectPaths = [
        'settings.jira.project', // New path that matches character file structure
        'configs.jira.projectKey',
        'jira.projectKey',
        'jira.project',
        'JIRA_PROJECT_KEY'
    ];
    
    const project = projectPaths.reduce((found, path) => {
        const value = runtime.getSetting(path);
        if (value) {
            elizaLogger.debug(`Found project key in ${path}: ${value}`);
            return value;
        }
        return found;
    }, null);

    elizaLogger.debug('Jira Configuration:', {
        host: host || '(not set)',
        email: email || '(not set)',
        project: project || '(not set)',
        apiToken: apiToken ? '(set)' : '(not set)',
        settings: {
            'JIRA_HOST': runtime.getSetting('JIRA_HOST'),
            'jira.host': runtime.getSetting('jira.host'),
            'configs.jira.host': runtime.getSetting('configs.jira.host'),
            'jira.projectKey': runtime.getSetting('jira.projectKey'),
            'jira.project': runtime.getSetting('jira.project'),
            'configs.jira.projectKey': runtime.getSetting('configs.jira.projectKey'),
            'JIRA_PROJECT_KEY': runtime.getSetting('JIRA_PROJECT_KEY')
        }
    });

    const missingConfigs = [];
    if (!host) missingConfigs.push('JIRA_HOST/jira.host/configs.jira.host');
    if (!email) missingConfigs.push('JIRA_EMAIL/jira.email/configs.jira.email');
    if (!apiToken) missingConfigs.push('JIRA_API_TOKEN/jira.apiToken/configs.jira.apiToken');
    if (!project) missingConfigs.push('settings.jira.project/jira.projectKey/jira.project/configs.jira.projectKey/JIRA_PROJECT_KEY');

    const hasConfig = !!(host && email && apiToken && project);
    if (!hasConfig) {
        elizaLogger.error('Missing required Jira configuration:', {
            missingValues: missingConfigs,
            searchedLocations: {
                host: ['JIRA_HOST', 'jira.host', 'configs.jira.host'],
                email: ['JIRA_EMAIL', 'jira.email', 'configs.jira.email'],
                apiToken: ['JIRA_API_TOKEN', 'jira.apiToken', 'configs.jira.apiToken'],
                project: projectPaths
            }
        });
        return false;
    }

    // Try to instantiate the JiraService and validate project
    try {
        const service = new JiraService({
            host: host!,
            email: email!,
            apiToken: apiToken!,
            project: project!
        });
        
        // Try to validate the project exists in Jira
        const projectExists = await service['validateProject']();
        if (!projectExists) {
            elizaLogger.error(`Jira project ${project} does not exist or is not accessible`);
            return false;
        }
        
        elizaLogger.debug(`Successfully validated Jira project ${project}`);
        return true;
    } catch (error) {
        elizaLogger.error('Error validating Jira configuration:', error);
        return false;
    }
}

export function getConfig(runtime: IAgentRuntime): JiraServiceConfig {
    const host = runtime.getSetting('JIRA_HOST') || runtime.getSetting('jira.host') || runtime.getSetting('configs.jira.host');
    const email = runtime.getSetting('JIRA_EMAIL') || runtime.getSetting('jira.email') || runtime.getSetting('configs.jira.email');
    const apiToken = runtime.getSetting('JIRA_API_TOKEN') || runtime.getSetting('jira.apiToken') || runtime.getSetting('configs.jira.apiToken');
    
    // Check all possible paths for project key
    const projectPaths = [
        'settings.jira.project', // New path that matches character file structure
        'configs.jira.projectKey',
        'jira.projectKey',
        'jira.project',
        'JIRA_PROJECT_KEY'
    ];
    
    const project = projectPaths.reduce((found, path) => {
        const value = runtime.getSetting(path);
        if (value) return value;
        return found;
    }, null);

    // Validate all required fields are present
    const missingConfigs = [];
    if (!host) missingConfigs.push('JIRA_HOST/jira.host/configs.jira.host');
    if (!email) missingConfigs.push('JIRA_EMAIL/jira.email/configs.jira.email');
    if (!apiToken) missingConfigs.push('JIRA_API_TOKEN/jira.apiToken/configs.jira.apiToken');
    if (!project) missingConfigs.push('settings.jira.project/jira.projectKey/jira.project/configs.jira.projectKey/JIRA_PROJECT_KEY');

    if (missingConfigs.length > 0) {
        throw new Error(`Missing required Jira configuration: ${missingConfigs.join(', ')}`);
    }

    return {
        host: host!,
        email: email!,
        apiToken: apiToken!,
        project: project!
    };
}
