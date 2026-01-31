import { create } from 'zustand';
import { apiFetch } from '@/lib/utils';
import { getAuthToken } from '@/lib/auth';
import { API_ROUTES } from '@threat-modeling/shared';
import type {
  ThreatModel,
  ThreatModelSummary,
  ThreatModelListResponse,
  CreateThreatModelRequest,
  UpdateThreatModelRequest,
  GuidedQuestion,
  GenerationStatusResponse,
  ShareLinkResponse,
} from '@threat-modeling/shared';

interface ThreatModelState {
  // List state
  threatModels: ThreatModelSummary[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  error: string | null;

  // Current model state
  currentModel: ThreatModel | null;
  isLoadingModel: boolean;

  // Generation state
  generationStatus: GenerationStatusResponse | null;
  isGenerating: boolean;

  // Guided questions
  guidedQuestions: GuidedQuestion[];

  // Actions
  fetchThreatModels: (page?: number, search?: string, status?: string) => Promise<void>;
  fetchThreatModel: (id: string) => Promise<ThreatModel | null>;
  createThreatModel: (data: CreateThreatModelRequest) => Promise<ThreatModel>;
  updateThreatModel: (id: string, data: UpdateThreatModelRequest) => Promise<ThreatModel>;
  deleteThreatModel: (id: string) => Promise<void>;
  generateThreatModel: (id: string) => Promise<void>;
  pollGenerationStatus: (id: string) => Promise<GenerationStatusResponse>;
  fetchGuidedQuestions: () => Promise<void>;
  createShareLink: (id: string) => Promise<ShareLinkResponse>;
  deleteShareLink: (id: string) => Promise<void>;
  uploadFile: (threatModelId: string, file: File, fileType: string) => Promise<void>;
  deleteFile: (threatModelId: string, fileId: string) => Promise<void>;
  updateThreat: (threatModelId: string, threatId: string, data: any) => Promise<void>;
  updateMitigation: (threatModelId: string, threatId: string, mitigationId: string, data: any) => Promise<void>;
  clearError: () => void;
  setCurrentModel: (model: ThreatModel | null) => void;
}

export const useThreatModelStore = create<ThreatModelState>((set, get) => ({
  threatModels: [],
  total: 0,
  page: 1,
  pageSize: 20,
  isLoading: false,
  error: null,
  currentModel: null,
  isLoadingModel: false,
  generationStatus: null,
  isGenerating: false,
  guidedQuestions: [],

  fetchThreatModels: async (page = 1, search?: string, status?: string) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(get().pageSize) });
      if (search) params.set('search', search);
      if (status) params.set('status', status);

      const data = await apiFetch<ThreatModelListResponse>(
        `${API_ROUTES.threatModels.list}?${params}`
      );
      set({
        threatModels: data.items,
        total: data.total,
        page: data.page,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchThreatModel: async (id: string) => {
    set({ isLoadingModel: true, error: null });
    try {
      const model = await apiFetch<ThreatModel>(API_ROUTES.threatModels.get(id));
      set({ currentModel: model, isLoadingModel: false });
      return model;
    } catch (err: any) {
      set({ error: err.message, isLoadingModel: false });
      return null;
    }
  },

  createThreatModel: async (data: CreateThreatModelRequest) => {
    set({ isLoading: true, error: null });
    try {
      const model = await apiFetch<ThreatModel>(API_ROUTES.threatModels.create, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      set({ currentModel: model, isLoading: false });
      return model;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  updateThreatModel: async (id: string, data: UpdateThreatModelRequest) => {
    set({ error: null });
    try {
      const model = await apiFetch<ThreatModel>(API_ROUTES.threatModels.update(id), {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      set({ currentModel: model });
      return model;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteThreatModel: async (id: string) => {
    set({ error: null });
    try {
      await apiFetch(API_ROUTES.threatModels.delete(id), { method: 'DELETE' });
      set((state) => ({
        threatModels: state.threatModels.filter((m) => m.id !== id),
        total: state.total - 1,
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  generateThreatModel: async (id: string) => {
    set({ isGenerating: true, error: null, generationStatus: { status: 'generating', progress: 0 } });
    try {
      await apiFetch(API_ROUTES.threatModels.generate(id), { method: 'POST' });
    } catch (err: any) {
      set({ error: err.message, isGenerating: false });
      throw err;
    }
  },

  pollGenerationStatus: async (id: string) => {
    try {
      const status = await apiFetch<GenerationStatusResponse>(
        API_ROUTES.threatModels.generationStatus(id)
      );
      set({ generationStatus: status });

      if (status.status === 'completed' || status.status === 'failed') {
        set({ isGenerating: false });
        if (status.status === 'completed') {
          // Refresh the model
          await get().fetchThreatModel(id);
        }
      }

      return status;
    } catch (err: any) {
      set({ error: err.message, isGenerating: false });
      throw err;
    }
  },

  fetchGuidedQuestions: async () => {
    try {
      const questions = await apiFetch<GuidedQuestion[]>(API_ROUTES.questions.list);
      set({ guidedQuestions: questions });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  createShareLink: async (id: string) => {
    try {
      const response = await apiFetch<ShareLinkResponse>(
        API_ROUTES.threatModels.share(id),
        { method: 'POST' }
      );
      return response;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteShareLink: async (id: string) => {
    try {
      await apiFetch(API_ROUTES.threatModels.share(id), { method: 'DELETE' });
      // If we have a current model loaded, refresh it
      const currentModel = get().currentModel;
      if (currentModel && currentModel.id === id) {
        await get().fetchThreatModel(id);
      }
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  uploadFile: async (threatModelId: string, file: File, fileType: string) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', fileType);

      const token = await getAuthToken();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/threat-models/${threatModelId}/files`, {
        method: 'POST',
        body: formData,
        headers,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'File upload failed');
      }

      // Refresh model to get updated files
      await get().fetchThreatModel(threatModelId);
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteFile: async (threatModelId: string, fileId: string) => {
    try {
      await apiFetch(API_ROUTES.files.delete(threatModelId, fileId), { method: 'DELETE' });
      await get().fetchThreatModel(threatModelId);
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateThreat: async (threatModelId: string, threatId: string, data: any) => {
    try {
      await apiFetch(API_ROUTES.threats.update(threatModelId, threatId), {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      await get().fetchThreatModel(threatModelId);
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateMitigation: async (threatModelId: string, threatId: string, mitigationId: string, data: any) => {
    try {
      await apiFetch(API_ROUTES.mitigations.update(threatModelId, threatId, mitigationId), {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      await get().fetchThreatModel(threatModelId);
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
  setCurrentModel: (model) => set({ currentModel: model }),
}));
