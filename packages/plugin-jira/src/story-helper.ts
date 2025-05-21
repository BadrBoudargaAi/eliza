import { elizaLogger, IAgentRuntime, UUID } from '@elizaos/core';
import { JiraService } from './jira-service.js';
import { validateAndLogStoryData } from './interfaces.js';
import { formatUserStoryFromText } from './format-helper.js';
import { RecentMemory } from './interfaces.js';
import { getConfig, validateConfig } from './config.js';

export async function createJiraStory(
    runtime: IAgentRuntime,
    text: string,
    roomId: UUID,
    findInRecentHistory = true
){
    // First try to format the text directly
    let storyData = formatUserStoryFromText(text);
    
    // If that fails and history search is enabled, look in recent messages
    if ((!storyData || !validateAndLogStoryData(storyData)) && findInRecentHistory) {
        const recentMessages = await runtime.messageManager.getMemories({
            roomId: roomId,
            count: 5,
            unique: false
        }) as RecentMemory[];
        
        const formattedMessage = recentMessages.find(msg => {
            if (!['jira.formatUserStory', 'jira.createUserStory'].includes(msg.content?.action)) return false;
            if (msg.userId !== runtime.agentId) return false;
            const msgData = msg.content?.data;
            return msgData && validateAndLogStoryData(msgData);
        });

        if (formattedMessage?.content?.data) {
            elizaLogger.info('Found valid story data in message history');
            storyData = formattedMessage.content.data;
        }
    }

    // Validate the story data
    if (!storyData || !validateAndLogStoryData(storyData)) {
        throw new Error('Could not create valid story data. Please provide:\n' +
            '1. A clear story summary\n' +
            '2. A description in the format "As a user, I want to... so that..."\n' +
            '3. At least one acceptance criterion\n' +
            '4. A priority level (High/Medium/Low)');
    }

    // Create the story in Jira
    const service = new JiraService(getConfig(runtime));
    elizaLogger.info('Creating story with service:', {
        data: storyData,
        config: getConfig(runtime)
    });

    const key = await service.createStory({
        summary: storyData.summary.trim(),
        description: storyData.description.trim(),
        acceptanceCriteria: storyData.acceptanceCriteria.map(c => c.trim()),
        priority: storyData.priority,
        epicKey: storyData.epicKey,
        storyPoints: storyData.storyPoints
    });

    elizaLogger.info(`Story created with key: ${key}`);
    return key;
}
