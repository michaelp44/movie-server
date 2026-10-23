import type {
  Download,
  ProviderSearchResult,
  RecommendationSection,
  WantedDownload,
  WantedDownloadAvailability,
  WantedDownloadQuality,
  AdminOverview,
  User,
  PaginatedResponse,
  ApiResponse
} from '@movie-server/shared';

const API_BASE = '';

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : { error: await response.text() };
  
  if (!response.ok) {
    throw new Error(data.error || response.statusText || 'Request failed');
  }

  return data;
}

// Auth
export async function login(username: string, password: string): Promise<User> {
  const response = await fetchApi<{ user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return response.data!.user;
}

export async function signup(username: string, password: string, confirmPassword: string): Promise<User> {
  const response = await fetchApi<{ user: User }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ username, password, confirmPassword }),
  });
  return response.data!.user;
}

export async function logout(): Promise<void> {
  await fetchApi('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export async function getCurrentUser(): Promise<{
  user: User;
  ntfyTopic: string | null;
  ntfySubscribeUrl: string | null;
  ntfyWebUrl: string | null;
} | null> {
  try {
    const response = await fetchApi<{
      user: User;
      ntfyTopic: string | null;
      ntfySubscribeUrl: string | null;
      ntfyWebUrl: string | null;
    }>('/api/auth/me');
    return response.data ?? null;
  } catch {
    return null;
  }
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const response = await fetchApi<AdminOverview>('/api/admin/overview');
  return response.data!;
}

export async function deleteAdminUser(id: string): Promise<User> {
  const response = await fetchApi<{ user: User }>(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return response.data!.user;
}

export async function deleteAdminDownload(id: string): Promise<void> {
  await fetchApi(`/api/admin/downloads/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function updateSignupEnabled(enabled: boolean): Promise<AdminOverview['settings']> {
  const response = await fetchApi<{ settings: AdminOverview['settings'] }>(
    '/api/admin/settings/signup',
    {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }
  );
  return response.data!.settings;
}

export async function getSignupStatus(): Promise<{ signupEnabled: boolean }> {
  const response = await fetchApi<{ signupEnabled: boolean }>('/api/auth/signup-status');
  return response.data!;
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  await fetchApi('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Providers
export async function getProviders(): Promise<Array<{ name: string; displayName: string }>> {
  const response = await fetchApi<{ providers: Array<{ name: string; displayName: string }> }>('/api/providers');
  return response.data?.providers ?? [];
}

// Downloads
export async function searchProvider(
  query: string,
  provider: string
): Promise<ProviderSearchResult[]> {
  const response = await fetchApi<{ results: ProviderSearchResult[] }>('/api/downloads/request', {
    method: 'POST',
    body: JSON.stringify({ query, provider }),
  });
  return response.data?.results ?? [];
}

export async function confirmDownload(
  provider: string,
  resultId: string
): Promise<Download> {
  const response = await fetchApi<{ download: Download }>('/api/downloads/confirm', {
    method: 'POST',
    body: JSON.stringify({ provider, resultId }),
  });
  return response.data!.download;
}

export async function getDownloads(
  page = 1,
  pageSize = 20
): Promise<PaginatedResponse<Download>> {
  const response = await fetchApi<PaginatedResponse<Download>>(
    `/api/downloads?page=${page}&pageSize=${pageSize}`
  );
  return response.data!;
}

export async function getRecommendations(): Promise<RecommendationSection[]> {
  const response = await fetchApi<{ sections: RecommendationSection[] }>('/api/recommendations');
  return response.data?.sections ?? [];
}

export async function dismissRecommendation(input: {
  itemId: string;
  title: string;
  source: string;
  reason: 'already_watched' | 'not_interested';
}): Promise<void> {
  await fetchApi('/api/recommendations/dismiss', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getPromptRecommendations(prompt: string): Promise<RecommendationSection[]> {
  const response = await fetchApi<{ sections: RecommendationSection[] }>('/api/recommendations/prompt', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
  return response.data?.sections ?? [];
}

export async function pauseDownload(id: string): Promise<Download> {
  const response = await fetchApi<{ download: Download }>(`/api/downloads/${encodeURIComponent(id)}/pause`, {
    method: 'POST',
  });
  return response.data!.download;
}

export async function resumeDownload(id: string): Promise<Download> {
  const response = await fetchApi<{ download: Download }>(`/api/downloads/${encodeURIComponent(id)}/resume`, {
    method: 'POST',
  });
  return response.data!.download;
}

export async function cancelDownload(id: string): Promise<Download> {
  const response = await fetchApi<{ download: Download }>(`/api/downloads/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
  return response.data!.download;
}

export async function deleteDownload(id: string): Promise<void> {
  const response = await fetch(`/api/downloads/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : { error: await response.text() };
    throw new Error(data.error || response.statusText || 'Delete failed');
  }
}

export async function getWantedDownloads(): Promise<WantedDownload[]> {
  const response = await fetchApi<{ items: WantedDownload[] }>('/api/wanted-downloads');
  return response.data?.items ?? [];
}

export async function createWantedDownload(input: {
  title: string;
  year?: number;
  mediaType: 'movie' | 'show';
  minQuality: WantedDownloadQuality;
}): Promise<WantedDownload> {
  const response = await fetchApi<{ item: WantedDownload }>('/api/wanted-downloads', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.data!.item;
}

export async function getWantedDownloadAvailability(input: {
  minQuality?: WantedDownloadQuality;
  items: Array<{ id: string; title: string; year?: number }>;
}): Promise<WantedDownloadAvailability[]> {
  const response = await fetchApi<{ items: WantedDownloadAvailability[] }>(
    '/api/wanted-downloads/availability',
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
  return response.data?.items ?? [];
}

export async function checkWantedDownload(id: string): Promise<WantedDownload> {
  const response = await fetchApi<{ item: WantedDownload }>(`/api/wanted-downloads/${encodeURIComponent(id)}/check`, {
    method: 'POST',
  });
  return response.data!.item;
}

export async function cancelWantedDownload(id: string): Promise<WantedDownload> {
  const response = await fetchApi<{ item: WantedDownload }>(`/api/wanted-downloads/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
  return response.data!.item;
}
