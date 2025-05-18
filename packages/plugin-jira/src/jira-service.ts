import { Version3Client } from 'jira.js';
import { JiraEpic, JiraStory, JiraServiceConfig, Priority } from './types.js';
import { elizaLogger } from '@elizaos/core';

export class JiraService {
    private client: Version3Client;
    private project: string;

    constructor(config: JiraServiceConfig) {
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
                    customfield_10014: story.epicKey, // Epic Link field
                    customfield_10016: story.storyPoints, // Story points field
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
