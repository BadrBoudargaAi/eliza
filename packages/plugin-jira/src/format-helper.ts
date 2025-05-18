import { elizaLogger } from '@elizaos/core';

export interface FormattedUserStory {
    summary: string;
    description: string;
    acceptanceCriteria: string[];
    priority: 'High' | 'Medium' | 'Low';
    epicKey?: string;
    storyPoints?: number;
}

export interface FormatInput {
    description?: string;
    text?: string;
}

export function formatUserStoryFromText(input: string | FormatInput): FormattedUserStory | null {
    const text = typeof input === 'string' ? input : (input.description || input.text || '');
    try {
        // Try to extract user story components
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        
        // Find summary - usually the first line or a line starting with "Title:", "Summary:", etc.
        let summary = lines[0];
        const summaryMatch = lines.find(l => /^(title|summary):/i.test(l));
        if (summaryMatch) {
            summary = summaryMatch.replace(/^(title|summary):\s*/i, '');
        }

        // Find description - look for "As a user..." format
        let description = lines.find(l => /as\s+an?\s+\w+/i.test(l)) || '';
        if (!description) {
            // Try to construct a user story from the input
            description = `As a user, I want to ${summary.toLowerCase()} so that I can `;
        }

        // Find acceptance criteria - look for bullet points or numbered lists
        const acceptanceCriteria = lines
            .filter(l => l.match(/^[-*•]|\d+\.\s+/))
            .map(l => l.replace(/^[-*•]|\d+\.\s+/, '').trim())
            .filter(l => l);

        // If no explicit criteria found, try to extract from remaining lines
        if (acceptanceCriteria.length === 0) {
            const remainingLines = lines
                .filter(l => l !== summary && l !== description)
                .filter(l => !l.match(/^(title|summary|priority):/i));
            
            acceptanceCriteria.push(...remainingLines);
        }

        // Find priority - look for "priority:" or infer from keywords
        let priority: 'High' | 'Medium' | 'Low' = 'Medium';
        const priorityMatch = lines.find(l => /priority:/i.test(l));
        if (priorityMatch) {
            const p = priorityMatch.replace(/^priority:\s*/i, '').toLowerCase();
            if (p.includes('high') || p.includes('critical') || p.includes('urgent')) {
                priority = 'High';
            } else if (p.includes('low') || p.includes('minor')) {
                priority = 'Low';
            }
        }

        // Ensure we have required fields
        if (!summary || !description || acceptanceCriteria.length === 0) {
            return null;
        }

        return {
            summary,
            description,
            acceptanceCriteria,
            priority
        };
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
