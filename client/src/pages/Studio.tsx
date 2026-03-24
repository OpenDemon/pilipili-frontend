/**
 * Studio.tsx — 噼哩噼哩 主工作台 v2.1
 *
 * 设计：保持原有 Seedance 浅色风格（soft blue-grey bg, white cards, serif headings）
 * 功能布局参考 Kling Omni：
 *   - 左侧图标导航栏（可折叠）
 *   - 中间主区：角色参考图横排 + 消息区（可滚动）+ 输入区 + 底部工具栏
 *   - 右侧：对标视频分析面板（全部字段可编辑）
 *   - 右侧：Agent 控制台（可折叠）
 *   - 分镜审核区（嵌入中间主区，可滚动）
 *
 * v2.1 修复：
 *   - 对标分析结果全部字段可编辑（title/style/overall_prompt/appearance_prompt/scene prompts）
 *   - 角色参考图支持多张上传，上传后自动更新对应角色 appearance_prompt
 *   - CharacterRail 支持多张上传（multiple 属性）
 *   - 主布局改为正确的 flex 滚动，页面所有区域均可上下滑动
 *   - 分镜审核区嵌入主区，不再固定高度截断内容
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Zap,
  Bot,
  User,
  RefreshCw,
  Wifi,
  WifiOff,
  Star,
  X,
  Upload,
  ScanSearch,
  Layers,
  ChevronDown,
  Copy,
  Check,
  BookOpen,
  Camera,
  Edit3,
} from "lucide-react";
import { useWorkflow, AgentLog } from "@/hooks/useWorkflow";
import { useProjects } from "@/hooks/useProjects";
import {
  Scene,
  WorkflowStage,
  projectApi,
  uploadApi,
  UploadResult,
  analyzeApi,
  ReferenceVideoAnalysisResult,
  ReferenceAnalysisResponse,
  CharacterInfo,
  ReferenceScene,
  ShotMode,
} from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

const SHOT_MODE_BADGE: Record<ShotMode, { label: string; cls: string }> = {
  multi_ref: { label: "多参考", cls: "bg-violet-100 text-violet-700 border-violet-200" },
  first_end_frame: { label: "首尾帧", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  t2v: { label: "文生视频", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  i2v: { label: "图生视频", cls: "bg-sky-100 text-sky-700 border-sky-200" },
};

const ENGINE_OPTIONS = [
  { value: "kling", label: "Kling 3.0 Omni", desc: "多参考·首尾帧·多分镜" },
  { value: "seedance", label: "Seedance 1.5", desc: "叙事·多角色·长镜头" },
  { value: "auto", label: "智能路由", desc: "自动选择最优引擎" },
];

// ─── 复制按钮 ──────────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
      title="复制"
    >
      {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
    </button>
  );
}

// ─── 可编辑文本块 ──────────────────────────────────────────────────────────────
function EditableField({
  label,
  value,
  onChange,
  rows = 2,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
        <CopyBtn text={value} />
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={`text-xs resize-none leading-relaxed ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

// ─── 左侧图标导航 ──────────────────────────────────────────────────────────────
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
      className="flex flex-col border-r border-border bg-white transition-all duration-300 shrink-0 h-screen"
      style={{ width: collapsed ? 64 : 220 }}
    >
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.22 0.06 250)" }}>
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

      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map((item) => (
          <Link key={item.label} href={item.href}>
            <div className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 transition-colors cursor-pointer ${
              item.active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}>
              <item.icon size={18} className="shrink-0" />
              {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
            </div>
          </Link>
        ))}

        {!collapsed && projects.length > 0 && (
          <div className="mt-4 px-3">
            <div className="flex items-center gap-1.5 mb-2">
              <History size={12} className="text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">历史项目</span>
            </div>
            <div className="space-y-1">
              {projects.slice(0, 8).map((p) => (
                <button key={p.id} onClick={() => onSelectProject(p.id)}
                  className="w-full text-left px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors truncate">
                  {p.topic}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-border">
        <button onClick={onToggle} className="w-full flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}

// ─── 角色参考图横排（支持多张上传） ───────────────────────────────────────────
function CharacterRail({
  referenceImages,
  onAdd,
  onRemove,
  isUploading,
}: {
  referenceImages: UploadResult[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  isUploading: boolean;
}) {
  const imgFileRef = useRef<HTMLInputElement>(null);
  const vidFileRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onAdd(files);
    e.target.value = "";
    setMenuOpen(false);
  };

  const handleVidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onAdd(files);
    e.target.value = "";
    setMenuOpen(false);
  };

  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-white overflow-x-auto shrink-0">
      {/* 添加按钮 */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-14 h-14 rounded-full border-2 border-dashed border-border flex flex-col items-center justify-center gap-0.5 hover:border-primary/50 hover:bg-primary/5 transition-all group"
          title="添加角色参考图（支持多选）"
        >
          {isUploading ? (
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          ) : (
            <>
              <Plus size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-[9px] text-muted-foreground group-hover:text-primary transition-colors leading-none">角色</span>
            </>
          )}
        </button>
        {menuOpen && (
          <div className="absolute top-16 left-0 z-50 bg-white border border-border rounded-xl shadow-lg py-1 w-52">
            <label className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary cursor-pointer transition-colors">
              <Image size={14} className="text-muted-foreground" />
              上传图片（可多选）
              <input ref={imgFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImgChange} />
            </label>
            <label className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary cursor-pointer transition-colors">
              <Video size={14} className="text-muted-foreground" />
              上传视频（截帧）
              <input ref={vidFileRef} type="file" accept="video/*" multiple className="hidden" onChange={handleVidChange} />
            </label>
            <div className="border-t border-border my-1" />
            <div className="px-3 py-1.5 text-xs text-muted-foreground leading-relaxed">
              建议上传正/侧/背三视图<br />或四宫格图片保持角色一致性
            </div>
          </div>
        )}
      </div>

      {/* 已上传的参考图 */}
      {referenceImages.map((ref, idx) => (
        <div key={idx} className="relative shrink-0 group">
          <div className="w-14 h-14 rounded-full border-2 border-primary/30 overflow-hidden bg-secondary flex items-center justify-center">
            <User size={22} className="text-muted-foreground" />
          </div>
          <button
            onClick={() => onRemove(idx)}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={10} />
          </button>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white border border-border rounded-full px-1.5 py-0 text-[9px] text-muted-foreground whitespace-nowrap">
            {ref.type === "video_frame" ? "截帧" : `图${idx + 1}`}
          </div>
        </div>
      ))}

      {referenceImages.length === 0 && (
        <p className="text-xs text-muted-foreground">
          点击 <strong>+</strong> 上传角色参考图，支持多选 · 图片/视频截帧
        </p>
      )}
    </div>
  );
}

