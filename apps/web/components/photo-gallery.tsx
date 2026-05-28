'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { CategoryList, Photo } from '@/lib/types';
import { AlbumOverview } from './album-overview';

const PAGE_SIZE = 12;

export function PhotoGallery() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryList>({ primaryCategories: [], secondaryCategories: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'category' | 'album'>('category');
  const requestSeq = useRef(0);

  const loadPhotos = useCallback(async function loadPhotos(
    params?: { page?: number; brand?: string | null; product?: string | null; search?: string }
  ) {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    try {
      const data = await api.listPhotos({
        page: params?.page ?? page,
        brand: params?.brand ?? selectedBrand ?? undefined,
        product: params?.product ?? selectedProduct ?? undefined,
        q: (params?.search ?? searchText) || undefined,
        pageSize: PAGE_SIZE
      });
      if (seq !== requestSeq.current) return;
      setPhotos(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (requestError) {
      if (seq !== requestSeq.current) return;
      setError(requestError instanceof Error ? requestError.message : '加载失败');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [page, selectedBrand, selectedProduct, searchText]);

  async function loadCategories() {
    try {
      setCategories(await api.listCategories());
    } catch {
      // categories are non-critical
    }
  }

  useEffect(() => {
    void loadCategories();
  }, []);

  useEffect(() => {
    void loadPhotos({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch() {
    setPage(1);
    void loadPhotos({ page: 1, search: searchText });
  }

  function handleBrandClick(brand: string) {
    if (selectedBrand === brand) {
      setSelectedBrand(null);
      setPage(1);
      void loadPhotos({ page: 1, brand: null });
    } else {
      setSelectedBrand(brand);
      setPage(1);
      void loadPhotos({ page: 1, brand });
    }
  }

  function handleProductClick(product: string) {
    if (selectedProduct === product) {
      setSelectedProduct(null);
      setPage(1);
      void loadPhotos({ page: 1, product: null });
    } else {
      setSelectedProduct(product);
      setPage(1);
      void loadPhotos({ page: 1, product });
    }
  }

  function goToPage(p: number) {
    setPage(p);
    void loadPhotos({ page: p });
  }

  if (viewMode === 'album') {
    return (
      <div className="stack-lg">
        <div className="section-head">
          <h2>相册浏览</h2>
          <button className="button button-secondary button-sm" onClick={() => setViewMode('category')} type="button">
            切换到分类浏览
          </button>
        </div>
        <AlbumOverview />
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <section className="hero">
        <div>
          <p className="eyebrow">Product Photo Manager</p>
          <h1>商品图片库</h1>
          <p className="muted">
            按品牌和产品分类浏览商品图片，支持搜索产品名称、材质和分类标签。
          </p>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <span>图片总数</span>
            <strong>{total}</strong>
          </div>
          <div className="stat">
            <span>品牌数</span>
            <strong>{categories.primaryCategories.length}</strong>
          </div>
        </div>
      </section>

      <section className="section-head">
        <div className="search-bar">
          <input
            placeholder="搜索产品名称、材质、品牌..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          />
          <button className="button button-sm" onClick={handleSearch} type="button">搜索</button>
        </div>
        <button className="button button-secondary button-sm" onClick={() => setViewMode('album')} type="button">
          相册浏览
        </button>
      </section>

      <div className="category-filter-section">
        <div className="filter-chips-row">
          <span className="filter-label-text">品牌</span>
          <div className="filter-chips">
            <button
              className={`chip${selectedBrand === null ? ' active' : ''}`}
              onClick={() => {
                if (selectedBrand !== null) {
                  setSelectedBrand(null);
                  setPage(1);
                  void loadPhotos({ page: 1, brand: null });
                }
              }}
              type="button"
            >
              全部
            </button>
            {categories.primaryCategories.map((cat) => (
              <button
                key={cat}
                className={`chip${selectedBrand === cat ? ' active' : ''}`}
                onClick={() => handleBrandClick(cat)}
                type="button"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-chips-row">
          <span className="filter-label-text">产品类型</span>
          <div className="filter-chips">
            <button
              className={`chip${selectedProduct === null ? ' active' : ''}`}
              onClick={() => {
                if (selectedProduct !== null) {
                  setSelectedProduct(null);
                  setPage(1);
                  void loadPhotos({ page: 1, product: null });
                }
              }}
              type="button"
            >
              全部
            </button>
            {categories.secondaryCategories.map((cat) => (
              <button
                key={cat}
                className={`chip${selectedProduct === cat ? ' active' : ''}`}
                onClick={() => handleProductClick(cat)}
                type="button"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? <div className="panel error-text">{error}</div> : null}

      {loading ? (
        <div className="photo-grid">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div className="photo-card" key={i}>
              <div className="photo-image" style={{ background: 'var(--frame)' }} />
              <div className="photo-card-body">
                <div style={{ height: 20, background: 'var(--frame)', borderRadius: 8 }} />
                <div style={{ height: 14, width: '60%', background: 'var(--frame)', borderRadius: 8, marginTop: 4 }} />
              </div>
            </div>
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="panel muted" style={{ textAlign: 'center', padding: '3rem' }}>
          {searchText || selectedBrand || selectedProduct ? '暂无匹配的照片' : '暂无照片，请先上传照片。'}
        </div>
      ) : (
        <>
          <div className="photo-grid">
            {photos.map((photo) => (
              <Link href={`/albums/${photo.albumId}`} className="photo-card" key={photo.id}>
                <div className="photo-image">
                  <img
                    className="photo-image-thumb"
                    src={photo.thumbnailUrl || photo.imageUrl}
                    alt={photo.metadata.productName || 'Photo'}
                    loading="lazy"
                  />
                </div>
                <div className="photo-card-body">
                  <strong>{photo.metadata.productName || '未命名'}</strong>
                  <div className="photo-card-tags">
                    {photo.primaryCategory ? (
                      <span className="category-badge brand-badge">{photo.primaryCategory}</span>
                    ) : null}
                    {photo.secondaryCategory ? (
                      <span className="category-badge product-badge">{photo.secondaryCategory}</span>
                    ) : null}
                  </div>
                  <span className="muted" style={{ fontSize: '0.78rem' }}>
                    {photo.metadata.material || ''}
                    {photo.metadata.material && photo.metadata.marketPrice ? ' · ' : ''}
                    {photo.metadata.marketPrice ? `¥${photo.metadata.marketPrice}` : ''}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="pagination-bar">
            <span className="muted">
              共 {total} 张照片，第 {page}/{totalPages} 页
            </span>
            <div className="pagination-buttons">
              <button className="button button-secondary button-sm" disabled={page <= 1} onClick={() => goToPage(1)} type="button">首页</button>
              <button className="button button-secondary button-sm" disabled={page <= 1} onClick={() => goToPage(Math.max(1, page - 1))} type="button">上一页</button>
              <button className="button button-secondary button-sm" disabled={page >= totalPages} onClick={() => goToPage(Math.min(totalPages, page + 1))} type="button">下一页</button>
              <button className="button button-secondary button-sm" disabled={page >= totalPages} onClick={() => goToPage(totalPages)} type="button">末页</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
