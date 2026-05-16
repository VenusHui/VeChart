import { Injectable } from '@nestjs/common';

import { PostgresRepository } from '../../data/postgres.repository';
import { ConfirmPhotoAnalysisDto, CreatePhotoDto, UpdatePhotoDto } from './photos.dto';
import { PhotoAnalysisService } from './photo-analysis.service';

@Injectable()
export class PhotosService {
  constructor(
    private readonly repository: PostgresRepository,
    private readonly analysisService: PhotoAnalysisService
  ) {}

  getPhoto(photoId: string) {
    return this.repository.getPhoto(photoId);
  }

  createPhoto(albumId: string, userId: string, dto: CreatePhotoDto) {
    return this.repository.createPhoto(albumId, userId, dto).then((photo) => {
      this.analysisService.enqueuePhotoAnalysis(photo.id);
      return photo;
    });
  }

  updatePhoto(photoId: string, dto: UpdatePhotoDto) {
    return this.repository.updatePhoto(photoId, dto);
  }

  confirmPhotoAnalysis(photoId: string, dto: ConfirmPhotoAnalysisDto) {
    return this.repository.confirmPhotoAnalysis(photoId, dto);
  }

  requestPhotoAnalysis(photoId: string) {
    return this.analysisService.requestPhotoAnalysis(photoId);
  }

  removePhoto(photoId: string) {
    return this.repository.removePhoto(photoId);
  }
}
