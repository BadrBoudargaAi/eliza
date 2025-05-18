import { DocxPlugin } from './index';
import path from 'path';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { elizaLogger } from '@elizaos/core';

// Enable debug logging
elizaLogger.level = 'debug';

async function testDocumentCreation() {
    try {
        // Use relative path from the package to workspace root
        const docPath = path.resolve('C:\\Users\\badrb\\elizaos-V2\\Doc');        elizaLogger.info('Document directory path:', docPath);
        elizaLogger.info('Directory exists:', existsSync(docPath));

        // Ensure directory exists
        await mkdir(docPath, { recursive: true });
        elizaLogger.debug('Created output directory');
        
        // Create plugin with explicit output directory
        const plugin = new DocxPlugin({ outputDir: docPath });
        await plugin.init(null as any);
        elizaLogger.debug('Initialized plugin');
        
        // Create a test file first to verify permissions
        const testFilePath = path.join(docPath, 'test-permissions.txt');
        await writeFile(testFilePath, 'Testing write permissions');
        elizaLogger.debug('Test file created successfully at:', testFilePath);
        
        // Create the actual document
        const result = await plugin.createDocument({
            title: "BusinessAnalyst_Requirements_Document",
            content: "Test content for the document"
        });
          elizaLogger.info(`Document created successfully at: ${result}`);
        const exists = existsSync(result);
        elizaLogger.info(`Document exists: ${exists}`);
        
        if (exists) {
            const stats = await import('fs/promises').then(fs => fs.stat(result));
            elizaLogger.info(`Document size: ${stats.size} bytes`);
        }
    } catch (error) {
        elizaLogger.error('Error creating document:', error);
        if (error.code === 'EACCES') {
            elizaLogger.error('Permission denied - cannot write to directory');
        }
        throw error; // Re-throw to see full stack trace
    }
}

testDocumentCreation().catch(console.error);
