/*
 * Studio.tsx — 噼哩噼哩 主工作台
 * Design: Seedance 2.0 inspired — soft blue-grey bg, white cards, serif headings
 * Layout: Left sidebar (nav) + Center (chat + scene editor) + Right (agent console)
 */

import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
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
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Pencil,
  Trash2,
  Plus,
  Image,
  Volume2,
  Video,
  Scissors,
  Upload,
  Download,
  BookOpen,
  Zap,
  User,
  Bot,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type MessageRole = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

interface Scene {
  id: string;
  index: number;
  title: string;
  imagePrompt: string;
  videoPrompt: string;
  voiceover: string;
  duration: number;
  transition: string;
  status: "pending" | "generating" | "done" | "error";
  imageUrl?: string;
  videoUrl?: string;
}

interface AgentLog {
  id: string;
  time: string;
  level: "info" | "success" | "warning" | "error" | "progress";
  message: string;
  detail?: string;
}

type WorkflowStage =
  | "idle"
  | "scripting"
  | "reviewing"
  | "generating_images"
  | "generating_tts"
  | "generating_video"
  | "assembling"
  | "done";

// ─── Mock data ────────────────────────────────────────────────────────────────

const EXAMPLE_PROMPTS = [
  { label: "科技产品", desc: "展示最新 AI 芯片的震撼性能" },
  { label: "旅行 Vlog", desc: "日本京都秋季枫叶之旅" },
  { label: "美食短片", desc: "川菜大厨的一道麻婆豆腐" },
  { label: "品牌故事", desc: "一个创业者从零到一的故事" },
];

const MOCK_SCENES: Scene[] = [
  {
    id: "s1",
    index: 1,
    title: "开场镜头",
    imagePrompt: "Cinematic aerial shot of a futuristic city at dusk, neon lights reflecting on wet streets, ultra wide angle, 4K",
    videoPrompt: "Slow camera pull back from street level to aerial view, smooth motion",
    voiceover: "在这个信息爆炸的时代，每一个创作者都需要一个强大的工具。",
    duration: 5,
    transition: "crossfade",
    status: "done",
    imageUrl: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=640&q=80",
  },
  {
    id: "s2",
    index: 2,
    title: "产品展示",
    imagePrompt: "Close-up of a sleek AI device on a minimalist desk, soft studio lighting, product photography style",
    videoPrompt: "Camera slowly orbits the product, particles of light swirl around it",
    voiceover: "噼哩噼哩，让 AI 帮你完成从脚本到成片的全部工作。",
    duration: 6,
    transition: "fade",
    status: "generating",
  },
  {
    id: "s3",
    index: 3,
    title: "功能演示",
    imagePrompt: "Split screen showing a text prompt transforming into a beautiful video, dark UI interface, blue accents",
    videoPrompt: "Animated transition from text to video frames, smooth morphing effect",
    voiceover: "只需一句话，系统自动生成脚本、分镜、配音和成片。",
    duration: 5,
    transition: "slide",
    status: "pending",
  },
  {
    id: "s4",
    index: 4,
    title: "结尾号召",
    imagePrompt: "Bright optimistic scene of a creator at their desk, warm light, creative workspace, laptop glowing",
    videoPrompt: "Camera slowly pushes in toward the creator, warm light brightens",
    voiceover: "现在就开始，让你的创意飞起来。",
    duration: 4,
    transition: "fade",
    status: "pending",
  },
];

