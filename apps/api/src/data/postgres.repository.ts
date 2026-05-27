import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import {
  AlbumRecord,
  AnalysisConfidence,
  CostBreakdown,
  PhotoAnalysisStatus,
  PhotoRecord,
  ProductMetadata,
  ShareDocumentItem,
  ShareDocumentRecord,
  SuggestedProductMetadata,
  UserRecord
} from '../common/types';
import { CosStorageService } from './cos-storage.service';
import { PostgresService } from './postgres.service';

interface RowShape {
  [key: string]: unknown;
}

const PHOTO_SELECT = `SELECT p.id,
              p.album_id AS "albumId",
              p.storage_key_original AS "imageUrl",
              p.storage_key_thumbnail AS "thumbnailUrl",
              p.created_at AS "createdAt",
              p.updated_at AS "updatedAt",
              p.created_by AS "createdBy",
              m.product_name AS "productName",
              m.material,
              m.product_url AS "productUrl",
              m.supplier_1688_url AS "product1688Url",
              m.market_price AS "marketPrice",
              m.estimated_cost AS "estimatedCost",
              m.moq,
              m.note,
              m.analysis_status AS "analysisStatus",
              m.analysis_provider AS "analysisProvider",
              m.analysis_confidence AS "analysisConfidence",
              m.analysis_summary AS "analysisSummary",
              m.analysis_sources_json AS "analysisSources",
              m.analysis_error AS "analysisError",
              m.analysis_updated_at AS "analysisUpdatedAt",
              m.suggested_metadata_json AS "suggestedMetadata"
       FROM photos p
       LEFT JOIN photo_product_metadata m ON m.photo_id = p.id`;

@Injectable()
export class PostgresRepository {
  constructor(
    private readonly postgres: PostgresService,
    private readonly storage: CosStorageService
  ) {}

  async findUserByEmail(email: string) {
    const result = await this.postgres.query<RowShape>(
      `SELECT id, name, email, password_hash AS password, role
       FROM users
       WHERE email = $1`,
      [email]
    );
    return (result.rows[0] as unknown as UserRecord | undefined) ?? null;
  }

  async findUserById(id: string) {
    const result = await this.postgres.query<RowShape>(
      `SELECT id, name, email, password_hash AS password, role
       FROM users
       WHERE id = $1`,
      [id]
    );
    return (result.rows[0] as unknown as UserRecord | undefined) ?? null;
  }

  async listAlbums() {
    const result = await this.postgres.query<RowShape>(
      `SELECT a.id,
              a.name,
              a.slug,
              a.description,
              COALESCE(a.cover_photo_id, '') AS "coverPhotoId",
              a.created_at AS "createdAt",
              a.updated_at AS "updatedAt",
              COUNT(p.id)::int AS "photoCount",
              COALESCE(cp.storage_key_thumbnail, '') AS "coverUrl"
       FROM albums a
       LEFT JOIN photos p ON p.album_id = a.id
       LEFT JOIN photos cp ON cp.id = a.cover_photo_id
       GROUP BY a.id, cp.storage_key_thumbnail
       ORDER BY a.updated_at DESC`
    );
    return result.rows as unknown as Array<AlbumRecord & { photoCount: number; coverUrl: string }>;
  }

  async getAlbum(albumId: string) {
    const result = await this.postgres.query<RowShape>(
      `SELECT id,
              name,
              slug,
              description,
              COALESCE(cover_photo_id, '') AS "coverPhotoId",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM albums
       WHERE id = $1`,
      [albumId]
    );
    const album = result.rows[0] as unknown as AlbumRecord | undefined;
    if (!album) {
      throw new NotFoundException('Album not found');
    }
    return album;
  }

  async createAlbum(input: { name: string; description: string }) {
    const slug = input.name.trim().toLowerCase().replace(/\s+/g, '-');
    const result = await this.postgres.query<RowShape>(
      `INSERT INTO albums (id, name, slug, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id,
                 name,
                 slug,
                 description,
                 COALESCE(cover_photo_id, '') AS "coverPhotoId",
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      [`album-${Date.now()}`, input.name, slug, input.description]
    );
    return result.rows[0] as unknown as AlbumRecord;
  }

  async updateAlbum(albumId: string, input: Partial<Pick<AlbumRecord, 'name' | 'description'>>) {
    const current = await this.getAlbum(albumId);
    const nextName = input.name ?? current.name;
    const nextDescription = input.description ?? current.description;
    const nextSlug = nextName.trim().toLowerCase().replace(/\s+/g, '-');
    const result = await this.postgres.query<RowShape>(
      `UPDATE albums
       SET name = $2,
           slug = $3,
           description = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id,
                 name,
                 slug,
                 description,
                 COALESCE(cover_photo_id, '') AS "coverPhotoId",
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      [albumId, nextName, nextSlug, nextDescription]
    );
    return result.rows[0] as unknown as AlbumRecord;
  }

