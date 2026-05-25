import {
  AlbumRecord,
  PhotoRecord,
  ProductMetadata,
  ShareDocumentRecord,
  UserRecord
} from '../common/types';

export const seedTimestamp = '2026-04-04T12:00:00.000Z';

export const seedUsers: UserRecord[] = [
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

export const seedAlbums: AlbumRecord[] = [
  {
    id: 'album-bags',
    name: '包包',
    slug: 'bags',
    description: '适合通勤与礼品场景的包包集合',
    coverPhotoId: 'photo-bag-1',
    createdAt: seedTimestamp,
    updatedAt: seedTimestamp
  },
  {
    id: 'album-pendants',
    name: '挂件',
    slug: 'pendants',
    description: '新品挂件与配件资料',
    coverPhotoId: 'photo-pendant-1',
    createdAt: seedTimestamp,
    updatedAt: seedTimestamp
  }
];

export const seedPhotos: PhotoRecord[] = [
  makePhoto('photo-bag-1', 'album-bags', '托特包 A', '牛皮', 299, 128, 50),
  makePhoto('photo-bag-2', 'album-bags', '斜挎包 B', '帆布', 189, 78, 80),
  makePhoto('photo-pendant-1', 'album-pendants', '熊猫挂件', '合金', 59, 18, 200),
  makePhoto('photo-pendant-2', 'album-pendants', '猫爪挂件', 'PVC', 39, 9, 300)
];

export const seedShareDocuments: ShareDocumentRecord[] = [
  {
    id: 'share-launch',
    title: '春季新品推荐',
    description: '给渠道客户的新品展示',
    createdBy: 'user-admin',
    createdAt: seedTimestamp,
    updatedAt: seedTimestamp,
    items: ['photo-bag-1', 'photo-pendant-1'].map((photoId, index) => {
      const photo = seedPhotos.find((item) => item.id === photoId)!;
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

function makePhoto(
  id: string,
  albumId: string,
  productName: string,
  material: string,
  marketPrice: number,
  estimatedCost: number,
  moq: number
): PhotoRecord {
  const metadata = makeMetadata(productName, material, marketPrice, estimatedCost, moq);
  return {
    id,
    albumId,
    imageUrl: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`,
    thumbnailUrl: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=80`,
    createdAt: seedTimestamp,
    updatedAt: seedTimestamp,
    createdBy: 'user-admin',
    metadata,
    analysis: {
      status: 'confirmed',
      provider: 'seed',
      confidence: 'high',
      reasoningSummary: '示例数据已人工确认。',
      sources: ['seed'],
      errorMessage: null,
      updatedAt: seedTimestamp,
      suggestedMetadata: {
        ...metadata,
        estimatedCostMin: estimatedCost,
        estimatedCostMax: estimatedCost,
        bomBreakdown: null,
        costBreakdown: null
      }
    }
  };
}

function makeMetadata(
  productName: string,
  material: string,
  marketPrice: number,
  estimatedCost: number,
  moq: number
): ProductMetadata {
  return {
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
  };
}
