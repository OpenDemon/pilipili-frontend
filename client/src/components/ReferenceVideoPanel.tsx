/**
 * ReferenceVideoPanel - 对标视频分析面板
 *
 * 设计哲学：工业感暗色调，信息密度高，操作流程清晰
 * 功能：
 * 1. 上传对标视频 → Gemini 分析
 * 2. 展示分析结果：人物列表 + 分镜结构 + 反推提示词
 * 3. 人物替换：为每个人物上传替换参考图（支持四宫格提示）
 * 4. 一键基于分析结果创建新项目
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  analyzeApi,
  type ReferenceAnalysisResponse,
  type ReferenceVideoAnalysisResult,
  type CharacterInfo,
  type ReferenceScene,
  type ShotMode,
} from "@/lib/api";
import { toast } from "sonner";

// ─── Shot Mode 标签 ────────────────────────────────────────────────────────────

const SHOT_MODE_CONFIG: Record<ShotMode, { label: string; color: string; desc: string }> = {
  multi_ref: {
    label: "多参考",
    color: "bg-violet-500/20 text-violet-300 border-violet-500/40",
    desc: "角色参考图生视频，保持人物一致性",
  },
  first_end_frame: {
    label: "首尾帧",
    color: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    desc: "指定起止画面，AI 补中间动画",
  },
  t2v: {
    label: "文生视频",
    color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    desc: "纯文字生成，适合风景/氛围镜头",
  },
  i2v: {
    label: "图生视频",
    color: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    desc: "关键帧图片生成视频",
  },
};

function ShotModeBadge({ mode }: { mode?: ShotMode }) {
  if (!mode) return null;
  const cfg = SHOT_MODE_CONFIG[mode];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono ${cfg.color}`}
      title={cfg.desc}
    >
      {cfg.label}
    </span>
  );
}

// ─── 复制按钮 ──────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-2 px-2 py-0.5 rounded text-xs border border-white/10 text-zinc-400 hover:text-white hover:border-white/30 transition-colors"
    >
      {copied ? "已复制" : "复制"}
    </button>
  );
}

// ─── 人物替换卡片 ──────────────────────────────────────────────────────────────

interface CharacterCardProps {
  character: CharacterInfo;
  analysisId: string;
  onReplaced: (characterId: number, imagePath: string) => void;
}

function CharacterCard({ character, analysisId, onReplaced }: CharacterCardProps) {
  const [uploading, setUploading] = useState(false);
  const [replaced, setReplaced] = useState(!!character.replacement_image);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await analyzeApi.replaceCharacter(analysisId, character.character_id, file);
      setReplaced(true);
      onReplaced(character.character_id, result.path);
      toast.success(`${character.name} 替换参考图已上传`);
    } catch (err: unknown) {
      toast.error(`上传失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3">
      {/* 人物标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
            {character.character_id}
          </div>
          <span className="font-medium text-white text-sm">{character.name}</span>
        </div>
        {replaced && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            已替换
          </span>
        )}
      </div>

      {/* 外貌描述 */}
      <p className="text-xs text-zinc-400 leading-relaxed">{character.description}</p>

      {/* 英文提示词 */}
      <div className="rounded bg-black/30 p-2 border border-white/5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-zinc-300 font-mono leading-relaxed flex-1">
            {character.appearance_prompt}
          </p>
          <CopyButton text={character.appearance_prompt} />
        </div>
      </div>

      {/* 四宫格提示 */}
      <div className="rounded bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-300 leading-relaxed">
        <span className="font-semibold">角色一致性提示：</span>
        建议上传"正/侧/背"三视图或四宫格图片（可在 NanoBanana / 豆包中生成），
        以提升多分镜中的人物一致性。
      </div>

      {/* 上传替换参考图 */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className={`w-full py-2 rounded-lg text-sm font-medium border transition-all ${
          replaced
            ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
            : "border-violet-500/50 text-violet-300 hover:bg-violet-500/10"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            上传中...
          </span>
        ) : replaced ? (
          "重新上传替换参考图"
        ) : (
          "上传替换参考图（图片/视频）"
        )}
      </button>
    </div>
  );
}

// ─── 分镜反推提示词卡片 ────────────────────────────────────────────────────────

interface ScenePromptCardProps {
  scene: ReferenceScene;
  reversePrompt: string;
  index: number;
}

function ScenePromptCard({ scene, reversePrompt, index }: ScenePromptCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
      {/* 分镜头部 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-500 w-6">#{index + 1}</span>
          <ShotModeBadge mode={scene.shot_mode} />
          <span className="text-xs text-zinc-400">
            {scene.duration}s
          </span>
          <span className="text-xs text-zinc-300 truncate max-w-[200px]">
            {scene.voiceover || scene.image_prompt.slice(0, 40) + "..."}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5">
          {/* 旁白文案 */}
          {scene.voiceover && (
            <div className="pt-3">
              <p className="text-xs text-zinc-500 mb-1">旁白文案</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{scene.voiceover}</p>
            </div>
          )}

          {/* 反推提示词（最重要的输出） */}
          <div className="rounded-lg bg-violet-500/5 border border-violet-500/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-violet-400 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                反推提示词（可直接复用）
              </p>
              <CopyButton text={reversePrompt} />
            </div>
            <p className="text-xs text-zinc-300 font-mono leading-relaxed">{reversePrompt}</p>
          </div>

          {/* 生图提示词 */}
          <div className="rounded bg-black/30 border border-white/5 p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-zinc-500">生图提示词</p>
              <CopyButton text={scene.image_prompt} />
            </div>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed">{scene.image_prompt}</p>
          </div>

          {/* 运动提示词 */}
          <div className="rounded bg-black/30 border border-white/5 p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-zinc-500">运动提示词</p>
              <CopyButton text={scene.video_prompt} />
            </div>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed">{scene.video_prompt}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 主组件 ────────────────────────────────────────────────────────────────────

interface ReferenceVideoPanelProps {
  onCreateProject?: (analysisId: string, result: ReferenceVideoAnalysisResult) => void;
}

export default function ReferenceVideoPanel({ onCreateProject }: ReferenceVideoPanelProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<ReferenceAnalysisResponse | null>(null);
  const [polling, setPolling] = useState(false);
  const [activeTab, setActiveTab] = useState<"characters" | "scenes" | "style">("characters");
  const [characters, setCharacters] = useState<CharacterInfo[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 轮询分析结果
  useEffect(() => {
    if (!analysisId || !polling) return;

    pollRef.current = setInterval(async () => {
      try {
        const data = await analyzeApi.getResult(analysisId);
        setAnalysisData(data);

        if (data.status === "completed") {
          setPolling(false);
          setCharacters(data.result?.characters || []);
          toast.success("对标视频分析完成！");
        } else if (data.status === "failed") {
          setPolling(false);
          toast.error(`分析失败: ${data.error?.slice(0, 100)}`);
        }
      } catch (err) {
        console.error("轮询失败:", err);
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [analysisId, polling]);

  const handleUpload = useCallback(async (file: File) => {
    const videoExts = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!videoExts.includes(ext)) {
      toast.error(`不支持的格式: ${ext}，请上传视频文件`);
      return;
    }

    setUploading(true);
    setAnalysisData(null);
    setAnalysisId(null);
    setCharacters([]);

    try {
      const result = await analyzeApi.uploadVideo(file);
      setAnalysisId(result.analysis_id);
      setPolling(true);
      setAnalysisData({
        analysis_id: result.analysis_id,
        status: "processing",
        filename: file.name,
      });
      toast.info("视频已上传，Gemini 正在分析中...");
    } catch (err: unknown) {
      toast.error(`上传失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCharacterReplaced = (characterId: number, imagePath: string) => {
    setCharacters(prev =>
      prev.map(c =>
        c.character_id === characterId ? { ...c, replacement_image: imagePath } : c
      )
    );
    if (analysisData?.result) {
      setAnalysisData(prev => prev ? {
        ...prev,
        result: prev.result ? {
          ...prev.result,
          characters: prev.result.characters.map(c =>
            c.character_id === characterId ? { ...c, replacement_image: imagePath } : c
          )
        } : prev.result
      } : prev);
    }
  };

  const handleCreateProject = () => {
    if (!analysisId || !analysisData?.result) return;
    onCreateProject?.(analysisId, analysisData.result);
  };

  const result = analysisData?.result;

  return (
    <div className="flex flex-col h-full">
      {/* 上传区域 */}
      {!analysisData && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-4 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all
            ${dragOver
              ? "border-violet-500 bg-violet-500/10"
              : "border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]"
            }
            ${uploading ? "pointer-events-none opacity-60" : ""}
          `}
        >
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {uploading ? (
            <>
              <svg className="animate-spin w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-zinc-400">上传中...</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
                <svg className="w-7 h-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-300">拖拽或点击上传对标视频</p>
                <p className="text-xs text-zinc-500 mt-1">支持 MP4 / MOV / AVI / MKV / WebM</p>
                <p className="text-xs text-zinc-600 mt-0.5">Gemini 将自动分析人物、分镜和反推提示词</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* 分析中状态 */}
      {analysisData?.status === "processing" && (
        <div className="flex flex-col items-center justify-center gap-4 py-10">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-violet-500/30 flex items-center justify-center">
              <svg className="animate-spin w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-violet-500/10 animate-ping" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-300">Gemini 正在分析视频...</p>
            <p className="text-xs text-zinc-500 mt-1">正在识别人物、分解分镜、生成反推提示词</p>
            <p className="text-xs text-zinc-600 mt-0.5">{analysisData.filename}</p>
          </div>
          <button
            onClick={() => {
              setAnalysisData(null);
              setAnalysisId(null);
              setPolling(false);
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            取消，重新上传
          </button>
        </div>
      )}

      {/* 分析结果 */}
      {analysisData?.status === "completed" && result && (
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* 视频概览 */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-sm truncate">{result.title}</h3>
                <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{result.style}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-xs text-zinc-500">{result.aspect_ratio}</span>
                <span className="text-xs text-zinc-500">{result.total_duration.toFixed(1)}s</span>
              </div>
            </div>

            {/* 元数据标签 */}
            <div className="flex flex-wrap gap-2 mt-3">
              {result.color_grade && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {result.color_grade}
                </span>
              )}
              {result.bgm_style && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  {result.bgm_style}
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10">
                {result.scenes.length} 个分镜
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10">
                {result.characters.length} 个人物
              </span>
            </div>

            {/* 整体风格提示词 */}
            {result.overall_prompt && (
              <div className="mt-3 rounded-lg bg-black/30 border border-white/5 p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-zinc-500">整体风格提示词</p>
                  <CopyButton text={result.overall_prompt} />
                </div>
                <p className="text-xs text-zinc-400 font-mono leading-relaxed">{result.overall_prompt}</p>
              </div>
            )}
          </div>

          {/* 标签页切换 */}
          <div className="flex gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/10">
            {(["characters", "scenes", "style"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab
                    ? "bg-violet-600 text-white"
                    : "text-zinc-400 hover:text-zinc-300"
                }`}
              >
                {tab === "characters" ? `人物 (${result.characters.length})` :
                 tab === "scenes" ? `分镜 (${result.scenes.length})` :
                 "风格参考"}
              </button>
            ))}
          </div>

          {/* 标签页内容 */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* 人物标签页 */}
            {activeTab === "characters" && (
              <>
                {result.characters.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-sm">
                    未识别到人物（可能是纯风景视频）
                  </div>
                ) : (
                  result.characters.map((char) => (
                    <CharacterCard
                      key={char.character_id}
                      character={characters.find(c => c.character_id === char.character_id) || char}
                      analysisId={analysisId!}
                      onReplaced={handleCharacterReplaced}
                    />
                  ))
                )}
              </>
            )}

            {/* 分镜标签页 */}
            {activeTab === "scenes" && (
              <>
                {/* shot_mode 图例 */}
                <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
                  <p className="text-xs text-zinc-500 mb-2">生成模式说明</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.entries(SHOT_MODE_CONFIG) as [ShotMode, typeof SHOT_MODE_CONFIG[ShotMode]][]).map(([mode, cfg]) => (
                      <div key={mode} className="flex items-center gap-1.5">
                        <ShotModeBadge mode={mode} />
                        <span className="text-xs text-zinc-500 truncate">{cfg.desc.slice(0, 12)}...</span>
                      </div>
                    ))}
                  </div>
                </div>

                {result.scenes.map((scene, i) => (
                  <ScenePromptCard
                    key={scene.scene_id}
                    scene={scene}
                    reversePrompt={result.reverse_prompts[i] || scene.image_prompt}
                    index={i}
                  />
                ))}
              </>
            )}

            {/* 风格参考标签页 */}
            {activeTab === "style" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <h4 className="text-xs font-semibold text-zinc-400 mb-2">整体风格</h4>
                  <p className="text-sm text-zinc-300 leading-relaxed">{result.style}</p>
                </div>

                {result.overall_prompt && (
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-violet-400">整体风格提示词（可直接复用）</h4>
                      <CopyButton text={result.overall_prompt} />
                    </div>
                    <p className="text-xs text-zinc-300 font-mono leading-relaxed">{result.overall_prompt}</p>
                  </div>
                )}

                {/* 所有反推提示词汇总 */}
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-zinc-400">全部反推提示词</h4>
                    <CopyButton text={result.reverse_prompts.join("\n\n")} />
                  </div>
                  <div className="space-y-2">
                    {result.reverse_prompts.map((prompt, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-xs text-zinc-600 font-mono shrink-0 w-5">#{i + 1}</span>
                        <p className="text-xs text-zinc-400 font-mono leading-relaxed">{prompt}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 底部操作区 */}
          <div className="flex gap-2 pt-2 border-t border-white/10">
            <button
              onClick={() => {
                setAnalysisData(null);
                setAnalysisId(null);
                setCharacters([]);
              }}
              className="flex-1 py-2 rounded-lg text-sm border border-white/10 text-zinc-400 hover:text-zinc-300 hover:border-white/20 transition-all"
            >
              重新上传
            </button>
            <button
              onClick={handleCreateProject}
              className="flex-[2] py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              基于此分析创建项目
            </button>
          </div>
        </div>
      )}

      {/* 分析失败 */}
      {analysisData?.status === "failed" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm text-red-400 font-medium">分析失败</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              {analysisData.error?.slice(0, 150)}
            </p>
          </div>
          <button
            onClick={() => { setAnalysisData(null); setAnalysisId(null); }}
            className="px-4 py-2 rounded-lg text-sm border border-white/10 text-zinc-400 hover:text-zinc-300 transition-all"
          >
            重新上传
          </button>
        </div>
      )}
    </div>
  );
}
