'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { api } from '@/lib/api';
import { ShareDocument } from '@/lib/types';

function statusMeta(status: ShareDocument['status']) {
  switch (status) {
    case 'pending':
      return { label: '等待中', className: 'status-pending' };
    case 'analyzing':
      return { label: '分析中', className: 'status-running' };
    case 'generating':
      return { label: '生成中', className: 'status-running' };
    case 'completed':
      return { label: '已完成', className: 'status-confirmed' };
    case 'failed':
      return { label: '失败', className: 'status-failed' };
    default:
      return { label: '未知', className: 'status-pending' };
  }
}

export function ShareDocumentView({ shareId }: { shareId: string }) {
  const [document, setDocument] = useState<ShareDocument | null>(null);
  const [message, setMessage] = useState('');
  const [downloading, setDownloading] = useState(false);

  const loadDocument = useCallback(() => {
    void api.getShareDocument(shareId).then(setDocument);
  }, [shareId]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  useEffect(() => {
    if (!document) return;
    const active = document.status === 'pending' || document.status === 'analyzing' || document.status === 'generating';
    if (!active) return;

    const timer = window.setInterval(() => {
      loadDocument();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [document?.status, loadDocument]);

  if (!document) {
    return <div className="panel">加载分享文档...</div>;
  }

  const meta = statusMeta(document.status);

  return (
    <div className="stack-lg share-print">
      <div className="section-head">
        <div>
          <Link href="/tasks" className="eyebrow-link">
            返回任务列表
          </Link>
          <h1>{document.title}</h1>
          <p className="muted">{document.description || '固定模板分享文档'}</p>
        </div>
        <div className="row">
          <span className={`status-pill ${meta.className}`}>{meta.label}</span>
          {document.status === 'completed' ? (
            <button
              className="button"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                setMessage('正在下载...');
                try {
                  await api.downloadExportPptx(document.id, `${document.title}.pptx`);
                  setMessage('PPTX 下载完成。');
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : '下载失败');
                } finally {
                  setDownloading(false);
                }
              }}
            >
              {downloading ? '下载中...' : '下载 PPTX'}
            </button>
          ) : null}
          {document.status === 'failed' ? (
            <span className="error-text">{document.exportError || '导出任务失败'}</span>
          ) : null}
        </div>
      </div>

      {(document.status === 'analyzing' || document.status === 'generating') ? (
        <div className="panel">
          <p className="muted">
            {document.status === 'analyzing' ? '正在分析产品...' : '正在生成 PPTX 文件...'}
          </p>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${document.exportProgress}%` }}
            />
          </div>
          <p className="muted">{document.exportProgress}%</p>
        </div>
      ) : null}

      {document.status === 'pending' ? (
        <div className="panel muted">导出任务排队中，即将开始分析...</div>
      ) : null}

      {document.status === 'failed' ? (
        <div className="panel error-text">
          <p>导出任务失败：{document.exportError || '未知错误'}</p>
        </div>
      ) : null}

      {message ? <div className="panel muted">{message}</div> : null}

      <div className="share-pages">
        {document.items.map((item, index) => (
          <article className="share-sheet panel" key={item.id}>
            <header className="share-sheet-head">
              <p className="eyebrow">Page {index + 1}</p>
              <h2>{item.snapshot.productName || `产品 ${index + 1}`}</h2>
              <p className="muted">{item.snapshot.material || '待分析'}</p>
            </header>
            <div className="share-page">
              <div className="share-media-frame">
                <img
                  alt={item.snapshot.productName || 'product'}
                  className="share-media"
                  src={item.snapshot.imageUrl}
                />
              </div>
              <div className="stack-sm">
                <div className="spec-grid">
                  <div>
                    <span>市场售价</span>
                    <strong>{item.snapshot.marketPrice !== null ? `¥${item.snapshot.marketPrice}` : '待确认'}</strong>
                  </div>
                  <div>
                    <span>预估成本</span>
                    <strong>{item.snapshot.estimatedCost !== null ? `¥${item.snapshot.estimatedCost}` : '待确认'}</strong>
                  </div>
                  <div>
                    <span>MOQ</span>
                    <strong>{item.snapshot.moq ?? '待确认'}</strong>
                  </div>
                  <div>
                    <span>材质</span>
                    <strong>{item.snapshot.material || '待分析'}</strong>
                  </div>
                </div>
                {document.unifiedMoq != null ? (
                  <div className="stack-xs">
                    <span className="muted">统一 MOQ: {document.unifiedMoq}</span>
                  </div>
                ) : null}
                <div className="stack-xs">
                  <span className="muted">产品链接</span>
                  <a href={item.snapshot.productUrl}>{item.snapshot.productUrl || '-'}</a>
                </div>
                <div className="stack-xs">
                  <span className="muted">1688 链接</span>
                  <a href={item.snapshot.product1688Url}>{item.snapshot.product1688Url || '-'}</a>
                </div>
                {item.snapshot.note ? <p className="note-box">{item.snapshot.note}</p> : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
