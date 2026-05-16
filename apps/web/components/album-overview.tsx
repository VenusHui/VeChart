'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { Album } from '@/lib/types';

export function AlbumOverview() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function loadAlbums() {
    setLoading(true);
    try {
      setAlbums(await api.getAlbums());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAlbums();
  }, []);

  async function onCreateAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api.createAlbum({ name, description });
      setName('');
      setDescription('');
      await loadAlbums();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="stack-lg">
      <section className="hero">
        <div>
          <p className="eyebrow">Responsive Web MVP</p>
          <h1>商品云相册</h1>
          <p className="muted">
            统一管理商品图片、产品资料与对外分享文档。卡片显示名称、材质、价格，详情保存完整结构化信息。
          </p>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <span>相册数</span>
            <strong>{albums.length}</strong>
          </div>
          <div className="stat">
            <span>图片总数</span>
            <strong>{albums.reduce((sum, album) => sum + album.photoCount, 0)}</strong>
          </div>
        </div>
      </section>

      <section className="two-column">
        <div className="stack-md">
          <div className="section-head">
            <h2>相册分类</h2>
            <p className="muted">按业务分类管理产品素材，例如挂件、包包。</p>
          </div>
          {loading ? <div className="panel">加载中...</div> : null}
          <div className="album-grid">
            {albums.map((album) => (
              <Link href={`/albums/${album.id}`} className="album-card" key={album.id}>
                <div
                  className="album-cover"
                  style={{ backgroundImage: `url(${album.coverUrl || ''})` }}
                />
                <div className="album-meta">
                  <h3>{album.name}</h3>
                  <p>{album.description || '暂无描述'}</p>
                  <div className="row muted">
                    <span>{album.photoCount} 张图片</span>
                    <span>{new Date(album.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <form className="panel form" onSubmit={onCreateAlbum}>
          <div>
            <h2>新建相册</h2>
            <p className="muted">为新的产品分类准备展示空间。</p>
          </div>
          <label>
            相册名称
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            描述
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <button className="button" disabled={submitting || !name.trim()}>
            {submitting ? '创建中...' : '创建相册'}
          </button>
        </form>
      </section>
    </div>
  );
}
