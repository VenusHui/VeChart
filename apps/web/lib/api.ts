import { Album, Photo, ProductMetadata, ShareDocument, User } from './types';

function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL;

  if (
    configured &&
    configured.trim() &&
    !configured.includes('localhost') &&
    !configured.includes('127.0.0.1')
  ) {
    return configured;
  }

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  return configured ?? 'http://localhost:4000';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    credentials: 'include',
    cache: 'no-store'
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
  currentUser: () => request<User>('/auth/me'),
  logout: () =>
    request<{ ok: boolean }>('/auth/logout', {
      method: 'POST'
    }),
  getAlbums: () => request<Album[]>('/albums'),
  getAlbum: (albumId: string) => request<Album>(`/albums/${albumId}`),
  createAlbum: (payload: { name: string; description: string }) =>
    request<Album>('/albums', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateAlbum: (albumId: string, payload: { name?: string; description?: string }) =>
    request<Album>(`/albums/${albumId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteAlbum: (albumId: string) =>
    request<{ ok: boolean }>(`/albums/${albumId}`, {
      method: 'DELETE'
    }),
  getAlbumPhotos: (albumId: string) => request<Photo[]>(`/albums/${albumId}/photos`),
  createPhoto: (
    albumId: string,
    payload: {
      imageUrl: string;
      thumbnailUrl: string;
      metadata?: Partial<ProductMetadata>;
    }
  ) =>
    request<Photo>(`/albums/${albumId}/photos`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updatePhoto: (photoId: string, payload: { metadata: Partial<ProductMetadata> }) =>
    request<Photo>(`/photos/${photoId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  requestPhotoAnalysis: (photoId: string) =>
    request<Photo>(`/photos/${photoId}/analyze`, {
      method: 'POST'
    }),
  confirmPhotoAnalysis: (photoId: string, payload: { metadata: Partial<ProductMetadata> }) =>
    request<Photo>(`/photos/${photoId}/confirm-analysis`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  deletePhoto: (photoId: string) =>
    request<{ ok: boolean }>(`/photos/${photoId}`, {
      method: 'DELETE'
    }),
  createShareDocument: (payload: { title: string; description: string; photoIds: string[] }) =>
    request<ShareDocument>('/share-documents', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  getShareDocument: (shareId: string) => request<ShareDocument>(`/share-documents/${shareId}`),
  exportPdf: (shareId: string) =>
    request<{ message: string }>(`/share-documents/${shareId}/export-pdf`, {
      method: 'POST'
    }),
  exportPptx: async (
    shareId: string,
    fileName = `share-${shareId}.pptx`,
    template: 'default' | 'sales' = 'default'
  ) => {
    const query = new URLSearchParams({ template });
    const response = await fetch(
      `${getApiBaseUrl()}/api/share-documents/${shareId}/export-pptx?${query.toString()}`,
      {
        method: 'POST',
        credentials: 'include'
      }
    );
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Request failed: ${response.status}`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
};