  async removeAlbum(albumId: string) {
    await this.getAlbum(albumId);
    const photoResult = await this.postgres.query<RowShape>(
      `SELECT id
       FROM photos
       WHERE album_id = $1`,
      [albumId]
    );
    const photoIds = photoResult.rows.map((row) => String(row.id));

    if (photoIds.length > 0) {
      await this.postgres.query(
        `UPDATE albums
         SET cover_photo_id = NULL,
             updated_at = NOW()
         WHERE cover_photo_id = ANY($1::text[])`,
        [photoIds]
      );

      await this.postgres.query(
        `DELETE FROM share_document_items
         WHERE photo_id = ANY($1::text[])`,
        [photoIds]
      );

      await this.postgres.query(
        `DELETE FROM photo_product_metadata
         WHERE photo_id = ANY($1::text[])`,
        [photoIds]
      );
    }

    await this.postgres.query(`DELETE FROM photos WHERE album_id = $1`, [albumId]);
    await this.postgres.query(`DELETE FROM albums WHERE id = $1`, [albumId]);

    return { ok: true };
  }

  async listPhotosByAlbum(albumId: string) {
    await this.getAlbum(albumId);
    const result = await this.postgres.query<RowShape>(
      `${PHOTO_SELECT}
       WHERE p.album_id = $1
       ORDER BY p.created_at DESC`,
      [albumId]
    );
    return result.rows.map((row) => this.mapPhotoRow(row));
  }

  async listPhotosByAnalysisStatuses(statuses: PhotoAnalysisStatus[]) {
    const result = await this.postgres.query<RowShape>(
      `${PHOTO_SELECT}
       WHERE m.analysis_status = ANY($1::text[])
       ORDER BY p.created_at ASC`,
      [statuses]
    );
    return result.rows.map((row) => this.mapPhotoRow(row));
  }

