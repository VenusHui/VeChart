export type PhotoAnalysisStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'confirmed';
export type AnalysisConfidence = 'low' | 'medium' | 'high';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor';
}

export interface Album {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverPhotoId: string;
  createdAt: string;
  updatedAt: string;
  photoCount: number;
  coverUrl: string;
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

export interface PhotoAnalysis {
  status: PhotoAnalysisStatus;
  provider: string | null;
  confidence: AnalysisConfidence | null;
  reasoningSummary: string | null;
  sources: string[];
  errorMessage: string | null;
  updatedAt: string | null;
  suggestedMetadata: SuggestedProductMetadata | null;
}

export interface Photo {
  id: string;
  albumId: string;
  imageUrl: string;
  thumbnailUrl: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  metadata: ProductMetadata;
  analysis: PhotoAnalysis;
}

export interface ShareDocument {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    photoId: string;
    sortOrder: number;
    snapshot: ProductMetadata & {
      imageUrl: string;
      thumbnailUrl: string;
      estimatedCostMin?: number | null;
      estimatedCostMax?: number | null;
    };
  }>;
}
