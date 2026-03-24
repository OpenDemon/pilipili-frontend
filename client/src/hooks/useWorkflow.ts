/**
 * useWorkflow — 工作流状态管理 Hook
 * 通过 WebSocket 实时接收后端工作流进度
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  WorkflowWebSocket,
  WorkflowStatus,
  WorkflowStage,
  VideoScript,
  Scene,
  ProjectResult,
  projectApi,
} from "@/lib/api";

export interface AgentLog {
  id: string;
  time: string;
  level: "info" | "success" | "warning" | "error" | "progress";
  message: string;
  detail?: string;
}

export interface WorkflowState {
  projectId: string | null;
  stage: WorkflowStage;
  progress: number;
  message: string;
  script: VideoScript | null;
  scenes: Scene[];
  result: ProjectResult | null;
  logs: AgentLog[];
  requiresReview: boolean;
  isConnected: boolean;
  error: string | null;
}

const INITIAL_STATE: WorkflowState = {
  projectId: null,
  stage: "idle",
  progress: 0,
  message: "",
  script: null,
  scenes: [],
  result: null,
  logs: [],
  requiresReview: false,
  isConnected: false,
  error: null,
};

export function useWorkflow() {
  const [state, setState] = useState<WorkflowState>(INITIAL_STATE);
  const wsRef = useRef<WorkflowWebSocket | null>(null);

  // 添加日志
  const addLog = useCallback(
    (level: AgentLog["level"], message: string, detail?: string) => {
      const now = new Date().toLocaleTimeString("zh-CN", { hour12: false });
      setState((prev) => ({
        ...prev,
        logs: [
          ...prev.logs,
          {
            id: `${Date.now()}-${Math.random()}`,
            time: now,
            level,
            message,
            detail,
          },
        ],
      }));
    },
    []
  );

  // 处理 WebSocket 消息
  const handleWsMessage = useCallback(
    (status: WorkflowStatus) => {
      setState((prev) => {
        const newState: Partial<WorkflowState> = {
          stage: status.stage,
          progress: status.progress,
          message: status.message,
          isConnected: true,
        };

        // 脚本就绪 → 填充分镜
        if (status.script) {
          newState.script = status.script;
          newState.scenes = status.script.scenes;
        }

        // 需要用户审核
        if (status.requires_action && status.action_type === "review_script") {
          newState.requiresReview = true;
        }

        // 完成
        if (status.result) {
          newState.result = status.result;
        }

        // 错误
        if (status.error) {
          newState.error = status.error;
        }

        return { ...prev, ...newState };
      });

      // 添加日志
      const levelMap: Record<string, AgentLog["level"]> = {
        generating_script: "info",
        awaiting_review: "warning",
        generating_images: "progress",
        generating_audio: "progress",
        generating_video: "progress",
        assembling: "progress",
        completed: "success",
        failed: "error",
      };

      const level = levelMap[status.stage] || "info";
      addLog(level, status.message);
    },
    [addLog]
  );

  // 连接 WebSocket
  const connectWebSocket = useCallback(
    (projectId: string) => {
      // 断开旧连接
      wsRef.current?.disconnect();

      const ws = new WorkflowWebSocket(
        projectId,
        handleWsMessage,
        () => {
          setState((prev) => ({ ...prev, isConnected: false }));
          addLog("warning", "WebSocket 连接断开，正在重连...");
        }
      );
      ws.connect();
      wsRef.current = ws;

      setState((prev) => ({ ...prev, isConnected: true }));
    },
    [handleWsMessage, addLog]
  );

  // 启动工作流
  const startWorkflow = useCallback(
    async (params: {
      topic: string;
      style?: string;
      duration?: number;
      engine?: "kling" | "seedance" | "auto";
      voiceId?: string;
      referenceImages?: string[];
      addSubtitles?: boolean;
      presetScenes?: Array<Record<string, unknown>>;  // 对标分析分镜，有则跳过 LLM
    }) => {
      setState({
        ...INITIAL_STATE,
        stage: "generating_script",
        progress: 5,
        message: "正在启动工作流...",
        logs: [],
      });

      addLog("info", "工作流已启动", `主题: ${params.topic}`);

      try {
        const res = await projectApi.create({
          topic: params.topic,
          style: params.style,
          target_duration: params.duration,
          video_engine: params.engine,
          voice_id: params.voiceId,
          reference_images: params.referenceImages,
          add_subtitles: params.addSubtitles ?? true,
          preset_scenes: params.presetScenes,
        });

        const projectId = res.project_id;
        setState((prev) => ({ ...prev, projectId }));
        addLog("info", `项目已创建: ${projectId}`);

        // 连接 WebSocket 监听进度
        connectWebSocket(projectId);

        return projectId;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "启动失败";
        setState((prev) => ({
          ...prev,
          stage: "failed",
          error: msg,
        }));
        addLog("error", `工作流启动失败: ${msg}`);
        throw err;
      }
    },
    [addLog, connectWebSocket]
  );

  // 提交脚本审核
  const submitReview = useCallback(
    async (approved: boolean) => {
      if (!state.projectId) return;

      try {
        await projectApi.submitReview(
          state.projectId,
          approved,
          approved ? state.scenes : undefined
        );

        setState((prev) => ({
          ...prev,
          requiresReview: false,
          stage: approved ? "generating_images" : "idle",
        }));

        addLog(
          approved ? "success" : "warning",
          approved ? "脚本已确认，开始生成视频" : "用户取消，工作流已停止"
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "提交失败";
        addLog("error", `审核提交失败: ${msg}`);
      }
    },
    [state.projectId, state.scenes, addLog]
  );

  // 更新分镜内容
  const updateScene = useCallback(
    (sceneId: number, field: keyof Scene, value: string | number | string[]) => {
      setState((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.scene_id === sceneId ? { ...s, [field]: value } : s
        ),
      }));
    },
    []
  );

  // 提交评分
  const submitFeedback = useCallback(
    async (rating: number) => {
      if (!state.projectId) return;
      try {
        await projectApi.submitFeedback(state.projectId, rating);
        addLog("success", `评分 ${rating} 星已记录，记忆系统已更新`);
      } catch {
        // 评分失败不影响主流程
      }
    },
    [state.projectId, addLog]
  );

  // 重置状态
  const reset = useCallback(() => {
    wsRef.current?.disconnect();
    wsRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  // 恢复已有项目
  const restoreProject = useCallback(
    async (projectId: string) => {
      try {
        const project = await projectApi.get(projectId);
        setState((prev) => ({
          ...prev,
          projectId,
          stage: project.status.stage,
          progress: project.status.progress,
          message: project.status.message || "",
          script: project.script || null,
          scenes: project.script?.scenes || [],
          result: project.result || null,
        }));

        // 如果项目还在进行中，重新连接 WebSocket
        if (
          project.status.stage !== "completed" &&
          project.status.stage !== "failed" &&
          project.status.stage !== "idle"
        ) {
          connectWebSocket(projectId);
        }
      } catch (err) {
        addLog("error", `恢复项目失败: ${err}`);
      }
    },
    [addLog, connectWebSocket]
  );

  // 组件卸载时断开 WebSocket
  useEffect(() => {
    return () => {
      wsRef.current?.disconnect();
    };
  }, []);

  return {
    state,
    startWorkflow,
    submitReview,
    updateScene,
    submitFeedback,
    reset,
    restoreProject,
    addLog,
  };
}