  async getPhoto(photoId: string) {
    const result = await this.postgres.query<RowShape>(
      `${PHOTO_SELECT}
       WHERE p.id = $1`,
      [photoId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Photo not found');
    }
    return this.mapPhotoRow(row);
  }

  async createPhoto(
    albumId: string,
    userId: string,
    input: {
      imageUrl: string;
      thumbnailUrl?: string;
      metadata?: Partial<ProductMetadata>;
    }
  ) {
    await this.getAlbum(albumId);
    const uploaded = await this.storage.uploadBase64Image(input.imageUrl);
    const photoId = `photo-${Date.now()}`;
    const metadata = this.normalizeMetadataDraft(input.metadata);

    await this.postgres.query(
      `INSERT INTO photos (
         id, album_id, storage_key_original, storage_key_thumbnail, storage_key_preview,
         created_by, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [photoId, albumId, uploaded.imageUrl, uploaded.thumbnailUrl, uploaded.thumbnailUrl, userId]
    );

    await this.postgres.query(
      `INSERT INTO photo_product_metadata (
         photo_id, product_name, material, product_url, supplier_1688_url,
         market_price, estimated_cost, moq, note, analysis_status,
         analysis_sources_json, updated_by, analysis_updated_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', '[]'::jsonb, $10, NOW(), NOW())`,
      [
        photoId,
        metadata.productName,
        metadata.material,
        metadata.productUrl,
        metadata.product1688Url,
        metadata.marketPrice,
        metadata.estimatedCost,
        metadata.moq,
        metadata.note ?? '',
        userId
      ]
    );

    await this.postgres.query(
      `UPDATE albums
       SET updated_at = NOW(),
           cover_photo_id = CASE WHEN cover_photo_id IS NULL OR cover_photo_id = '' THEN $2 ELSE cover_photo_id END
       WHERE id = $1`,
      [albumId, photoId]
    );

    return this.getPhoto(photoId);
  }

  async updatePhoto(photoId: string, input: { metadata: Partial<ProductMetadata> }) {
    const current = await this.getPhoto(photoId);
    const next = this.mergeMetadata(current.metadata, input.metadata);

    await this.postgres.query(
      `UPDATE photo_product_metadata
       SET product_name = $2,
           material = $3,
           product_url = $4,
           supplier_1688_url = $5,
           market_price = $6,
           estimated_cost = $7,
           moq = $8,
           note = $9,
           updated_at = NOW()
       WHERE photo_id = $1`,
      [
        photoId,
        this.nullIfBlank(next.productName),
        this.nullIfBlank(next.material),
        this.nullIfBlank(next.productUrl),
        this.nullIfBlank(next.product1688Url),
        next.marketPrice,
        next.estimatedCost,
        next.moq,
        next.note
      ]
    );

    await this.postgres.query(`UPDATE photos SET updated_at = NOW() WHERE id = $1`, [photoId]);
    return this.getPhoto(photoId);
  }

  async confirmPhotoAnalysis(photoId: string, input: { metadata: Partial<ProductMetadata> }) {
    const current = await this.getPhoto(photoId);
    const next = this.mergeMetadata(current.metadata, input.metadata, current.analysis.suggestedMetadata);

    await this.postgres.query(
      `UPDATE photo_product_metadata
       SET product_name = $2,
           material = $3,
           product_url = $4,
           supplier_1688_url = $5,
           market_price = $6,
           estimated_cost = $7,
           moq = $8,
           note = $9,
           analysis_status = 'confirmed',
           analysis_error = NULL,
           analysis_updated_at = NOW(),
           updated_at = NOW()
       WHERE photo_id = $1`,
      [
        photoId,
        this.nullIfBlank(next.productName),
        this.nullIfBlank(next.material),
        this.nullIfBlank(next.productUrl),
        this.nullIfBlank(next.product1688Url),
        next.marketPrice,
        next.estimatedCost,
        next.moq,
        next.note
      ]
    );

    await this.postgres.query(`UPDATE photos SET updated_at = NOW() WHERE id = $1`, [photoId]);
    return this.getPhoto(photoId);
  }

  async requestPhotoAnalysis(photoId: string) {
    await this.getPhoto(photoId);
    await this.postgres.query(
      `UPDATE photo_product_metadata
       SET analysis_status = 'pending',
           analysis_error = NULL,
           analysis_updated_at = NOW(),
           updated_at = NOW()
       WHERE photo_id = $1`,
      [photoId]
    );
    await this.postgres.query(`UPDATE photos SET updated_at = NOW() WHERE id = $1`, [photoId]);
    return this.getPhoto(photoId);
  }

  async markPhotoAnalysisRunning(photoId: string, provider: string) {
    await this.postgres.query(
      `UPDATE photo_product_metadata
       SET analysis_status = 'running',
           analysis_provider = $2,
           analysis_error = NULL,
           analysis_updated_at = NOW(),
           updated_at = NOW()
       WHERE photo_id = $1`,
      [photoId, provider]
    );
    await this.postgres.query(`UPDATE photos SET updated_at = NOW() WHERE id = $1`, [photoId]);
  }

  async markPhotoAnalysisSucceeded(
    photoId: string,
    input: {
      provider: string;
      confidence: AnalysisConfidence | null;
      reasoningSummary: string | null;
      sources: string[];
      snapshot: Record<string, unknown>;
      suggestedMetadata: SuggestedProductMetadata;
    }
  ) {
    await this.postgres.query(
      `UPDATE photo_product_metadata
       SET analysis_status = CASE WHEN analysis_status = 'confirmed' THEN 'confirmed' ELSE 'succeeded' END,
           analysis_provider = $2,
           analysis_confidence = $3,
           analysis_summary = $4,
           analysis_sources_json = $5::jsonb,
           analysis_error = NULL,
           analysis_snapshot_json = $6::jsonb,
           suggested_metadata_json = $7::jsonb,
           analysis_updated_at = NOW(),
           updated_at = NOW()
       WHERE photo_id = $1`,
      [
        photoId,
        input.provider,
        input.confidence,
        input.reasoningSummary,
        JSON.stringify(input.sources),
        JSON.stringify(input.snapshot),
        JSON.stringify(input.suggestedMetadata)
      ]
    );
    await this.postgres.query(`UPDATE photos SET updated_at = NOW() WHERE id = $1`, [photoId]);
  }

  async markPhotoAnalysisFailed(photoId: string, provider: string, errorMessage: string) {
    await this.postgres.query(
      `UPDATE photo_product_metadata
       SET analysis_status = 'failed',
           analysis_provider = $2,
           analysis_error = $3,
           analysis_updated_at = NOW(),
           updated_at = NOW()
       WHERE photo_id = $1`,
      [photoId, provider, errorMessage.slice(0, 500)]
    );
    await this.postgres.query(`UPDATE photos SET updated_at = NOW() WHERE id = $1`, [photoId]);
  }

  async removePhoto(photoId: string) {
    const photo = await this.getPhoto(photoId);

    await this.postgres.query(`DELETE FROM share_document_items WHERE photo_id = $1`, [photoId]);
    await this.postgres.query(`DELETE FROM photo_product_metadata WHERE photo_id = $1`, [photoId]);
    await this.postgres.query(`DELETE FROM photos WHERE id = $1`, [photoId]);

    const nextCoverResult = await this.postgres.query<RowShape>(
      `SELECT id
       FROM photos
       WHERE album_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [photo.albumId]
    );
    const nextCoverId = nextCoverResult.rows[0] ? String(nextCoverResult.rows[0].id) : null;

    await this.postgres.query(
      `UPDATE albums
       SET cover_photo_id = CASE WHEN cover_photo_id = $2 THEN $3 ELSE cover_photo_id END,
           updated_at = NOW()
       WHERE id = $1`,
      [photo.albumId, photoId, nextCoverId]
    );

    return { ok: true };
  }

  async createShareDocument(input: {
    title: string;
    description: string;
    photoIds: string[];
    createdBy: string;
    unifiedMoq?: number | null;
  }) {
    const shareId = `share-${Date.now()}`;
    const moq = input.unifiedMoq ?? null;
    await this.postgres.query(
      `INSERT INTO share_documents (
         id, title, description, created_by, template_version, status, unified_moq, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, 'v1', 'pending', $5, NOW(), NOW())`,
      [shareId, input.title, input.description, input.createdBy, moq]
    );

    for (const [index, photoId] of input.photoIds.entries()) {
      const photo = await this.getPhoto(photoId);
      await this.postgres.query(
        `INSERT INTO share_document_items (
           id, share_document_id, photo_id, sort_order, snapshot_json
         )
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          `share-item-${Date.now()}-${index}`,
          shareId,
          photoId,
          index,
          JSON.stringify({
            productName: photo.metadata.productName || '',
            material: photo.metadata.material || '',
            productUrl: photo.metadata.productUrl || '',
            product1688Url: photo.metadata.product1688Url || '',
            marketPrice: photo.metadata.marketPrice,
            estimatedCost: photo.metadata.estimatedCost,
            moq: moq ?? photo.metadata.moq,
            note: photo.metadata.note || '',
            estimatedSize: photo.metadata.estimatedSize ?? null,
            samplingTime: photo.metadata.samplingTime ?? null,
            moldRequired: photo.metadata.moldRequired ?? null,
            moldTime: photo.metadata.moldTime ?? null,
            bulkProductionTime: photo.metadata.bulkProductionTime ?? null,
            estimatedCostMin: null,
            estimatedCostMax: null,
            imageUrl: photo.imageUrl,
            thumbnailUrl: photo.thumbnailUrl
          })
        ]
      );
    }

    return this.getShareDocument(shareId);
  }

