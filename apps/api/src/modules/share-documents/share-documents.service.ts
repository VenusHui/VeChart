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

  async exportPptxBuffer(shareId: string) {
    const shareDocument = await this.repository.getShareDocument(shareId);
    const pptx = new PPTXGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'VeChart';
    pptx.company = 'VeChart';
    pptx.subject = 'Product Share Document';
    pptx.title = shareDocument.title;

    // Title slide — matching template slide 1 design
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: 'FFFFFF' };
    titleSlide.addText(shareDocument.title, {
      x: 0.67,
      y: 3.05,
      w: 11.5,
      h: 1.39,
      color: '000000',
      fontFace: '微软雅黑',
      fontSize: 36
    });
    if (shareDocument.description) {
      titleSlide.addText(shareDocument.description, {
        x: 0.67,
        y: 4.42,
        w: 11,
        h: 0.6,
        color: '5F5F5F',
        fontFace: '微软雅黑',
        fontSize: 14
      });
    }

    // Product slides — matching template slides 2-7
    for (const [index, item] of shareDocument.items.entries()) {
      const imageData = await this.toDataUri(item.snapshot.imageUrl);
      const slide = pptx.addSlide();
      slide.background = { color: 'FFFFFF' };

      // Product name — (0.40, 0.57)" 24pt bold 微软雅黑
      slide.addText(item.snapshot.productName || `产品 ${index + 1}`, {
        x: 0.4,
        y: 0.57,
        w: 12,
        h: 0.36,
        color: '000000',
        bold: true,
        fontFace: '微软雅黑',
        fontSize: 24
      });

      // Product image — maintain aspect ratio with contain sizing
      if (imageData) {
        slide.addImage({
          data: imageData,
          x: 0.4,
          y: 1.2,
          w: 8.7,
          h: 3.9,
          sizing: { type: 'contain', x: 0.4, y: 1.2, w: 8.7, h: 3.9 }
        });
      }

      // "产品 Spec" label — (0.40, 5.32)" 20pt bold Speedee
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

      // 9-column spec table matching template exactly
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
          { text: '预估尺寸', options: { ...headerOpts, border } },
          { text: 'MOQ', options: { ...headerOpts, border } },
          { text: '预估含税价格\n-低', options: { ...headerOpts, border } },
          { text: '预估含税价格\n-高', options: { ...headerOpts, border } },
          { text: '单次打样时间', options: { ...headerOpts, border } },
          { text: '是否开模', options: { ...headerOpts, border } },
          { text: '预估开模时间', options: { ...headerOpts, border } },
          { text: '预估大货时间', options: { ...headerOpts, border } }
        ],
        [
          { text: item.snapshot.material || '-', options: { ...dataOpts, border } },
          { text: '-', options: { ...dataOpts, border } },
          { text: String(item.snapshot.moq ?? '-'), options: { ...dataOpts, border } },
          { text: item.snapshot.estimatedCost != null ? `¥${item.snapshot.estimatedCost}` : '-', options: { ...dataOpts, border } },
          { text: item.snapshot.marketPrice != null ? `¥${item.snapshot.marketPrice}` : '-', options: { ...dataOpts, border } },
          { text: '-', options: { ...dataOpts, border } },
          { text: '-', options: { ...dataOpts, border } },
          { text: '-', options: { ...dataOpts, border } },
          { text: '-', options: { ...dataOpts, border } }
        ]
      ];

      slide.addTable(tableRows, {
        x: 0.4,
        y: 5.78,
        w: 12.4,
        colW: [1.38, 1.81, 1.23, 1.68, 1.7, 1.21, 0.88, 1.26, 1.27],
        rowH: [0.48, 0.67],
        border: { pt: 0.5, color: 'DB0007' }
      });

      // Links and note below table
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
    }

    const buffer = (await pptx.write({
      outputType: 'nodebuffer'
    })) as Buffer;

    return {
      buffer,
      fileName: `${sanitizeFileName(shareDocument.title)}.pptx`
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
