import { Injectable } from '@nestjs/common';
import PPTXGenJS from 'pptxgenjs';
import sharp from 'sharp';

import { PostgresRepository } from '../../data/postgres.repository';
import { ProductMetadata } from '../../common/types';
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

    // Title slide — matching template slide 1
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: 'FFFFFF' };
    titleSlide.addText(shareDocument.title, {
      x: 0.43, y: 2.82, w: 12, h: 1.2,
      color: '000000', bold: true,
      fontFace: 'Microsoft YaHei', fontSize: 42,
      margin: 0
    });
    if (shareDocument.description) {
      titleSlide.addText(shareDocument.description, {
        x: 0.43, y: 4.65, w: 12, h: 0.5,
        color: '5F5F5F',
        fontFace: 'Microsoft YaHei', fontSize: 14,
        margin: 0
      });
    }

    // Product slides — one per share document item
    for (const [index, item] of shareDocument.items.entries()) {
      const imageInfo = await this.toImageInfo(item.snapshot.imageUrl);
      const slide = pptx.addSlide();
      slide.background = { color: 'FFFFFF' };

      // Product name at top — (0.40, 0.40)"
      slide.addText(item.snapshot.productName || `产品 ${index + 1}`, {
        x: 0.40, y: 0.40, w: 12, h: 0.50,
        color: '000000', bold: true,
        fontFace: 'Microsoft YaHei', fontSize: 42,
        margin: 0
      });

      // Product image on right — matching template reference image position (9.37, 1.88)"
      if (imageInfo) {
        // "产品参考：" label
        slide.addText('产品参考：', {
          x: 9.40, y: 1.42, w: 3.27, h: 0.30,
          color: '000000',
          fontFace: 'Microsoft YaHei', fontSize: 12,
          margin: 0
        });

        // Reference image on right — aspect-ratio-preserved within max 3.27"x3.75"
        const refAreaW = 3.27;
        const refAreaH = 3.75;
        const refScale = Math.min(refAreaW / imageInfo.width, refAreaH / imageInfo.height, 1.0);
        slide.addImage({
          data: imageInfo.dataUri,
          x: 9.37, y: 1.88,
          w: imageInfo.width * refScale, h: imageInfo.height * refScale,
          sizing: { type: 'contain', w: imageInfo.width * refScale, h: imageInfo.height * refScale }
        });
      }

      // "产品 Spec" label
      slide.addText('产品 Spec', {
        x: 0.40, y: 5.67, w: 2.5, h: 0.30,
        color: '000000', bold: true,
        fontFace: 'Microsoft YaHei', fontSize: 20,
        margin: 0
      });

      // 9-column spec table — factory functions avoid PptxGenJS object mutation bug
      const makeHeaderOpts = function () {
        return {
          fill: { color: 'DB0007' },
          color: 'FFFFFF',
          bold: true,
          fontSize: 12,
          fontFace: 'Microsoft YaHei',
          align: 'center' as const,
          valign: 'middle' as const,
          border: { pt: 0.5, color: 'DB0007' }
        };
      };
      const makeDataOpts = function () {
        return {
          fill: { color: 'FFFFFF' },
          color: '000000',
          fontSize: 14,
          fontFace: 'Microsoft YaHei',
          align: 'center' as const,
          valign: 'middle' as const,
          border: { pt: 0.5, color: 'DB0007' }
        };
      };

      const snap = item.snapshot as ProductMetadata & {
        estimatedCostMin?: number | null;
        estimatedCostMax?: number | null;
      };

      const formatCost = (value: number | null | undefined) =>
        value != null ? `¥${value}` : '-';
      const formatDays = (value: number | null | undefined) =>
        value != null ? `${value}天` : '-';

      const tableRows = [
        [
          { text: '主体材质', options: makeHeaderOpts() },
          { text: '预估尺寸', options: makeHeaderOpts() },
          { text: 'MOQ', options: makeHeaderOpts() },
          { text: '预估含税价格\n-低', options: makeHeaderOpts() },
          { text: '预估含税价格\n-高', options: makeHeaderOpts() },
          { text: '单次打样时间', options: makeHeaderOpts() },
          { text: '是否开模', options: makeHeaderOpts() },
          { text: '预估开模时间', options: makeHeaderOpts() },
          { text: '预估大货时间', options: makeHeaderOpts() }
        ],
        [
          { text: snap.material || '-', options: makeDataOpts() },
          { text: snap.estimatedSize || '-', options: makeDataOpts() },
          { text: snap.moq != null ? String(snap.moq) : '-', options: makeDataOpts() },
          { text: formatCost(snap.estimatedCostMin), options: makeDataOpts() },
          { text: formatCost(snap.estimatedCostMax), options: makeDataOpts() },
          { text: formatDays(snap.samplingTime), options: makeDataOpts() },
          { text: snap.moldRequired || '-', options: makeDataOpts() },
          { text: snap.moldTime != null ? `${snap.moldTime}天` : (snap.moldRequired === '否' ? '/' : '-'), options: makeDataOpts() },
          { text: formatDays(snap.bulkProductionTime), options: makeDataOpts() }
        ]
      ];

      slide.addTable(tableRows, {
        x: 0.40, y: 6.05, w: 12.4,
        colW: [1.38, 1.81, 1.23, 1.68, 1.7, 1.21, 0.88, 1.26, 1.27],
        rowH: [0.48, 0.67]
      });
    }

    const buffer = (await pptx.write({
      outputType: 'nodebuffer'
    })) as Buffer;

    return {
      buffer,
      fileName: `${sanitizeFileName(shareDocument.title)}.pptx`
    };
  }

  private async toImageInfo(imageUrl: string): Promise<{
    dataUri: string;
    width: number;
    height: number;
  } | null> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) return null;
      const contentType = response.headers.get('content-type') ?? 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const metadata = await sharp(buffer).metadata();
      const width = metadata.width ?? 800;
      const height = metadata.height ?? 600;
      const base64 = buffer.toString('base64');
      return { dataUri: `data:${contentType};base64,${base64}`, width, height };
    } catch {
      return null;
    }
  }
}

function sanitizeFileName(input: string) {
  const normalized = input.trim().replace(/[\\/:*?"<>|]+/g, '-');
  return normalized || 'share-document';
}
