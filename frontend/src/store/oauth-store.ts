import { create } from 'zustand';
import { apiFetch } from '@/lib/utils';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
}

interface OAuthState {
  isGoogleConfigured: boolean;
  isGoogleConnected: boolean;
  isLoading: boolean;
  driveFiles: DriveFile[];
  isLoadingFiles: boolean;

  checkGoogleConfigured: () => Promise<void>;
  checkGoogleStatus: () => Promise<void>;
  connectGoogle: () => void;
  disconnectGoogle: () => Promise<void>;
  fetchDriveFiles: (query?: string) => Promise<void>;
  getFileContent: (fileId: string) => Promise<{ content: string; name: string }>;
}

const API_BASE = 'http://localhost:3001';

export const useOAuthStore = create<OAuthState>((set) => ({
  isGoogleConfigured: false,
  isGoogleConnected: false,
  isLoading: false,
  driveFiles: [],
  isLoadingFiles: false,

  checkGoogleConfigured: async () => {
    try {
      const data = await apiFetch<{ configured: boolean }>(`${API_BASE}/api/oauth/google/configured`);
      set({ isGoogleConfigured: data.configured });
    } catch {
      set({ isGoogleConfigured: false });
    }
  },

  checkGoogleStatus: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<{ connected: boolean }>(`${API_BASE}/api/oauth/google/status`);
      set({ isGoogleConnected: data.connected, isLoading: false });
    } catch {
      set({ isGoogleConnected: false, isLoading: false });
    }
  },

  connectGoogle: () => {
    // Open OAuth in popup
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      `${API_BASE}/api/oauth/google/authorize`,
      'google-oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Listen for message from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'oauth_complete') {
        window.removeEventListener('message', handleMessage);
        useOAuthStore.getState().checkGoogleStatus();
      }
    };
    window.addEventListener('message', handleMessage);

    // Fallback: poll for popup close
    const checkPopup = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(checkPopup);
        window.removeEventListener('message', handleMessage);
        setTimeout(() => {
          useOAuthStore.getState().checkGoogleStatus();
        }, 500);
      }
    }, 500);
  },

  disconnectGoogle: async () => {
    set({ isLoading: true });
    try {
      await apiFetch(`${API_BASE}/api/oauth/google`, { method: 'DELETE' });
      set({ isGoogleConnected: false, driveFiles: [], isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchDriveFiles: async (query?: string) => {
    set({ isLoadingFiles: true });
    try {
      const params = query ? `?q=${encodeURIComponent(query)}` : '';
      const data = await apiFetch<{ files: DriveFile[] }>(
        `${API_BASE}/api/oauth/google/drive/files${params}`
      );
      set({ driveFiles: data.files, isLoadingFiles: false });
    } catch {
      set({ driveFiles: [], isLoadingFiles: false });
    }
  },

  getFileContent: async (fileId: string) => {
    const data = await apiFetch<{ content: string; name: string }>(
      `${API_BASE}/api/oauth/google/drive/files/${fileId}/content`
    );
    return data;
  },
}));
