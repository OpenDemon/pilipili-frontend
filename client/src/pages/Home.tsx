/*
 * Home.tsx — 噼哩噼哩 产品首页
 * Design: Seedance 2.0 inspired — soft blue-grey bg, white cards, serif headings
 */

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Zap,
  ArrowRight,
  Sparkles,
  Image,
  Volume2,
  Video,
  Scissors,
  Brain,
  CheckCircle2,
  Film,
  Settings,
  ScanSearch,
  Layers,
  User,
} from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    title: "智能脚本策划",
    desc: "输入一句话，AI 自动生成结构化分镜脚本，支持 DeepSeek、Kimi、Gemini 等多种大模型。",
  },
  {
    icon: ScanSearch,
    title: "对标视频分析",
    desc: "上传任意参考视频，Gemini 自动反推每个分镜的提示词、识别人物、分析风格，一键复用。",
  },
  {
    icon: User,
    title: "人物替换工作流",
    desc: "上传角色参考图（支持四宫格三视图），Kling Omni 多参考模式保持全片人物高度一致。",
  },
  {
    icon: Layers,
    title: "Kling Omni Multi-Shot",
    desc: "全新 Kling 3.0 Omni 引擎，支持多参考生视频、首尾帧、shot_type intelligence，分镜更连贯。",
  },
  {
    icon: Volume2,
    title: "动态音画对齐",
    desc: "先生成 MiniMax TTS 配音并测量精确时长，再以此控制视频 duration，音画永远同步。",
  },
  {
    icon: Scissors,
    title: "剪映分轨草稿",
    desc: "每个分镜独立轨道，自动生成剪映草稿，导入即可在时间线上精细调整，无需手动整理素材。",
  },
  {
    icon: Image,
    title: "首帧精确锁定",
    desc: "先用 Nano Banana 生成 4K 关键帧图像，再用图生视频，画质下限极高，主体不漂移。",
  },
  {
    icon: Sparkles,
    title: "越用越懂你",
    desc: "Mem0 记忆系统自动学习你的风格偏好，每次生成都会注入你的历史创作习惯。",
  },
];

const WORKFLOW_STEPS = [
  { step: "01", label: "输入创意 / 上传对标视频", desc: "一句话描述，或上传参考视频让 AI 反推分镜" },
  { step: "02", label: "审核分镜", desc: "确认 AI 生成的脚本，可编辑每个分镜的旁白和提示词" },
  { step: "03", label: "自动生成", desc: "并行生成首帧图像、TTS 配音、Kling Omni 视频" },
  { step: "04", label: "成片交付", desc: "下载 MP4 成片 + 剪映分轨草稿双输出" },
];

