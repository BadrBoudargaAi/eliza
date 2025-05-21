import { elizaLogger, Memory, Content, UUID } from '@elizaos/core';
import { CreateStoryData, CreateEpicData } from './types.js';

// Base interfaces
export interface BaseMemory extends Memory {
    roomId: UUID;
    userId: UUID;
    agentId: UUID;
}

export interface CreateStoryContent extends Content {
    data?: CreateStoryData;
    text: string;
    action?: string;
}

export interface CreateStoryMemory extends BaseMemory {
    content: CreateStoryContent;
}

export interface FormatStoryContent extends Content {
    data?: {
        description?: string;
    } | CreateStoryData;
    text: string;
    action?: string;
}

export interface FormatStoryMemory extends BaseMemory {
    content: FormatStoryContent;
}

export interface RecentMemory extends BaseMemory {
    content: {
        action?: string;
        data?: any;
        text: string;
    };
}

// Story validation
export function validateAndLogStoryData(data: any): data is CreateStoryData {
    elizaLogger.debug('Validating story data:', data);
    
    if (!data) {
        elizaLogger.error('Story data is null or undefined');
        return false;
    }

    const missingFields = [];
    if (!data.summary) missingFields.push('summary');
    if (!data.description) missingFields.push('description');
    if (!data.priority) missingFields.push('priority');
    if (!data.acceptanceCriteria || !Array.isArray(data.acceptanceCriteria)) {
        missingFields.push('acceptanceCriteria (must be an array)');
    } else if (data.acceptanceCriteria.length === 0) {
        missingFields.push('acceptanceCriteria (array is empty)');
    }
    
    const validPriority = ['High', 'Medium', 'Low'].includes(data.priority);
    if (data.priority && !validPriority) {
        missingFields.push('priority (must be High, Medium, or Low)');
    }

    if (missingFields.length > 0) {
        elizaLogger.error('Story validation failed:', {
            missingOrInvalidFields: missingFields,
            receivedFields: Object.keys(data || {}),
            receivedValues: {
                summary: data?.summary,
                description: data?.description,
                priority: data?.priority,
                acceptanceCriteria: data?.acceptanceCriteria,
                epicKey: data?.epicKey,
                storyPoints: data?.storyPoints
            }
        });
        return false;
    }

    elizaLogger.info('Story data validation passed:', {
        summary: data.summary?.substring(0, 50) + (data.summary?.length > 50 ? '...' : ''),
        description: data.description?.substring(0, 50) + (data.description?.length > 50 ? '...' : ''),
        acceptanceCriteria: data.acceptanceCriteria,
        priority: data.priority,
        epicKey: data.epicKey,
        storyPoints: data.storyPoints
    });

    return true;
}

// Epic validation
export function validateAndLogEpicData(data: any): data is CreateEpicData {
    if (!data) {
        elizaLogger.error('Epic data is null or undefined');
        return false;
    }

    const missingFields = [];
    if (!data.name) missingFields.push('name');
    if (!data.summary) missingFields.push('summary');
    if (!data.description) missingFields.push('description');
    
    if (missingFields.length > 0) {
        elizaLogger.error('Invalid epic data:', {
            missingOrInvalidFields: missingFields,
            providedData: data
        });
        return false;
    }

    elizaLogger.info('Epic data validation passed:', {
        name: data.name,
        summary: data.summary,
        description: data.description
    });

    return true;
}
