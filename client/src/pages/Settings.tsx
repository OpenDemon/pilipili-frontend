/*
 * Settings.tsx — API 连接器配置页面（真实 API 对接版）
 * Design: Seedance 2.0 inspired — soft blue-grey bg, white cards
 *
 * 配置通过 POST /api/settings/keys 保存到后端
 * 状态通过 GET /api/settings/keys/status 从后端读取
 * 测试通过 POST /api/settings/keys/test 验证 Key 有效性
 */

import { useState, useEffect } from "react";
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
  Loader2,
  AlertCircle,
  CheckCircle2,
  Play,
} from "lucide-react";
import { settingsApi, healthApi, ApiKeysStatus } from "@/lib/api";

interface ApiField {
  id: string;
  category: string;
  name: string;
  description: string;
  placeholder: string;
  docsUrl: string;
  apiKey: keyof import("@/lib/api").UpdateApiKeysRequest;
  apiSecretKey?: keyof import("@/lib/api").UpdateApiKeysRequest;
  secretPlaceholder?: string;
  value: string;
  secretValue?: string;
  enabled: boolean;
  isConfigured?: boolean;
  testService?: string; // 对应后端 test_api_key 的 service 参数
}

const DEFAULT_FIELDS: ApiField[] = [
  {
    id: "deepseek",
    category: "大脑层 (LLM)",
    name: "DeepSeek",
    description: "脚本生成、分镜拆解、Metadata 生成（默认推荐，性价比最高）",
    placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    docsUrl: "https://platform.deepseek.com/api_keys",
    apiKey: "llm_api_key",
    value: "",
    enabled: true,
    testService: "llm",
  },
  {
    id: "kimi",
    category: "大脑层 (LLM)",
    name: "Kimi (Moonshot)",
    description: "适合长文本处理，小说/剧本转分镜脚本",
    placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    docsUrl: "https://platform.moonshot.cn/console/api-keys",
    apiKey: "llm_api_key",
    value: "",
    enabled: false,
    testService: "llm",
  },
  {
    id: "minimax_llm",
    category: "大脑层 (LLM)",
    name: "MiniMax",
    description: "对话与情绪表达最强，适合情感类内容",
    placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
    docsUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    apiKey: "llm_api_key",
    value: "",
    enabled: false,
    testService: "llm",
  },
  {
    id: "gemini",
    category: "大脑层 (LLM)",
    name: "Google Gemini",
    description: "多模态理解，支持图片/视频输入转脚本",
    placeholder: "AIzaSyxxxxxxxxxxxxxxxxxxxxxxxx",
    docsUrl: "https://aistudio.google.com/app/apikey",
    apiKey: "llm_api_key",
    value: "",
    enabled: false,
    testService: "llm",
  },
  {
    id: "nano_banana",
    category: "视觉层 (生图)",
    name: "Nano Banana (Gemini 3 Pro Image)",
    description: "4K 首帧锁定，主体一致性基础，目前最强文生图 API（与 Gemini LLM 共用同一 Key）",
    placeholder: "AIzaSyxxxxxxxxxxxxxxxxxxxxxxxx",
    docsUrl: "https://aistudio.google.com/app/apikey",
    apiKey: "image_gen_api_key",
    value: "",
    enabled: true,
    testService: "image_gen",
  },
  {
    id: "kling",
    category: "动态层 (视频)",
    name: "Kling 3.0",
    description: "动作/产品/抖音短视频首选，动态能量强，渲染快",
    placeholder: "API Key",
    docsUrl: "https://app.klingai.com/global/dev/document-api",
    apiKey: "kling_api_key",
    apiSecretKey: "kling_api_secret",
    secretPlaceholder: "API Secret",
    value: "",
    secretValue: "",
    enabled: true,
    testService: "kling",
  },
  {
    id: "seedance",
    category: "动态层 (视频)",
    name: "Seedance 1.5 Pro (字节火山引擎)",
    description: "叙事短剧/多角色连戏首选，主体一致性极强，支持原生音画同步",
    placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
    docsUrl: "https://www.volcengine.com/docs/82379",
    apiKey: "seedance_api_key",
    value: "",
    enabled: false,
    testService: "seedance",
  },
  {
    id: "minimax_tts",
    category: "配音层 (TTS)",
    name: "MiniMax Speech 2.8 HD",
    description: "中文自然度业界领先，支持声音克隆和情感控制",
    placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
    docsUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    apiKey: "tts_api_key",
    value: "",
    enabled: true,
    testService: "tts",
  },
  {
    id: "mem0",
    category: "记忆系统 (可选)",
    name: "Mem0 Cloud",
    description: "云端记忆同步，跨设备共享风格偏好（不填则使用本地 SQLite）",
    placeholder: "m0-xxxxxxxxxxxxxxxxxxxxxxxx",
    docsUrl: "https://app.mem0.ai/dashboard/api-keys",
    apiKey: "mem0_api_key",
    value: "",
    enabled: false,
  },
];