const VS_TABLE = [
  { dim: "交互范式", libtv: "节点画布，手动触发", huobao: "表单填写，按步操作", ours: "自然语言对话 + 对标视频分析，一句话驱动" },
  { dim: "对标视频反推", libtv: "无", huobao: "无", ours: "Gemini 自动分析分镜结构、反推提示词、识别人物" },
  { dim: "人物一致性", libtv: "提示词引导", huobao: "参考图上传", ours: "四宫格三视图 + Kling Omni 多参考模式" },
  { dim: "视频引擎", libtv: "Kling 1.x", huobao: "单引擎", ours: "Kling 3.0 Omni + Seedance 1.5 双引擎智能路由" },
  { dim: "音画同步", libtv: "手动剪辑对齐", huobao: "未明确支持", ours: "先测配音时长，再控视频 duration" },
  { dim: "最终交付", libtv: "手动下载导入剪映", huobao: "压制 MP4", ours: "剪映分轨草稿 + MP4 双输出" },
  { dim: "记忆系统", libtv: "无", huobao: "无", ours: "Mem0 数字孪生，越用越懂你" },
  { dim: "Agent 调用", libtv: "无", huobao: "无", ours: "封装为标准 Skill，可被任意 Agent 调用" },
];

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: "oklch(0.955 0.012 240)" }}>
      {/* Nav */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.22 0.06 250)" }}>
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <span style={{ fontFamily: "'Playfair Display', serif" }} className="font-bold text-foreground">噼哩噼哩</span>
              <span className="text-xs text-muted-foreground ml-2">Pilipili-AutoVideo</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/settings">
              <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Settings size={15} />
                配置 API
              </button>
            </Link>
            <Link href="/studio">
              <Button style={{ background: "oklch(0.22 0.06 250)" }} className="gap-2">
                <Film size={15} />
                进入工作台
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="badge-pill mx-auto mb-6">
          <Sparkles size={10} />
          全自动 AI 视频代理 · 本地部署
        </div>
        <h1
          style={{ fontFamily: "'Playfair Display', serif" }}
          className="text-6xl font-bold text-foreground mb-6 leading-tight"
        >
          一句话，
          <br />
          <span style={{ color: "oklch(0.40 0.12 255)" }}>从创意到成片</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          噼哩噼哩是一个完全部署在本地的全自动 AI 视频代理。输入一句话，系统自动完成脚本策划、分镜生成、配音制作、视频合成，最终输出带字幕的成品视频或剪映草稿。
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/studio">
            <Button size="lg" style={{ background: "oklch(0.22 0.06 250)" }} className="gap-2 px-8">
              开始创作
              <ArrowRight size={16} />
            </Button>
          </Link>
          <Link href="/settings">
            <Button size="lg" variant="outline" className="gap-2 px-8">
              配置 API Key
            </Button>
          </Link>
        </div>
      </section>

      {/* Workflow steps */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-4 gap-4">
          {WORKFLOW_STEPS.map((s, i) => (
            <div key={s.step} className="card-white p-6 relative">
              <div className="text-4xl font-bold font-mono mb-3" style={{ color: "oklch(0.88 0.015 240)" }}>
                {s.step}
              </div>
              <div className="text-base font-semibold text-foreground mb-1">{s.label}</div>
              <div className="text-sm text-muted-foreground">{s.desc}</div>
              {i < WORKFLOW_STEPS.length - 1 && (
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 z-10">
                  <ArrowRight size={16} className="text-muted-foreground/40" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="text-center mb-10">
          <h2 style={{ fontFamily: "'Playfair Display', serif" }} className="text-3xl font-bold text-foreground mb-3">
            核心能力
          </h2>
          <p className="text-muted-foreground">每一个环节都经过精心设计，确保最终成片质量</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card-white p-6 hover:shadow-md transition-shadow">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "oklch(0.93 0.015 240)" }}
              >
                <f.icon size={20} style={{ color: "oklch(0.40 0.12 255)" }} />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison table */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="text-center mb-10">
          <h2 style={{ fontFamily: "'Playfair Display', serif" }} className="text-3xl font-bold text-foreground mb-3">
            与同类产品对比
          </h2>
          <p className="text-muted-foreground">在保持相同生图、生视频效果的前提下，做到更极致的自动化</p>
        </div>
        <div className="card-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-4 text-muted-foreground font-medium w-1/4">对比维度</th>
                <th className="text-center px-6 py-4 text-muted-foreground font-medium">LibTV</th>
                <th className="text-center px-6 py-4 text-muted-foreground font-medium">火宝短剧</th>
                <th className="text-center px-6 py-4 font-semibold" style={{ color: "oklch(0.22 0.06 250)" }}>
                  噼哩噼哩 ✦
                </th>
              </tr>
            </thead>
            <tbody>
              {VS_TABLE.map((row, i) => (
                <tr key={row.dim} className={i % 2 === 0 ? "bg-secondary/20" : ""}>
                  <td className="px-6 py-3.5 font-medium text-foreground">{row.dim}</td>
                  <td className="px-6 py-3.5 text-center text-muted-foreground">{row.libtv}</td>
                  <td className="px-6 py-3.5 text-center text-muted-foreground">{row.huobao}</td>
                  <td className="px-6 py-3.5 text-center">
                    <span className="flex items-center justify-center gap-1.5" style={{ color: "oklch(0.40 0.12 255)" }}>
                      <CheckCircle2 size={13} />
                      {row.ours}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: "oklch(0.22 0.06 250)" }}
        >
          <h2 style={{ fontFamily: "'Playfair Display', serif" }} className="text-3xl font-bold text-white mb-4">
            准备好了吗？
          </h2>
          <p className="text-white/70 mb-8 text-base">
            配置好 API Key 后，输入一句话，噼哩噼哩会帮你完成剩下的一切。
          </p>
          <Link href="/studio">
            <Button size="lg" className="gap-2 px-10 bg-white hover:bg-white/90" style={{ color: "oklch(0.22 0.06 250)" }}>
              立即开始
              <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-white py-6 text-center">
        <p className="text-xs text-muted-foreground">
          噼哩噼哩 Pilipili-AutoVideo · 本地部署 · 全自动 AI 视频代理
        </p>
      </footer>
    </div>
  );
}
