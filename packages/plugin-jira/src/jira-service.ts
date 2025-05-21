import { Version3Client } from 'jira.js/version3';
import { JiraEpic, JiraStory, JiraServiceConfig, Priority } from './types.js';
import { elizaLogger } from '@elizaos/core';

export class JiraService {
    private client: Version3Client;
    private project: string;
    private config: JiraServiceConfig;
    private accountId: string | null = null;

    constructor(config: JiraServiceConfig) {
        this.config = config;
        this.client = new Version3Client({
            host: config.host,
            authentication: {
                basic: {
                    email: config.email,
                    apiToken: config.apiToken,
                }
            }
        });
        this.project = config.project;
    }

    private formatAcceptanceCriteria(criteria: string[]): string {
        return criteria.map(c => `* ${c}`).join('\n');
    }

    /**
     * Validates that the configured project exists in Jira
     */    private async validateProject(): Promise<boolean> {
        try {
            elizaLogger.info(`Validating Jira project: ${this.project}`);
            const projectResponse = await this.client.projects.getProject({ projectIdOrKey: this.project });
            elizaLogger.info(`Project response:`, projectResponse);
            elizaLogger.success(`Successfully validated Jira project: ${this.project}`);
            return true;
        } catch (error) {
            elizaLogger.error(`Error validating Jira project ${this.project}:`, error);
            if (error instanceof Error) {
                elizaLogger.error(`Error details: ${error.message}`);
            }
            return false;
        }
    }

    private async getAccountId(): Promise<string> {
        // First validate the project exists
        const projectExists = await this.validateProject();
        if (!projectExists) {
            throw new Error(`Jira project ${this.project} does not exist or is not accessible. Please check your project key configuration.`);
        }

        if (this.accountId) {
            return this.accountId;
        }

        try {
            // Search for users matching email
            const response = await this.client.userSearch.findAssignableUsers({
                query: this.config.email,
                project: this.project,
                maxResults: 1
            });
            const users = response;

            if (!users || users.length === 0) {
                throw new Error(`No Jira user found for email: ${this.config.email}`);
            }

            // Store and return the account ID
            this.accountId = users[0].accountId;
            return this.accountId;
        } catch (error) {
            elizaLogger.error('Error getting account ID:', error);
            throw error;
        }
    }

    async createEpic(epic: JiraEpic): Promise<string> {
        try {
            elizaLogger.info('Creating Epic with data:', { epic });
            
            const response = await this.client.issues.createIssue({
                fields: {
                    project: { key: this.project },
                    summary: epic.summary,
                    description: {
                        type: 'doc',
                        version: 1,
                        content: [{
                            type: 'paragraph',
                            content: [{ type: 'text', text: epic.description }]
                        }]
                    },
                    issuetype: { name: 'Epic' },
                    customfield_10011: epic.name // Epic Name field
                }
            });

            elizaLogger.info(`Created Epic: ${response.key}`);
            return response.key;
        } catch (error) {
            elizaLogger.error('Error creating Epic:', error);
            throw error;
        }
    }

    async createStory(story: JiraStory): Promise<string> {
        try {
            elizaLogger.info('Creating Story with data:', { story });
            
            // Get the reporter's account ID
            const reporterId = await this.getAccountId();
            
            // Format description to include acceptance criteria
            const description = `${story.description}\n\n*Acceptance Criteria:*\n${this.formatAcceptanceCriteria(story.acceptanceCriteria)}`;

            const response = await this.client.issues.createIssue({
                fields: {
                    project: { key: this.project },
                    summary: story.summary,
                    description: {
                        type: 'doc',
                        version: 1,
                        content: [{
                            type: 'paragraph',
                            content: [{ type: 'text', text: description }]
                        }]
                    },
                    issuetype: { name: 'Story' },
                    reporter: { accountId: reporterId }, // Use accountId instead of email
                    customfield_10014: story.epicKey,
                    customfield_10016: story.storyPoints,
                    priority: { name: story.priority }
                }
            });

            elizaLogger.info(`Created Story: ${response.key}`);
            return response.key;
        } catch (error) {
            elizaLogger.error('Error creating Story:', error);
            throw error;
        }
    }
}
