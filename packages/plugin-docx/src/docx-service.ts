import { 
    Document, 
    Paragraph, 
    TextRun, 
    HeadingLevel as HeadingLevelEnum, 
    Table, 
    TableRow, 
    TableCell, 
    WidthType, 
    AlignmentType as AlignmentTypeEnum, 
    BorderStyle,
    IRunOptions,
    Packer
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import { elizaLogger } from '@elizaos/core';

export interface DocxOptions {
    title?: string;
    content: ContentBlock[];
    fileName: string;
    outputPath: string;
}

export interface ContentBlock {
    type: 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'table';
    text?: string;
    tableData?: TableData;
    style?: ContentStyle;
}

export interface TableData {
    headers: string[];
    rows: string[][];
}

export interface ContentStyle {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    alignment?: 'left' | 'center' | 'right' | 'justify';
    color?: string;
}

export class DocxService {
    private getHeadingLevel(type: string) {
        switch (type) {
            case 'heading1': return HeadingLevelEnum.HEADING_1;
            case 'heading2': return HeadingLevelEnum.HEADING_2;
            case 'heading3': return HeadingLevelEnum.HEADING_3;
            default: return HeadingLevelEnum.HEADING_1;
        }
    }

    private createTextRun(text: string, style?: ContentStyle): TextRun {
        return new TextRun({
            text,
            bold: style?.bold,
            italics: style?.italic,
            underline: style?.underline ? {} : undefined,
            color: style?.color
        });
    }

    private createTableRow(cells: string[], isHeader: boolean = false): TableRow {
        return new TableRow({
            children: cells.map(cell => new TableCell({
                children: [new Paragraph({
                    children: [this.createTextRun(cell, { bold: isHeader })]
                })],
                width: {
                    size: 100 / cells.length,
                    type: WidthType.PERCENTAGE
                }
            }))
        });
    }

    private createTable(data: TableData): Table {
        const rows = [
            this.createTableRow(data.headers, true),
            ...data.rows.map(row => this.createTableRow(row))
        ];

        return new Table({
            width: {
                size: 100,
                type: WidthType.PERCENTAGE
            },
            borders: {
                top: { style: BorderStyle.SINGLE, size: 1 },
                bottom: { style: BorderStyle.SINGLE, size: 1 },
                left: { style: BorderStyle.SINGLE, size: 1 },
                right: { style: BorderStyle.SINGLE, size: 1 },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
                insideVertical: { style: BorderStyle.SINGLE, size: 1 }
            },
            rows
        });
    }

    private getAlignment(alignment?: string) {
        switch (alignment) {
            case 'center': return AlignmentTypeEnum.CENTER;
            case 'right': return AlignmentTypeEnum.RIGHT;
            case 'justify': return AlignmentTypeEnum.JUSTIFIED;
            default: return AlignmentTypeEnum.LEFT;
        }
    }

    private createBlock(block: ContentBlock): Paragraph | Table {
        if (block.type === 'table' && block.tableData) {
            return this.createTable(block.tableData);
        }

        return new Paragraph({
            children: [this.createTextRun(block.text || '', block.style)],
            heading: block.type === 'heading1' || block.type === 'heading2' || block.type === 'heading3' ? 
                    this.getHeadingLevel(block.type) : undefined,
            alignment: block.style?.alignment ? this.getAlignment(block.style.alignment) : undefined
        });
    }

    async generateDocument(options: DocxOptions): Promise<string> {
        try {
            elizaLogger.info('Generating document:', { fileName: options.fileName });

            const doc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        ...(options.title ? [new Paragraph({
                            text: options.title,
                            heading: HeadingLevelEnum.TITLE,
                            alignment: AlignmentTypeEnum.CENTER
                        })] : []),
                        ...options.content.map(block => this.createBlock(block))
                    ]
                }]
            });

            // Ensure the output directory exists
            const dir = options.outputPath;
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const filePath = path.join(dir, options.fileName);
            const buffer = await Packer.toBuffer(doc);
            await fs.promises.writeFile(filePath, buffer);

            elizaLogger.info(`Document generated successfully: ${filePath}`);
            return filePath;
        } catch (error) {
            elizaLogger.error('Error generating document:', error);
            throw error;
        }
    }
}
