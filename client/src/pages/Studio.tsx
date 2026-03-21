/*
 * Studio.tsx — 噼哩噼哩 主工作台（真实 API 对接版）
 * Design: Seedance 2.0 inspired — soft blue-grey bg, white cards, serif headings
 * Layout: Left sidebar (nav) + Center (chat + scene editor) + Right (agent console)
 *
 * 所有工作流状态通过 WebSocket 实时同步后端，无 Mock 数据
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Film,
  Home,
  Settings,
  History,
  Sparkles,
  Send,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Pencil,
  Plus,
  Image,
  Volume2,
  Video,
  Scissors,
  Download,
  BookOpen,
  Zap,
  Bot,
  User,
  RefreshCw,
  Wifi,
  WifiOff,
  Star,
  X,
} from "lucide-react";
import { useWorkflow, AgentLog } from "@/hooks/useWorkflow";
import { useProjects } from "@/hooks/useProjects";
import { Scene, WorkflowStage, projectApi } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAMPLE_PROMPTS = [
  { label: "科技产品", desc: "展示最新 AI 芯片的震撼性能，科技感蓝紫色调" },
  { label: "旅行 Vlog", desc: "日本京都秋季枫叶之旅，暖色调，治愈系" },
  { label: "美食短片", desc: "川菜大厨的一道麻婆豆腐，食欲感，特写镜头" },
  { label: "品牌故事", desc: "一个创业者从零到一的故事，励志，电影感" },
];

const STAGE_LABELS: Record<WorkflowStage, string> = {
  idle: "空闲",
  generating_script: "生成脚本中",
  awaiting_review: "等待审核",
  generating_images: "生成首帧图像",
  generating_audio: "生成配音",
  generating_video: "生成视频片段",
  assembling: "拼接成片",
  completed: "已完成",
  failed: "生成失败",
};

const STAGE_PROGRESS: Record<WorkflowStage, number> = {
  idle: 0,
  generating_script: 15,
  awaiting_review: 25,
  generating_images: 45,
  generating_audio: 55,
  generating_video: 80,
  assembling: 92,
  completed: 100,
  failed: 0,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SidebarNav({
  collapsed,
  onToggle,
  projects,
  onSelectProject,
}: {
  collapsed: boolean;
  onToggle: () => void;
  projects: ReturnType<typeof useProjects>["projects"];
  onSelectProject: (id: string) => void;
}) {
  const navItems = [
    { icon: Home, label: "首页", href: "/" },
    { icon: Film, label: "工作台", href: "/studio", active: true },
    { icon: Settings, label: "设置", href: "/settings" },
  ];

  return (
    <aside
      className="flex flex-col border-r border-border bg-white transition-all duration-300 shrink-0"
      style={{ width: collapsed ? 64 : 220 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "oklch(0.22 0.06 250)" }}
        >
          <Zap size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <div
              className="text-sm font-semibold leading-tight"
              style={{
                fontFamily: "'Playfair Display', serif",
                color: "oklch(0.22 0.06 250)",
              }}
            >
              噼哩噼哩
            </div>
            <div className="text-xs text-muted-foreground leading-tight">
              AutoVideo
            </div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 overflow-hidden">
        {navItems.map((item) => (
          <Link key={item.label} href={item.href}>
            <div
              className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 transition-colors cursor-pointer ${
                item.active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && (
                <span className="text-sm font-medium truncate">
                  {item.label}
                </span>
              )}
            </div>
          </Link>
        ))}

        {/* 历史项目 */}
        {!collapsed && projects.length > 0 && (
          <div className="mt-4 px-3">
            <div className="flex items-center gap-1.5 mb-2">
              <History size={12} className="text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                历史项目
              </span>
            </div>
            <div className="space-y-1">
              {projects.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  className="w-full text-left px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors truncate"
                >
                  {p.topic}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-border">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}

function EmptyState({ onExampleClick }: { onExampleClick: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 px-6">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: "oklch(0.94 0.03 250)" }}
      >
        <Sparkles size={28} style={{ color: "oklch(0.42 0.12 255)" }} />
      </div>
      <h3
        className="text-xl font-semibold text-foreground mb-2"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        开始创作你的视频
      </h3>
      <p className="text-sm text-muted-foreground text-center mb-8 max-w-xs leading-relaxed">
        描述你想要的视频内容，AI 将自动完成脚本生成、配音、图像和视频片段的全部工作
      </p>
      <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p.label}
            onClick={() => onExampleClick(p.desc)}
            className="text-left p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all group"
          >
            <div className="text-xs font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
              {p.label}
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {p.desc}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? "bg-primary" : "bg-secondary"
        }`}
      >
        {isUser ? (
          <User size={14} className="text-primary-foreground" />
        ) : (
          <Bot size={14} className="text-foreground" />
        )}
      </div>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-secondary text-foreground rounded-tl-sm"
        }`}
        style={{ whiteSpace: "pre-wrap" }}
      >
        {message.content}
      </div>
    </div>
  );
}