const MOCK_LOGS: AgentLog[] = [
  { id: "l1", time: "14:23:01", level: "info", message: "工作流已启动", detail: "接收到用户指令，开始解析意图" },
  { id: "l2", time: "14:23:02", level: "info", message: "调用 DeepSeek-V3 生成分镜脚本", detail: "model: deepseek-chat | temperature: 0.7" },
  { id: "l3", time: "14:23:08", level: "success", message: "脚本生成完成", detail: "共 4 个分镜，总时长约 20 秒" },
  { id: "l4", time: "14:23:09", level: "warning", message: "等待用户审核分镜脚本", detail: "流水线已暂停，请确认后继续" },
  { id: "l5", time: "14:23:45", level: "info", message: "用户确认脚本，继续执行", detail: "" },
  { id: "l6", time: "14:23:46", level: "info", message: "并行生成 TTS 配音 (4 条)", detail: "model: minimax-speech-02-hd | 情感: 专业" },
  { id: "l7", time: "14:23:52", level: "success", message: "配音生成完成", detail: "S01: 4.2s | S02: 5.1s | S03: 4.8s | S04: 3.6s" },
  { id: "l8", time: "14:23:53", level: "info", message: "调用 Nano Banana 生成首帧图像 (S01)", detail: "model: gemini-3-pro-image | resolution: 4K" },
  { id: "l9", time: "14:24:15", level: "success", message: "首帧图像生成完成 (S01)", detail: "耗时 22s | 已保存至本地" },
  { id: "l10", time: "14:24:16", level: "info", message: "调用 Kling 3.0 生成视频 (S01)", detail: "model: kling-v3 | duration: 4.2s | I2V模式" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SidebarNav({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const navItems = [
    { icon: Home, label: "首页", href: "/" },
    { icon: Film, label: "工作台", href: "/studio", active: true },
    { icon: History, label: "历史项目", href: "/studio" },
    { icon: BookOpen, label: "角色库", href: "/studio" },
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
            <div className="text-sm font-semibold leading-tight" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.22 0.06 250)" }}>
              噼哩噼哩
            </div>
            <div className="text-xs text-muted-foreground leading-tight">AutoVideo</div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3">
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
              {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
            </div>
          </Link>
        ))}
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

function ChatPanel({
  messages,
  onSend,
  stage,
  onConfirmScript,
}: {
  messages: ChatMessage[];
  onSend: (msg: string) => void;
  stage: WorkflowStage;
  onConfirmScript: () => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif" }} className="text-lg font-semibold text-foreground">
              创作工作台
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">描述你想要的视频，AI 自动完成全部工作</p>
          </div>
          {stage === "reviewing" && (
            <Button
              size="sm"
              onClick={onConfirmScript}
              className="gap-2"
              style={{ background: "oklch(0.22 0.06 250)" }}
            >
              <CheckCircle2 size={14} />
              确认脚本，开始生成
            </Button>
          )}
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
        {/* Attachments row */}
        <div className="flex items-center gap-2 mb-3">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors border border-border">
            <Image size={13} />
            参考图片
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors border border-border">
            <Video size={13} />
            参考视频
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors border border-border">
            <Upload size={13} />
            上传文档
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors border border-border">
            <User size={13} />
            角色设定
          </button>
        </div>

        <div className="flex gap-3 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你想要的视频内容，例如：帮我做一个关于 AI 改变世界的 60 秒短视频，科技感强，节奏快..."
            className="flex-1 resize-none min-h-[80px] max-h-[160px] text-sm border-border focus:ring-1 rounded-xl"
            style={{ background: "oklch(0.97 0.008 240)" }}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim()}
            size="icon"
            className="w-10 h-10 rounded-xl shrink-0"
            style={{ background: "oklch(0.22 0.06 250)" }}
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onExampleClick }: { onExampleClick: (msg: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: "oklch(0.93 0.015 240)" }}
      >
        <Sparkles size={28} style={{ color: "oklch(0.22 0.06 250)" }} />
      </div>
      <h3 style={{ fontFamily: "'Playfair Display', serif" }} className="text-2xl font-semibold text-foreground mb-2">
        开始你的创作
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-8 leading-relaxed">
        输入一句话，AI 自动完成脚本策划、分镜生成、配音制作、视频合成，最终输出带字幕的成品视频或剪映草稿。
      </p>

      <div className="grid grid-cols-2 gap-3 w-full max-w-md">
        {EXAMPLE_PROMPTS.map((ex) => (
          <button
            key={ex.label}
            onClick={() => onExampleClick(ex.desc)}
            className="text-left p-4 rounded-xl border border-border bg-white hover:border-primary/40 hover:shadow-sm transition-all group"
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 group-hover:text-primary transition-colors">
              {ex.label}
            </div>
            <div className="text-sm text-foreground">{ex.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 slide-up ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? "bg-primary text-primary-foreground" : ""
        }`}
        style={!isUser ? { background: "oklch(0.93 0.015 240)" } : {}}
      >
        {isUser ? <User size={14} /> : <Bot size={14} style={{ color: "oklch(0.22 0.06 250)" }} />}
      </div>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-white border border-border text-foreground rounded-tl-sm"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

function SceneReviewPanel({ scenes, onUpdate, onApprove }: {
  scenes: Scene[];
  onUpdate: (id: string, field: keyof Scene, value: string | number) => void;
  onApprove: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="border-t border-border bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="badge-pill">
            <Film size={10} />
            分镜审核
          </div>
          <span className="text-xs text-muted-foreground">共 {scenes.length} 个分镜，请确认后开始生成</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1.5">
            <Plus size={12} />
            添加分镜
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

      {/* Scene cards — horizontal scroll */}
      <div className="flex gap-4 px-6 py-4 overflow-x-auto">
        {scenes.map((scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            expanded={expandedId === scene.id}
            onToggle={() => setExpandedId(expandedId === scene.id ? null : scene.id)}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  );
}

function SceneCard({
  scene,
  expanded,
  onToggle,
  onUpdate,
}: {
  scene: Scene;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, field: keyof Scene, value: string | number) => void;
}) {
  const statusConfig = {
    pending: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted", label: "待生成" },
    generating: { icon: Loader2, color: "text-blue-500", bg: "bg-blue-50", label: "生成中" },
    done: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50", label: "已完成" },
    error: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-50", label: "出错" },
  };
  const sc = statusConfig[scene.status];

  return (
    <div
      className="scene-card shrink-0 transition-all duration-200"
      style={{ width: expanded ? 380 : 220 }}
    >
      {/* Image preview */}
      <div
        className="relative overflow-hidden"
        style={{ height: 120, background: "oklch(0.93 0.015 240)" }}
      >
        {scene.imageUrl ? (
          <img src={scene.imageUrl} alt={scene.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image size={24} className="text-muted-foreground/40" />
          </div>
        )}
        {/* Scene index badge */}
        <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center font-mono font-bold">
          {scene.index}
        </div>
        {/* Status badge */}
        <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${sc.bg} ${sc.color}`}>
          <sc.icon size={10} className={scene.status === "generating" ? "animate-spin" : ""} />
          {sc.label}
        </div>
        {/* Duration */}
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs font-mono">
          {scene.duration}s
        </div>
      </div>

      {/* Card body */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground truncate">{scene.title}</span>
          <button onClick={onToggle} className="text-muted-foreground hover:text-foreground transition-colors ml-2 shrink-0">
            <Pencil size={13} />
          </button>
        </div>

        {!expanded ? (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{scene.voiceover}</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">旁白文案</label>
              <Textarea
                value={scene.voiceover}
                onChange={(e) => onUpdate(scene.id, "voiceover", e.target.value)}
                className="text-xs min-h-[60px] resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">画面描述</label>
              <Textarea
                value={scene.imagePrompt}
                onChange={(e) => onUpdate(scene.id, "imagePrompt", e.target.value)}
                className="text-xs min-h-[60px] resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">运动描述</label>
              <Textarea
                value={scene.videoPrompt}
                onChange={(e) => onUpdate(scene.id, "videoPrompt", e.target.value)}
                className="text-xs min-h-[50px] resize-none"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">时长 (秒)</label>
                <input
                  type="number"
                  value={scene.duration}
                  onChange={(e) => onUpdate(scene.id, "duration", Number(e.target.value))}
                  className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background"
                  min={1}
                  max={15}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">转场</label>
                <select
                  value={scene.transition}
                  onChange={(e) => onUpdate(scene.id, "transition", e.target.value)}
                  className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background"
                >
                  <option value="crossfade">交叉淡入</option>
                  <option value="fade">淡入淡出</option>
                  <option value="slide">滑动</option>
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

function AgentConsole({
  logs,
  stage,
  collapsed,
  onToggle,
}: {
  logs: AgentLog[];
  stage: WorkflowStage;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const stageLabels: Record<WorkflowStage, string> = {
    idle: "空闲",
    scripting: "生成脚本中",
    reviewing: "等待审核",
    generating_images: "生成首帧图像",
    generating_tts: "生成配音",
    generating_video: "生成视频片段",
    assembling: "拼接成片",
    done: "已完成",
  };

  const stageProgress: Record<WorkflowStage, number> = {
    idle: 0,
    scripting: 15,
    reviewing: 25,
    generating_images: 45,
    generating_tts: 55,
    generating_video: 80,
    assembling: 95,
    done: 100,
  };

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
        <div className="w-2 h-2 rounded-full bg-emerald-400 progress-pulse" title={stageLabels[stage]} />
      </div>
    );
  }

  return (
    <aside className="w-80 border-l border-border bg-white flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 progress-pulse" />
          <span className="text-sm font-semibold text-foreground">Agent 控制台</span>
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
          <span className="text-xs font-medium text-foreground">{stageLabels[stage]}</span>
          <span className="text-xs text-muted-foreground font-mono">{stageProgress[stage]}%</span>
        </div>
        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${stageProgress[stage]}%`,
              background: "oklch(0.60 0.20 255)",
            }}
          />
        </div>

        {/* Stage steps */}
        <div className="mt-3 space-y-1">
          {[
            { key: "scripting", icon: Sparkles, label: "脚本生成" },
            { key: "reviewing", icon: Pencil, label: "分镜审核" },
            { key: "generating_images", icon: Image, label: "首帧生图" },
            { key: "generating_tts", icon: Volume2, label: "配音生成" },
            { key: "generating_video", icon: Video, label: "视频生成" },
            { key: "assembling", icon: Scissors, label: "拼接成片" },
          ].map((step) => {
            const stageOrder = ["scripting", "reviewing", "generating_images", "generating_tts", "generating_video", "assembling", "done"];
            const currentIdx = stageOrder.indexOf(stage);
            const stepIdx = stageOrder.indexOf(step.key);
            const isDone = currentIdx > stepIdx;
            const isCurrent = currentIdx === stepIdx;

            return (
              <div key={step.key} className={`flex items-center gap-2 py-0.5 ${isDone ? "opacity-100" : isCurrent ? "opacity-100" : "opacity-30"}`}>
                <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                  isDone ? "bg-emerald-100" : isCurrent ? "bg-blue-100" : "bg-secondary"
                }`}>
                  {isDone ? (
                    <CheckCircle2 size={10} className="text-emerald-600" />
                  ) : isCurrent ? (
                    <Loader2 size={10} className="text-blue-500 animate-spin" />
                  ) : (
                    <step.icon size={10} className="text-muted-foreground" />
                  )}
                </div>
                <span className={`text-xs ${isCurrent ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Log output */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-1">
          {logs.map((log) => (
            <div key={log.id} className="agent-log-line">
              <span className="text-muted-foreground/50 mr-2">{log.time}</span>
              <span className={`mr-1.5 ${logColors[log.level]}`}>{logPrefixes[log.level]}</span>
              <span className={logColors[log.level]}>{log.message}</span>
              {log.detail && (
                <div className="pl-8 text-muted-foreground/60 text-xs mt-0.5">{log.detail}</div>
              )}
            </div>
          ))}
          {stage !== "idle" && stage !== "done" && (
            <div className="agent-log-line flex items-center gap-1 text-muted-foreground/50">
              <span className="mr-2">{new Date().toLocaleTimeString("zh-CN", { hour12: false })}</span>
              <span className="cursor-blink">▋</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Action buttons */}
      {stage === "done" && (
        <div className="p-4 border-t border-border space-y-2">
          <Button className="w-full gap-2 text-sm" style={{ background: "oklch(0.22 0.06 250)" }}>
            <Download size={14} />
            下载成片 MP4
          </Button>
          <Button variant="outline" className="w-full gap-2 text-sm">
            <Scissors size={14} />
            导出剪映草稿
          </Button>
        </div>
      )}
    </aside>
  );
}

// ─── Main Studio Page ─────────────────────────────────────────────────────────

export default function Studio() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [stage, setStage] = useState<WorkflowStage>("idle");
  const [showSceneReview, setShowSceneReview] = useState(false);

  const addMessage = (role: MessageRole, content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role, content, timestamp: new Date() },
    ]);
  };

  const addLog = (level: AgentLog["level"], message: string, detail?: string) => {
    const now = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    setLogs((prev) => [
      ...prev,
      { id: Date.now().toString(), time: now, level, message, detail },
    ]);
  };

  const handleSend = (input: string) => {
    addMessage("user", input);
    setStage("scripting");

    // Simulate AI response
    setTimeout(() => {
      addMessage(
        "assistant",
        `好的！我已经理解你的需求：**${input}**\n\n正在调用 DeepSeek-V3 生成分镜脚本，请稍候...`
      );
      addLog("info", "工作流已启动", `用户指令: ${input}`);
      addLog("info", "调用 DeepSeek-V3 生成分镜脚本", "model: deepseek-chat | temperature: 0.7");
    }, 600);

    setTimeout(() => {
      setScenes(MOCK_SCENES);
      setLogs(MOCK_LOGS);
      setStage("reviewing");
      setShowSceneReview(true);
      addMessage(
        "assistant",
        "脚本生成完成！共生成 **4 个分镜**，总时长约 **20 秒**。\n\n请在下方审核每个分镜的画面描述、旁白文案和时长，确认无误后点击「全部确认，开始生成」。"
      );
    }, 3000);
  };

  const handleSceneUpdate = (id: string, field: keyof Scene, value: string | number) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleConfirmScript = () => {
    setStage("generating_images");
    addMessage("assistant", "已确认脚本！开始并行生成配音和首帧图像...");
    addLog("info", "用户确认脚本，继续执行");
    addLog("info", "并行生成 TTS 配音 (4 条)", "model: minimax-speech-02-hd");
    toast.success("脚本已确认，开始生成视频！");

    setTimeout(() => setStage("generating_tts"), 2000);
    setTimeout(() => setStage("generating_video"), 5000);
    setTimeout(() => setStage("assembling"), 9000);
    setTimeout(() => {
      setStage("done");
      addMessage(
        "assistant",
        "🎉 视频生成完成！\n\n成片时长：**20 秒**，分辨率：**1080p**\n\n你可以在右侧控制台下载 MP4 成片，或导出剪映草稿进行微调。"
      );
      addLog("success", "视频拼接完成", "output: pilipili_output_20250321.mp4 | 20s | 1080p");
    }, 12000);
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "oklch(0.955 0.012 240)" }}>
      {/* Left sidebar */}
      <SidebarNav collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      {/* Center panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ChatPanel
          messages={messages}
          onSend={handleSend}
          stage={stage}
          onConfirmScript={handleConfirmScript}
        />
        {showSceneReview && (
          <SceneReviewPanel
            scenes={scenes}
            onUpdate={handleSceneUpdate}
            onApprove={handleConfirmScript}
          />
        )}
      </div>

      {/* Right agent console */}
      <AgentConsole
        logs={logs}
        stage={stage}
        collapsed={consoleCollapsed}
        onToggle={() => setConsoleCollapsed(!consoleCollapsed)}
      />
    </div>
  );
}
