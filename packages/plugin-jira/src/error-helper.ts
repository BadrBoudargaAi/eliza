import { elizaLogger } from '@elizaos/core';
import { CreateStoryData } from './types.js';

export function validateAndLogStoryData(data: any): data is CreateStoryData {
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
        elizaLogger.error('Invalid story data:', {
            missingOrInvalidFields: missingFields,
            providedData: data
        });
        return false;
    }

    elizaLogger.info('Story data validation passed:', {
        summary: data.summary,
        description: data.description,
        acceptanceCriteria: data.acceptanceCriteria,
        priority: data.priority
    });

    return true;
}
