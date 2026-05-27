import { BadRequestException, Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExportTasksService } from '../export-tasks/export-tasks.service';
import { CreateShareDocumentDto } from './share-documents.dto';
import { ShareDocumentsService } from './share-documents.service';

@UseGuards(JwtAuthGuard)
@Controller('share-documents')
export class ShareDocumentsController {
  constructor(
    private readonly shareDocumentsService: ShareDocumentsService,
    private readonly exportTasksService: ExportTasksService
  ) {}

  @Get()
  listShareDocuments() {
    return this.shareDocumentsService.listShareDocuments();
  }

  @Get(':shareId')
  getShareDocument(@Param('shareId') shareId: string) {
    return this.shareDocumentsService.getShareDocument(shareId);
  }

  @Post()
  async createShareDocument(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateShareDocumentDto
  ) {
    const doc = await this.shareDocumentsService.createShareDocument(user.sub, dto);
    this.exportTasksService.enqueueExportTask(doc.id);
    return doc;
  }

  @Post(':shareId/export-pdf')
  exportPdf(@Param('shareId') shareId: string) {
    return this.shareDocumentsService.exportPdf(shareId);
  }

  @Post(':shareId/export-pptx')
  async exportPptx(
    @Param('shareId') shareId: string,
    @Res() response: Response
  ) {
    const doc = await this.shareDocumentsService.getShareDocument(shareId);
    if (doc.status !== 'completed') {
      throw new BadRequestException('导出任务尚未完成，请等待分析结束后再下载');
    }
    const { buffer, fileName } = await this.shareDocumentsService.exportPptxBuffer(shareId);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    response.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    response.send(buffer);
  }
}
