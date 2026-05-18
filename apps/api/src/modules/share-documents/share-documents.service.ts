import { Injectable } from '@nestjs/common';
import PPTXGenJS from 'pptxgenjs';

import { PostgresRepository } from '../../data/postgres.repository';
import { CreateShareDocumentDto } from './share-documents.dto';

@Injectable()
export class ShareDocumentsService {
  constructor(private readonly repository: PostgresRepository) {}

  listShareDocuments() {
    return this.repository.listShareDocuments();
  }

  getShareDocument(shareId: string) {
    return this.repository.getShareDocument(shareId);
  }

  createShareDocument(userId: string, dto: CreateShareDocumentDto) {
    return this.repository.createShareDocument({
      ...dto,
      createdBy: userId
    });
  }

  async exportPdf(shareId: string) {
    const shareDocument = await this.repository.getShareDocument(shareId);
    return {
      shareId,
      title: shareDocument.title,
      exportStatus: 'print-template-ready',
      message: 'Use the redesigned print sheet to export high-quality PDF from browser.'
    };
  }

  async exportPptxBuffer(shareId: string, template: 'default' | 'sales' | 'spec' = 'default') {
    const shareDocument = await this.repository.getShareDocument(shareId);
    const pptx = new PPTXGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'VeChart';
    pptx.company = 'VeChart';
    pptx.subject = 'Product Share Document';
    pptx.title = shareDocument.title;

    if (template === 'sales') {
      const titleSlide = pptx.addSlide();
      titleSlide.background = { color: 'F5EEE7' };
      titleSlide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: 13.33,
        h: 1.55,
        fill: { color: '5E2D23' },
        line: { color: '5E2D23', pt: 0 }
      });
      titleSlide.addText('Sales Collection', {
        x: 0.8,
        y: 0.52,
        w: 7,
        h: 0.45,
        color: 'FDE8D5',
        bold: true,
        fontFace: 'Aptos Display',
        fontSize: 22
      });
      titleSlide.addText(shareDocument.title, {
        x: 0.8,
        y: 2.1,
        w: 11.8,
        h: 1,
        color: '3A1F18',
        bold: true,
        fontFace: 'Aptos Display',
        fontSize: 38
      });
      titleSlide.addShape(pptx.ShapeType.line, {
        x: 0.8,
        y: 3.45,
        w: 4.2,
        h: 0,
        line: { color: 'D67C4A', pt: 2.5 }
      });
      titleSlide.addText(shareDocument.description || '产品销售展示模板', {
        x: 0.8,
        y: 3.75,
        w: 8.2,
        h: 0.6,
        color: '805C4A',
        fontFace: 'Aptos',
        fontSize: 16
      });
      titleSlide.addText(`共 ${shareDocument.items.length} 个产品`, {
        x: 0.8,
        y: 6.45,
        w: 4.4,
        h: 0.35,
        color: '8D5E49',
        fontSize: 12
      });
    } else if (template === 'spec') {
      const titleSlide = pptx.addSlide();
      titleSlide.background = { color: 'FFFFFF' };
      titleSlide.addText(shareDocument.title, {
        x: 0.67,
        y: 2.8,
        w: 11.5,
        h: 1.4,
        color: '000000',
        fontFace: '微软雅黑',
        fontSize: 36
      });
      if (shareDocument.description) {
        titleSlide.addText(shareDocument.description, {
          x: 0.67,
          y: 4.3,
          w: 11,
          h: 0.6,
          color: '5F5F5F',
          fontFace: '微软雅黑',
          fontSize: 14
        });
      }
    } else {
      const titleSlide = pptx.addSlide();
      titleSlide.background = { color: '0F2A43' };
      titleSlide.addShape(pptx.ShapeType.rect, {
        x: 0.45,
        y: 0.45,
        w: 12.4,
        h: 0.25,
        fill: { color: 'FF9B42' },
        line: { color: 'FF9B42', pt: 0 }
      });
      titleSlide.addText('VeChart Product Deck', {
        x: 0.6,
        y: 0.9,
        w: 8.5,
        h: 0.45,
        color: 'FFCC93',
        bold: true,
        fontFace: 'Aptos Display',
        fontSize: 18
      });
      titleSlide.addText(shareDocument.title, {
        x: 0.6,
        y: 1.6,
        w: 11.8,
        h: 1.2,
        color: 'FFFFFF',
        bold: true,
        fontFace: 'Aptos Display',
        fontSize: 34
      });
      titleSlide.addText(shareDocument.description || '产品分享文档', {
        x: 0.6,
        y: 3.1,
        w: 11.2,
        h: 0.8,
        color: 'C9D6EA',
        fontFace: 'Aptos',
        fontSize: 16
      });
    }

    for (const [index, item] of shareDocument.items.entries()) {
      const imageData = await this.toDataUri(item.snapshot.imageUrl);
      const slide = pptx.addSlide();

      if (template === 'spec') {
        slide.background = { color: 'FFFFFF' };

        slide.addText(item.snapshot.productName || `产品 ${index + 1}`, {
          x: 0.4,
          y: 0.57,
          w: 8.5,
          h: 0.36,
          color: '000000',
          bold: true,
          fontFace: '微软雅黑',
          fontSize: 24
        });

        if (imageData) {
          slide.addImage({
            data: imageData,
            x: 0.4,
            y: 1.2,
            w: 8.7,
            h: 4.0,
            sizing: { type: 'contain', x: 0.4, y: 1.2, w: 8.7, h: 4.0 }
          });
        }

        slide.addText('产品 Spec', {
          x: 0.4,
          y: 5.32,
          w: 2.5,
          h: 0.3,
          color: '000000',
          bold: true,
          fontFace: 'Speedee',
          fontSize: 20
        });

        const headerOpts = {
          fill: { color: 'DB0007' },
          color: 'FFFFFF',
          bold: true,
          fontSize: 12,
          fontFace: '微软雅黑',
          align: 'center' as const,
          valign: 'middle' as const
        };
        const dataOpts = {
          fill: { color: 'FFFFFF' },
          color: '000000',
          fontSize: 14,
          fontFace: '微软雅黑',
          align: 'center' as const,
          valign: 'middle' as const
        };
        const border = { pt: 0.5, color: 'DB0007' };

        const tableRows = [
          [
            { text: '主体材质', options: { ...headerOpts, border } },
            { text: 'MOQ', options: { ...headerOpts, border } },
            { text: '市场售价', options: { ...headerOpts, border } },
            { text: '预估成本', options: { ...headerOpts, border } }
          ],
          [
            { text: item.snapshot.material || '-', options: { ...dataOpts, border } },
            { text: String(item.snapshot.moq ?? '-'), options: { ...dataOpts, border } },
            { text: item.snapshot.marketPrice != null ? `¥${item.snapshot.marketPrice}` : '-', options: { ...dataOpts, border } },
            { text: item.snapshot.estimatedCost != null ? `¥${item.snapshot.estimatedCost}` : '-', options: { ...dataOpts, border } }
          ]
        ];

        slide.addTable(tableRows, {
          x: 0.4,
          y: 5.78,
          w: 12.4,
          colW: [3.1, 3.1, 3.1, 3.1],
          rowH: [0.48, 0.67],
          border: { pt: 0.5, color: 'DB0007' }
        });

        const linkY = 7.0;
        slide.addText(`产品链接: ${item.snapshot.productUrl || '-'}`, {
          x: 0.4,
          y: linkY,
          w: 12.4,
          h: 0.2,
          color: '5F5F5F',
          fontSize: 8
        });
        slide.addText(`1688链接: ${item.snapshot.product1688Url || '-'}`, {
          x: 0.4,
          y: linkY + 0.17,
          w: 12.4,
          h: 0.2,
          color: '5F5F5F',
          fontSize: 8
        });
        if (item.snapshot.note) {
          slide.addText(`备注: ${item.snapshot.note}`, {
            x: 0.4,
            y: linkY + 0.34,
            w: 12.4,
            h: 0.2,
            color: '5F5F5F',
            fontSize: 8
          });
        }
      } else if (template === 'sales') {
        slide.background = { color: 'FCF7F2' };
        slide.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: 13.33,
          h: 0.68,
          fill: { color: '5E2D23' },
          line: { color: '5E2D23', pt: 0 }
        });
        slide.addText(`HOT PICK ${String(index + 1).padStart(2, '0')}`, {
          x: 0.62,
          y: 0.19,
          w: 3,
          h: 0.28,
          color: 'FFD6B0',
          fontFace: 'Aptos',
          bold: true,
          fontSize: 11
        });

        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.55,
          y: 0.95,
          w: 8.35,
          h: 5.95,
          rectRadius: 0.06,
          fill: { color: 'FFFDFC' },
          line: { color: 'E4D7CC', pt: 1 }
        });

        if (imageData) {
          slide.addImage({
            data: imageData,
            x: 0.8,
            y: 1.2,
            w: 7.85,
            h: 5.45,
            sizing: { type: 'contain', x: 0.8, y: 1.2, w: 7.85, h: 5.45 }
          });
        }

        slide.addShape(pptx.ShapeType.roundRect, {
          x: 9.15,
          y: 0.95,
          w: 3.65,
          h: 5.95,
          rectRadius: 0.06,
          fill: { color: 'FFFFFF' },
          line: { color: 'E8DED5', pt: 1 }
        });

        slide.addText(item.snapshot.productName || `Product ${index + 1}`, {
          x: 9.45,
          y: 1.25,
          w: 3.15,
          h: 0.85,
          color: '2D1A15',
          bold: true,
          fontFace: 'Aptos Display',
          fontSize: 20
        });
        slide.addText(item.snapshot.material || '未知材质', {
          x: 9.45,
          y: 2.08,
          w: 3.15,
          h: 0.24,
          color: '8A685A',
          fontSize: 10
        });

        const specs = [
          ['市场售价', `¥${item.snapshot.marketPrice ?? '-'}`],
          ['预估成本', `¥${item.snapshot.estimatedCost ?? '-'}`],
          ['MOQ', String(item.snapshot.moq ?? '-')],
          ['材质', item.snapshot.material || '-']
        ];
        specs.forEach(([label, value], idx) => {
          slide.addText(label, {
            x: 9.45,
            y: 2.62 + idx * 0.83,
            w: 1.15,
            h: 0.2,
            color: '8C6E60',
            fontSize: 10
          });
          slide.addText(value, {
            x: 10.65,
            y: 2.59 + idx * 0.83,
            w: 1.9,
            h: 0.25,
            color: '38241E',
            bold: true,
            fontSize: 11
          });
        });

        slide.addText(`产品链接: ${item.snapshot.productUrl || '-'}`, {
          x: 0.62,
          y: 7.03,
          w: 12.1,
          h: 0.22,
          color: '6E564A',
          fontSize: 8
        });
        slide.addText(`1688链接: ${item.snapshot.product1688Url || '-'}`, {
          x: 0.62,
          y: 7.25,
          w: 12.1,
          h: 0.22,
          color: '6E564A',
          fontSize: 8
        });
        if (item.snapshot.note) {
          slide.addText(`备注: ${item.snapshot.note}`, {
            x: 0.62,
            y: 7.47,
            w: 12.1,
            h: 0.22,
            color: '6E564A',
            fontSize: 8
          });
        }
      } else {
        slide.background = { color: 'F6F8FC' };
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.45,
          y: 0.35,
          w: 12.4,
          h: 6.75,
          rectRadius: 0.08,
          fill: { color: 'FFFFFF' },
          line: { color: 'DCE5F5', pt: 1.2 }
        });

        slide.addText(`No.${index + 1}`, {
          x: 0.75,
          y: 0.65,
          w: 1.1,
          h: 0.3,
          color: '0B4A6B',
          bold: true,
          fontSize: 12
        });

        slide.addText(item.snapshot.productName || `Product ${index + 1}`, {
          x: 0.75,
          y: 0.95,
          w: 7.2,
          h: 0.6,
          color: '14213D',
          bold: true,
          fontFace: 'Aptos Display',
          fontSize: 24
        });

        slide.addText(item.snapshot.material || '未知材质', {
          x: 0.75,
          y: 1.6,
          w: 4.5,
          h: 0.3,
          color: '546179',
          fontFace: 'Aptos',
          fontSize: 12
        });

        if (imageData) {
          slide.addImage({
            data: imageData,
            x: 0.75,
            y: 2.05,
            w: 7.1,
            h: 4.65,
            sizing: { type: 'contain', x: 0.75, y: 2.05, w: 7.1, h: 4.65 }
          });
        }

        slide.addShape(pptx.ShapeType.roundRect, {
          x: 8.2,
          y: 2.05,
          w: 4.1,
          h: 4.65,
          rectRadius: 0.06,
          fill: { color: 'F2F6FF' },
          line: { color: 'D5DFF3', pt: 1 }
        });

        const specs = [
          ['市场售价', `¥${item.snapshot.marketPrice ?? '-'}`],
          ['预估成本', `¥${item.snapshot.estimatedCost ?? '-'}`],
          ['MOQ', String(item.snapshot.moq ?? '-')],
          ['材质', item.snapshot.material || '-']
        ];

        specs.forEach(([label, value], idx) => {
          slide.addText(label, {
            x: 8.45,
            y: 2.3 + idx * 1.02,
            w: 3.5,
            h: 0.22,
            color: '667189',
            fontSize: 11
          });
          slide.addText(value, {
            x: 8.45,
            y: 2.56 + idx * 1.02,
            w: 3.5,
            h: 0.28,
            color: '1B2A46',
            bold: true,
            fontSize: 14
          });
        });

        slide.addText(`产品链接: ${item.snapshot.productUrl || '-'}`, {
          x: 0.75,
          y: 6.86,
          w: 11.5,
          h: 0.26,
          color: '4D5D7A',
          fontSize: 9
        });
        slide.addText(`1688链接: ${item.snapshot.product1688Url || '-'}`, {
          x: 0.75,
          y: 7.1,
          w: 11.5,
          h: 0.26,
          color: '4D5D7A',
          fontSize: 9
        });
        if (item.snapshot.note) {
          slide.addText(`备注: ${item.snapshot.note}`, {
            x: 0.75,
            y: 7.34,
            w: 11.5,
            h: 0.26,
            color: '4D5D7A',
            fontSize: 9
          });
        }
      }
    }

    const buffer = (await pptx.write({
      outputType: 'nodebuffer'
    })) as Buffer;

    return {
      buffer,
      fileName: `${sanitizeFileName(shareDocument.title)}${template === 'sales' ? '-sales' : template === 'spec' ? '-spec' : ''}.pptx`
    };
  }

  private async toDataUri(imageUrl: string) {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return null;
      }
      const contentType = response.headers.get('content-type') ?? 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return `data:${contentType};base64,${base64}`;
    } catch {
      return null;
    }
  }
}

function sanitizeFileName(input: string) {
  const normalized = input.trim().replace(/[\\/:*?"<>|]+/g, '-');
  return normalized || 'share-document';
}
