/**
 * Pilipili-AutoVideo API 客户端
 * 封装所有与后端 FastAPI 的通信
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ShotMode = "multi_ref" | "first_end_frame" | "t2v" | "i2v";

export interface Scene {
  scene_id: number;
  duration: number;
  image_prompt: string;
  video_prompt: string;
  voiceover: string;
  transition: string;
  camera_motion: string;
  style_tags: string[];
  reference_character?: string;
  // v2.0 新增
  shot_mode?: ShotMode;
  character_refs?: string[];
}

export interface VideoScript {
  title: string;
  topic: string;
  style: string;
  total_duration: number;
  scenes: Scene[];
  metadata: {
    description?: string;
    tags?: string[];
    platform_title?: {
      douyin?: string;
      bilibili?: string;
    };
  };
}

export interface WorkflowStatus {
  type: string;
  project_id: string;
  stage: WorkflowStage;
  progress: number;
  message: string;
  timestamp: string;
  current_scene?: number;
  total_scenes?: number;
  error?: string;
  result?: ProjectResult;
  script?: VideoScript;
  requires_action?: boolean;
  action_type?: string;
  keyframes?: string[];
}

export type WorkflowStage =
  | "idle"
  | "generating_script"
  | "awaiting_review"
  | "generating_images"
  | "generating_audio"
  | "generating_video"
  | "assembling"
  | "completed"
  | "failed";

export interface ProjectResult {
  final_video: string;
  draft_dir: string;
  script: VideoScript;
  total_duration: number;
}

export interface Project {
  id: string;
  topic: string;
  created_at: string;
  status: {
    stage: WorkflowStage;
    progress: number;
    message?: string;
  };
  script?: VideoScript;
  result?: ProjectResult;
}

export interface CreateProjectRequest {
  topic: string;
  style?: string;
  target_duration?: number;
  voice_id?: string;
  video_engine?: "kling" | "seedance" | "auto";
  reference_images?: string[];
  add_subtitles?: boolean;
  auto_publish?: boolean;
}

export interface ApiKeysStatus {
  llm: { provider: string; configured: boolean };
  image_gen: { provider: string; configured: boolean };
  tts: { provider: string; configured: boolean };
  kling: { configured: boolean };
  seedance: { configured: boolean };
}

export interface UpdateApiKeysRequest {
  llm_provider?: string;
  llm_api_key?: string;
  image_gen_api_key?: string;
  tts_api_key?: string;
  kling_api_key?: string;
  kling_api_secret?: string;
  seedance_api_key?: string;
  mem0_api_key?: string;
}

// ─── Reference Video Analysis Types (v2.0) ───────────────────────────────────

export interface CharacterInfo {
  character_id: number;
  name: string;
  description: string;
  appearance_prompt: string;
  replacement_image?: string;
}

export interface ReferenceScene {
  scene_id: number;
  duration: number;
  image_prompt: string;
  video_prompt: string;
  voiceover: string;
  shot_mode: ShotMode;
  transition: string;
  camera_motion: string;
  style_tags: string[];
}

export interface ReferenceVideoAnalysisResult {
  title: string;
  style: string;
  aspect_ratio: string;
  total_duration: number;
  bgm_style: string;
  color_grade: string;
  overall_prompt: string;
  characters: CharacterInfo[];
  scenes: ReferenceScene[];
  reverse_prompts: string[];
  raw_analysis: string;
}

export interface ReferenceAnalysisResponse {
  analysis_id: string;
  status: "processing" | "completed" | "failed";
  filename?: string;
  file_path?: string;
  created_at?: string;
  result?: ReferenceVideoAnalysisResult;
  error?: string;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Project API ──────────────────────────────────────────────────────────────

export const projectApi = {
  /** 创建新项目，启动工作流 */
  create: (req: CreateProjectRequest) =>
    request<{ project_id: string; message: string }>("/api/projects", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  /** 获取项目状态 */
  get: (projectId: string) =>
    request<Project>(`/api/projects/${projectId}`),

  /** 获取所有项目 */
  list: () => request<Project[]>("/api/projects"),

  /** 提交脚本审核决策 */
  submitReview: (
    projectId: string,
    approved: boolean,
    scenes?: Scene[]
  ) =>
    request<{ message: string; approved: boolean }>(
      `/api/projects/${projectId}/review`,
      {
        method: "POST",
        body: JSON.stringify({ approved, scenes }),
      }
    ),

  /** 实时更新分镜内容 */
  updateScript: (projectId: string, scenes: Scene[]) =>
    request<{ message: string }>(`/api/projects/${projectId}/script`, {
      method: "PUT",
      body: JSON.stringify(scenes),
    }),

  /** 获取下载链接 */
  getDownloadLinks: (projectId: string) =>
    request<{
      final_video: string;
      draft_dir: string;
      total_duration: number;
    }>(`/api/projects/${projectId}/download`),

  /** 提交评分（用于记忆学习） */
  submitFeedback: (projectId: string, rating: number) =>
    request<{ message: string }>(
      `/api/projects/${projectId}/feedback?rating=${rating}`,
      { method: "POST" }
    ),
};

