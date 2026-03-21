/*
 * Settings.tsx — API 连接器配置页面
 * Design: Seedance 2.0 inspired — soft blue-grey bg, white cards
 */

import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft,
  Zap,
  Check,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";

interface ApiConfig {
  id: string;
  category: string;
  name: string;
  description: string;
  placeholder: string;
  docsUrl: string;
  value: string;
  enabled: boolean;
}

const API_CONFIGS: ApiConfig[] = [
  {
    id: "deepseek",
    category: "大脑层 (LLM)",
    name: "DeepSeek",
    description: "脚本生成、分镜拆解、Metadata 生成（默认推荐，性价比最高）",
    placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    docsUrl: "https://platform.deepseek.com/api_keys",
    value: "",
    enabled: true,
  },
  {
    id: "kimi",
    category: "大脑层 (LLM)",
    name: "Kimi (Moonshot)",
    description: "适合长文本处理，小说/剧本转分镜脚本",
    placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    docsUrl: "https://platform.moonshot.cn/console/api-keys",
    value: "",
    enabled: false,
  },
  {
    id: "minimax_llm",
    category: "大脑层 (LLM)",
    name: "MiniMax",
    description: "对话与情绪表达最强，适合情感类内容",
    placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
    docsUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    value: "",
    enabled: false,
  },
  {
    id: "gemini",
    category: "大脑层 (LLM)",
    name: "Google Gemini",
    description: "多模态理解，支持图片/视频输入转脚本",
    placeholder: "AIzaSyxxxxxxxxxxxxxxxxxxxxxxxx",
    docsUrl: "https://aistudio.google.com/app/apikey",
    value: "",
    enabled: false,
  },
  {
    id: "nano_banana",
    category: "视觉层 (生图)",
    name: "Nano Banana (Gemini 3 Pro Image)",
    description: "4K 首帧锁定，主体一致性基础，目前最强文生图 API",
    placeholder: "AIzaSyxxxxxxxxxxxxxxxxxxxxxxxx",
    docsUrl: "https://aistudio.google.com/app/apikey",
    value: "",
    enabled: true,
  },
  {
    id: "kling",
    category: "动态层 (视频)",
    name: "Kling 3.0",
    description: "动作/产品/抖音短视频首选，动态能量强，渲染快",
    placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
    docsUrl: "https://app.klingai.com/global/dev/document-api",
    value: "",
    enabled: true,
  },
  {
    id: "seedance",
    category: "动态层 (视频)",
    name: "Seedance 1.5 Pro",
    description: "叙事短剧/多角色连戏首选，主体一致性极强，支持原生音画同步",
    placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
    docsUrl: "https://www.volcengine.com/docs/82379",
    value: "",
    enabled: false,
  },
  {
    id: "minimax_tts",
    category: "配音层 (TTS)",
    name: "MiniMax Speech 2.8 HD",
    description: "中文自然度业界领先，支持声音克隆和情感控制",
    placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
    docsUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    value: "",
    enabled: true,
  },
];

export default function Settings() {
  const [configs, setConfigs] = useState(API_CONFIGS);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    "大脑层 (LLM)": true,
    "视觉层 (生图)": true,
    "动态层 (视频)": true,
    "配音层 (TTS)": true,
  });

  const categories = Array.from(new Set(API_CONFIGS.map((c) => c.category)));

  const toggleShow = (id: string) => {
    setShowValues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const updateConfig = (id: string, field: "value" | "enabled", val: string | boolean) => {
    setConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: val } : c)));
  };

  const handleSave = () => {
    toast.success("API 配置已保存");
  };

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.955 0.012 240)" }}>
      {/* Top nav */}
      <header className="bg-white border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/studio">
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={16} />
              返回工作台
            </button>
          </Link>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.22 0.06 250)" }}>
              <Zap size={14} className="text-white" />
            </div>
            <span style={{ fontFamily: "'Playfair Display', serif" }} className="font-semibold text-foreground">
              API 连接器
            </span>
          </div>
        </div>
        <Button onClick={handleSave} style={{ background: "oklch(0.22 0.06 250)" }} className="gap-2">
          <Check size={14} />
          保存配置
        </Button>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 style={{ fontFamily: "'Playfair Display', serif" }} className="text-3xl font-bold text-foreground mb-2">
            API 连接器配置
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            配置各层 API Key，系统将使用这些接口完成脚本生成、生图、配音和视频合成。所有 Key 仅存储在本地，不会上传至任何服务器。
          </p>
        </div>

        <div className="space-y-4">
          {categories.map((cat) => {
            const catConfigs = configs.filter((c) => c.category === cat);
            const expanded = expandedCategories[cat];

            return (
              <div key={cat} className="card-white overflow-hidden">
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="badge-pill">{cat}</span>
                    <span className="text-xs text-muted-foreground">
                      {catConfigs.filter((c) => c.enabled && c.value).length}/{catConfigs.length} 已配置
                    </span>
                  </div>
                  {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                </button>

                {expanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {catConfigs.map((config) => (
                      <div key={config.id} className="px-6 py-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 mr-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-foreground">{config.name}</span>
                              {config.enabled && config.value && (
                                <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                  <Check size={10} />
                                  已配置
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{config.description}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={config.docsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            >
                              获取 Key
                              <ExternalLink size={11} />
                            </a>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={config.enabled}
                                onChange={(e) => updateConfig(config.id, "enabled", e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                            </label>
                          </div>
                        </div>

                        {config.enabled && (
                          <div className="relative">
                            <input
                              type={showValues[config.id] ? "text" : "password"}
                              value={config.value}
                              onChange={(e) => updateConfig(config.id, "value", e.target.value)}
                              placeholder={config.placeholder}
                              className="w-full text-sm px-3 py-2 pr-10 rounded-lg border border-border bg-background font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <button
                              onClick={() => toggleShow(config.id)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showValues[config.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 rounded-xl border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>本地安全提示：</strong>所有 API Key 仅存储在本地配置文件 <code className="font-mono bg-amber-100 px-1 rounded">~/.pilipili/config.yaml</code> 中，不会上传至任何服务器。建议定期轮换 Key 以确保安全。
          </p>
        </div>
      </div>
    </div>
  );
}
