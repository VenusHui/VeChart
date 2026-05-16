import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConfirmPhotoAnalysisDto, CreatePhotoDto, UpdatePhotoDto } from './photos.dto';
import { PhotosService } from './photos.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Get('photos/:photoId')
  getPhoto(@Param('photoId') photoId: string) {
    return this.photosService.getPhoto(photoId);
  }

  @Post('albums/:albumId/photos')
  createPhoto(
    @Param('albumId') albumId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreatePhotoDto
  ) {
    return this.photosService.createPhoto(albumId, user.sub, dto);
  }

  @Patch('photos/:photoId')
  updatePhoto(@Param('photoId') photoId: string, @Body() dto: UpdatePhotoDto) {
    return this.photosService.updatePhoto(photoId, dto);
  }

  @Post('photos/:photoId/analyze')
  requestPhotoAnalysis(@Param('photoId') photoId: string) {
    return this.photosService.requestPhotoAnalysis(photoId);
  }

  @Post('photos/:photoId/confirm-analysis')
  confirmPhotoAnalysis(@Param('photoId') photoId: string, @Body() dto: ConfirmPhotoAnalysisDto) {
    return this.photosService.confirmPhotoAnalysis(photoId, dto);
  }

  @Delete('photos/:photoId')
  removePhoto(@Param('photoId') photoId: string) {
    return this.photosService.removePhoto(photoId);
  }
}
