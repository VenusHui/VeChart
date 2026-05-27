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

export function TaskList() {
  const [tasks, setTasks] = useState<ShareDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

      {tasks.length === 0 ? (
        <div className="panel muted">暂无导出任务，请在相册中选择图片创建分享文档。</div>
      ) : (
        <div className="panel">
          <table className="task-table">
            <thead>
              <tr>
                <th>标题</th>
                <th>MOQ</th>
                <th>状态</th>
                <th>进度</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const meta = statusMeta(task.status);
                return (
                  <tr key={task.id}>
                    <td>
                      <Link href={`/share/${task.id}`}>{task.title}</Link>
                    </td>
                    <td>{task.unifiedMoq ?? '-'}</td>
                    <td>
                      <span className={`status-pill ${meta.className}`}>{meta.label}</span>
                    </td>
                    <td>
                      {(task.status === 'analyzing' || task.status === 'generating') ? (
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${task.exportProgress}%` }}
                          />
                        </div>
                      ) : task.status === 'completed' ? (
                        '100%'
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{new Date(task.createdAt).toLocaleString('zh-CN')}</td>
                    <td>
                      <div className="row">
                        <Link href={`/share/${task.id}`} className="button button-secondary">
                          查看
                        </Link>
                        {task.status === 'completed' ? (
                          <button
                            className="button"
                            disabled={downloadingId === task.id}
                            onClick={async () => {
                              setDownloadingId(task.id);
                              try {
                                await api.downloadExportPptx(task.id, `${task.title}.pptx`);
                              } finally {
                                setDownloadingId(null);
                              }
                            }}
                          >
                            {downloadingId === task.id ? '下载中...' : '下载'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
