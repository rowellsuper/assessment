import axios, { AxiosError, AxiosRequestConfig } from 'axios';

export type Permission = 'view' | 'comment' | 'edit';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface DocumentListItem {
  id: string;
  title: string;
  updated_at: string;
  owner_id: string;
  owner_name: string;
  access_type: 'owned' | 'shared';
  permission?: Permission;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Share {
  id: string;
  user_id: string;
  name: string;
  email: string;
  permission: Permission;
  created_at: string;
}

export interface DocumentVersion {
  id: string;
  title: string;
  created_at: string;
  created_by_name: string;
}

export interface Comment {
  id: string;
  body: string;
  quoted_text: string | null;
  suggestion: string | null;
  is_suggestion: number;
  status: 'open' | 'resolved' | 'accepted' | 'rejected';
  created_at: string;
  user_id: string;
  user_name: string;
}

export interface PresenceUser {
  userId: string;
  name: string;
  isEditing: boolean;
}

interface ApiErrorBody {
  error?: string;
}

const http = axios.create({
  baseURL: '/api',
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function toApiError(err: unknown): Error {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err : new Error('Request failed');
  }

  const axiosErr = err as AxiosError<ApiErrorBody>;

  if (!axiosErr.response) {
    return new Error(
      'Cannot reach the API server. Run "npm run dev" from the project root and open http://localhost:5173'
    );
  }

  const { status, data } = axiosErr.response;

  if (status === 500 && !data?.error) {
    return new Error(
      'API server error. Ensure the backend is running on port 3001 (npm run dev from project root).'
    );
  }

  return new Error(data?.error || `Request failed (${status})`);
}

async function request<T>(path: string, config: AxiosRequestConfig = {}): Promise<T> {
  try {
    const { data } = await http.request<T>({ url: path, ...config });
    return data;
  } catch (err) {
    throw toApiError(err);
  }
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      data: { email, password },
    }),

  me: () => request<{ user: User }>('/auth/me'),

  getDocuments: () =>
    request<{ owned: DocumentListItem[]; shared: DocumentListItem[] }>('/documents'),

  createDocument: (title?: string) =>
    request<{ document: Document }>('/documents', {
      method: 'POST',
      data: { title },
    }),

  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ document: Document }>('/documents/upload', {
      method: 'POST',
      data: form,
    });
  },

  getDocument: (id: string) =>
    request<{
      document: Document;
      owner: User;
      isOwner: boolean;
      permission: Permission;
      canEdit: boolean;
      canComment: boolean;
      shares: Share[];
    }>(`/documents/${id}`),

  updateDocument: (id: string, data: { title?: string; content?: string }) =>
    request<{ document: Document }>(`/documents/${id}`, {
      method: 'PATCH',
      data,
    }),

  importToDocument: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ document: Document }>(`/documents/${id}/import`, {
      method: 'POST',
      data: form,
    });
  },

  deleteDocument: (id: string) =>
    request<{ success: boolean }>(`/documents/${id}`, { method: 'DELETE' }),

  shareDocument: (id: string, email: string, permission: Permission = 'edit') =>
    request<{ share: Share }>(`/documents/${id}/share`, {
      method: 'POST',
      data: { email, permission },
    }),

  updateSharePermission: (docId: string, shareId: string, permission: Permission) =>
    request<{ share: Share }>(`/documents/${docId}/share/${shareId}`, {
      method: 'PATCH',
      data: { permission },
    }),

  removeShare: (docId: string, shareId: string) =>
    request<{ success: boolean }>(`/documents/${docId}/share/${shareId}`, {
      method: 'DELETE',
    }),

  getVersions: (id: string) =>
    request<{ versions: DocumentVersion[] }>(`/documents/${id}/versions`),

  restoreVersion: (docId: string, versionId: string) =>
    request<{ document: Document }>(`/documents/${docId}/versions/${versionId}/restore`, {
      method: 'POST',
    }),

  getComments: (id: string) =>
    request<{ comments: Comment[] }>(`/documents/${id}/comments`),

  addComment: (
    id: string,
    data: { body: string; quotedText?: string; suggestion?: string; isSuggestion?: boolean }
  ) =>
    request<{ comment: Comment }>(`/documents/${id}/comments`, {
      method: 'POST',
      data,
    }),

  updateCommentStatus: (docId: string, commentId: string, status: Comment['status']) =>
    request<{ comment: Comment; document?: Document }>(
      `/documents/${docId}/comments/${commentId}`,
      { method: 'PATCH', data: { status } }
    ),

  updateComment: (
    docId: string,
    commentId: string,
    data: { body: string; suggestion?: string }
  ) =>
    request<{ comment: Comment }>(`/documents/${docId}/comments/${commentId}`, {
      method: 'PATCH',
      data,
    }),

  deleteComment: (docId: string, commentId: string) =>
    request<{ success: boolean }>(`/documents/${docId}/comments/${commentId}`, {
      method: 'DELETE',
    }),
};
