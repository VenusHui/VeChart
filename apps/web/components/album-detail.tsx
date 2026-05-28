'use client';

import { ClipboardEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { api } from '@/lib/api';
import { Album, BomItem, CostBreakdown, Photo, ProductMetadata } from '@/lib/types';

const emptyDraft: ProductMetadata = {
  productName: '',
  material: '',
  productUrl: '',
  product1688Url: '',
  marketPrice: null,
  estimatedCost: null,
  moq: null,
  note: '',
  estimatedSize: null,
  samplingTime: null,
  moldRequired: null,
  moldTime: null,
  bulkProductionTime: null
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

function extractImageFromClipboardData(data: DataTransfer | null) {
  if (!data) {
    return null;
  }
  const { items } = data;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }
  return null;
}

function toOptionalNumber(value: FormDataEntryValue | string | null | undefined) {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatMoney(value: number | null | undefined) {
  return value === null || typeof value === 'undefined' ? '待确认' : `¥${value}`;
}

function statusMeta(status: Photo['analysis']['status']) {
  switch (status) {
    case 'draft':
      return { label: '草稿', className: 'status-draft' };
    case 'pending':
      return { label: '待分析', className: 'status-pending' };
    case 'running':
      return { label: '分析中', className: 'status-running' };
    case 'succeeded':
      return { label: '待确认', className: 'status-succeeded' };
    case 'failed':
      return { label: '分析失败', className: 'status-failed' };
    case 'confirmed':
      return { label: '已确认', className: 'status-confirmed' };
    default:
      return { label: '待处理', className: 'status-pending' };
  }
}

function makeDraftFromPhoto(photo: Photo | null): ProductMetadata {
  if (!photo) {
    return { ...emptyDraft };
  }
  return {
    productName: photo.metadata.productName || '',
    material: photo.metadata.material || '',
    productUrl: photo.metadata.productUrl || '',
    product1688Url: photo.metadata.product1688Url || '',
    marketPrice: photo.metadata.marketPrice,
    estimatedCost: photo.metadata.estimatedCost,
    moq: photo.metadata.moq,
    note: photo.metadata.note || '',
    estimatedSize: photo.metadata.estimatedSize,
    samplingTime: photo.metadata.samplingTime,
    moldRequired: photo.metadata.moldRequired,
    moldTime: photo.metadata.moldTime,
    bulkProductionTime: photo.metadata.bulkProductionTime
  };
}

function mergeSuggestion(photo: Photo, draft: ProductMetadata): ProductMetadata {
  const suggested = photo.analysis.suggestedMetadata;
  if (!suggested) {
    return draft;
  }
  return {
    productName: suggested.productName ?? draft.productName,
    material: suggested.material ?? draft.material,
    productUrl: suggested.productUrl ?? draft.productUrl,
    product1688Url: suggested.product1688Url ?? draft.product1688Url,
    marketPrice: suggested.marketPrice ?? draft.marketPrice,
    estimatedCost: suggested.estimatedCost ?? draft.estimatedCost,
    moq: suggested.moq ?? draft.moq,
    note: suggested.note ?? draft.note,
    estimatedSize: suggested.estimatedSize ?? draft.estimatedSize,
    samplingTime: suggested.samplingTime ?? draft.samplingTime,
    moldRequired: suggested.moldRequired ?? draft.moldRequired,
    moldTime: suggested.moldTime ?? draft.moldTime,
    bulkProductionTime: suggested.bulkProductionTime ?? draft.bulkProductionTime
  };
}

const PHOTO_PAGE_SIZE = 12;

function getCardDisplay(photo: Photo) {
  const suggestion = photo.analysis.suggestedMetadata;
  return {
    productName: photo.metadata.productName || suggestion?.productName || '待 AI 命名',
    material: photo.metadata.material || suggestion?.material || '待补材质',
    marketPrice: photo.metadata.marketPrice ?? suggestion?.marketPrice ?? null
  };
}

export function AlbumDetail({ albumId }: { albumId: string }) {
  const router = useRouter();
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [albumName, setAlbumName] = useState('');
  const [albumDescription, setAlbumDescription] = useState('');
  const [shareTitle, setShareTitle] = useState('');
  const [shareDescription, setShareDescription] = useState('');
  const [shareMoq, setShareMoq] = useState('');
  const [photoPage, setPhotoPage] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAlbum, setSavingAlbum] = useState(false);
  const [deletingAlbum, setDeletingAlbum] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [clipboardImage, setClipboardImage] = useState<{
    name: string;
    dataUrl: string;
  } | null>(null);
  const [detailDraft, setDetailDraft] = useState<ProductMetadata>({ ...emptyDraft });
  const [showCostDetail, setShowCostDetail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadAlbum() {
    const record = await api.getAlbum(albumId);
    setAlbum(record);
    setAlbumName(record.name);
    setAlbumDescription(record.description || '');
  }

  async function loadPhotos() {
    const records = await api.getAlbumPhotos(albumId);
    setPhotos(records);
    setSelectedPhotoIds((current) => current.filter((id) => records.some((item) => item.id === id)));
    setSelectedPhotoId((current) => {
      if (current && records.some((item) => item.id === current)) {
        return current;
      }
      return records[0]?.id ?? null;
    });
  }

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    void (async () => {
      try {
        const [albumRecord, photoRecords] = await Promise.all([
          api.getAlbum(albumId),
          api.getAlbumPhotos(albumId)
        ]);
        if (!isActive) {
          return;
        }
        setAlbum(albumRecord);
        setAlbumName(albumRecord.name);
        setAlbumDescription(albumRecord.description || '');
        setPhotos(photoRecords);
        setSelectedPhotoId(photoRecords[0]?.id ?? null);
      } catch (requestError) {
        if (!isActive) {
          return;
        }
        setError(requestError instanceof Error ? requestError.message : '加载失败');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    })();
    return () => {
      isActive = false;
    };
  }, [albumId]);

  useEffect(() => {
    if (!showDetailModal) {
      return;
    }
    const photo = photos.find((item) => item.id === selectedPhotoId) ?? null;
    setDetailDraft(makeDraftFromPhoto(photo));
    setShowCostDetail(false);
  }, [photos, selectedPhotoId, showDetailModal]);

  useEffect(() => {
    const hasActiveAnalysis = photos.some(
      (photo) => photo.analysis.status === 'pending' || photo.analysis.status === 'running'
    );
    if (!hasActiveAnalysis) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadPhotos().catch(() => undefined);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [albumId, photos]);

  const selectedPhoto = useMemo(
    () => photos.find((item) => item.id === selectedPhotoId) ?? null,
    [photos, selectedPhotoId]
  );

  const photoTotalPages = Math.max(1, Math.ceil(photos.length / PHOTO_PAGE_SIZE));
  const pagePhotos = useMemo(
    () => photos.slice(photoPage * PHOTO_PAGE_SIZE, (photoPage + 1) * PHOTO_PAGE_SIZE),
    [photos, photoPage]
  );

  // Reset photo page when list shrinks past current page
  useEffect(() => {
    if (photoPage >= photoTotalPages && photoTotalPages > 0) {
      setPhotoPage(Math.max(0, photoTotalPages - 1));
    }
  }, [photoTotalPages, photoPage]);

  async function onCreateShareDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const document = await api.createShareDocument({
        title: shareTitle || '未命名分享',
        description: shareDescription,
        photoIds: selectedPhotoIds,
        moq: toOptionalNumber(shareMoq) ?? undefined
      });
      setShowShareModal(false);
      router.push('/tasks');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '生成分享失败');
    }
  }

  async function onCreatePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get('image') as File | null;

    let fileAsDataUrl = clipboardImage?.dataUrl ?? '';
    if (!fileAsDataUrl) {
      if (!file || file.size === 0) {
        setError('请选择图片文件，或粘贴剪贴板中的图片');
        return;
      }

      fileAsDataUrl = await fileToDataUrl(file);
    }

    setUploading(true);
    setError('');
    try {
      const created = await api.createPhoto(albumId, {
        imageUrl: fileAsDataUrl,
        thumbnailUrl: fileAsDataUrl,
        primaryCategory: String(formData.get('primaryCategory') ?? '').trim() || undefined,
        secondaryCategory: String(formData.get('secondaryCategory') ?? '').trim() || undefined,
        metadata: {
          productName: String(formData.get('productName') ?? '').trim(),
          productUrl: String(formData.get('productUrl') ?? '').trim(),
          product1688Url: String(formData.get('product1688Url') ?? '').trim(),
          note: String(formData.get('note') ?? '').trim()
        }
      });
      await loadAlbum();
      await loadPhotos();
      form.reset();
      setClipboardImage(null);
      setSelectedPhotoId(created.id);
      setShowUploadModal(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function onPasteImage(event: ClipboardEvent<HTMLFormElement>) {
    const file = extractImageFromClipboardData(event.clipboardData);
    if (!file) {
      return;
    }
    event.preventDefault();
    try {
      const dataUrl = await fileToDataUrl(file);
      setClipboardImage({
        name: file.name || `clipboard-${Date.now()}.png`,
        dataUrl
      });
      setError('');
    } catch {
      setError('读取剪贴板图片失败');
    }
  }

  async function onPasteImageBox(event: ClipboardEvent<HTMLTextAreaElement>) {
    const file = extractImageFromClipboardData(event.clipboardData);
    if (!file) {
      return;
    }
    event.preventDefault();
    try {
      const dataUrl = await fileToDataUrl(file);
      setClipboardImage({
        name: file.name || `clipboard-${Date.now()}.png`,
        dataUrl
      });
      setError('');
    } catch {
      setError('读取剪贴板图片失败');
    }
  }

  async function onReadClipboardImage() {
    if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.read) {
      setError('当前浏览器不支持读取系统剪贴板，请直接 Ctrl/Cmd + V 粘贴图片');
      return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (!imageType) {
          continue;
        }
        const blob = await item.getType(imageType);
        const extension = imageType.split('/')[1] || 'png';
        const file = new File([blob], `clipboard-${Date.now()}.${extension}`, {
          type: imageType
        });
        const dataUrl = await fileToDataUrl(file);
        setClipboardImage({
          name: file.name,
          dataUrl
        });
        setError('');
        return;
      }
      setError('剪贴板中没有图片内容');
    } catch {
      setError('读取剪贴板失败，请检查浏览器权限后重试');
    }
  }

  async function onSaveAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!albumName.trim()) {
      setError('相册名称不能为空');
      return;
    }
    setSavingAlbum(true);
    setError('');
    try {
      await api.updateAlbum(albumId, {
        name: albumName.trim(),
        description: albumDescription.trim()
      });
      await loadAlbum();
      setShowAlbumModal(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新相册失败');
    } finally {
      setSavingAlbum(false);
    }
  }

  async function onDeleteAlbum() {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('确认删除该相册吗？相册下图片也会一起删除。');
      if (!confirmed) {
        return;
      }
    }
    setDeletingAlbum(true);
    setError('');
    try {
      await api.deleteAlbum(albumId);
      window.location.href = '/';
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '删除相册失败');
      setDeletingAlbum(false);
    }
  }

  async function onDeletePhoto(photoId: string) {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('确认删除这张图片吗？');
      if (!confirmed) {
        return;
      }
    }
    setDeletingPhotoId(photoId);
    setError('');
    try {
      await api.deletePhoto(photoId);
      await loadAlbum();
      await loadPhotos();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '删除图片失败');
    } finally {
      setDeletingPhotoId(null);
    }
  }

  async function onRetryAnalysis() {
    if (!selectedPhoto) {
      return;
    }
    setAnalysisLoading(true);
    setError('');
    try {
      await api.requestPhotoAnalysis(selectedPhoto.id);
      await loadPhotos();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '重新分析失败');
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function onSaveDetail(confirmAnalysis: boolean) {
    if (!selectedPhoto) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (confirmAnalysis) {
        await api.confirmPhotoAnalysis(selectedPhoto.id, { metadata: detailDraft });
      } else {
        await api.updatePhoto(selectedPhoto.id, { metadata: detailDraft });
      }
      await loadPhotos();
      setShowDetailModal(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack-lg">
      <div className="section-head">
        <div>
          <Link href="/" className="eyebrow-link">
            返回相册列表
          </Link>
          <h1>{album?.name || '相册图片'}</h1>
          <p className="muted">上传图片后可在分享文档时统一进行 AI 成本分析并导出 PPTX。</p>
        </div>
      </div>

      {error ? <div className="panel error-text">{error}</div> : null}
      {loading ? <div className="panel">加载中...</div> : null}

      <section className="panel stack-md">
        <div className="album-action-bar">
          <button className="button" onClick={() => setShowUploadModal(true)} type="button">
            上传图片
          </button>
          <button
            className="button button-secondary"
            onClick={() => setShowAlbumModal(true)}
            type="button"
          >
            编辑相册
          </button>
          <button
            className="button button-secondary"
            onClick={() => {
              if (selectedPhotoIds.length === 0) {
                setError('请先勾选至少一张图片');
                return;
              }
              setShowShareModal(true);
            }}
            type="button"
          >
            分享文档
          </button>
          <button
            className="button button-secondary"
            disabled={deletingAlbum}
            onClick={onDeleteAlbum}
            type="button"
          >
            {deletingAlbum ? '删除中...' : '删除相册'}
          </button>
        </div>

        <div className="section-head album-gallery-head">
          <h2>图片列表</h2>
          <span className="muted">已确认的图片可直接分享；待确认图片会展示 AI 状态与建议信息。</span>
        </div>
        <div className="photo-grid album-photo-grid analysis-photo-grid">
          {pagePhotos.map((photo) => {
            const checked = selectedPhotoIds.includes(photo.id);
            const selected = selectedPhotoId === photo.id;
            const status = statusMeta(photo.analysis.status);
            const card = getCardDisplay(photo);
            return (
              <button
                key={photo.id}
                className={`photo-card ${selected ? 'active' : ''}`}
                onClick={() => {
                  setSelectedPhotoId(photo.id);
                  setShowDetailModal(true);
                }}
                type="button"
              >
                <div className="photo-image album-photo-image">
                  <img
                    alt={card.productName || 'product photo'}
                    className="photo-image-thumb"
                    src={photo.thumbnailUrl}
                  />
                  <button
                    className="photo-delete-button"
                    disabled={deletingPhotoId === photo.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onDeletePhoto(photo.id);
                    }}
                    type="button"
                  >
                    {deletingPhotoId === photo.id ? '删除中...' : '删除'}
                  </button>
                  <label className="checkbox" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        event.stopPropagation();
                        setSelectedPhotoIds((current) =>
                          event.target.checked
                            ? [...current, photo.id]
                            : current.filter((item) => item !== photo.id)
                        );
                      }}
                    />
                    <span>分享</span>
                  </label>
                  <span className={`status-pill photo-status-badge ${status.className}`}>{status.label}</span>
                </div>
                <div className="photo-card-body photo-card-analysis-body">
                  <div className="stack-xs">
                    <strong>{card.productName}</strong>
                    <span>{card.material}</span>
                  </div>
                  <div className="photo-card-foot">
                    <span>{formatMoney(card.marketPrice)}</span>
                    <span>{photo.analysis.confidence ? `${photo.analysis.confidence} confidence` : '待复核'}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {photoTotalPages > 1 ? (
          <div className="pagination-bar">
            <span className="muted">
              共 {photos.length} 张图片，第 {photoPage + 1}/{photoTotalPages} 页
            </span>
            <div className="pagination-buttons">
              <button className="button button-secondary button-sm" disabled={photoPage === 0} onClick={() => setPhotoPage(0)} type="button">首页</button>
              <button className="button button-secondary button-sm" disabled={photoPage === 0} onClick={() => setPhotoPage((p) => Math.max(0, p - 1))} type="button">上一页</button>
              <button className="button button-secondary button-sm" disabled={photoPage >= photoTotalPages - 1} onClick={() => setPhotoPage((p) => Math.min(photoTotalPages - 1, p + 1))} type="button">下一页</button>
              <button className="button button-secondary button-sm" disabled={photoPage >= photoTotalPages - 1} onClick={() => setPhotoPage(photoTotalPages - 1)} type="button">末页</button>
            </div>
          </div>
        ) : null}
      </section>

      {showUploadModal ? (
        <div className="dialog-backdrop" onClick={() => setShowUploadModal(false)} role="presentation">
          <form
            className="panel form dialog-panel"
            onClick={(event) => event.stopPropagation()}
            onPaste={onPasteImage}
            onSubmit={onCreatePhoto}
          >
            <div className="section-head">
              <div>
                <h2>上传图片</h2>
                <p className="muted">上传图片后可手动填写商品信息，分享文档时会统一进行 AI 成本分析。</p>
              </div>
              <button
                className="button button-secondary"
                onClick={() => setShowUploadModal(false)}
                type="button"
              >
                关闭
              </button>
            </div>
            <label>
              粘贴输入框
              <textarea
                className="paste-box"
                onPaste={onPasteImageBox}
                placeholder="点击这里后按 Command/Ctrl + V 粘贴图片"
              />
            </label>
            <label>
              图片文件
              <input accept="image/*" name="image" type="file" />
            </label>
            <button className="button button-secondary" onClick={onReadClipboardImage} type="button">
              读取剪贴板图片
            </button>
            {clipboardImage ? (
              <div className="stack-sm">
                <span className="muted">已使用剪贴板图片：{clipboardImage.name}</span>
                <div className="detail-preview analysis-preview-frame">
                  <img
                    alt={clipboardImage.name}
                    className="detail-preview-image"
                    src={clipboardImage.dataUrl}
                  />
                </div>
              </div>
            ) : null}
            <label>
              商品标题提示（可选）
              <input name="productName" placeholder="例如：轻奢挂件 / 女包 / 礼品挂饰" />
            </label>
            <label>
              品牌（一级分类）
              <input name="primaryCategory" placeholder="例如：晖致、麦当劳、莉莉丝" list="brand-list" autoComplete="off" />
            </label>
            <label>
              产品类型（二级分类）
              <input name="secondaryCategory" placeholder="例如：杯套、睡眠、挂件" list="product-list" autoComplete="off" />
            </label>
            <label>
              产品链接（可选）
              <input name="productUrl" placeholder="https://example.com/product" />
            </label>
            <label>
              1688 产品链接（可选）
              <input name="product1688Url" placeholder="https://detail.1688.com/offer/xxx.html" />
            </label>
            <label>
              补充说明（可选）
              <textarea name="note" placeholder="例如：目标渠道、包装要求、你已知的材质线索" />
            </label>
            <button className="button" disabled={uploading}>
              {uploading ? '上传中...' : '上传图片'}
            </button>
          </form>
        </div>
      ) : null}

      {showAlbumModal ? (
        <div className="dialog-backdrop" onClick={() => setShowAlbumModal(false)} role="presentation">
          <form
            className="panel form dialog-panel"
            onClick={(event) => event.stopPropagation()}
            onSubmit={onSaveAlbum}
          >
            <div className="section-head">
              <h2>编辑相册</h2>
              <button
                className="button button-secondary"
                onClick={() => setShowAlbumModal(false)}
                type="button"
              >
                关闭
              </button>
            </div>
            <label>
              相册名称
              <input value={albumName} onChange={(event) => setAlbumName(event.target.value)} />
            </label>
            <label>
              相册描述
              <textarea
                value={albumDescription}
                onChange={(event) => setAlbumDescription(event.target.value)}
              />
            </label>
            <button className="button" disabled={savingAlbum || !albumName.trim()}>
              {savingAlbum ? '保存中...' : '保存相册信息'}
            </button>
          </form>
        </div>
      ) : null}

      {showDetailModal && selectedPhoto ? (
        <div className="dialog-backdrop" onClick={() => setShowDetailModal(false)} role="presentation">
          <div className="panel dialog-panel detail-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <div>
                <h2>产品详情与 AI 审核</h2>
                <p className="muted">AI 先生成建议字段，你再决定采用、修改或重新分析。</p>
              </div>
              <button
                className="button button-secondary"
                onClick={() => setShowDetailModal(false)}
                type="button"
              >
                关闭
              </button>
            </div>

            <div className="detail-dialog-grid">
              <section className="detail-side-panel stack-md">
                <div className="detail-preview analysis-preview-frame">
                  <img
                    alt={selectedPhoto.metadata.productName || 'detail'}
                    className="detail-preview-image"
                    src={selectedPhoto.imageUrl}
                  />
                </div>
                <div className="analysis-summary-card">
                  <div className="row wrap-row">
                    <span className={`status-pill ${statusMeta(selectedPhoto.analysis.status).className}`}>
                      {statusMeta(selectedPhoto.analysis.status).label}
                    </span>
                    {selectedPhoto.analysis.confidence ? (
                      <span className="status-pill status-neutral">{selectedPhoto.analysis.confidence} confidence</span>
                    ) : null}
                  </div>
                  <p>{selectedPhoto.analysis.reasoningSummary || '上传后系统会在后台自动分析，完成后这里会展示判断依据。'}</p>
                  {selectedPhoto.analysis.sources.length > 0 ? (
                    <div className="analysis-source-list">
                      {selectedPhoto.analysis.sources.map((source) => (
                        <span key={source} className="analysis-source-chip">
                          {source}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {selectedPhoto.analysis.errorMessage ? (
                    <p className="error-text">{selectedPhoto.analysis.errorMessage}</p>
                  ) : null}
                  <button
                    className="button button-secondary"
                    disabled={analysisLoading}
                    onClick={() => void onRetryAnalysis()}
                    type="button"
                  >
                    {analysisLoading ? '分析中...' : '重新分析'}
                  </button>
                </div>
              </section>

              <section className="stack-md detail-main-column">
                <div className="detail-section stack-sm">
                  <div className="section-head compact-head">
                    <h3>AI 建议</h3>
                    <button
                      className="button button-secondary"
                      disabled={!selectedPhoto.analysis.suggestedMetadata}
                      onClick={() => setDetailDraft((current) => mergeSuggestion(selectedPhoto, current))}
                      type="button"
                    >
                      套用 AI 建议
                    </button>
                  </div>
                  {selectedPhoto.analysis.suggestedMetadata ? (
                    <>
                      <div className="analysis-field-grid">
                        <div className="analysis-field-card">
                          <span>产品名称</span>
                          <strong>{selectedPhoto.analysis.suggestedMetadata.productName || '待建议'}</strong>
                        </div>
                        <div className="analysis-field-card">
                          <span>材质</span>
                          <strong>{selectedPhoto.analysis.suggestedMetadata.material || '待建议'}</strong>
                        </div>
                        <div className="analysis-field-card">
                          <span>市场售价</span>
                          <strong>{formatMoney(selectedPhoto.analysis.suggestedMetadata.marketPrice)}</strong>
                        </div>
                        <div className="analysis-field-card">
                          <span>预估成本区间</span>
                          <strong>
                            {selectedPhoto.analysis.suggestedMetadata.estimatedCostMin != null ||
                            selectedPhoto.analysis.suggestedMetadata.estimatedCostMax != null
                              ? `${formatMoney(selectedPhoto.analysis.suggestedMetadata.estimatedCostMin)} ~ ${formatMoney(
                                  selectedPhoto.analysis.suggestedMetadata.estimatedCostMax
                                )}`
                              : '待建议'}
                          </strong>
                        </div>
                        <div className="analysis-field-card">
                          <span>MOQ</span>
                          <strong>{selectedPhoto.analysis.suggestedMetadata.moq ?? '待建议'}</strong>
                        </div>
                        <div className="analysis-field-card analysis-field-card-wide">
                          <span>AI 备注</span>
                          <strong>{selectedPhoto.analysis.suggestedMetadata.note || '待建议'}</strong>
                        </div>
                      </div>

                      {(selectedPhoto.analysis.suggestedMetadata.bomBreakdown ||
                        selectedPhoto.analysis.suggestedMetadata.costBreakdown) ? (
                        <div className="cost-detail-section">
                          <button
                            className="button button-secondary"
                            onClick={() => setShowCostDetail((v) => !v)}
                            type="button"
                          >
                            {showCostDetail ? '收起预估成本详情' : '预估成本详情'}
                          </button>
                          {showCostDetail ? (
                            <div className="cost-detail-panel">
                              {selectedPhoto.analysis.suggestedMetadata.bomBreakdown ? (
                                <div className="cost-table-section">
                                  <h4>BOM 物料清单</h4>
                                  <table className="cost-table">
                                    <thead>
                                      <tr>
                                        <th>部件</th>
                                        <th>材质 / 工艺</th>
                                        <th>单价</th>
                                        <th>损耗率</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(selectedPhoto.analysis.suggestedMetadata.bomBreakdown as BomItem[]).map(
                                        (item, idx) => (
                                          <tr key={idx}>
                                            <td>{item.part}</td>
                                            <td>{item.material}</td>
                                            <td>{formatMoney(item.unitCost)}</td>
                                            <td>{item.lossRate}</td>
                                          </tr>
                                        )
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              ) : null}
                              {selectedPhoto.analysis.suggestedMetadata.costBreakdown ? (
                                <div className="cost-table-section">
                                  <h4>成本结构</h4>
                                  <table className="cost-table">
                                    <thead>
                                      <tr>
                                        <th>成本类别</th>
                                        <th>金额</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {((
                                        breakdown: CostBreakdown
                                      ) => {
                                        const rows: Array<{ label: string; value: number | null }> = [
                                          { label: '物料成本', value: breakdown.materialCost },
                                          { label: '人工成本', value: breakdown.laborCost },
                                          { label: '包装成本', value: breakdown.packagingCost },
                                          { label: '固定成本分摊', value: breakdown.fixedCostPerUnit },
                                          { label: '物流运费', value: breakdown.logisticsCost },
                                          { label: '税费', value: breakdown.taxCost }
                                        ];
                                        const total =
                                          rows.reduce((sum, row) => sum + (row.value ?? 0), 0) || null;
                                        return (
                                          <>
                                            {rows.map(
                                              (row) =>
                                                row.value !== null ? (
                                                  <tr key={row.label}>
                                                    <td>{row.label}</td>
                                                    <td>{formatMoney(row.value)}</td>
                                                  </tr>
                                                ) : null
                                            )}
                                            {total !== null ? (
                                              <tr className="cost-table-total">
                                                <td><strong>合计</strong></td>
                                                <td><strong>{formatMoney(total)}</strong></td>
                                              </tr>
                                            ) : null}
                                          </>
                                        );
                                      })(selectedPhoto.analysis.suggestedMetadata.costBreakdown)}
                                    </tbody>
                                  </table>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="analysis-empty-state">
                      {selectedPhoto.analysis.status === 'failed'
                        ? '本次分析失败，可点击“重新分析”重试。'
                        : 'AI 正在处理中，结果完成后会自动刷新。'}
                    </div>
                  )}
                </div>

                <div className="detail-section stack-sm">
                  <div className="section-head compact-head">
                    <h3>正式商品信息</h3>
                    <span className="muted">这里保存的是最终确认后的字段，分享文档将使用这部分内容。</span>
                  </div>
                  <div className="form-grid-tight">
                    <label>
                      产品名称
                      <input
                        name="productName"
                        value={detailDraft.productName}
                        onChange={(event) =>
                          setDetailDraft((current) => ({ ...current, productName: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      产品材质
                      <input
                        name="material"
                        value={detailDraft.material}
                        onChange={(event) =>
                          setDetailDraft((current) => ({ ...current, material: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      产品链接
                      <input
                        name="productUrl"
                        value={detailDraft.productUrl}
                        onChange={(event) =>
                          setDetailDraft((current) => ({ ...current, productUrl: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      1688 产品链接
                      <input
                        name="product1688Url"
                        value={detailDraft.product1688Url}
                        onChange={(event) =>
                          setDetailDraft((current) => ({ ...current, product1688Url: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      市场售价
                      <input
                        type="number"
                        value={detailDraft.marketPrice ?? ''}
                        onChange={(event) =>
                          setDetailDraft((current) => ({
                            ...current,
                            marketPrice: toOptionalNumber(event.target.value)
                          }))
                        }
                      />
                    </label>
                    <label>
                      预估成本
                      <input
                        type="number"
                        value={detailDraft.estimatedCost ?? ''}
                        onChange={(event) =>
                          setDetailDraft((current) => ({
                            ...current,
                            estimatedCost: toOptionalNumber(event.target.value)
                          }))
                        }
                      />
                    </label>
                    <label>
                      MOQ
                      <input
                        type="number"
                        value={detailDraft.moq ?? ''}
                        onChange={(event) =>
                          setDetailDraft((current) => ({
                            ...current,
                            moq: toOptionalNumber(event.target.value)
                          }))
                        }
                      />
                    </label>
                    <label className="form-grid-wide">
                      备注
                      <textarea
                        name="note"
                        value={detailDraft.note}
                        onChange={(event) =>
                          setDetailDraft((current) => ({ ...current, note: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <div className="detail-action-row">
                    <button className="button button-secondary" disabled={saving} onClick={() => void onSaveDetail(false)} type="button">
                      {saving ? '保存中...' : '仅保存手动修改'}
                    </button>
                    <button className="button" disabled={saving} onClick={() => void onSaveDetail(true)} type="button">
                      {saving ? '确认中...' : '确认并保存为正式资料'}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {showShareModal ? (
        <div className="dialog-backdrop" onClick={() => setShowShareModal(false)} role="presentation">
          <form
            className="panel form dialog-panel"
            onClick={(event) => event.stopPropagation()}
            onSubmit={onCreateShareDocument}
          >
            <div className="section-head">
              <h2>分享文档</h2>
              <button
                className="button button-secondary"
                onClick={() => setShowShareModal(false)}
                type="button"
              >
                关闭
              </button>
            </div>
            <p className="muted">已选择 {selectedPhotoIds.length} 张图片，将创建导出任务并统一进行 AI 成本分析。</p>
            <label>
              文档标题
              <input value={shareTitle} onChange={(event) => setShareTitle(event.target.value)} />
            </label>
            <label>
              文档说明
              <textarea
                value={shareDescription}
                onChange={(event) => setShareDescription(event.target.value)}
              />
            </label>
            <label>
              统一定起订量 (MOQ)
              <input
                type="number"
                min="1"
                value={shareMoq}
                onChange={(event) => setShareMoq(event.target.value)}
                placeholder="例如：500（所有产品统一 MOQ）"
              />
            </label>
            <button className="button">创建导出任务</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
