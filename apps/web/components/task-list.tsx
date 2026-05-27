'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { api } from '@/lib/api';
import { ShareDocument } from '@/lib/types';

const PAGE_SIZE = 10;

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

export function TaskList() {
  const [tasks, setTasks] = useState<ShareDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);

  const loadTasks = useCallback(() => {
    void api.listExportTasks().then((data) => {
      setTasks(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const hasActive = tasks.some(
      (t) => t.status === 'pending' || t.status === 'analyzing' || t.status === 'generating'
    );
    if (!hasActive) return;

    const timer = window.setInterval(() => {
      loadTasks();
    }, 4000);

    return () => window.clearInterval(timer);
  }, [tasks, loadTasks]);

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [searchText, statusFilter, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!task.title.toLowerCase().includes(q)) return false;
      }
      if (statusFilter && task.status !== statusFilter) return false;
      if (dateFrom || dateTo) {
        const created = new Date(task.createdAt);
        if (dateFrom && created < new Date(dateFrom)) return false;
        if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          if (created > end) return false;
        }
      }
      return true;
    });
  }, [tasks, searchText, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function clearFilters() {
    setSearchText('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
  }

  const hasFilters = searchText || statusFilter || dateFrom || dateTo;

  if (loading) {
    return <div className="panel">加载任务列表...</div>;
  }

  return (
    <div className="stack-lg">
      <div className="section-head">
        <div>
          <Link href="/" className="eyebrow-link">
            返回相册列表
          </Link>
          <h1>导出任务</h1>
          <p className="muted">查看所有 PPTX 导出任务的状态和进度</p>
        </div>
      </div>

      {/* Search / filter bar */}
      <div className="panel">
        <div className="filter-bar">
          <div className="filter-field">
            <label className="filter-label">标题搜索</label>
            <input
              className="filter-input"
              placeholder="输入标题关键词..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
          <div className="filter-field">
            <label className="filter-label">状态</label>
            <select
              className="filter-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">全部</option>
              <option value="pending">等待中</option>
              <option value="analyzing">分析中</option>
              <option value="generating">生成中</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
            </select>
          </div>
          <div className="filter-field">
            <label className="filter-label">创建日期 起</label>
            <input
              className="filter-input"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="filter-field">
            <label className="filter-label">创建日期 止</label>
            <input
              className="filter-input"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          {hasFilters ? (
            <div className="filter-field filter-action">
              <button className="button button-secondary" onClick={clearFilters} type="button">
                清除筛选
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="panel muted">
          {hasFilters ? '没有匹配的任务，请调整筛选条件。' : '暂无导出任务，请在相册中选择图片创建分享文档。'}
        </div>
      ) : (
        <>
          <div className="panel task-table-panel">
            <table className="task-table">
              <thead>
                <tr>
                  <th className="col-title">标题</th>
                  <th className="col-moq">MOQ</th>
                  <th className="col-status">状态</th>
                  <th className="col-progress">进度</th>
                  <th className="col-date">创建时间</th>
                  <th className="col-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((task) => {
                  const meta = statusMeta(task.status);
                  return (
                    <tr key={task.id}>
                      <td className="col-title">
                        <Link href={`/share/${task.id}`} className="task-title-link">
                          {task.title}
                        </Link>
                      </td>
                      <td className="col-moq">{task.unifiedMoq != null ? task.unifiedMoq : '-'}</td>
                      <td className="col-status">
                        <span className={`status-pill ${meta.className}`}>{meta.label}</span>
                      </td>
                      <td className="col-progress">
                        {(task.status === 'analyzing' || task.status === 'generating') ? (
                          <span className="progress-cell">
                            <span className="progress-bar">
                              <span
                                className="progress-fill"
                                style={{ width: `${task.exportProgress}%` }}
                              />
                            </span>
                            <span className="progress-text">{task.exportProgress}%</span>
                          </span>
                        ) : task.status === 'completed' ? (
                          '100%'
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="col-date">{new Date(task.createdAt).toLocaleString('zh-CN')}</td>
                      <td className="col-actions">
                        <Link href={`/share/${task.id}`} className="button button-secondary button-sm">
                          查看
                        </Link>
                        {task.status === 'completed' ? (
                          <button
                            className="button button-sm"
                            disabled={downloadingId === task.id}
                            onClick={async () => {
                              setDownloadingId(task.id);
                              try {
                                await api.downloadExportPptx(task.id, `${task.title}.pptx`);
                              } finally {
                                setDownloadingId(null);
                              }
                            }}
                            type="button"
                          >
                            {downloadingId === task.id ? '下载中...' : '下载'}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 ? (
            <div className="pagination-bar">
              <span className="muted">
                共 {filtered.length} 条，第 {page + 1}/{totalPages} 页
              </span>
              <div className="pagination-buttons">
                <button
                  className="button button-secondary button-sm"
                  disabled={page === 0}
                  onClick={() => setPage(0)}
                  type="button"
                >
                  首页
                </button>
                <button
                  className="button button-secondary button-sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  type="button"
                >
                  上一页
                </button>
                <button
                  className="button button-secondary button-sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  type="button"
                >
                  下一页
                </button>
                <button
                  className="button button-secondary button-sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(totalPages - 1)}
                  type="button"
                >
                  末页
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
