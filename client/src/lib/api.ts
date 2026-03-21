/**
 * Pilipili-AutoVideo API 客户端
 * 封装所有与后端 FastAPI 的通信
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

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
      // 连接成功，清除重连定时器
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
        // 忽略非 JSON 消息（如 pong）
      }
    };

    this.ws.onerror = (error) => {
      this.onError(error);
    };

    this.ws.onclose = () => {
      if (this.shouldReconnect) {
        // 3 秒后重连
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
