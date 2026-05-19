import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateShareDocumentDto } from './share-documents.dto';
import { ShareDocumentsService } from './share-documents.service';

@UseGuards(JwtAuthGuard)
@Controller('share-documents')
export class ShareDocumentsController {
  constructor(private readonly shareDocumentsService: ShareDocumentsService) {}

  @Get()
  listShareDocuments() {
    return this.shareDocumentsService.listShareDocuments();
  }

  @Get(':shareId')
  getShareDocument(@Param('shareId') shareId: string) {
    return this.shareDocumentsService.getShareDocument(shareId);
  }

  @Post()
  createShareDocument(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateShareDocumentDto
  ) {
    return this.shareDocumentsService.createShareDocument(user.sub, dto);
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
    const { buffer, fileName } = await this.shareDocumentsService.exportPptxBuffer(
      shareId
    );
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    response.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    response.send(buffer);
  }
}