// ─── 底部工具栏 ────────────────────────────────────────────────────────────────
function BottomToolbar({
  engine,
  onEngineChange,
  multiShot,
  onMultiShotChange,
  resolution,
  onResolutionChange,
  onAnalyzeVideo,
  isGenerating,
  isConnected,
  stage,
}: {
  engine: "kling" | "seedance" | "auto";
  onEngineChange: (v: "kling" | "seedance" | "auto") => void;
  multiShot: boolean;
  onMultiShotChange: (v: boolean) => void;
  resolution: "720p" | "1080p";
  onResolutionChange: (v: "720p" | "1080p") => void;
  onAnalyzeVideo: () => void;
  isGenerating: boolean;
  isConnected: boolean;
  stage: WorkflowStage;
}) {
  const [engineOpen, setEngineOpen] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const engineRef = useRef<HTMLDivElement>(null);
  const resRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (engineRef.current && !engineRef.current.contains(e.target as Node)) setEngineOpen(false);
      if (resRef.current && !resRef.current.contains(e.target as Node)) setResOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentEngine = ENGINE_OPTIONS.find(e => e.value === engine) || ENGINE_OPTIONS[0];

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border bg-white flex-wrap shrink-0">
      {/* 引擎选择 */}
      <div className="relative" ref={engineRef}>
        <button
          onClick={() => setEngineOpen(!engineOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-secondary transition-colors"
        >
          <Video size={12} className="text-muted-foreground" />
          {currentEngine.label}
          <ChevronDown size={11} className="text-muted-foreground" />
        </button>
        {engineOpen && (
          <div className="absolute bottom-10 left-0 z-50 bg-white border border-border rounded-xl shadow-lg py-1 w-52">
            {ENGINE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onEngineChange(opt.value as "kling" | "seedance" | "auto"); setEngineOpen(false); }}
                className={`w-full text-left px-3 py-2 hover:bg-secondary transition-colors ${engine === opt.value ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{opt.label}</span>
                  {engine === opt.value && <CheckCircle2 size={13} className="text-primary" />}
                </div>
                <span className="text-xs text-muted-foreground">{opt.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 分辨率 */}
      <div className="relative" ref={resRef}>
        <button
          onClick={() => setResOpen(!resOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-secondary transition-colors"
        >
          <Camera size={12} className="text-muted-foreground" />
          {resolution}
          <ChevronDown size={11} className="text-muted-foreground" />
        </button>
        {resOpen && (
          <div className="absolute bottom-10 left-0 z-50 bg-white border border-border rounded-xl shadow-lg py-1 w-32">
            {(["720p", "1080p"] as const).map(r => (
              <button
                key={r}
                onClick={() => { onResolutionChange(r); setResOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors flex items-center justify-between ${resolution === r ? "text-primary font-medium" : "text-foreground"}`}
              >
                {r}
                {resolution === r && <CheckCircle2 size={12} className="text-primary" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Multi-Shot 开关 */}
      <button
        onClick={() => onMultiShotChange(!multiShot)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
          multiShot
            ? "border-primary/40 bg-primary/5 text-primary"
            : "border-border text-muted-foreground hover:bg-secondary"
        }`}
      >
        <Layers size={12} />
        Multi-Shot
        {multiShot && <CheckCircle2 size={11} />}
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* 对标视频分析入口 */}
      <button
        onClick={onAnalyzeVideo}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        title="上传对标视频，AI 自动分析分镜结构和反推提示词"
      >
        <ScanSearch size={12} />
        对标分析
      </button>

      {/* 连接状态 */}
      <div className="ml-auto flex items-center gap-1.5">
        {isConnected ? (
          <Wifi size={12} className="text-emerald-500" />
        ) : (
          <WifiOff size={12} className="text-muted-foreground" />
        )}
        <span className="text-xs text-muted-foreground">{isConnected ? "已连接" : "未连接"}</span>
      </div>

      {/* 进度指示 */}
      {stage !== "idle" && stage !== "completed" && stage !== "failed" && (
        <div className="flex items-center gap-1.5 text-xs text-blue-500">
          <Loader2 size={12} className="animate-spin" />
          {STAGE_LABELS[stage]}
        </div>
      )}
    </div>
  );
}

// ─── 分镜卡片（可编辑） ────────────────────────────────────────────────────────
function SceneCard({
  scene,
  onUpdate,
}: {
  scene: Scene;
  onUpdate: (id: number, field: keyof Scene, value: string | number | string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shotBadge = scene.shot_mode ? SHOT_MODE_BADGE[scene.shot_mode] : null;

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-secondary/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: "oklch(0.42 0.12 255)", fontSize: "10px" }}>
            {scene.scene_id}
          </span>
          <span className="text-xs font-medium text-foreground">分镜 {scene.scene_id}</span>
          <Badge variant="outline" className="text-xs py-0 h-4">{scene.duration}s</Badge>
          {shotBadge && (
            <span className={`text-[10px] px-1.5 py-0 rounded border font-medium ${shotBadge.cls}`}>
              {shotBadge.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{scene.transition}</span>
          <ChevronDown size={13} className={`text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      <div className="px-3 pb-3">
        {!expanded ? (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{scene.voiceover}</p>
        ) : (
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">旁白文案</label>
              <Textarea value={scene.voiceover} onChange={(e) => onUpdate(scene.scene_id, "voiceover", e.target.value)} className="text-xs min-h-[60px] resize-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">画面描述</label>
              <Textarea value={scene.image_prompt} onChange={(e) => onUpdate(scene.scene_id, "image_prompt", e.target.value)} className="text-xs min-h-[60px] resize-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">运动描述</label>
              <Textarea value={scene.video_prompt} onChange={(e) => onUpdate(scene.scene_id, "video_prompt", e.target.value)} className="text-xs min-h-[50px] resize-none" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">时长 (秒)</label>
                <input type="number" value={scene.duration} onChange={(e) => onUpdate(scene.scene_id, "duration", Number(e.target.value))}
                  className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background" min={1} max={15} />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">转场</label>
                <select value={scene.transition} onChange={(e) => onUpdate(scene.scene_id, "transition", e.target.value)}
                  className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background">
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

// ─── 分镜审核区（嵌入主区，可滚动） ───────────────────────────────────────────
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
    <div className="border-t border-border bg-white shrink-0">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Pencil size={14} style={{ color: "oklch(0.42 0.12 255)" }} />
          <span className="text-sm font-semibold text-foreground">分镜审核 · {scenes.length} 个分镜</span>
          <span className="text-xs text-muted-foreground">总时长约 {scenes.reduce((s, sc) => s + sc.duration, 0)}s · 点击展开编辑</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onCancel} className="text-xs gap-1.5"><X size={12} />取消</Button>
          <Button size="sm" onClick={onApprove} className="text-xs gap-1.5" style={{ background: "oklch(0.22 0.06 250)" }}>
            <CheckCircle2 size={12} />确认，开始生成
          </Button>
        </div>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: "45vh" }}>
        <div className="grid grid-cols-2 gap-3 p-4">
          {scenes.map((scene) => (
            <SceneCard key={scene.scene_id} scene={scene} onUpdate={onUpdate} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 人物替换卡片（可编辑 appearance_prompt，支持多图上传） ────────────────────
function CharacterReplaceCard({
  character,
  analysisId,
  onReplaced,
  onPromptChange,
}: {
  character: CharacterInfo;
  analysisId: string;
  onReplaced: (characterId: number, imagePath: string) => void;
  onPromptChange: (characterId: number, prompt: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [replaced, setReplaced] = useState(!!character.replacement_image);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [localPrompt, setLocalPrompt] = useState(character.appearance_prompt);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      // 依次上传多张图片，最后一张作为替换图
      let lastPath = "";
      for (const file of files) {
        const result = await analyzeApi.replaceCharacter(analysisId, character.character_id, file);
        lastPath = result.path;
      }
      setReplaced(true);
      onReplaced(character.character_id, lastPath);
      toast.success(`${character.name} 替换参考图已上传（${files.length} 张）`);
    } catch (err: unknown) {
      toast.error(`上传失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handlePromptSave = () => {
    onPromptChange(character.character_id, localPrompt);
    setEditingPrompt(false);
    toast.success("角色提示词已更新");
  };

  return (
    <div className="rounded-xl border border-border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: "oklch(0.42 0.12 255)" }}>
            {character.character_id}
          </div>
          <span className="text-sm font-semibold text-foreground">{character.name}</span>
        </div>
        {replaced && (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircle2 size={12} />已替换
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{character.description}</p>

      {/* 可编辑的 appearance_prompt */}
      <div className="rounded-lg bg-secondary p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">外观提示词</span>
          <div className="flex items-center gap-1">
            <CopyBtn text={localPrompt} />
            <button
              onClick={() => setEditingPrompt(!editingPrompt)}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              title={editingPrompt ? "取消编辑" : "编辑提示词"}
            >
              <Edit3 size={12} />
            </button>
          </div>
        </div>
        {editingPrompt ? (
          <div className="space-y-2">
            <Textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              className="text-xs font-mono resize-none min-h-[80px] leading-relaxed"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 text-xs h-7" onClick={handlePromptSave} style={{ background: "oklch(0.22 0.06 250)" }}>
                <Check size={11} className="mr-1" />保存
              </Button>
              <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => { setLocalPrompt(character.appearance_prompt); setEditingPrompt(false); }}>
                取消
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-foreground font-mono leading-relaxed">{localPrompt}</p>
        )}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700 leading-relaxed">
        <span className="font-semibold">角色一致性：</span>
        建议上传正/侧/背三视图或四宫格图片（可在 NanoBanana / 豆包中生成），支持多选
      </div>

      <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileChange} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className={`w-full py-2 rounded-lg text-xs font-medium border transition-all disabled:opacity-50 ${
          replaced
            ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-1.5"><Loader2 size={12} className="animate-spin" />上传中...</span>
        ) : replaced ? "重新上传替换参考图（支持多选）" : "上传替换参考图（图片/视频，可多选）"}
      </button>
    </div>
  );
}

// ─── 分镜反推提示词行（全部字段可编辑） ────────────────────────────────────────
function ScenePromptRow({
  scene,
  reversePrompt,
  index,
  onSceneChange,
  onReversePromptChange,
}: {
  scene: ReferenceScene;
  reversePrompt: string;
  index: number;
  onSceneChange: (idx: number, field: keyof ReferenceScene, value: string | number) => void;
  onReversePromptChange: (idx: number, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shotBadge = SHOT_MODE_BADGE[scene.shot_mode];

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-secondary/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">#{index + 1}</span>
          {shotBadge && (
            <span className={`text-[10px] px-1.5 py-0 rounded border font-medium shrink-0 ${shotBadge.cls}`}>
              {shotBadge.label}
            </span>
          )}
          <span className="text-xs text-muted-foreground shrink-0">{scene.duration}s</span>
          <span className="text-xs text-foreground truncate">{scene.voiceover || scene.image_prompt.slice(0, 35) + "..."}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Edit3 size={11} className="text-muted-foreground" />
          <ChevronDown size={13} className={`text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-border pt-3">
          {/* 反推提示词 */}
          <EditableField
            label="反推提示词（可直接复用）"
            value={reversePrompt}
            onChange={(v) => onReversePromptChange(index, v)}
            rows={3}
            mono
          />
          {/* 旁白 */}
          <EditableField
            label="旁白文案"
            value={scene.voiceover}
            onChange={(v) => onSceneChange(index, "voiceover", v)}
            rows={2}
          />
          {/* 生图提示词 */}
          <EditableField
            label="生图提示词"
            value={scene.image_prompt}
            onChange={(v) => onSceneChange(index, "image_prompt", v)}
            rows={3}
            mono
          />
          {/* 运动提示词 */}
          <EditableField
            label="运动提示词"
            value={scene.video_prompt}
            onChange={(v) => onSceneChange(index, "video_prompt", v)}
            rows={2}
            mono
          />
          {/* 时长 */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-16 shrink-0">时长 (秒)</label>
            <input
              type="number"
              value={scene.duration}
              onChange={(e) => onSceneChange(index, "duration", Number(e.target.value))}
              className="w-20 text-xs px-2 py-1.5 rounded-md border border-border bg-background"
              min={1} max={15}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 对标视频分析面板（右侧，全部字段可编辑） ──────────────────────────────────
function AnalysisPanel({
  open,
  onClose,
  onCreateProject,
}: {
  open: boolean;
  onClose: () => void;
  onCreateProject: (analysisId: string, result: ReferenceVideoAnalysisResult) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<ReferenceAnalysisResponse | null>(null);
  const [polling, setPolling] = useState(false);
  const [activeTab, setActiveTab] = useState<"characters" | "scenes" | "overall">("characters");
  // 本地可编辑的分析结果（独立于 analysisData，避免影响轮询）
  const [editableResult, setEditableResult] = useState<ReferenceVideoAnalysisResult | null>(null);
  const [editableReversePrompts, setEditableReversePrompts] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setPolling(false);
  }, []);

  const startPolling = useCallback((id: string) => {
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const data = await analyzeApi.getAnalysis(id);
        setAnalysisData(data);
        if (data.status === "completed" && data.result) {
          // 初始化可编辑副本
          setEditableResult(JSON.parse(JSON.stringify(data.result)));
          setEditableReversePrompts([...(data.result.reverse_prompts || [])]);
          stopPolling();
        } else if (data.status === "failed") {
          stopPolling();
        }
      } catch {
        stopPolling();
      }
    }, 2000);
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("video/")) { toast.error("请上传视频文件"); return; }
    setUploading(true);
    setAnalysisData(null);
    setAnalysisId(null);
    setEditableResult(null);
    try {
      const res = await analyzeApi.uploadVideo(file);
      setAnalysisId(res.analysis_id);
      setAnalysisData(res);
      if (res.status === "processing") {
        startPolling(res.analysis_id);
      } else if (res.status === "completed" && res.result) {
        setEditableResult(JSON.parse(JSON.stringify(res.result)));
        setEditableReversePrompts([...(res.result.reverse_prompts || [])]);
      }
      toast.success("视频上传成功，Gemini 分析中...");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`上传失败: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  // 更新角色替换图，同时更新 editableResult 中的 replacement_image
  const handleReplaced = (characterId: number, imagePath: string) => {
    setEditableResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        characters: prev.characters.map(c =>
          c.character_id === characterId ? { ...c, replacement_image: imagePath } : c
        ),
      };
    });
  };

  // 更新角色 appearance_prompt
  const handlePromptChange = (characterId: number, prompt: string) => {
    setEditableResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        characters: prev.characters.map(c =>
          c.character_id === characterId ? { ...c, appearance_prompt: prompt } : c
        ),
      };
    });
  };

  // 更新分镜字段
  const handleSceneChange = (idx: number, field: keyof ReferenceScene, value: string | number) => {
    setEditableResult(prev => {
      if (!prev) return prev;
      const scenes = [...prev.scenes];
      scenes[idx] = { ...scenes[idx], [field]: value };
      return { ...prev, scenes };
    });
  };

  // 更新反推提示词
  const handleReversePromptChange = (idx: number, value: string) => {
    setEditableReversePrompts(prev => {
      const arr = [...prev];
      arr[idx] = value;
      return arr;
    });
  };

  // 更新整体字段
  const handleOverallChange = (field: keyof ReferenceVideoAnalysisResult, value: string) => {
    setEditableResult(prev => prev ? { ...prev, [field]: value } : prev);
  };

  if (!open) return null;

  const result = editableResult;

  return (
    <aside className="w-96 border-l border-border bg-white flex flex-col shrink-0 h-screen" style={{ minHeight: 0 }}>
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <ScanSearch size={15} style={{ color: "oklch(0.42 0.12 255)" }} />
          <span className="text-sm font-semibold text-foreground">对标视频分析</span>
          {analysisData?.status === "processing" && (
            <span className="flex items-center gap-1 text-xs text-blue-500">
              <Loader2 size={11} className="animate-spin" />分析中
            </span>
          )}
          {analysisData?.status === "completed" && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={11} />完成
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-auto">
        <div className="p-4 space-y-4 min-w-0">
          {/* 上传区 */}
          {!analysisData && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/50"
              }`}
            >
              <input ref={fileRef} type="file" accept="video/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={32} className="animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">上传中，请稍候...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "oklch(0.94 0.03 250)" }}>
                    <Upload size={24} style={{ color: "oklch(0.42 0.12 255)" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">上传对标视频</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      拖拽或点击上传，Gemini 自动分析<br />分镜结构、人物、风格、反推提示词
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {["分镜反推", "人物识别", "风格提取", "运镜分析"].map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 分析中 */}
          {analysisData?.status === "processing" && (
            <div className="rounded-xl border border-border p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
                <Loader2 size={24} className="animate-spin text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Gemini 正在分析视频</p>
                <p className="text-xs text-muted-foreground mt-1">通常需要 30-60 秒</p>
              </div>
            </div>
          )}

          {/* 分析失败 */}
          {analysisData?.status === "failed" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
              <AlertCircle size={20} className="text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-700 font-medium">分析失败</p>
              <p className="text-xs text-red-500 mt-1">{analysisData.error}</p>
              <button onClick={() => { setAnalysisData(null); setAnalysisId(null); setEditableResult(null); }}
                className="mt-3 text-xs text-red-600 underline">重新上传</button>
            </div>
          )}

          {/* 分析结果 */}
          {result && (
            <div className="space-y-4">
              {/* 视频概览（可编辑标题和风格） */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">视频标题</label>
                  <input
                    value={result.title}
                    onChange={(e) => handleOverallChange("title", e.target.value)}
                    className="w-full text-sm font-semibold px-2 py-1.5 rounded-md border border-border bg-background"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">风格</label>
                    <input value={result.style} onChange={(e) => handleOverallChange("style", e.target.value)}
                      className="w-full text-xs px-2 py-1 rounded border border-border bg-background" />
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground pt-4">
                    <span className="font-medium text-foreground">时长：</span>{result.total_duration.toFixed(0)}s
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="font-medium text-foreground">比例：</span>{result.aspect_ratio}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">BGM 风格</label>
                    <input value={result.bgm_style} onChange={(e) => handleOverallChange("bgm_style", e.target.value)}
                      className="w-full text-xs px-2 py-1 rounded border border-border bg-background" />
                  </div>
                </div>
              </div>

              {/* 标签切换 */}
              <div className="flex gap-1 p-1 bg-secondary rounded-lg">
                {(["characters", "scenes", "overall"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeTab === tab ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "characters" ? `人物 (${result.characters.length})` : tab === "scenes" ? `分镜 (${result.scenes.length})` : "整体"}
                  </button>
                ))}
              </div>

              {/* 人物替换（可编辑提示词，多图上传） */}
              {activeTab === "characters" && (
                <div className="space-y-3">
                  {result.characters.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">未检测到明显人物</p>
                  ) : (
                    result.characters.map((char) => (
                      <CharacterReplaceCard
                        key={char.character_id}
                        character={char}
                        analysisId={analysisId!}
                        onReplaced={handleReplaced}
                        onPromptChange={handlePromptChange}
                      />
                    ))
                  )}
                </div>
              )}

              {/* 分镜反推提示词（全部可编辑） */}
              {activeTab === "scenes" && (
                <div className="space-y-2">
                  {result.scenes.map((scene, idx) => (
                    <ScenePromptRow
                      key={scene.scene_id}
                      scene={scene}
                      reversePrompt={editableReversePrompts[idx] || ""}
                      index={idx}
                      onSceneChange={handleSceneChange}
                      onReversePromptChange={handleReversePromptChange}
                    />
                  ))}
                </div>
              )}

              {/* 整体风格（可编辑） */}
              {activeTab === "overall" && (
                <div className="space-y-3">
                  <EditableField
                    label="整体风格提示词"
                    value={result.overall_prompt}
                    onChange={(v) => handleOverallChange("overall_prompt", v)}
                    rows={4}
                    mono
                  />
                  <EditableField
                    label="调色风格"
                    value={result.color_grade}
                    onChange={(v) => handleOverallChange("color_grade", v)}
                    rows={2}
                  />
                </div>
              )}

              {/* 一键创建项目（使用编辑后的数据） */}
              <Button
                className="w-full gap-2"
                style={{ background: "oklch(0.22 0.06 250)" }}
                onClick={() => {
                  const finalResult = {
                    ...result,
                    reverse_prompts: editableReversePrompts,
                  };
                  onCreateProject(analysisId!, finalResult);
                  onClose();
                }}
              >
                <Sparkles size={14} />
                基于分析结果创建项目
              </Button>

              {/* 重新上传 */}
              <button
                onClick={() => { setAnalysisData(null); setAnalysisId(null); setEditableResult(null); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                重新上传其他视频
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

// ─── Agent 控制台 ──────────────────────────────────────────────────────────────
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
  const logPrefixes = { info: "·", success: "✓", warning: "⚠", error: "✗", progress: "→" };

  const stageSteps = [
    { key: "generating_script", icon: Sparkles, label: "脚本生成" },
    { key: "awaiting_review", icon: Pencil, label: "分镜审核" },
    { key: "generating_images", icon: Image, label: "首帧生图" },
    { key: "generating_audio", icon: Volume2, label: "配音生成" },
    { key: "generating_video", icon: Video, label: "视频生成" },
    { key: "assembling", icon: Scissors, label: "拼接成片" },
  ];
  const stageOrder = ["generating_script", "awaiting_review", "generating_images", "generating_audio", "generating_video", "assembling", "completed"];
  const currentIdx = stageOrder.indexOf(stage);

  if (collapsed) {
    return (
      <div className="w-12 border-l border-border bg-white flex flex-col items-center py-4 gap-3 shrink-0">
        <button onClick={onToggle} className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" title="展开控制台">
          <ChevronLeft size={16} />
        </button>
        <div className={`w-2 h-2 rounded-full ${
          stage === "failed" ? "bg-red-400" : stage === "completed" ? "bg-emerald-400" : stage === "idle" ? "bg-gray-300" : "bg-blue-400 animate-pulse"
        }`} title={STAGE_LABELS[stage]} />
      </div>
    );
  }

  return (
    <aside className="w-72 border-l border-border bg-white flex flex-col shrink-0 h-screen" style={{ minHeight: 0 }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            stage === "failed" ? "bg-red-400" : stage === "completed" ? "bg-emerald-400" : stage === "idle" ? "bg-gray-300" : "bg-blue-400 animate-pulse"
          }`} />
          <span className="text-sm font-semibold text-foreground">Agent 控制台</span>
        </div>
        <button onClick={onToggle} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 进度 */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-foreground">{STAGE_LABELS[stage]}</span>
          <span className="text-xs text-muted-foreground font-mono">{STAGE_PROGRESS[stage]}%</span>
        </div>
        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${STAGE_PROGRESS[stage]}%`, background: stage === "failed" ? "oklch(0.60 0.20 30)" : "oklch(0.60 0.20 255)" }} />
        </div>
        <div className="mt-3 space-y-1">
          {stageSteps.map((step) => {
            const stepIdx = stageOrder.indexOf(step.key);
            const isDone = currentIdx > stepIdx;
            const isCurrent = currentIdx === stepIdx;
            return (
              <div key={step.key} className={`flex items-center gap-2 py-0.5 ${isDone || isCurrent ? "opacity-100" : "opacity-30"}`}>
                <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${isDone ? "bg-emerald-100" : isCurrent ? "bg-blue-100" : "bg-secondary"}`}>
                  {isDone ? <CheckCircle2 size={10} className="text-emerald-600" /> : isCurrent ? <Loader2 size={10} className="text-blue-500 animate-spin" /> : <step.icon size={10} className="text-muted-foreground" />}
                </div>
                <span className={`text-xs ${isCurrent ? "text-foreground font-medium" : "text-muted-foreground"}`}>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 日志 */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-1 font-mono">
          {logs.map((log) => (
            <div key={log.id} className="text-xs leading-relaxed">
              <span className="text-muted-foreground/50 mr-2">{log.time}</span>
              <span className={`mr-1.5 ${logColors[log.level]}`}>{logPrefixes[log.level]}</span>
              <span className={logColors[log.level]}>{log.message}</span>
              {log.detail && <div className="pl-8 text-muted-foreground/60 text-xs mt-0.5">{log.detail}</div>}
            </div>
          ))}
          {stage !== "idle" && stage !== "completed" && stage !== "failed" && (
            <div className="text-xs text-muted-foreground/50 flex items-center gap-1">
              <span>{new Date().toLocaleTimeString("zh-CN", { hour12: false })}</span>
              <span className="animate-pulse">▋</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 完成操作 */}
      {stage === "completed" && (
        <div className="p-4 border-t border-border space-y-3 shrink-0">
          {!feedbackGiven && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">对本次生成结果评分</p>
              <div className="flex items-center justify-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onMouseEnter={() => setHoveredStar(star)} onMouseLeave={() => setHoveredStar(0)}
                    onClick={() => { onFeedback(star); setFeedbackGiven(true); toast.success(`感谢评分 ${star} 星！`); }}
                    className="transition-transform hover:scale-110">
                    <Star size={18} className={star <= hoveredStar ? "text-amber-400 fill-amber-400" : "text-muted-foreground"} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {feedbackGiven && <p className="text-xs text-center text-emerald-600">✓ 评分已记录</p>}
          <Button className="w-full gap-2 text-sm" onClick={onDownload} style={{ background: "oklch(0.22 0.06 250)" }}>
            <Download size={14} />下载成片 MP4
          </Button>
          <Button variant="outline" className="w-full gap-2 text-sm" onClick={onExportDraft}>
            <Scissors size={14} />导出剪映草稿
          </Button>
        </div>
      )}

      {stage === "failed" && (
        <div className="p-4 border-t border-border shrink-0">
          <div className="flex items-center gap-2 text-red-500 mb-3">
            <AlertCircle size={14} />
            <span className="text-xs font-medium">生成失败</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">请检查 API Keys 配置，或查看日志了解详情。</p>
          <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={() => window.location.reload()}>
            <RefreshCw size={12} />重试
          </Button>
        </div>
      )}
    </aside>
  );
}

// ─── 主页面 ────────────────────────────────────────────────────────────────────
export default function Studio() {
  const params = useParams<{ projectId?: string }>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [analysisPanelOpen, setAnalysisPanelOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [referenceImages, setReferenceImages] = useState<UploadResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [input, setInput] = useState("");
  const [engine, setEngine] = useState<"kling" | "seedance" | "auto">("kling");
  const [multiShot, setMultiShot] = useState(true);
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { state: workflow, startWorkflow, submitReview, updateScene, submitFeedback, reset, restoreProject } = useWorkflow();
  const { projects, refetch: refetchProjects } = useProjects();

  const addChatMessage = useCallback((role: "user" | "assistant", content: string) => {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, role, content, timestamp: new Date() }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (params.projectId) restoreProject(params.projectId);
  }, [params.projectId]);

  useEffect(() => {
    const stage = workflow.stage;
    const script = workflow.script;
    if (stage === "awaiting_review" && script) {
      addChatMessage("assistant", `脚本生成完成！共 **${script.scenes.length} 个分镜**，总时长约 **${script.total_duration.toFixed(0)} 秒**。\n\n标题：《${script.title}》\n\n请在下方审核每个分镜，展开可编辑旁白/画面描述/运动描述，确认后点击「确认，开始生成」。`);
    } else if (stage === "generating_images") {
      addChatMessage("assistant", "✅ 脚本已确认！正在并行生成首帧图像和 TTS 配音...");
    } else if (stage === "generating_video") {
      addChatMessage("assistant", "🎨 首帧和配音生成完成！正在调用 Kling Omni 视频引擎...");
    } else if (stage === "assembling") {
      addChatMessage("assistant", "🎬 所有片段生成完毕！正在拼接成片...");
    } else if (stage === "completed" && workflow.result) {
      addChatMessage("assistant", `🎉 视频生成完成！成片时长：**${workflow.result.total_duration.toFixed(1)} 秒**\n\n右侧控制台可下载 MP4 或导出剪映草稿。`);
      refetchProjects();
    } else if (stage === "failed" && workflow.error) {
      addChatMessage("assistant", `❌ 生成失败：${workflow.error}\n\n请检查 API Keys 配置后重试。`);
    }
  }, [workflow.stage, addChatMessage, refetchProjects]);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/health`, { signal: AbortSignal.timeout(3000) });
        setBackendOnline(res.ok);
      } catch { setBackendOnline(false); }
    };
    check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, []);

  // 支持多张图片同时上传
  const handleUploadReference = async (files: File[]) => {
    setIsUploading(true);
    let successCount = 0;
    try {
      for (const file of files) {
        try {
          const result = await uploadApi.uploadReference(file);
          setReferenceImages((prev) => [...prev, result]);
          successCount++;
        } catch (err) {
          toast.error(`${file.name} 上传失败：${err instanceof Error ? err.message : "未知错误"}`);
        }
      }
      if (successCount > 0) {
        toast.success(successCount === 1 ? "参考图上传成功" : `${successCount} 张参考图上传成功`);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    reset();
    setMessages([]);

    addChatMessage("user", text);
    const durationMatch = text.match(/(\d+)\s*秒/);
    const duration = durationMatch ? parseInt(durationMatch[1]) : 60;
    const refInfo = referenceImages.length > 0 ? `\n**角色参考图**：${referenceImages.length} 张` : "";
    addChatMessage("assistant", `好的！\n\n**主题**：${text}\n**目标时长**：${duration}s\n**视频引擎**：${engine === "auto" ? "智能路由" : engine.toUpperCase()}\n**Multi-Shot**：${multiShot ? "开启" : "关闭"}${refInfo}\n\n正在生成分镜脚本...`);

    try {
      await startWorkflow({ topic: text, duration, engine, addSubtitles: true, referenceImages: referenceImages.map(r => r.path), style: undefined });
    } catch (err) {
      addChatMessage("assistant", `❌ 工作流启动失败：${err instanceof Error ? err.message : "启动失败"}\n\n请确认后端服务已启动。`);
    }
  };

  const handleCreateProjectFromAnalysis = async (_analysisId: string, result: ReferenceVideoAnalysisResult) => {
    reset();
    setMessages([]);
    const replacedChars = result.characters.filter(c => c.replacement_image);
    addChatMessage("assistant", `对标视频分析完成！正在基于分析结果创建项目...\n\n**标题**：${result.title}\n**分镜数**：${result.scenes.length} 个\n**人物替换**：${replacedChars.length > 0 ? replacedChars.map(c => c.name).join("、") : "无"}\n\n正在生成脚本...`);
    try {
      await startWorkflow({
        topic: result.title,
        duration: Math.round(result.total_duration) || 60,
        engine: "kling",
        addSubtitles: true,
        referenceImages: replacedChars.filter(c => c.replacement_image).map(c => c.replacement_image as string),
        style: result.overall_prompt || result.style || undefined,
      });
    } catch (err) {
      addChatMessage("assistant", `❌ 工作流启动失败：${err instanceof Error ? err.message : "启动失败"}`);
    }
  };

  const isGenerating = workflow.stage !== "idle" && workflow.stage !== "awaiting_review" && workflow.stage !== "completed" && workflow.stage !== "failed";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "oklch(0.955 0.012 240)" }}>
      {/* 左侧导航 */}
      <SidebarNav
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        projects={projects}
        onSelectProject={(id) => { reset(); setMessages([]); restoreProject(id); }}
      />

      {/* 中间主区 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 顶部标题栏 */}
        <div className="px-6 py-3 border-b border-border bg-white flex items-center justify-between shrink-0">
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif" }} className="text-lg font-semibold text-foreground">创作工作台</h2>
            <p className="text-xs text-muted-foreground mt-0.5">输入创意，AI 全自动完成脚本·配音·视频·成片</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {backendOnline ? <Wifi size={13} className="text-emerald-500" /> : <WifiOff size={13} className="text-muted-foreground" />}
              <span className="text-xs text-muted-foreground">{backendOnline ? "后端已连接" : "后端未连接"}</span>
            </div>
            {workflow.stage === "awaiting_review" && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => { submitReview(false); addChatMessage("assistant", "已取消。"); }} className="gap-1.5 text-xs">
                  <X size={12} />取消
                </Button>
                <Button size="sm" onClick={() => submitReview(true)} className="gap-1.5 text-xs" style={{ background: "oklch(0.22 0.06 250)" }}>
                  <CheckCircle2 size={12} />确认脚本，开始生成
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 角色参考图横排 */}
        <CharacterRail
          referenceImages={referenceImages}
          onAdd={handleUploadReference}
          onRemove={(idx) => setReferenceImages(prev => prev.filter((_, i) => i !== idx))}
          isUploading={isUploading}
        />

        {/* 消息区（flex-1 + overflow-y-auto 确保可滚动） */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-full py-12 px-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: "oklch(0.94 0.03 250)" }}>
                <Sparkles size={28} style={{ color: "oklch(0.42 0.12 255)" }} />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                开始创作你的视频
              </h3>
              <p className="text-sm text-muted-foreground text-center mb-8 max-w-xs leading-relaxed">
                在下方输入创意，或点击「对标分析」上传参考视频，AI 自动完成全部工作
              </p>
              <div className="grid grid-cols-3 gap-3 w-full max-w-lg">
                {[
                  { icon: Sparkles, title: "一句话生成", desc: "输入主题，自动生成脚本·配音·视频" },
                  { icon: ScanSearch, title: "对标视频分析", desc: "上传参考视频，反推提示词+人物替换" },
                  { icon: Layers, title: "Multi-Shot 模式", desc: "Kling Omni 多分镜连贯生成" },
                ].map(f => (
                  <div key={f.title} className="p-4 rounded-xl border border-border bg-white text-center hover:shadow-sm transition-shadow">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "oklch(0.94 0.03 250)" }}>
                      <f.icon size={18} style={{ color: "oklch(0.42 0.12 255)" }} />
                    </div>
                    <div className="text-xs font-semibold text-foreground mb-1">{f.title}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-primary" : "bg-secondary"}`}>
                    {msg.role === "user" ? <User size={14} className="text-primary-foreground" /> : <Bot size={14} className="text-foreground" />}
                  </div>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-white text-foreground rounded-tl-sm border border-border"
                    }`}
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* 分镜审核区（嵌入主区，有自己的滚动） */}
        {workflow.requiresReview && workflow.scenes.length > 0 && (
          <SceneReviewPanel
            scenes={workflow.scenes}
            onUpdate={updateScene}
            onApprove={() => submitReview(true)}
            onCancel={() => { submitReview(false); addChatMessage("assistant", "已取消。"); }}
          />
        )}

        {/* 输入区 */}
        <div className="px-6 py-4 border-t border-border bg-white shrink-0">
          <div className="flex items-end gap-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={isGenerating ? "视频生成中，请稍候..." : "描述你想要的视频内容，例如：一个科技产品发布会，蓝紫色调，30秒"}
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
              {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </Button>
          </div>
        </div>

        {/* 底部工具栏 */}
        <BottomToolbar
          engine={engine}
          onEngineChange={setEngine}
          multiShot={multiShot}
          onMultiShotChange={setMultiShot}
          resolution={resolution}
          onResolutionChange={setResolution}
          onAnalyzeVideo={() => setAnalysisPanelOpen(true)}
          isGenerating={isGenerating}
          isConnected={backendOnline}
          stage={workflow.stage}
        />
      </div>

      {/* 对标视频分析面板 */}
      <AnalysisPanel
        open={analysisPanelOpen}
        onClose={() => setAnalysisPanelOpen(false)}
        onCreateProject={handleCreateProjectFromAnalysis}
      />

      {/* Agent 控制台 */}
      <AgentConsole
        logs={workflow.logs}
        stage={workflow.stage}
        collapsed={consoleCollapsed}
        onToggle={() => setConsoleCollapsed(!consoleCollapsed)}
        projectId={workflow.projectId}
        onDownload={async () => {
          if (!workflow.projectId) return;
          window.open(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/projects/${workflow.projectId}/download/video`, "_blank");
        }}
        onExportDraft={async () => {
          if (!workflow.projectId) return;
          window.open(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/projects/${workflow.projectId}/download/draft`, "_blank");
        }}
        onFeedback={submitFeedback}
      />
    </div>
  );
}
