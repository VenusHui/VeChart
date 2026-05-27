import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import fs from 'fs/promises';
import path from 'path';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PostgresRepository } from '../../data/postgres.repository';

const EXPORT_DIR = path.join(process.cwd(), 'exports');

function sanitizeFileName(input: string) {
  const normalized = input.trim().replace(/[\\/:*?"<>|]+/g, '-');
  return normalized || 'export';
}

@UseGuards(JwtAuthGuard)
@Controller('export-tasks')
export class ExportTasksController {
  constructor(private readonly repository: PostgresRepository) {}

  @Get()
  listTasks() {
    return this.repository.listShareDocuments();
  }

  @Get(':shareId')
  getTask(@Param('shareId') shareId: string) {
    return this.repository.getShareDocument(shareId);
  }

  @Get(':shareId/download')
  async downloadPptx(
    @Param('shareId') shareId: string,
    @Res() response: Response
  ) {
    const doc = await this.repository.getShareDocument(shareId);
    if (!doc.exportFileUrl) {
      response.status(404).json({ message: 'PPTX 文件尚未生成' });
      return;
    }
    const filePath = path.resolve(doc.exportFileUrl);
    const fileName = `${sanitizeFileName(doc.title || 'export')}.pptx`;
    try {
      const buffer = await fs.readFile(filePath);
      response.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );
      response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      response.send(buffer);
    } catch {
      response.status(404).json({ message: 'PPTX 文件不存在，请重新导出' });
    }
  }
}
