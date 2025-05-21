import { Plugin, Action, elizaLogger, IAgentRuntime, Memory, Content, UUID, Character } from '@elizaos/core';
import { JiraService } from './jira-service.js';
import { CreateStoryData, Priority } from './types.js';
import { formatUserStoryFromText, formatUserStoryToText } from './format-helper.js';
import { validateConfig, getConfig } from './config.js';
import { CreateStoryMemory, FormatStoryMemory, validateAndLogStoryData } from './interfaces.js';
import { createJiraStory } from './story-helper.js';

// Action Implementations
export const formatStoryAction: Action = {
    name: "jira.formatUserStory",
    description: "Formats user story requirements into a structured format and chains to story creation",
    similes: ["FORMAT_USER_STORY", "FORMAT_REQUIREMENTS"],
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create a user story for login functionality where users can reset their password"
                }
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll format that into a user story and create it in Jira",
                    action: "jira.formatUserStory",
                    data: {
                        description: "What are the requirements for the login functionality with password reset?"
                    }
                }
            }
        ]
    ],
    validate: validateConfig,
    handler: async (runtime: IAgentRuntime, message: FormatStoryMemory) => {
        try {
            // Validate config early to fail fast
            if (!await validateConfig(runtime)) {
                await runtime.messageManager.createMemory({
                    content: { 
                        text: "Missing required Jira configuration. Please check Jira host, email, API token, and project settings." 
                    },
                    userId: runtime.agentId,
                    roomId: message.roomId,
                    agentId: runtime.agentId
                });
                return false;
            }

            const text = message.content.data?.description || message.content.text;
            if (!text) {
                elizaLogger.error('No text provided to format');
                await runtime.messageManager.createMemory({
                    content: { text: 'No text provided to format user story' },
                    userId: runtime.agentId,
                    roomId: message.roomId,
                    agentId: runtime.agentId
                });
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
            }

            const formattedText = formatUserStoryToText(formatted);
            await runtime.messageManager.createMemory({
                content: {
                    text: `Here's the formatted user story:\n\n${formattedText}\n\nCreating this story in Jira...`,
                    action: "jira.createUserStory",
                    data: formatted
                },
                userId: runtime.agentId,
                roomId: message.roomId,
                agentId: runtime.agentId
            });

            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            elizaLogger.error('Error in formatStoryAction:', error);
            await runtime.messageManager.createMemory({
                content: { text: `Error formatting user story: ${errorMessage}` },
                userId: runtime.agentId,
                roomId: message.roomId,
                agentId: runtime.agentId
            });
            return false;
        }
    }
};

export const createStoryAction: Action = {
    name: "jira.createUserStory",
    description: "Creates a new user story in Jira",
    similes: ["CREATE_USER_STORY", "NEW_STORY"],
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create a Jira story for implementing search functionality"
                }
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Creating a user story for search functionality",
                    action: "jira.createUserStory",
                    data: {
                        summary: "Search Functionality",
                        description: "As a user, I want to search through content so that I can quickly find what I'm looking for",
                        acceptanceCriteria: [
                            "Search box is accessible from the main page",
                            "Search results display in a clear format", 
                            "Search works across all content types"
                        ],
                        priority: "Medium"
                    }
                }
            }
        ]
    ],
    validate: validateConfig,
    handler: async (runtime: IAgentRuntime, message: CreateStoryMemory) => {
        try {
            let storyData = message.content.data as CreateStoryData;
            
            // If no storyData provided or invalid, try to format from text or find in history
            if (!storyData || !validateAndLogStoryData(storyData)) {
                const text = message.content.text;
                if (text) {
                    const formatted = formatUserStoryFromText(text);
                    if (formatted) {
                        storyData = formatted;
                    }
                }

                // If still no valid data, look for recently formatted story
                if (!storyData || !validateAndLogStoryData(storyData)) {
                    const recentMessages = await runtime.messageManager.getMemories({
                        roomId: message.roomId,
                        count: 5,
                        unique: false
                    });
                    
                    const formattedMessage = recentMessages.find(msg => {
                        if (!['jira.formatUserStory', 'jira.createUserStory'].includes(msg.content?.action)) return false;
                        if (msg.userId !== runtime.agentId) return false;
                        const msgData = msg.content?.data as CreateStoryData;
                        return msgData && validateAndLogStoryData(msgData);
                    });

                    if (formattedMessage?.content?.data) {
                        storyData = formattedMessage.content.data as CreateStoryData;
                    }
                }
            }

            // At this point if we still don't have valid data, fail with a detailed message
            if (!storyData || !validateAndLogStoryData(storyData)) {
                const errorMessage = "I couldn't find valid story data. Please provide:\n" + 
                    "1. A clear story summary\n" +
                    "2. A description in the format 'As a user, I want to... so that...'\n" +
                    "3. At least one acceptance criterion\n" +
                    "4. A priority level (High/Medium/Low)";

                elizaLogger.error('No valid story data found');
                await runtime.messageManager.createMemory({
                    content: { text: errorMessage },
                    userId: runtime.agentId,
                    roomId: message.roomId,
                    agentId: runtime.agentId
                });
                return false;
            }

            // Create the story in Jira
            const service = new JiraService(getConfig(runtime));
            const key = await service.createStory({
                summary: storyData.summary.trim(),
                description: storyData.description.trim(),
                acceptanceCriteria: storyData.acceptanceCriteria.map(c => c.trim()),
                priority: storyData.priority,
                epicKey: storyData.epicKey,
                storyPoints: storyData.storyPoints
            });
            
            const response = `Story created successfully with key: ${key}. You can view it at ${getConfig(runtime).host}/browse/${key}`;
            
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
            elizaLogger.error('Error in createStoryAction:', error);
            
            await runtime.messageManager.createMemory({
                content: { 
                    text: `Failed to create story: ${errorMessage}. Please check all required fields and Jira configuration.`
                },
                userId: runtime.agentId,
                roomId: message.roomId,
                agentId: runtime.agentId
            });
            
            return false;
        }
    }
};

// Define and export the plugin
const jiraPlugin: Plugin = {
    name: "jira",
    description: "Create and manage Jira issues",
    actions: [formatStoryAction, createStoryAction],
    handlePostCharacterLoaded: async (character: Character) => {
        // Any post-load initialization if needed
        return character;
    }
};

export default jiraPlugin;