  async getShareDocument(shareId: string) {
    const shareResult = await this.postgres.query<RowShape>(
      `SELECT id,
              title,
              description,
              created_by AS "createdBy",
              template_version AS "templateVersion",
              status,
              unified_moq AS "unifiedMoq",
              export_progress AS "exportProgress",
              export_file_path AS "exportFileUrl",
              export_error AS "exportError",
              export_started_at AS "exportStartedAt",
              export_completed_at AS "exportCompletedAt",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM share_documents
       WHERE id = $1`,
      [shareId]
    );
    const share = shareResult.rows[0] as unknown as ShareDocumentRecord | undefined;
    if (!share) {
      throw new NotFoundException('Share document not found');
    }

    const itemResult = await this.postgres.query<RowShape>(
      `SELECT id,
              photo_id AS "photoId",
              sort_order AS "sortOrder",
              snapshot_json AS snapshot
       FROM share_document_items
       WHERE share_document_id = $1
       ORDER BY sort_order ASC`,
      [shareId]
    );

    return {
      ...share,
      items: itemResult.rows.map((row) => ({
        id: String(row.id),
        photoId: String(row.photoId),
        sortOrder: Number(row.sortOrder),
        snapshot: row.snapshot as ShareDocumentItem['snapshot']
      }))
    };
  }

