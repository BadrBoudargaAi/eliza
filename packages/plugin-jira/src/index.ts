import { Plugin, Action, elizaLogger, IAgentRuntime, Memory, Content } from '@elizaos/core';
import { JiraService } from './jira-service.js';
import { JiraServiceConfig, CreateEpicData, CreateStoryData, Priority } from './types.js';
import { formatUserStoryFromText, formatUserStoryToText, FormattedUserStory, FormatInput } from './format-helper.js';

// Configuration Helper Functions
const validateConfig = async (runtime: IAgentRuntime): Promise<boolean> => {
    const host = runtime.getSetting('jira.host');
    const email = runtime.getSetting('jira.email');
    const apiToken = runtime.getSetting('jira.apiToken');
    return !!(host && email && apiToken);
};

const getConfig = (runtime: IAgentRuntime): JiraServiceConfig => {
    return {
        host: runtime.getSetting('jira.host'),
        email: runtime.getSetting('jira.email'),
        apiToken: runtime.getSetting('jira.apiToken'),
        project: runtime.getSetting('jira.project')
    };
};

const getJiraService = (runtime: IAgentRuntime): JiraService => {
    return new JiraService(getConfig(runtime));
};

const validateCreateStoryData = (data: any): data is CreateStoryData => {
    return !!(data && data.summary && data.description && 
        data.acceptanceCriteria && Array.isArray(data.acceptanceCriteria) &&
        data.priority && ['High', 'Medium', 'Low'].includes(data.priority));
};
// ...existing code...

// Helper Functions 
const requestConfirmation = async (runtime: IAgentRuntime, message: Memory, text: string): Promise<boolean> => {
    await runtime.messageManager.createMemory({
        content: { text },
        userId: runtime.agentId,
        roomId: message.roomId,
        agentId: runtime.agentId
    });
    
    // In a real implementation, we would wait for user confirmation
    // For now, we'll just return true
    return true;
};

// Action Implementations
const createEpicAction: Action = {
    name: "jira.createEpic",
    description: "Creates a new epic in Jira",
    similes: ["CREATE_EPIC", "NEW_EPIC"],
    examples: [[{
        user: "User",
        content: {
            text: "Create an epic for the search feature",
            action: "jira.createEpic",
            data: {
                name: "Search Feature",
                summary: "Implement search functionality",
                description: "This epic covers all the user stories related to implementing search functionality across the application."
            } as CreateEpicData
        }
    }]],
    validate: validateConfig,
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        try {
            const data = message.content?.data as CreateEpicData;
            if (!data || !data.name || !data.summary || !data.description) {
                elizaLogger.error('Invalid epic data');
                return false;
            }

            const key = await getJiraService(runtime).createEpic({
                name: data.name.trim(),
                summary: data.summary.trim(),
                description: data.description.trim(),
            });

            const response = `Epic created successfully with key: ${key}. You can view it at ${getConfig(runtime).host}browse/${key}`;
            await runtime.messageManager.createMemory({
                content: { text: response },
                userId: runtime.agentId,
                roomId: message.roomId,
                agentId: runtime.agentId
            });

            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            elizaLogger.error('Error in createEpicAction:', errorMessage);
            
            await runtime.messageManager.createMemory({
                content: { 
                    text: `Failed to create epic: ${errorMessage}. Please ensure all required fields are provided.`
                },
                userId: runtime.agentId,
                roomId: message.roomId,
                agentId: runtime.agentId
            });
            
            return false;
        }
    }
};

interface CreateStoryContent extends Content {
    data?: CreateStoryData;
}

interface CreateStoryMemory extends Memory {
    content: CreateStoryContent;
}

interface RecentMemory extends Memory {
    content: {
        action?: string;
        data?: any;
        text: string; // Make text required to match Content interface
    }
}

