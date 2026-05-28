import { Injectable } from '@nestjs/common';

import { PostgresRepository } from '../../data/postgres.repository';
import { ConfirmPhotoAnalysisDto, CreatePhotoDto, ListPhotosQueryDto, UpdatePhotoDto } from './photos.dto';
import { PhotoAnalysisService } from './photo-analysis.service';

@Injectable()
export class PhotosService {
  constructor(
    private readonly repository: PostgresRepository,
    private readonly analysisService: PhotoAnalysisService
  ) {}

  listPhotos(query: ListPhotosQueryDto) {
    return this.repository.listPhotos({
      search: query.q,
      primaryCategory: query.brand,
      secondaryCategory: query.product,
      albumId: query.albumId,
      page: query.page,
      pageSize: query.pageSize
    });
  }

  listCategories() {
    return this.repository.listDistinctCategories();
  }

  getPhoto(photoId: string) {
    return this.repository.getPhoto(photoId);
  }

  createPhoto(albumId: string, userId: string, dto: CreatePhotoDto) {
    return this.repository.createPhoto(albumId, userId, dto);
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
