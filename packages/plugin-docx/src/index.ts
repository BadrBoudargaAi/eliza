import type { Plugin, Action, IAgentRuntime, Memory } from '@elizaos/core';
import { elizaLogger } from '@elizaos/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { DocxService } from './docx-service.js';

export interface DocxPluginConfig {
    outputDir?: string;
}

interface GenerateDocData {
    fileName: string;
    title?: string;
    content: Array<{
        type: 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'table';
        text?: string;
        style?: {
            bold?: boolean;
            italic?: boolean;
        };
        tableData?: {
            headers: string[];
            rows: string[][];
        };
    }>;
}

const DEFAULT_OUTPUT_DIR = path.resolve('C:\\Users\\badrb\\elizaos-V2\\Doc');

export class DocxPlugin implements Plugin {
    name = '@elizaos/plugin-docx';
    description = 'Plugin for generating Word documents';
    config: DocxPluginConfig = { outputDir: DEFAULT_OUTPUT_DIR };
    runtime: IAgentRuntime;
    private docxService: DocxService;

    constructor(config: DocxPluginConfig = {}) {
        elizaLogger.info('DocxPlugin constructor called with config:', config);
        this.config = { ...this.config, ...config };
        this.docxService = new DocxService();
        elizaLogger.info('Final config:', this.config);
    }

    async init(runtime: IAgentRuntime): Promise<void> {
        elizaLogger.info('DocxPlugin init started');
        this.runtime = runtime;

        // Ensure output directory exists
        const outputDir = path.resolve(this.config.outputDir || DEFAULT_OUTPUT_DIR);
        elizaLogger.info(`Creating directory at: ${outputDir}`);
        
        try {
            if (!existsSync(outputDir)) {
                elizaLogger.debug(`Creating output directory: ${outputDir}`);
                await fs.mkdir(outputDir, { recursive: true });
            }

            // Verify directory is writable with test file
            const testFile = path.join(outputDir, '.write-test');
            elizaLogger.debug(`Testing write permissions with file: ${testFile}`);
            await fs.writeFile(testFile, '');
            await fs.unlink(testFile);

            elizaLogger.info('DocxPlugin initialization successful');
        } catch (err) {
            elizaLogger.error('Failed to initialize DocxPlugin:', err);
            throw err;
        }
    }

    getActions(): Action[] {
        return [
            {
                name: 'docx.generateDocument',
                similes: ['create document', 'generate document', 'create doc', 'make document', 'write document'],
                description: 'Generates a Word document with provided content',                handler: async (runtime: IAgentRuntime, message: Memory) => {
                    try {
                        elizaLogger.info('DocX handler called with message:', message);
                        const data = message.content.data as GenerateDocData;
                        elizaLogger.info('Parsed document data:', data);
                        if (!data || !data.fileName || !Array.isArray(data.content)) {
                            elizaLogger.error('Invalid data structure:', { data });
                            throw new Error('Invalid document data structure');
                        }

                        const filePath = path.join(this.config.outputDir || DEFAULT_OUTPUT_DIR, data.fileName);
                        
                        await this.docxService.generateDocument({
                            fileName: data.fileName,
                            outputPath: this.config.outputDir || DEFAULT_OUTPUT_DIR,
                            title: data.title,
                            content: data.content
                        });

                        await runtime.messageManager.createMemory({
                            content: { 
                                text: `Document generated successfully and saved to: ${filePath}` 
                            },
                            roomId: message.roomId,
                            userId: runtime.agentId,
                            agentId: runtime.agentId
                        });

                        return true;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        elizaLogger.error('Error in generateDocument action:', errorMessage);
                        
                        await runtime.messageManager.createMemory({
                            content: { text: `Failed to generate document: ${errorMessage}` },
                            roomId: message.roomId,
                            userId: runtime.agentId,
                            agentId: runtime.agentId
                        });
                        
                        return false;
                    }
                },
                validate: async (runtime: IAgentRuntime, message: Memory) => {
                    const text = message.content.text.toLowerCase();
                    return text.includes('document') || 
                           text.includes('doc') || 
                           text.includes('requirements');
                },
                examples: [[{
                    user: "user1",
                    content: {
                        text: "Generate a requirements document"
                    }
                }, {
                    user: "Assistant",
                    content: {
                        text: "I'll generate a requirements document for you.",
                        action: "docx.generateDocument",
                        data: {
                            fileName: "requirements.docx",
                            title: "Requirements Document",
                            content: [{
                                type: "heading1",
                                text: "Requirements Document",
                                style: { bold: true }
                            }, {
                                type: "paragraph",
                                text: "This document outlines the requirements for the project."
                            }]
                        }
                    }
                }]]
            }
        ];
    }
}

// Export default instance
export default new DocxPlugin();