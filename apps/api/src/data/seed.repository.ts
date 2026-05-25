import { Injectable, NotFoundException } from '@nestjs/common';

import {
  AlbumRecord,
  PhotoRecord,
  ProductMetadata,
  ShareDocumentRecord,
  UserRecord
} from '../common/types';

const now = '2026-04-04T12:00:00.000Z';

@Injectable()
export class SeedRepository {
  private users: UserRecord[] = [
    {
      id: 'user-admin',
      name: 'Admin',
      email: 'admin@vechart.local',
      password: 'admin123',
      role: 'admin'
    },
    {
      id: 'user-editor',
      name: 'Editor',
      email: 'editor@vechart.local',
      password: 'editor123',
      role: 'editor'
    }
  ];

  private albums: AlbumRecord[] = [
    {
      id: 'album-bags',
      name: '包包',
      slug: 'bags',
      description: '适合通勤与礼品场景的包包集合',
      coverPhotoId: 'photo-bag-1',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'album-pendants',
      name: '挂件',
      slug: 'pendants',
      description: '新品挂件与配件资料',
      coverPhotoId: 'photo-pendant-1',
      createdAt: now,
      updatedAt: now
    }
  ];

  private photos: PhotoRecord[] = [
    this.makePhoto('photo-bag-1', 'album-bags', '托特包 A', '牛皮', 299, 128, 50),
    this.makePhoto('photo-bag-2', 'album-bags', '斜挎包 B', '帆布', 189, 78, 80),
    this.makePhoto('photo-pendant-1', 'album-pendants', '熊猫挂件', '合金', 59, 18, 200),
    this.makePhoto('photo-pendant-2', 'album-pendants', '猫爪挂件', 'PVC', 39, 9, 300)
  ];

  private shareDocuments: ShareDocumentRecord[] = [
    {
      id: 'share-launch',
      title: '春季新品推荐',
      description: '给渠道客户的新品展示',
      createdBy: 'user-admin',
      createdAt: now,
      updatedAt: now,
      items: ['photo-bag-1', 'photo-pendant-1'].map((photoId, index) => {
        const photo = this.photos.find((item) => item.id === photoId)!;
        return {
          id: `share-item-${index + 1}`,
          photoId,
          sortOrder: index,
          snapshot: {
            ...photo.metadata,
            imageUrl: photo.imageUrl,
            thumbnailUrl: photo.thumbnailUrl
          }
        };
      })
    }
  ];

  findUserByEmail(email: string) {
    return this.users.find((user) => user.email === email) ?? null;
  }

  findUserById(id: string) {
    return this.users.find((user) => user.id === id) ?? null;
  }

  listAlbums() {
    return this.albums.map((album) => ({
      ...album,
      photoCount: this.photos.filter((photo) => photo.albumId === album.id).length,
      coverUrl: this.photos.find((photo) => photo.id === album.coverPhotoId)?.thumbnailUrl ?? ''
    }));
  }

  getAlbum(albumId: string) {
    const album = this.albums.find((item) => item.id === albumId);
    if (!album) {
      throw new NotFoundException('Album not found');
    }
    return album;
  }

  createAlbum(input: { name: string; description: string }) {
    const id = `album-${Date.now()}`;
    const album: AlbumRecord = {
      id,
      name: input.name,
      slug: input.name.toLowerCase(),
      description: input.description,
      coverPhotoId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.albums.unshift(album);
    return album;
  }

  updateAlbum(albumId: string, input: Partial<Pick<AlbumRecord, 'name' | 'description'>>) {
    const album = this.getAlbum(albumId);
    Object.assign(album, input, {
      updatedAt: new Date().toISOString()
    });
    return album;
  }

  removeAlbum(albumId: string) {
    this.getAlbum(albumId);
    const photoIds = this.photos.filter((photo) => photo.albumId === albumId).map((photo) => photo.id);

    this.photos = this.photos.filter((photo) => photo.albumId !== albumId);
    this.albums = this.albums.filter((album) => album.id !== albumId);
    this.shareDocuments = this.shareDocuments.map((document) => ({
      ...document,
      items: document.items.filter((item) => !photoIds.includes(item.photoId))
    }));

    return { ok: true };
  }

  listPhotosByAlbum(albumId: string) {
    this.getAlbum(albumId);
    return this.photos.filter((photo) => photo.albumId === albumId);
  }

  getPhoto(photoId: string) {
    const photo = this.photos.find((item) => item.id === photoId);
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }
    return photo;
  }

