// API Route definitions - shared between frontend and backend

export const API_ROUTES = {
  // Threat Models
  threatModels: {
    list: '/api/threat-models',
    create: '/api/threat-models',
    get: (id: string) => `/api/threat-models/${id}`,
    update: (id: string) => `/api/threat-models/${id}`,
    delete: (id: string) => `/api/threat-models/${id}`,
    generate: (id: string) => `/api/threat-models/${id}/generate`,
    generationStatus: (id: string) => `/api/threat-models/${id}/generation-status`,
    share: (id: string) => `/api/threat-models/${id}/share`,
    export: (id: string) => `/api/threat-models/${id}/export`,
  },

  // Context Files
  files: {
    upload: (threatModelId: string) => `/api/threat-models/${threatModelId}/files`,
    delete: (threatModelId: string, fileId: string) =>
      `/api/threat-models/${threatModelId}/files/${fileId}`,
    download: (threatModelId: string, fileId: string) =>
      `/api/threat-models/${threatModelId}/files/${fileId}/download`,
  },

  // Threats within a model
  threats: {
    update: (threatModelId: string, threatId: string) =>
      `/api/threat-models/${threatModelId}/threats/${threatId}`,
  },

  // Mitigations
  mitigations: {
    update: (threatModelId: string, threatId: string, mitigationId: string) =>
      `/api/threat-models/${threatModelId}/threats/${threatId}/mitigations/${mitigationId}`,
  },

  // Public/Shared access
  shared: {
    get: (shareToken: string) => `/api/shared/${shareToken}`,
    export: (shareToken: string) => `/api/shared/${shareToken}/export`,
  },

  // Guided Questions
  questions: {
    list: '/api/questions',
  },
} as const;

// Query parameter types
export interface ListThreatModelsParams {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}

export interface ExportParams {
  format: 'pdf' | 'json' | 'markdown';
}