export default function Settings() {
  const [fields, setFields] = useState<ApiField[]>(DEFAULT_FIELDS);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({
    "大脑层 (LLM)": true,
    "视觉层 (生图)": true,
    "动态层 (视频)": true,
    "配音层 (TTS)": true,
    "记忆系统 (可选)": false,
  });
  const [saving, setSaving] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [llmProvider, setLlmProvider] = useState("deepseek");
  const [testingService, setTestingService] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; message: string }>
  >({});

  // 检查后端健康状态 + 加载已配置的 Key 状态
  useEffect(() => {
    const init = async () => {
      try {
        await healthApi.check();
        setBackendOnline(true);

        const status: ApiKeysStatus = await settingsApi.getKeysStatus();
        setLlmProvider(status.llm.provider);

        setFields((prev) =>
          prev.map((f) => {
            let isConfigured = false;
            if (f.id === "deepseek" || f.id === "kimi" || f.id === "minimax_llm" || f.id === "gemini") {
              isConfigured = status.llm.configured && status.llm.provider === f.id;
            } else if (f.id === "nano_banana") {
              isConfigured = status.image_gen.configured;
            } else if (f.id === "kling") {
              isConfigured = status.kling.configured;
            } else if (f.id === "seedance") {
              isConfigured = status.seedance.configured;
            } else if (f.id === "minimax_tts") {
              isConfigured = status.tts.configured;
            }
            return { ...f, isConfigured };
          })
        );
      } catch {
        setBackendOnline(false);
      } finally {
        setLoadingStatus(false);
      }
    };
    init();
  }, []);

  const categories = Array.from(new Set(DEFAULT_FIELDS.map((f) => f.category)));

  const toggleShow = (id: string) => {
    setShowValues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const updateField = (
    id: string,
    field: "value" | "secretValue" | "enabled",
    val: string | boolean
  ) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: val } : f))
    );
  };

  const handleTestKey = async (field: ApiField) => {
    if (!field.testService || !backendOnline) return;

    // 如果该服务未配置且当前输入框也没有值，提示先保存
    if (!field.isConfigured && !field.value.trim()) {
      toast.error("请先填写 API Key 并保存，然后再测试连接");
      return;
    }

    setTestingService(field.id);
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[field.id];
      return next;
    });

    try {
      const result = await settingsApi.testKey(field.testService);
      setTestResults((prev) => ({ ...prev, [field.id]: result }));
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "测试失败";
      setTestResults((prev) => ({
        ...prev,
        [field.id]: { success: false, message: msg },
      }));
      toast.error(`测试失败：${msg}`);
    } finally {
      setTestingService(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const req: import("@/lib/api").UpdateApiKeysRequest = {
        llm_provider: llmProvider,
      };

      for (const f of fields) {
        if (!f.enabled || !f.value.trim()) continue;
        req[f.apiKey] = f.value.trim();
        if (f.apiSecretKey && f.secretValue?.trim()) {
          req[f.apiSecretKey] = f.secretValue.trim();
        }
      }

      const result = await settingsApi.updateKeys(req);
      toast.success(`配置已保存！更新了 ${result.updated_keys.length} 个 Key`);

      // 重新加载状态
      const status = await settingsApi.getKeysStatus();
      setFields((prev) =>
        prev.map((f) => {
          let isConfigured = false;
          if (["deepseek", "kimi", "minimax_llm", "gemini"].includes(f.id)) {
            isConfigured = status.llm.configured && status.llm.provider === f.id;
          } else if (f.id === "nano_banana") {
            isConfigured = status.image_gen.configured;
          } else if (f.id === "kling") {
            isConfigured = status.kling.configured;
          } else if (f.id === "seedance") {
            isConfigured = status.seedance.configured;
          } else if (f.id === "minimax_tts") {
            isConfigured = status.tts.configured;
          }
          return { ...f, isConfigured, value: "", secretValue: "" };
        })
      );
      // 清除旧的测试结果
      setTestResults({});
    } catch (err) {
      const msg = err instanceof Error ? err.message : "保存失败";
      toast.error(`保存失败：${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.955 0.012 240)" }}>
      {/* Top nav */}
      <header className="bg-white border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/studio">
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={16} />
              返回工作台
            </button>
          </Link>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "oklch(0.22 0.06 250)" }}
            >
              <Zap size={14} className="text-white" />
            </div>
            <span
              style={{ fontFamily: "'Playfair Display', serif" }}
              className="font-semibold text-foreground"
            >
              API 连接器
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* 后端状态指示 */}
          {loadingStatus ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" />
              检查后端...
            </div>
          ) : backendOnline ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 size={12} />
              后端已连接
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle size={12} />
              后端未连接
            </div>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || !backendOnline}
            style={{ background: "oklch(0.22 0.06 250)" }}
            className="gap-2"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
            保存配置
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1
            style={{ fontFamily: "'Playfair Display', serif" }}
            className="text-3xl font-bold text-foreground mb-2"
          >
            API 连接器配置
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            配置各层 API Key，系统将使用这些接口完成脚本生成、生图、配音和视频合成。
            所有 Key 仅存储在后端本地配置文件中，不会上传至任何第三方服务器。
          </p>
        </div>

        {/* 后端未连接提示 */}
        {!loadingStatus && !backendOnline && (
          <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 flex items-start gap-3">
            <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700 mb-1">
                后端服务未连接
              </p>
              <p className="text-xs text-red-600 leading-relaxed">
                请先启动后端服务：
                <code className="font-mono bg-red-100 px-1 rounded mx-1">
                  python cli/main.py server
                </code>
                或
                <code className="font-mono bg-red-100 px-1 rounded mx-1">
                  docker-compose up -d
                </code>
                ，然后刷新此页面。
              </p>
            </div>
          </div>
        )}

        {/* LLM 提供商选择 */}
        <div className="bg-white rounded-xl border border-border p-5 mb-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            默认 LLM 提供商
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {["deepseek", "kimi", "minimax", "gemini"].map((p) => (
              <button
                key={p}
                onClick={() => setLlmProvider(p)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  llmProvider === p
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {p === "deepseek"
                  ? "DeepSeek"
                  : p === "kimi"
                  ? "Kimi"
                  : p === "minimax"
                  ? "MiniMax"
                  : "Gemini"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {categories.map((cat) => {
            const catFields = fields.filter((f) => f.category === cat);
            const expanded = expandedCategories[cat];
            const configuredCount = catFields.filter(
              (f) => f.isConfigured
            ).length;

            return (
              <div
                key={cat}
                className="bg-white rounded-xl border border-border overflow-hidden"
              >
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-foreground">
                      {cat}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        configuredCount > 0
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {configuredCount}/{catFields.length} 已配置
                    </span>
                  </div>
                  {expanded ? (
                    <ChevronUp size={16} className="text-muted-foreground" />
                  ) : (
                    <ChevronDown size={16} className="text-muted-foreground" />
                  )}
                </button>

                {expanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {catFields.map((field) => {
                      const testResult = testResults[field.id];
                      const isTesting = testingService === field.id;

                      return (
                        <div key={field.id} className="px-6 py-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 mr-4">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-foreground">
                                  {field.name}
                                </span>
                                {field.isConfigured && (
                                  <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                    <Check size={10} />
                                    已配置
                                  </span>
                                )}
                                {testResult && (
                                  <span
                                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                                      testResult.success
                                        ? "text-emerald-600 bg-emerald-50"
                                        : "text-red-600 bg-red-50"
                                    }`}
                                  >
                                    {testResult.success ? (
                                      <CheckCircle2 size={10} />
                                    ) : (
                                      <AlertCircle size={10} />
                                    )}
                                    {testResult.success ? "连接正常" : "连接失败"}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {field.description}
                              </p>
                              {/* 测试失败详情 */}
                              {testResult && !testResult.success && (
                                <p className="text-xs text-red-500 mt-1">
                                  {testResult.message}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {/* 测试连接按钮 */}
                              {field.testService && field.isConfigured && (
                                <button
                                  onClick={() => handleTestKey(field)}
                                  disabled={isTesting || !backendOnline}
                                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                                    isTesting
                                      ? "border-border text-muted-foreground cursor-wait"
                                      : "border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50"
                                  }`}
                                >
                                  {isTesting ? (
                                    <Loader2 size={11} className="animate-spin" />
                                  ) : (
                                    <Play size={11} />
                                  )}
                                  {isTesting ? "测试中..." : "测试连接"}
                                </button>
                              )}
                              <a
                                href={field.docsUrl}
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
                                  checked={field.enabled}
                                  onChange={(e) =>
                                    updateField(field.id, "enabled", e.target.checked)
                                  }
                                  className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                              </label>
                            </div>
                          </div>

                          {field.enabled && (
                            <div className="space-y-2">
                              <div className="relative">
                                <input
                                  type={showValues[field.id] ? "text" : "password"}
                                  value={field.value}
                                  onChange={(e) =>
                                    updateField(field.id, "value", e.target.value)
                                  }
                                  placeholder={
                                    field.isConfigured
                                      ? "已配置（输入新值以更新）"
                                      : field.placeholder
                                  }
                                  className="w-full text-sm px-3 py-2 pr-10 rounded-lg border border-border bg-background font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                                <button
                                  onClick={() => toggleShow(field.id)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {showValues[field.id] ? (
                                    <EyeOff size={14} />
                                  ) : (
                                    <Eye size={14} />
                                  )}
                                </button>
                              </div>
                              {/* Secret Key 字段（如 Kling） */}
                              {field.apiSecretKey && (
                                <div className="relative">
                                  <input
                                    type={
                                      showValues[`${field.id}_secret`]
                                        ? "text"
                                        : "password"
                                    }
                                    value={field.secretValue || ""}
                                    onChange={(e) =>
                                      updateField(
                                        field.id,
                                        "secretValue",
                                        e.target.value
                                      )
                                    }
                                    placeholder={
                                      field.isConfigured
                                        ? "Secret 已配置（输入新值以更新）"
                                        : field.secretPlaceholder || "API Secret"
                                    }
                                    className="w-full text-sm px-3 py-2 pr-10 rounded-lg border border-border bg-background font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                                  />
                                  <button
                                    onClick={() =>
                                      toggleShow(`${field.id}_secret`)
                                    }
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {showValues[`${field.id}_secret`] ? (
                                      <EyeOff size={14} />
                                    ) : (
                                      <Eye size={14} />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 rounded-xl border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>安全提示：</strong>所有 API Key 仅存储在后端本地配置文件{" "}
            <code className="font-mono bg-amber-100 px-1 rounded">
              configs/config.yaml
            </code>{" "}
            中，不会上传至任何第三方服务器。建议定期轮换 Key 以确保安全。
          </p>
        </div>
      </div>
    </div>
  );
}
