// Types for Jira entities
export type Priority = 'High' | 'Medium' | 'Low';

export interface JiraEpic {
    id?: string;
    key?: string;
    name?: string; // For epic name field
    summary: string;
    description: string;
    status?: string;
}

export interface JiraStory {
    id?: string;
    key?: string;
    summary: string;
    description: string;
    epicKey?: string;
    status?: string;
    storyPoints?: number;
    priority: Priority;
    acceptanceCriteria: string[];
}

export interface JiraServiceConfig {
    host: string;
    email: string;
    apiToken: string;
    project: string;
}

// Action data types
export interface CreateEpicData {
    name: string;
    summary: string;
    description: string;
}

export interface CreateStoryData {
    summary: string;
    description: string;
    acceptanceCriteria: string[];
    priority: Priority;
    epicKey?: string;
    storyPoints?: number;
}