  async listShareDocuments() {
    const result = await this.postgres.query<RowShape>(
      `SELECT id,
              title,
              description,
              created_by AS "createdBy",
              template_version AS "templateVersion",
              status,
              unified_moq AS "unifiedMoq",
              export_progress AS "exportProgress",
              export_file_path AS "exportFileUrl",
              export_error AS "exportError",
              export_started_at AS "exportStartedAt",
              export_completed_at AS "exportCompletedAt",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM share_documents
       ORDER BY created_at DESC`
    );
    return result.rows as unknown as ShareDocumentRecord[];
  }

  async listShareDocumentsByStatuses(statuses: string[]) {
    const result = await this.postgres.query<RowShape>(
      `SELECT id,
              title,
              description,
              created_by AS "createdBy",
              template_version AS "templateVersion",
              status,
              unified_moq AS "unifiedMoq",
              export_progress AS "exportProgress",
              export_file_path AS "exportFileUrl",
              export_error AS "exportError",
              export_started_at AS "exportStartedAt",
              export_completed_at AS "exportCompletedAt",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM share_documents
       WHERE status = ANY($1::text[])
       ORDER BY created_at DESC`,
      [statuses]
    );
    return result.rows as unknown as ShareDocumentRecord[];
  }

  async updateShareDocumentStatus(shareId: string, status: string, progress: number) {
    await this.postgres.query(
      `UPDATE share_documents
       SET status = $2,
           export_progress = $3,
           export_started_at = COALESCE(export_started_at, NOW()),
           updated_at = NOW()
       WHERE id = $1`,
      [shareId, status, progress]
    );
  }

  async updateShareDocumentItemSnapshot(itemId: string, snapshot: Record<string, unknown>) {
    await this.postgres.query(
      `UPDATE share_document_items
       SET snapshot_json = $2::jsonb
       WHERE id = $1`,
      [itemId, JSON.stringify(snapshot)]
    );
  }

  async markShareDocumentExportCompleted(shareId: string, filePath: string) {
    await this.postgres.query(
      `UPDATE share_documents
       SET status = 'completed',
           export_progress = 100,
           export_file_path = $2,
           export_error = NULL,
           export_completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [shareId, filePath]
    );
  }

  async markShareDocumentExportFailed(shareId: string, error: string) {
    await this.postgres.query(
      `UPDATE share_documents
       SET status = 'failed',
           export_error = $2,
           export_completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [shareId, error]
    );
  }

  private mapPhotoRow(row: RowShape): PhotoRecord {
    const suggestedMetadata = this.mapSuggestedMetadata(row.suggestedMetadata);
    return {
      id: String(row.id),
      albumId: String(row.albumId),
      imageUrl: String(row.imageUrl),
      thumbnailUrl: String(row.thumbnailUrl),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
      createdBy: String(row.createdBy),
      metadata: {
        productName: this.stringOrEmpty(row.productName),
        material: this.stringOrEmpty(row.material),
        productUrl: this.stringOrEmpty(row.productUrl),
        product1688Url: this.stringOrEmpty(row.product1688Url),
        marketPrice: this.numberOrNull(row.marketPrice),
        estimatedCost: this.numberOrNull(row.estimatedCost),
        moq: this.intOrNull(row.moq),
        note: this.stringOrEmpty(row.note),
        estimatedSize: null,
        samplingTime: null,
        moldRequired: null,
        moldTime: null,
        bulkProductionTime: null
      },
      analysis: {
        status: this.analysisStatusOrDefault(row.analysisStatus),
        provider: this.stringOrNull(row.analysisProvider),
        confidence: this.confidenceOrNull(row.analysisConfidence),
        reasoningSummary: this.stringOrNull(row.analysisSummary),
        sources: this.stringArray(row.analysisSources),
        errorMessage: this.stringOrNull(row.analysisError),
        updatedAt: this.stringOrNull(row.analysisUpdatedAt),
        suggestedMetadata
      }
    };
  }

