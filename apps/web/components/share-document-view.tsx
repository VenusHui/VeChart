'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { api } from '@/lib/api';
import { ShareDocument } from '@/lib/types';

export function ShareDocumentView({ shareId }: { shareId: string }) {
  const [document, setDocument] = useState<ShareDocument | null>(null);
  const [message, setMessage] = useState('');
  const [exportingTemplate, setExportingTemplate] = useState<'default' | 'sales' | null>(null);

  useEffect(() => {
    void api.getShareDocument(shareId).then(setDocument);
  }, [shareId]);

  if (!document) {
    return <div className="panel">加载分享文档...</div>;
  }

  return (
    <div className="stack-lg share-print">
      <div className="section-head">
        <div>
          <Link href="/" className="eyebrow-link">
            返回相册
          </Link>
          <h1>{document.title}</h1>
          <p className="muted">{document.description || '固定模板分享文档'}</p>
        </div>
        <div className="row">
          <button
            className="button button-secondary"
            disabled={exportingTemplate !== null}
            onClick={async () => {
              setExportingTemplate('default');
              setMessage('正在生成 PPTX，请稍候...');
              try {
                await api.exportPptx(document.id, `${document.title}.pptx`, 'default');
                setMessage('PPTX 导出已开始下载。');
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'PPTX 导出失败。');
              } finally {
                setExportingTemplate(null);
              }
            }}
          >
            {exportingTemplate === 'default' ? '正在生成 PPTX...' : '导出 PPTX'}
          </button>
          <button
            className="button button-secondary"
            disabled={exportingTemplate !== null}
            onClick={async () => {
              setExportingTemplate('sales');
              setMessage('正在生成销售模板 PPTX，请稍候...');
              try {
                await api.exportPptx(document.id, `${document.title}-销售模板.pptx`, 'sales');
                setMessage('销售模板 PPTX 导出已开始下载。');
              } catch (error) {
                setMessage(error instanceof Error ? error.message : '销售模板导出失败。');
              } finally {
                setExportingTemplate(null);
              }
            }}
          >
            {exportingTemplate === 'sales' ? '正在生成销售模板...' : '导出销售模板 PPTX'}
          </button>
          <button
            className="button"
            disabled={exportingTemplate !== null}
            onClick={async () => {
              const result = await api.exportPdf(document.id);
              setMessage(result.message);
              window.print();
            }}
          >
            导出 PDF
          </button>
        </div>
      </div>
      {message ? <div className="panel muted">{message}</div> : null}
      <div className="share-pages">
        {document.items.map((item, index) => (
          <article className="share-sheet panel" key={item.id}>
            <header className="share-sheet-head">
              <p className="eyebrow">Page {index + 1}</p>
              <h2>{item.snapshot.productName}</h2>
              <p className="muted">{item.snapshot.material}</p>
            </header>
            <div className="share-page">
              <div className="share-media-frame">
                <img
                  alt={item.snapshot.productName}
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
                    <strong>{item.snapshot.material}</strong>
                  </div>
                </div>
                <div className="stack-xs">
                  <span className="muted">产品链接</span>
                  <a href={item.snapshot.productUrl}>{item.snapshot.productUrl}</a>
                </div>
                <div className="stack-xs">
                  <span className="muted">1688 链接</span>
                  <a href={item.snapshot.product1688Url}>{item.snapshot.product1688Url}</a>
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
