import { elizaLogger } from '@elizaos/core';
import { Priority } from './types.js';

export interface FormattedUserStory {
    summary: string;
    description: string;
    acceptanceCriteria: string[];
    priority: Priority;
    epicKey?: string;
    storyPoints?: number;
}

export interface FormatInput {
    description?: string;
    text?: string;
}

export function formatUserStoryFromText(input: string | FormatInput): FormattedUserStory | null {
    elizaLogger.debug('Formatting user story from input:', input);
    
    // Handle input type
    const text = typeof input === 'string' ? input : (input.description || input.text || '');
    if (!text) {
        elizaLogger.error('Empty input text');
        return null;
    }

    try {
        // Split and clean lines
        const lines = text.split('\n')
            .map(l => l.trim())
            .filter(l => l);

        // Find summary
        let summary = '';
        const summaryMatch = lines.find(l => /^(title|summary):/i.test(l)) ||
                           lines.find(l => !l.toLowerCase().includes('as a'));
        if (summaryMatch) {
            summary = summaryMatch.replace(/^(title|summary):\s*/i, '');
        } else {
            summary = lines[0];
        }

        // Find description - look for "As a user..." format
        let description = '';
        const descMatch = lines.find(l => /as\s+an?\s+\w+.*,\s*i\s+want\s+to/i.test(l));
        if (descMatch) {
            description = descMatch;
        } else {
            // Try to find any line that might be a description
            const descLine = lines.find(l => l !== summary && l.length > 20);
            if (descLine) {
                description = descLine;
            }
            // If still no description, construct one from summary
            if (!description) {
                description = `As a user, I want to ${summary.toLowerCase()} so that I can improve functionality`;
            }
        }

        // Find or parse priority
        let priority: Priority = 'Medium'; // Default priority
        const priorityMatch = lines.find(l => /priority:\s*(high|medium|low)/i.test(l));
        if (priorityMatch) {
            const match = priorityMatch.match(/priority:\s*(high|medium|low)/i);
            if (match) {
                priority = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() as Priority;
            }
        }

        // Find acceptance criteria
        let acceptanceCriteria: string[] = [];
        
        // Look for an acceptance criteria section
        const acStart = lines.findIndex(l => 
            /^(acceptance\s+criteria|criteria|requirements|acceptance\s+test)s?:/i.test(l)
        );
        
        if (acStart !== -1) {
            // Take all items after the "Acceptance Criteria:" line that look like list items
            acceptanceCriteria = lines.slice(acStart + 1)
                .filter(l => /^[-*•]|\d+\.|[a-z]\)|\[\s?\]|\[x\]/i.test(l))
                .map(l => l.replace(/^[-*•]|\d+\.|[a-z]\)|\[\s?\]|\[x\]/, '').trim());
        }

        // If no explicit criteria found, try to extract from remaining lines
        if (acceptanceCriteria.length === 0) {
            const remainingLines = lines
                .filter(l => l !== summary && l !== description)
                .filter(l => !l.match(/^(title|summary|priority|acceptance\s+criteria):/i));
            
            // If we have remaining lines, use them as criteria
            if (remainingLines.length > 0) {
                acceptanceCriteria = remainingLines.map(line => 
                    line.replace(/^[-*•]|\d+\.|[a-z]\)|\[\s?\]|\[x\]/, '').trim()
                );
            } else {
                // Create a basic acceptance criterion if none found
                acceptanceCriteria = ['Feature should be implemented according to specifications'];
            }
        }

        // Validate and create story
        if (summary && description && acceptanceCriteria.length > 0) {
            const story: FormattedUserStory = {
                summary: summary.trim(),
                description: description.trim(),
                acceptanceCriteria: acceptanceCriteria.filter(c => c.length > 0),
                priority
            };
            
            elizaLogger.debug('Successfully formatted user story:', story);
            return story;
        }

        elizaLogger.error('Failed to format user story - missing required fields:', {
            hasSummary: Boolean(summary),
            hasDescription: Boolean(description),
            criteriaCount: acceptanceCriteria.length
        });
        return null;

    } catch (error) {
        elizaLogger.error('Error formatting user story:', error);
        return null;
    }
}

export function formatUserStoryToText(story: FormattedUserStory): string {
    return `Summary: ${story.summary}

Description:
${story.description}

Acceptance Criteria:
${story.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Priority: ${story.priority}`;
}
