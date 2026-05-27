export type Role = 'admin' | 'editor';
export type PhotoAnalysisStatus = 'draft' | 'pending' | 'running' | 'succeeded' | 'failed' | 'confirmed';
export type ShareDocExportStatus = 'pending' | 'analyzing' | 'generating' | 'completed' | 'failed';
export type AnalysisConfidence = 'low' | 'medium' | 'high';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface ProductMetadata {
  productName: string;
  material: string;
  productUrl: string;
  product1688Url: string;
  marketPrice: number | null;
  estimatedCost: number | null;
  moq: number | null;
  note: string;
  estimatedSize: string | null;
  samplingTime: number | null;
  moldRequired: string | null;
  moldTime: number | null;
  bulkProductionTime: number | null;
}

export interface BomItem {
  part: string;
  material: string;
  unitCost: number | null;
  lossRate: string;
}

export interface CostBreakdown {
  materialCost: number | null;
  laborCost: number | null;
  packagingCost: number | null;
  fixedCostPerUnit: number | null;
  logisticsCost: number | null;
  taxCost: number | null;
}

export interface SuggestedProductMetadata {
  productName: string | null;
  material: string | null;
  productUrl: string | null;
  product1688Url: string | null;
  marketPrice: number | null;
  estimatedCost: number | null;
  estimatedCostMin: number | null;
  estimatedCostMax: number | null;
  moq: number | null;
  note: string | null;
  estimatedSize: string | null;
  samplingTime: number | null;
  moldRequired: string | null;
  moldTime: number | null;
  bulkProductionTime: number | null;
  bomBreakdown: BomItem[] | null;
  costBreakdown: CostBreakdown | null;
}

export interface PhotoAnalysisRecord {
  status: PhotoAnalysisStatus;
  provider: string | null;
  confidence: AnalysisConfidence | null;
  reasoningSummary: string | null;
  sources: string[];
  errorMessage: string | null;
  updatedAt: string | null;
  suggestedMetadata: SuggestedProductMetadata | null;
}

export interface PhotoRecord {
  id: string;
  albumId: string;
  imageUrl: string;
  thumbnailUrl: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  metadata: ProductMetadata;
  analysis: PhotoAnalysisRecord;
}

export interface AlbumRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverPhotoId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShareDocumentItem {
  id: string;
  photoId: string;
  sortOrder: number;
  snapshot: ProductMetadata & {
    imageUrl: string;
    thumbnailUrl: string;
    estimatedCostMin?: number | null;
    estimatedCostMax?: number | null;
  };
}

export interface ShareDocumentRecord {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  templateVersion: string;
  status: ShareDocExportStatus;
  unifiedMoq: number | null;
  exportProgress: number;
  exportFileUrl: string | null;
  exportError: string | null;
  exportStartedAt: string | null;
  exportCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: ShareDocumentItem[];
}
