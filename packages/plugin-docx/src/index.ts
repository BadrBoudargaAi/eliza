import type { Plugin, Action, IAgentRuntime } from '@elizaos/core';
import { elizaLogger } from '@elizaos/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

export interface DocxPluginConfig {
    outputDir?: string;
}

interface CreateDocumentParams {
    title: string;
    content: string;
}

const DEFAULT_OUTPUT_DIR = path.resolve('C:\\Users\\badrb\\elizaos-V2\\Doc');

const isValidCreateDocumentParams = (params: any): params is CreateDocumentParams => {
    return (
        params &&
        typeof params.title === 'string' &&
        typeof params.content === 'string'
    );
};

export class DocxPlugin implements Plugin {
    name = 'docx';
    description = 'Plugin for generating Word documents';
    config: DocxPluginConfig = { outputDir: DEFAULT_OUTPUT_DIR };
    runtime: IAgentRuntime;
    private docxLib: any;

    constructor(config: DocxPluginConfig = {}) {
        elizaLogger.info('DocxPlugin constructor called with config:', config);
        this.config = { ...this.config, ...config };
        elizaLogger.info('Final config:', this.config);
    }

    async init(runtime: IAgentRuntime): Promise<void> {
        elizaLogger.info('DocxPlugin init started');
        this.runtime = runtime;
        this.docxLib = await import('docx');
        elizaLogger.info('Initialized DocxPlugin with runtime');

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

            elizaLogger.info('DocxPlugin initialization successful');
        } catch (err) {
            elizaLogger.error('Failed to initialize DocxPlugin:', err);
            throw err;
        }
    }

    async createDocument(params: CreateDocumentParams): Promise<string> {
        try {
            const { title, content } = params;
            elizaLogger.info(`Starting document creation for title: ${title}`);
            elizaLogger.info(`Using output directory: ${this.config.outputDir}`);

            const { Document, Paragraph, TextRun, Packer } = this.docxLib;
            elizaLogger.info('Loaded docx classes');

            // Create document
            const doc = new Document({
                sections: [{
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: title,
                                    bold: true,
                                    size: 24
                                })
                            ]
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: content
                                })
                            ]
                        })
                    ]
                }]
            });
            elizaLogger.info('Document object created');

            // Generate filename from title
            const filename = path.join(this.config.outputDir || DEFAULT_OUTPUT_DIR, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`);
            elizaLogger.info(`Will save document to: ${filename}`);

            // Create buffer
            const buffer = await Packer.toBuffer(doc);
            elizaLogger.info(`Document buffer created, size: ${buffer.length} bytes`);
            
            // Save the document
            await fs.writeFile(filename, buffer);
            elizaLogger.info('Document file written to disk');

            // Verify file exists and has content
            if (existsSync(filename)) {
                const stats = await fs.stat(filename);
                elizaLogger.info(`Document created successfully. File size: ${stats.size} bytes`);
            } else {
                throw new Error('Document creation failed - file does not exist');
            }

            return filename;
        } catch (error) {
            elizaLogger.error('Error in createDocument:', error);
            if (error.code === 'EACCES') {
                elizaLogger.error('Permission denied - cannot write to directory');
            }
            throw error;
        }
    }

    getActions(): Action[] {
        return [
            {
                name: 'create-document',
                similes: ['create a document', 'make a document', 'generate a document'],
                description: 'Create a Word document with a title and content',
                examples: [[
                    {
                        user: 'user',
                        content: {
                            text: 'Create a document titled "Meeting Notes" with content "Topics discussed: AI and ML"'
                        }
                    }
                ]],
                handler: async (runtime: IAgentRuntime, params: any) => {
                    if (!isValidCreateDocumentParams(params)) {
                        throw new Error('Invalid parameters for create-document action');
                    }
                    return this.createDocument(params);
                },
                validate: async (params: any) => {
                    return isValidCreateDocumentParams(params);
                }
            }
        ];
    }

    async runAction(action: string, params: any): Promise<any> {
        switch (action) {
            case 'create-document':
                return this.createDocument(params);
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }
}

// Export default instance
export default new DocxPlugin();