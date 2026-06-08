const API_BASE = "http://127.0.0.1:8000/api";

export interface Repository {
  id: number;
  name: string;
  path: string;
  source_type: "local" | "git" | "zip";
  status: "pending" | "indexing" | "completed" | "failed";
  error_message?: string;
  files_count: number;
  folders_count: number;
  size_bytes: number;
  created_at: string;
}

export const api = {
  getRepositories: async (): Promise<Repository[]> => {
    const res = await fetch(`${API_BASE}/repositories`);
    if (!res.ok) throw new Error("Failed to fetch repositories");
    return res.json();
  },

  getRepository: async (id: number): Promise<Repository> => {
    const res = await fetch(`${API_BASE}/repositories/${id}`);
    if (!res.ok) throw new Error("Failed to fetch repository details");
    return res.json();
  },

  deleteRepository: async (id: number): Promise<any> => {
    const res = await fetch(`${API_BASE}/repositories/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete repository");
    return res.json();
  },

  ingestRepository: async (path?: string, cloneUrl?: string, name?: string): Promise<Repository> => {
    const res = await fetch(`${API_BASE}/repositories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, clone_url: cloneUrl, name }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to trigger repository ingestion");
    }
    return res.json();
  },

  uploadZipRepository: async (file: File, name?: string): Promise<Repository> => {
    const formData = new FormData();
    formData.append("file", file);
    if (name) formData.append("name", name);

    const res = await fetch(`${API_BASE}/repositories/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to upload ZIP archive");
    }
    return res.json();
  },

  getTopology: async (id: number): Promise<any> => {
    const res = await fetch(`${API_BASE}/repositories/${id}/topology`);
    if (!res.ok) throw new Error("Failed to fetch repository topology");
    return res.json();
  },

  getDependencies: async (id: number, level: "file" | "module" | "package" = "file"): Promise<any> => {
    const res = await fetch(`${API_BASE}/repositories/${id}/dependencies?level=${level}`);
    if (!res.ok) throw new Error("Failed to fetch dependencies");
    return res.json();
  },

  getSymbols: async (id: number, query?: string): Promise<any[]> => {
    const url = query 
      ? `${API_BASE}/repositories/${id}/symbols?query=${encodeURIComponent(query)}`
      : `${API_BASE}/repositories/${id}/symbols`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch symbols");
    return res.json();
  },

  getMetrics: async (id: number): Promise<any> => {
    const res = await fetch(`${API_BASE}/repositories/${id}/metrics`);
    if (!res.ok) throw new Error("Failed to fetch quality metrics");
    return res.json();
  },

  getGitAnalytics: async (id: number): Promise<any> => {
    const res = await fetch(`${API_BASE}/repositories/${id}/git`);
    if (!res.ok) throw new Error("Failed to fetch git evolution metrics");
    return res.json();
  },

  getSecurity: async (id: number): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/repositories/${id}/security`);
    if (!res.ok) throw new Error("Failed to fetch security audit findings");
    return res.json();
  },

  getCICD: async (id: number): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/repositories/${id}/cicd`);
    if (!res.ok) throw new Error("Failed to fetch CI/CD pipeline structures");
    return res.json();
  },

  askChat: async (id: number, query: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/repositories/${id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error("Failed to query AI RAG chat");
    return res.json();
  },

  getBenchmark: async (repoAId: number, repoBId: number): Promise<any> => {
    const res = await fetch(`${API_BASE}/benchmark?repo_a_id=${repoAId}&repo_b_id=${repoBId}`);
    if (!res.ok) throw new Error("Failed to perform repository benchmarking");
    return res.json();
  },
};
export { API_BASE };