  private mapSuggestedMetadata(value: unknown): SuggestedProductMetadata | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const record = value as Record<string, unknown>;
    return {
      productName: this.stringOrNull(record.productName),
      material: this.stringOrNull(record.material),
      productUrl: this.stringOrNull(record.productUrl),
      product1688Url: this.stringOrNull(record.product1688Url),
      marketPrice: this.numberOrNull(record.marketPrice),
      estimatedCost: this.numberOrNull(record.estimatedCost),
      estimatedCostMin: this.numberOrNull(record.estimatedCostMin),
      estimatedCostMax: this.numberOrNull(record.estimatedCostMax),
      moq: this.intOrNull(record.moq),
      note: this.stringOrNull(record.note),
      estimatedSize: this.stringOrNull(record.estimatedSize),
      samplingTime: this.intOrNull(record.samplingTime),
      moldRequired: this.stringOrNull(record.moldRequired),
      moldTime: this.intOrNull(record.moldTime),
      bulkProductionTime: this.intOrNull(record.bulkProductionTime),
      bomBreakdown: Array.isArray(record.bomBreakdown) ? record.bomBreakdown : null,
      costBreakdown: this.mapCostBreakdown(record.costBreakdown)
    };
  }

  private mapCostBreakdown(value: unknown): CostBreakdown | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const r = value as Record<string, unknown>;
    return {
      materialCost: this.numberOrNull(r.materialCost),
      laborCost: this.numberOrNull(r.laborCost),
      packagingCost: this.numberOrNull(r.packagingCost),
      fixedCostPerUnit: this.numberOrNull(r.fixedCostPerUnit),
      logisticsCost: this.numberOrNull(r.logisticsCost),
      taxCost: this.numberOrNull(r.taxCost)
    };
  }

  private mergeMetadata(
    current: ProductMetadata,
    patch: Partial<ProductMetadata> = {},
    suggested?: SuggestedProductMetadata | null
  ): ProductMetadata {
    return {
      productName: patch.productName ?? suggested?.productName ?? current.productName,
      material: patch.material ?? suggested?.material ?? current.material,
      productUrl: patch.productUrl ?? suggested?.productUrl ?? current.productUrl,
      product1688Url: patch.product1688Url ?? suggested?.product1688Url ?? current.product1688Url,
      marketPrice: patch.marketPrice ?? suggested?.marketPrice ?? current.marketPrice,
      estimatedCost: patch.estimatedCost ?? suggested?.estimatedCost ?? current.estimatedCost,
      moq: patch.moq ?? suggested?.moq ?? current.moq,
      note: patch.note ?? suggested?.note ?? current.note,
      estimatedSize: patch.estimatedSize ?? suggested?.estimatedSize ?? current.estimatedSize,
      samplingTime: patch.samplingTime ?? suggested?.samplingTime ?? current.samplingTime,
      moldRequired: patch.moldRequired ?? suggested?.moldRequired ?? current.moldRequired,
      moldTime: patch.moldTime ?? suggested?.moldTime ?? current.moldTime,
      bulkProductionTime: patch.bulkProductionTime ?? suggested?.bulkProductionTime ?? current.bulkProductionTime
    };
  }

  private normalizeMetadataDraft(patch?: Partial<ProductMetadata>) {
    return {
      productName: this.nullIfBlank(patch?.productName),
      material: this.nullIfBlank(patch?.material),
      productUrl: this.nullIfBlank(patch?.productUrl),
      product1688Url: this.nullIfBlank(patch?.product1688Url),
      marketPrice: this.numberOrNull(patch?.marketPrice),
      estimatedCost: this.numberOrNull(patch?.estimatedCost),
      moq: this.intOrNull(patch?.moq),
      note: patch?.note?.trim() ?? '',
      estimatedSize: this.stringOrNull(patch?.estimatedSize),
      samplingTime: this.intOrNull(patch?.samplingTime),
      moldRequired: this.stringOrNull(patch?.moldRequired),
      moldTime: this.intOrNull(patch?.moldTime),
      bulkProductionTime: this.intOrNull(patch?.bulkProductionTime)
    };
  }

  private analysisStatusOrDefault(value: unknown): PhotoAnalysisStatus {
    if (
      value === 'draft' ||
      value === 'pending' ||
      value === 'running' ||
      value === 'succeeded' ||
      value === 'failed' ||
      value === 'confirmed'
    ) {
      return value;
    }
    return 'confirmed';
  }

  private confidenceOrNull(value: unknown): AnalysisConfidence | null {
    if (value === 'low' || value === 'medium' || value === 'high') {
      return value;
    }
    return null;
  }

  private stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((item) => String(item));
  }

  private stringOrEmpty(value: unknown) {
    return typeof value === 'string' ? value : '';
  }

  private stringOrNull(value: unknown) {
    return typeof value === 'string' && value ? value : null;
  }

  private numberOrNull(value: unknown) {
    if (value === null || typeof value === 'undefined' || value === '') {
      return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private intOrNull(value: unknown) {
    const numeric = this.numberOrNull(value);
    return numeric === null ? null : Math.round(numeric);
  }

  private nullIfBlank(value: string | null | undefined) {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
}