function ChatPanel({
  messages,
  onSend,
  stage,
  onConfirmScript,
  onCancelScript,
  isConnected,
}: {
  messages: ChatMessage[];
  onSend: (msg: string) => void;
  stage: WorkflowStage;
  onConfirmScript: () => void;
  onCancelScript: () => void;
  isConnected: boolean;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isGenerating =
    stage !== "idle" && stage !== "awaiting_review" && stage !== "completed" && stage !== "failed";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2
              style={{ fontFamily: "'Playfair Display', serif" }}
              className="text-lg font-semibold text-foreground"
            >
              创作工作台
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              描述你想要的视频，AI 自动完成全部工作
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 连接状态 */}
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <Wifi size={13} className="text-emerald-500" />
              ) : (
                <WifiOff size={13} className="text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">
                {isConnected ? "已连接" : "未连接"}
              </span>
            </div>
            {/* 审核按钮 */}
            {stage === "awaiting_review" && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onCancelScript}
                  className="gap-1.5 text-xs"
                >
                  <X size={12} />
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={onConfirmScript}
                  className="gap-1.5 text-xs"
                  style={{ background: "oklch(0.22 0.06 250)" }}
                >
                  <CheckCircle2 size={12} />
                  确认脚本，开始生成
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-6 py-4">
        {messages.length === 0 ? (
          <EmptyState onExampleClick={onSend} />
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="px-6 py-4 border-t border-border bg-white">
        <div className="flex items-end gap-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isGenerating
                ? "视频生成中，请稍候..."
                : "描述你想要的视频内容，如：展示 AI 芯片的科技感，蓝紫色调，60秒"
            }
            disabled={isGenerating}
            className="flex-1 min-h-[56px] max-h-[120px] resize-none text-sm"
            rows={2}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            className="h-14 w-14 shrink-0 rounded-xl"
            style={{ background: "oklch(0.22 0.06 250)" }}
          >
            {isGenerating ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SceneCard({
  scene,
  onUpdate,
}: {
  scene: Scene;
  onUpdate: (id: number, field: keyof Scene, value: string | number | string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      {/* Card header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-secondary/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: "oklch(0.42 0.12 255)", fontSize: "10px" }}
          >
            {scene.scene_id}
          </span>
          <span className="text-xs font-medium text-foreground">
            分镜 {scene.scene_id}
          </span>
          <Badge variant="outline" className="text-xs py-0 h-4">
            {scene.duration}s
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{scene.transition}</span>
          <Pencil size={11} className="text-muted-foreground" />
        </div>
      </div>

      {/* Card body */}
      <div className="px-3 pb-3">
        {!expanded ? (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {scene.voiceover}
          </p>
        ) : (
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                旁白文案
              </label>
              <Textarea
                value={scene.voiceover}
                onChange={(e) => onUpdate(scene.scene_id, "voiceover", e.target.value)}
                className="text-xs min-h-[60px] resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                画面描述
              </label>
              <Textarea
                value={scene.image_prompt}
                onChange={(e) => onUpdate(scene.scene_id, "image_prompt", e.target.value)}
                className="text-xs min-h-[60px] resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                运动描述
              </label>
              <Textarea
                value={scene.video_prompt}
                onChange={(e) => onUpdate(scene.scene_id, "video_prompt", e.target.value)}
                className="text-xs min-h-[50px] resize-none"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  时长 (秒)
                </label>
                <input
                  type="number"
                  value={scene.duration}
                  onChange={(e) => onUpdate(scene.scene_id, "duration", Number(e.target.value))}
                  className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background"
                  min={1}
                  max={15}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  转场
                </label>
                <select
                  value={scene.transition}
                  onChange={(e) => onUpdate(scene.scene_id, "transition", e.target.value)}
                  className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background"
                >
                  <option value="crossfade">交叉淡入</option>
                  <option value="fade">淡入淡出</option>
                  <option value="wipe">划像</option>
                  <option value="none">无转场</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SceneReviewPanel({
  scenes,
  onUpdate,
  onApprove,
  onCancel,
}: {
  scenes: Scene[];
  onUpdate: (id: number, field: keyof Scene, value: string | number | string[]) => void;
  onApprove: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="border-t border-border bg-white"
      style={{ maxHeight: "40vh" }}
    >
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Pencil size={14} style={{ color: "oklch(0.42 0.12 255)" }} />
          <span className="text-sm font-semibold text-foreground">
            分镜审核 · {scenes.length} 个分镜
          </span>
          <span className="text-xs text-muted-foreground">
            总时长约 {scenes.reduce((s, sc) => s + sc.duration, 0)}s
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onCancel} className="text-xs gap-1.5">
            <X size={12} />
            取消
          </Button>
          <Button
            size="sm"
            onClick={onApprove}
            className="text-xs gap-1.5"
            style={{ background: "oklch(0.22 0.06 250)" }}
          >
            <CheckCircle2 size={12} />
            全部确认，开始生成
          </Button>
        </div>
      </div>
      <ScrollArea className="px-6 py-3" style={{ maxHeight: "calc(40vh - 56px)" }}>
        <div className="grid grid-cols-2 gap-3">
          {scenes.map((scene) => (
            <SceneCard key={scene.scene_id} scene={scene} onUpdate={onUpdate} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function AgentConsole({
  logs,
  stage,
  collapsed,
  onToggle,
  projectId,
  onDownload,
  onExportDraft,
  onFeedback,
}: {
  logs: AgentLog[];
  stage: WorkflowStage;
  collapsed: boolean;
  onToggle: () => void;
  projectId: string | null;
  onDownload: () => void;
  onExportDraft: () => void;
  onFeedback: (rating: number) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const logColors = {
    info: "text-foreground/70",
    success: "text-emerald-600",
    warning: "text-amber-600",
    error: "text-red-500",
    progress: "text-blue-500",
  };

  const logPrefixes = {
    info: "·",
    success: "✓",
    warning: "⚠",
    error: "✗",
    progress: "→",
  };

  const stageSteps = [
    { key: "generating_script", icon: Sparkles, label: "脚本生成" },
    { key: "awaiting_review", icon: Pencil, label: "分镜审核" },
    { key: "generating_images", icon: Image, label: "首帧生图" },
    { key: "generating_audio", icon: Volume2, label: "配音生成" },
    { key: "generating_video", icon: Video, label: "视频生成" },
    { key: "assembling", icon: Scissors, label: "拼接成片" },
  ];

  const stageOrder = [
    "generating_script",
    "awaiting_review",
    "generating_images",
    "generating_audio",
    "generating_video",
    "assembling",
    "completed",
  ];

  const currentIdx = stageOrder.indexOf(stage);

  if (collapsed) {
    return (
      <div className="w-12 border-l border-border bg-white flex flex-col items-center py-4 gap-3">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          title="展开 Agent 控制台"
        >
          <ChevronLeft size={16} />
        </button>
        <div
          className={`w-2 h-2 rounded-full ${
            stage === "failed"
              ? "bg-red-400"
              : stage === "completed"
              ? "bg-emerald-400"
              : stage === "idle"
              ? "bg-gray-300"
              : "bg-blue-400 animate-pulse"
          }`}
          title={STAGE_LABELS[stage]}
        />
      </div>
    );
  }

  return (
    <aside className="w-80 border-l border-border bg-white flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              stage === "failed"
                ? "bg-red-400"
                : stage === "completed"
                ? "bg-emerald-400"
                : stage === "idle"
                ? "bg-gray-300"
                : "bg-blue-400 animate-pulse"
            }`}
          />
          <span className="text-sm font-semibold text-foreground">
            Agent 控制台
          </span>
        </div>
        <button
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Stage progress */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-foreground">
            {STAGE_LABELS[stage]}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {STAGE_PROGRESS[stage]}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${STAGE_PROGRESS[stage]}%`,
              background:
                stage === "failed"
                  ? "oklch(0.60 0.20 30)"
                  : "oklch(0.60 0.20 255)",
            }}
          />
        </div>

        {/* Stage steps */}
        <div className="mt-3 space-y-1">
          {stageSteps.map((step) => {
            const stepIdx = stageOrder.indexOf(step.key);
            const isDone = currentIdx > stepIdx;
            const isCurrent = currentIdx === stepIdx;

            return (
              <div
                key={step.key}
                className={`flex items-center gap-2 py-0.5 ${
                  isDone || isCurrent ? "opacity-100" : "opacity-30"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                    isDone
                      ? "bg-emerald-100"
                      : isCurrent
                      ? "bg-blue-100"
                      : "bg-secondary"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 size={10} className="text-emerald-600" />
                  ) : isCurrent ? (
                    <Loader2 size={10} className="text-blue-500 animate-spin" />
                  ) : (
                    <step.icon size={10} className="text-muted-foreground" />
                  )}
                </div>
                <span
                  className={`text-xs ${
                    isCurrent
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Log output */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-1 font-mono">
          {logs.map((log) => (
            <div key={log.id} className="text-xs leading-relaxed">
              <span className="text-muted-foreground/50 mr-2">{log.time}</span>
              <span className={`mr-1.5 ${logColors[log.level]}`}>
                {logPrefixes[log.level]}
              </span>
              <span className={logColors[log.level]}>{log.message}</span>
              {log.detail && (
                <div className="pl-8 text-muted-foreground/60 text-xs mt-0.5">
                  {log.detail}
                </div>
              )}
            </div>
          ))}
          {stage !== "idle" &&
            stage !== "completed" &&
            stage !== "failed" && (
              <div className="text-xs text-muted-foreground/50 flex items-center gap-1">
                <span>
                  {new Date().toLocaleTimeString("zh-CN", { hour12: false })}
                </span>
                <span className="animate-pulse">▋</span>
              </div>
            )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Action buttons */}
      {stage === "completed" && (
        <div className="p-4 border-t border-border space-y-3">
          {/* 评分 */}
          {!feedbackGiven && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">
                对本次生成结果评分
              </p>
              <div className="flex items-center justify-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    onClick={() => {
                      onFeedback(star);
                      setFeedbackGiven(true);
                      toast.success(`感谢评分 ${star} 星！记忆系统已更新`);
                    }}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      size={18}
                      className={
                        star <= hoveredStar
                          ? "text-amber-400 fill-amber-400"
                          : "text-muted-foreground"
                      }
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          {feedbackGiven && (
            <p className="text-xs text-center text-emerald-600">
              ✓ 评分已记录，记忆系统已更新
            </p>
          )}
          <Button
            className="w-full gap-2 text-sm"
            onClick={onDownload}
            style={{ background: "oklch(0.22 0.06 250)" }}
          >
            <Download size={14} />
            下载成片 MP4
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 text-sm"
            onClick={onExportDraft}
          >
            <Scissors size={14} />
            导出剪映草稿
          </Button>
        </div>
      )}

      {/* Error state */}
      {stage === "failed" && (
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 text-red-500 mb-3">
            <AlertCircle size={14} />
            <span className="text-xs font-medium">生成失败</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            请检查 API Keys 配置，或查看日志了解详情。
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={12} />
            重试
          </Button>
        </div>
      )}
    </aside>
  );
}

// ─── Main Studio Page ─────────────────────────────────────────────────────────

export default function Studio() {
  const params = useParams<{ projectId?: string }>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const {
    state: workflow,
    startWorkflow,
    submitReview,
    updateScene,
    submitFeedback,
    reset,
    restoreProject,
    addLog,
  } = useWorkflow();

  const { projects, refetch: refetchProjects } = useProjects();

  // 恢复已有项目（URL 中有 projectId 时）
  useEffect(() => {
    if (params.projectId) {
      restoreProject(params.projectId);
    }
  }, [params.projectId]);

  // 工作流状态变化时，向聊天面板推送消息
  useEffect(() => {
    const stage = workflow.stage;
    const script = workflow.script;

    if (stage === "awaiting_review" && script) {
      addChatMessage(
        "assistant",
        `脚本生成完成！共生成 **${script.scenes.length} 个分镜**，总时长约 **${script.total_duration.toFixed(0)} 秒**。\n\n标题：《${script.title}》\n\n请在下方审核每个分镜的画面描述、旁白文案和时长，确认无误后点击「全部确认，开始生成」。`
      );
    } else if (stage === "generating_images") {
      addChatMessage(
        "assistant",
        "✅ 脚本已确认！正在并行生成首帧图像和 TTS 配音，请稍候..."
      );
    } else if (stage === "generating_video") {
      addChatMessage(
        "assistant",
        "🎨 首帧图像和配音生成完成！正在调用视频生成引擎，这是最耗时的步骤，请耐心等待..."
      );
    } else if (stage === "assembling") {
      addChatMessage(
        "assistant",
        "🎬 视频片段生成完成！正在使用 FFmpeg 拼接成片、混合音频、烧录字幕..."
      );
    } else if (stage === "completed" && workflow.result) {
      const result = workflow.result;
      addChatMessage(
        "assistant",
        `🎉 视频生成完成！\n\n成片时长：**${result.total_duration.toFixed(1)} 秒**\n\n你可以在右侧控制台下载 MP4 成片，或导出剪映草稿进行微调。`
      );
      refetchProjects();
    } else if (stage === "failed" && workflow.error) {
      addChatMessage("assistant", `❌ 生成失败：${workflow.error}\n\n请检查 API Keys 配置后重试。`);
    }
  }, [workflow.stage]);

  const addChatMessage = (role: "user" | "assistant", content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, role, content, timestamp: new Date() },
    ]);
  };

  const handleSend = async (input: string) => {
    // 重置状态
    reset();
    setMessages([]);

    addChatMessage("user", input);

    // 解析用户输入中的参数（简单规则）
    const durationMatch = input.match(/(\d+)\s*秒/);
    const duration = durationMatch ? parseInt(durationMatch[1]) : 60;

    const engineMatch = input.toLowerCase().match(/seedance|kling/);
    const engine = engineMatch
      ? (engineMatch[0] as "kling" | "seedance")
      : "auto";

    addChatMessage(
      "assistant",
      `好的！我已理解你的需求：\n\n**主题**：${input}\n**目标时长**：${duration}s\n**视频引擎**：${engine === "auto" ? "智能路由" : engine.toUpperCase()}\n\n正在调用 LLM 生成分镜脚本，请稍候...`
    );

    try {
      await startWorkflow({
        topic: input,
        duration,
        engine,
        addSubtitles: true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "启动失败";
      addChatMessage(
        "assistant",
        `❌ 工作流启动失败：${msg}\n\n请确认后端服务已启动，并检查 API Keys 配置。`
      );
    }
  };

  const handleConfirmScript = () => {
    submitReview(true);
  };

  const handleCancelScript = () => {
    submitReview(false);
    addChatMessage("assistant", "已取消。如需重新生成，请重新描述你的需求。");
  };

  const handleDownload = async () => {
    if (!workflow.projectId) return;
    try {
      const links = await projectApi.getDownloadLinks(workflow.projectId);
      window.open(links.final_video, "_blank");
    } catch {
      toast.error("获取下载链接失败，请检查后端服务");
    }
  };

  const handleExportDraft = async () => {
    if (!workflow.projectId) return;
    try {
      const links = await projectApi.getDownloadLinks(workflow.projectId);
      window.open(links.draft_dir, "_blank");
    } catch {
      toast.error("获取草稿链接失败");
    }
  };

  const handleSelectProject = (id: string) => {
    reset();
    setMessages([]);
    restoreProject(id);
  };

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "oklch(0.955 0.012 240)" }}
    >
      {/* Left sidebar */}
      <SidebarNav
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        projects={projects}
        onSelectProject={handleSelectProject}
      />

      {/* Center panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ChatPanel
          messages={messages}
          onSend={handleSend}
          stage={workflow.stage}
          onConfirmScript={handleConfirmScript}
          onCancelScript={handleCancelScript}
          isConnected={workflow.isConnected}
        />
        {workflow.requiresReview && workflow.scenes.length > 0 && (
          <SceneReviewPanel
            scenes={workflow.scenes}
            onUpdate={updateScene}
            onApprove={handleConfirmScript}
            onCancel={handleCancelScript}
          />
        )}
      </div>

      {/* Right agent console */}
      <AgentConsole
        logs={workflow.logs}
        stage={workflow.stage}
        collapsed={consoleCollapsed}
        onToggle={() => setConsoleCollapsed(!consoleCollapsed)}
        projectId={workflow.projectId}
        onDownload={handleDownload}
        onExportDraft={handleExportDraft}
        onFeedback={submitFeedback}
      />
    </div>
  );
}