  createPhoto(
    albumId: string,
    userId: string,
    input: {
      imageUrl: string;
      thumbnailUrl: string;
      metadata: ProductMetadata;
    }
  ) {
    const album = this.getAlbum(albumId);
    const photo: PhotoRecord = {
      id: `photo-${Date.now()}`,
      albumId,
      imageUrl: input.imageUrl,
      thumbnailUrl: input.thumbnailUrl,
      metadata: input.metadata,
      analysis: {
        status: 'confirmed',
        provider: 'seed',
        confidence: 'high',
        reasoningSummary: '内存仓储默认视为已确认数据。',
        sources: ['seed'],
        errorMessage: null,
        updatedAt: new Date().toISOString(),
        suggestedMetadata: {
          ...input.metadata,
          estimatedCostMin: input.metadata.estimatedCost,
          estimatedCostMax: input.metadata.estimatedCost,
          bomBreakdown: null,
          costBreakdown: null
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId
    };
    this.photos.unshift(photo);
    if (!album.coverPhotoId) {
      album.coverPhotoId = photo.id;
    }
    album.updatedAt = new Date().toISOString();
    return photo;
  }

  updatePhoto(photoId: string, input: { metadata: ProductMetadata }) {
    const photo = this.getPhoto(photoId);
    photo.metadata = input.metadata;
    photo.updatedAt = new Date().toISOString();
    return photo;
  }

  removePhoto(photoId: string) {
    const photo = this.getPhoto(photoId);
    this.photos = this.photos.filter((item) => item.id !== photoId);
    this.shareDocuments = this.shareDocuments.map((document) => ({
      ...document,
      items: document.items.filter((item) => item.photoId !== photoId)
    }));

    const album = this.albums.find((item) => item.id === photo.albumId);
    if (album) {
      if (album.coverPhotoId === photoId) {
        const replacement = this.photos.find((item) => item.albumId === album.id);
        album.coverPhotoId = replacement?.id ?? '';
      }
      album.updatedAt = new Date().toISOString();
    }

    return { ok: true };
  }

  createShareDocument(input: {
    title: string;
    description: string;
    photoIds: string[];
    createdBy: string;
  }) {
    const items = input.photoIds.map((photoId, index) => {
      const photo = this.getPhoto(photoId);
      return {
        id: `share-item-${Date.now()}-${index}`,
        photoId,
        sortOrder: index,
        snapshot: {
          ...photo.metadata,
          imageUrl: photo.imageUrl,
          thumbnailUrl: photo.thumbnailUrl
        }
      };
    });

    const shareDocument: ShareDocumentRecord = {
      id: `share-${Date.now()}`,
      title: input.title,
      description: input.description,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items
    };

    this.shareDocuments.unshift(shareDocument);
    return shareDocument;
  }

  getShareDocument(shareId: string) {
    const shareDocument = this.shareDocuments.find((item) => item.id === shareId);
    if (!shareDocument) {
      throw new NotFoundException('Share document not found');
    }
    return shareDocument;
  }

  listShareDocuments() {
    return this.shareDocuments;
  }

  private makePhoto(
    id: string,
    albumId: string,
    productName: string,
    material: string,
    marketPrice: number,
    estimatedCost: number,
    moq: number
  ): PhotoRecord {
    return {
      id,
      albumId,
      imageUrl: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`,
      thumbnailUrl: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=80`,
      createdAt: now,
      updatedAt: now,
      createdBy: 'user-admin',
      metadata: {
        productName,
        material,
        productUrl: 'https://example.com/product',
        product1688Url: 'https://detail.1688.com/offer/example.html',
        marketPrice,
        estimatedCost,
        moq,
        note: '首版示例数据',
        estimatedSize: null,
        samplingTime: null,
        moldRequired: null,
        moldTime: null,
        bulkProductionTime: null
      },
      analysis: {
        status: 'confirmed',
        provider: 'seed',
        confidence: 'high',
        reasoningSummary: '首版示例数据已确认。',
        sources: ['seed'],
        errorMessage: null,
        updatedAt: now,
        suggestedMetadata: {
          productName,
          material,
          productUrl: 'https://example.com/product',
          product1688Url: 'https://detail.1688.com/offer/example.html',
          marketPrice,
          estimatedCost,
          estimatedCostMin: estimatedCost,
          estimatedCostMax: estimatedCost,
          moq,
          note: '首版示例数据',
          estimatedSize: null,
          samplingTime: null,
          moldRequired: null,
          moldTime: null,
          bulkProductionTime: null,
          bomBreakdown: null,
          costBreakdown: null
        }
      }
    };
  }
}