const createStoryAction: Action = {
    name: "jira.createUserStory",
    description: "Creates a new user story in Jira",
    similes: ["CREATE_USER_STORY", "NEW_STORY"],    examples: [[{
            user: "User",
            content: {
                text: "Create a user story for the search feature",
                action: "jira.createUserStory",
                data: {
                    summary: "Search Functionality",
                    description: "As a user, I want to search for content using keywords so that I can quickly find the information I need.",
                    acceptanceCriteria: [
                        "User can enter search terms in a search box",
                        "Search results display relevant content based on keywords",
                        "Search results are sorted by relevance"
                    ],
                    priority: "High"
                } as CreateStoryData
            }
    }]],
    validate: validateConfig,
    handler: async (runtime: IAgentRuntime, message: CreateStoryMemory) => {
        try {
            // First store the message in chat history
            await runtime.messageManager.createMemory({
                id: message.id,
                content: message.content,
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId
            });

            // Get recent context from chat history
            const recentMessages = await runtime.messageManager.getMemories({
                roomId: message.roomId,
                count: runtime.getConversationLength(),
                unique: false
            }) as RecentMemory[];
            
            // Extract story data from message or recent context
            let data = message.content.data;
            
            // If no data provided, look through recent messages for formatted story
            if (!data) {
                // First try to format from text
                const formatted = formatUserStoryFromText(message.content.text || '');
                if (formatted) {
                    data = formatted;
                } else {
                    // Look for recently formatted story in chat history
                    const formattedMessage = recentMessages.reverse().find(msg => {
                        if (msg.content?.action !== 'jira.formatUserStory') return false;
                        if (msg.userId !== runtime.agentId) return false;
                        const msgData = msg.content?.data;
                        if (!msgData) return false;
                        return validateCreateStoryData(msgData);
                    });

                    if (formattedMessage?.content?.data) {
                        data = formattedMessage.content.data;
                    } else {
                        elizaLogger.error('No story data provided and could not find previously formatted story');
                        return false;
                    }
                }
            }

            // Validate story data and confirm with user 
            if (!validateCreateStoryData(data)) {
                return false;
            }

            const formattedPreview = formatUserStoryToText(data);
            if (!await requestConfirmation(runtime, message,
                `I'm about to create this user story in JIRA:\n\n${formattedPreview}\n\nPlease confirm this looks correct.`)) {
                await runtime.messageManager.createMemory({
                    content: { text: "Story creation cancelled." },
                    userId: runtime.agentId,
                    roomId: message.roomId,
                    agentId: runtime.agentId
                });
                return false;
            }

            // Create the story in Jira
            const key = await getJiraService(runtime).createStory({
                summary: data.summary.trim(),
                description: data.description.trim(),
                acceptanceCriteria: data.acceptanceCriteria.map(c => c.trim()),
                priority: data.priority,
                epicKey: data.epicKey,
                storyPoints: data.storyPoints
            });

            // Log success and update chat
            const response = `Story created successfully with key: ${key}. You can view it at ${getConfig(runtime)?.host}browse/${key}`;
            await runtime.messageManager.createMemory({
                content: { text: response },
                userId: runtime.agentId,
                roomId: message.roomId,
                agentId: runtime.agentId
            });

            elizaLogger.info(`Story created with key: ${key}`);
            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            elizaLogger.error('Error in createStoryAction:', errorMessage);
            
            // Update chat with error message
            await runtime.messageManager.createMemory({
                content: { 
                    text: `Failed to create story: ${errorMessage}. Please ensure all required fields are provided.`
                },
                userId: runtime.agentId,
                roomId: message.roomId,
                agentId: runtime.agentId
            });
            
            return false;
        }
    }
};

interface FormatStoryContent extends Content {
    data?: {
        description?: string;
    };
}

interface FormatStoryMemory extends Memory {
    content: FormatStoryContent;
}

const formatStoryAction: Action = {
    name: "jira.formatUserStory", 
    description: "Formats user story requirements into a structured format without creating a JIRA ticket",
    similes: ["FORMAT_USER_STORY", "FORMAT_REQUIREMENTS"],
    examples: [
        [{
            user: "User",
            content: {
                text: "Format this user story: Users should be able to reset their password",
                action: "jira.formatUserStory",
                data: {
                    description: "Users should be able to reset their password"
                }
            }
        }]
    ],
    validate: async () => true,
    handler: async (runtime: IAgentRuntime, message: FormatStoryMemory) => {
        try {
            const text = message.content.data?.description || message.content.text;
            if (!text) {
                elizaLogger.error('No text provided to format');
                return false;
            }

            const formatted = formatUserStoryFromText(text);
            if (!formatted) {
                const response = `I could not format the requirements into a user story. Please provide:
1. A clear description of what the user wants to achieve
2. The reason or benefit (what problem it solves)
3. Any specific criteria for the feature
4. Priority level (High/Medium/Low)`;

                await runtime.messageManager.createMemory({
                    content: { text: response },
                    userId: runtime.agentId,
                    roomId: message.roomId,
                    agentId: runtime.agentId
                });
                return false;
            }            const formattedText = formatUserStoryToText(formatted);
            await runtime.messageManager.createMemory({
                content: { 
                    text: `Here's the formatted user story:\n\n${formattedText}\n\nWould you like me to create this as a JIRA ticket?`,
                    action: "jira.formatUserStory",
                    data: formatted // Store the formatted story data
                },
                userId: runtime.agentId,
                roomId: message.roomId,  
                agentId: runtime.agentId
            });

            return true;
        } catch (error) {
            elizaLogger.error('Error in formatStoryAction:', error);
            return false;
        }
    }
};

// Plugin Export
export default {
    name: '@elizaos/plugin-jira',
    description: 'Jira integration plugin for creating and managing issues',
    actions: [
        createEpicAction,
        createStoryAction,
        formatStoryAction
    ]
} as Plugin;
