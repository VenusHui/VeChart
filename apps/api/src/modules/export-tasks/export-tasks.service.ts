import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import fs from 'fs/promises';
import path from 'path';

import { PostgresRepository } from '../../data/postgres.repository';
import { PhotoAnalysisService } from '../photos/photo-analysis.service';
import { ShareDocumentsService } from '../share-documents/share-documents.service';

const EXPORT_DIR = path.join(process.cwd(), 'exports');

@Injectable()
export class ExportTasksService implements OnModuleInit {
  private readonly logger = new Logger(ExportTasksService.name);
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly repository: PostgresRepository,
    private readonly analysisService: PhotoAnalysisService,
    private readonly shareDocumentsService: ShareDocumentsService
  ) {}

  async onModuleInit() {
    await fs.mkdir(EXPORT_DIR, { recursive: true });
    const stuckDocs = await this.repository.listShareDocumentsByStatuses(['analyzing', 'generating']);
    for (const doc of stuckDocs) {
      this.logger.log(`Recovering stuck export task for share document ${doc.id}`);
      this.enqueueExportTask(doc.id);
    }
  }

  enqueueExportTask(shareId: string) {
    if (this.inFlight.has(shareId)) {
      return;
    }
    this.inFlight.add(shareId);
    setTimeout(() => {
      void this.runExportTask(shareId).finally(() => {
        this.inFlight.delete(shareId);
      });
    }, 0);
  }

  private async runExportTask(shareId: string) {
    try {
      const doc = await this.repository.getShareDocument(shareId);
      const unifiedMoq = doc.unifiedMoq;
      const skipAnalysis = doc.status === 'generating';

      if (!skipAnalysis) {
        await this.repository.updateShareDocumentStatus(shareId, 'analyzing', 0);

        for (const [index, item] of doc.items.entries()) {
          const photo = await this.repository.getPhoto(item.photoId);
          const result = await this.analysisService.analyzePhotoForExport(photo, unifiedMoq);

          await this.repository.updateShareDocumentItemSnapshot(item.id, {
            productName: result.suggestedMetadata.productName ?? photo.metadata.productName ?? '',
            material: result.suggestedMetadata.material ?? photo.metadata.material ?? '',
            productUrl: result.suggestedMetadata.productUrl || photo.metadata.productUrl || '',
            product1688Url: result.suggestedMetadata.product1688Url || photo.metadata.product1688Url || '',
            marketPrice: result.suggestedMetadata.marketPrice ?? photo.metadata.marketPrice,
            estimatedCost: result.suggestedMetadata.estimatedCost ?? photo.metadata.estimatedCost,
            moq: unifiedMoq ?? result.suggestedMetadata.moq ?? photo.metadata.moq,
            note: result.suggestedMetadata.note || photo.metadata.note || '',
            estimatedSize: result.suggestedMetadata.estimatedSize ?? photo.metadata.estimatedSize,
            samplingTime: result.suggestedMetadata.samplingTime ?? photo.metadata.samplingTime,
            moldRequired: result.suggestedMetadata.moldRequired ?? photo.metadata.moldRequired,
            moldTime: result.suggestedMetadata.moldTime ?? photo.metadata.moldTime,
            bulkProductionTime: result.suggestedMetadata.bulkProductionTime ?? photo.metadata.bulkProductionTime,
            estimatedCostMin: result.suggestedMetadata.estimatedCostMin,
            estimatedCostMax: result.suggestedMetadata.estimatedCostMax,
            imageUrl: photo.imageUrl,
            thumbnailUrl: photo.thumbnailUrl
          });

          const progress = Math.round(((index + 1) / doc.items.length) * 100);
          await this.repository.updateShareDocumentStatus(shareId, 'analyzing', progress);
        }
      }

      await this.repository.updateShareDocumentStatus(shareId, 'generating', 100);
      const { buffer } = await this.shareDocumentsService.exportPptxBuffer(shareId);

      // Step 4: write buffer to disk
      const filePath = path.join(EXPORT_DIR, `${shareId}.pptx`);
      await fs.writeFile(filePath, buffer);

      // Step 5: completed
      await this.repository.markShareDocumentExportCompleted(shareId, filePath);
      this.logger.log(`Export task completed for share document ${shareId}`);
    } catch (error) {
      this.logger.error(`Export task failed for share document ${shareId}`, error as Error);
      await this.repository.markShareDocumentExportFailed(
        shareId,
        error instanceof Error ? error.message : '导出任务失败'
      );
    }
  }
}
