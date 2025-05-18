import { test } from 'node:test';
import assert from 'node:assert';
import { DocxService } from '../src/docx-service';
import * as path from 'path';
import * as fs from 'fs';

test('generates document with basic content', async () => {
    const service = new DocxService();
    const outputPath = path.join(process.cwd(), 'tests', 'output');
    const fileName = 'test-doc.docx';

    const options = {
        title: 'Test Document',
        fileName,
        outputPath,
        content: [
            {
                type: 'heading1',
                text: 'Test Heading',
                style: { bold: true }
            },
            {
                type: 'paragraph',
                text: 'This is a test paragraph.',
                style: { italic: true }
            },
            {
                type: 'table',
                tableData: {
                    headers: ['Column 1', 'Column 2'],
                    rows: [
                        ['Data 1', 'Data 2'],
                        ['Data 3', 'Data 4']
                    ]
                }
            }
        ]
    };

    const filePath = await service.generateDocument(options);
    assert.ok(fs.existsSync(filePath), 'Document file should exist');
});