// ─── Upload API ──────────────────────────────────────────────────────────────

export interface UploadResult {
  path: string;
  filename: string;
  type: "image" | "video_frame";
  message: string;
}

export const uploadApi = {
  /** 上传角色参考图（图片或视频，视频会自动截帧） */
  uploadReference: async (file: File): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    const url = `${API_BASE}/api/upload/reference`;
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },
};

// ─── Reference Video Analysis API (v2.0) ─────────────────────────────────────

export const analyzeApi = {
  /** 上传对标视频，触发 Gemini 分析（返回 analysis_id，需轮询结果） */
  uploadVideo: async (file: File): Promise<ReferenceAnalysisResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    const url = `${API_BASE}/api/analyze/upload`;
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },

  /** 轮询对标视频分析结果 */
  getResult: (analysisId: string) =>
    request<ReferenceAnalysisResponse>(`/api/analyze/${analysisId}`),

  /** 别名：轮询对标视频分析结果 */
  getAnalysis: (analysisId: string) =>
    request<ReferenceAnalysisResponse>(`/api/analyze/${analysisId}`),

  /** 为某个人物上传替换参考图（图片或视频） */
  replaceCharacter: async (
    analysisId: string,
    characterId: number,
    file: File
  ): Promise<{ message: string; character_id: number; replacement_image: string; path: string }> => {
    const formData = new FormData();
    formData.append("character_id", String(characterId));
    formData.append("file", file);
    const url = `${API_BASE}/api/analyze/${analysisId}/replace-character`;
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },

  /** 基于对标视频分析结果直接创建新项目 */
  createProjectFromAnalysis: async (
    analysisId: string,
    options?: { topic?: string; video_engine?: string; add_subtitles?: boolean }
  ): Promise<{ project_id: string; message: string; reference_images_count: number }> => {
    const formData = new FormData();
    if (options?.topic) formData.append("topic", options.topic);
    if (options?.video_engine) formData.append("video_engine", options.video_engine);
    if (options?.add_subtitles !== undefined) {
      formData.append("add_subtitles", String(options.add_subtitles));
    }
    const url = `${API_BASE}/api/analyze/${analysisId}/create-project`;
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },
};

// ─── Settings API ─────────────────────────────────────────────────────────────

export const settingsApi = {
  /** 更新 API Keys */
  updateKeys: (req: UpdateApiKeysRequest) =>
    request<{ message: string; updated_keys: string[] }>("/api/settings/keys", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  /** 获取 API Keys 配置状态 */
  getKeysStatus: () => request<ApiKeysStatus>("/api/settings/keys/status"),

  /** 测试指定服务的 API Key 连接 */
  testKey: (service: string) =>
    request<{ success: boolean; message: string }>("/api/settings/keys/test", {
      method: "POST",
      body: JSON.stringify({ service }),
    }),
};

// ─── Health API ───────────────────────────────────────────────────────────────

export const healthApi = {
  check: () =>
    request<{ status: string; version: string; name: string }>("/health"),
};

// ─── WebSocket ────────────────────────────────────────────────────────────────

export class WorkflowWebSocket {
  private ws: WebSocket | null = null;
  private projectId: string;
  private onMessage: (status: WorkflowStatus) => void;
  private onError: (error: Event) => void;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;

  constructor(
    projectId: string,
    onMessage: (status: WorkflowStatus) => void,
    onError: (error: Event) => void = () => {}
  ) {
    this.projectId = projectId;
    this.onMessage = onMessage;
    this.onError = onError;
  }

  connect() {
    this.shouldReconnect = true;
    this._connect();
  }

  private _connect() {
    const url = `${WS_BASE}/ws/${this.projectId}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data !== "pong") {
          this.onMessage(data as WorkflowStatus);
        }
      } catch {
        // 忽略非 JSON 消息
      }
    };

    this.ws.onerror = (error) => {
      this.onError(error);
    };

    this.ws.onclose = () => {
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this._connect(), 3000);
      }
    };

    // 心跳保活
    const heartbeat = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send("ping");
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
    this.ws = null;
  }
}
