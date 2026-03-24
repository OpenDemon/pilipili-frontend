/**
 * DebugPanel.tsx — 统一调试日志窗口
 * 收集所有 API 调用的请求/响应/错误，可一键复制，方便排查问题
 * 通过全局事件总线接收日志，不侵入业务组件
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Bug, X, Copy, Trash2, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Clock, Wifi } from "lucide-react";
import { toast } from "sonner";

// ─── 日志类型 ─────────────────────────────────────────────────

export type LogLevel = "info" | "success" | "warning" | "error" | "request" | "response";

export interface DebugLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: string;   // 来源模块，如 "对标分析" / "工作流" / "API"
  message: string;
  detail?: string;    // 详细内容（JSON / 错误堆栈）
}

// ─── 全局事件总线 ─────────────────────────────────────────────

const DEBUG_EVENT = "pilipili:debug";

export function emitDebugLog(log: Omit<DebugLog, "id" | "timestamp">) {
  const event = new CustomEvent(DEBUG_EVENT, {
    detail: {
      ...log,
      id: Math.random().toString(36).slice(2),
      timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
    } as DebugLog,
  });
  window.dispatchEvent(event);
}

// ─── 拦截全局 fetch，自动记录 API 日志 ────────────────────────

let _fetchPatched = false;

export function patchFetchForDebug() {
  if (_fetchPatched || typeof window === "undefined") return;
  _fetchPatched = true;

  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : (input as Request).url;
    const method = init?.method || "GET";

    // 只拦截后端 API 请求
    if (!url.includes("localhost:8000") && !url.includes("127.0.0.1:8000")) {
      return originalFetch(input, init);
    }

    const startTime = Date.now();
    const shortUrl = url.replace(/https?:\/\/[^/]+/, "");

    emitDebugLog({
      level: "request",
      category: "API",
      message: `→ ${method} ${shortUrl}`,
      detail: init?.body ? String(init.body).slice(0, 500) : undefined,
    });

    try {
      const response = await originalFetch(input, init);
      const duration = Date.now() - startTime;
      const cloned = response.clone();

      if (!response.ok) {
        let errorDetail = "";
        try {
          const errJson = await cloned.json();
          errorDetail = JSON.stringify(errJson, null, 2);
        } catch {
          errorDetail = await cloned.text().catch(() => response.statusText);
        }
        emitDebugLog({
          level: "error",
          category: "API",
          message: `✗ ${method} ${shortUrl} → ${response.status} ${response.statusText} (${duration}ms)`,
          detail: errorDetail,
        });
      } else {
        emitDebugLog({
          level: "success",
          category: "API",
          message: `✓ ${method} ${shortUrl} → ${response.status} (${duration}ms)`,
        });
      }

      return response;
    } catch (err) {
      const duration = Date.now() - startTime;
      emitDebugLog({
        level: "error",
        category: "API",
        message: `✗ ${method} ${shortUrl} → 网络错误 (${duration}ms)`,
        detail: String(err),
      });
      throw err;
    }
  };
}

// ─── 组件 ─────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<LogLevel, { color: string; bg: string; icon: React.ReactNode }> = {
  info:     { color: "text-blue-600",   bg: "bg-blue-50",   icon: <Clock size={12} /> },
  success:  { color: "text-green-600",  bg: "bg-green-50",  icon: <CheckCircle2 size={12} /> },
  warning:  { color: "text-amber-600",  bg: "bg-amber-50",  icon: <AlertCircle size={12} /> },
  error:    { color: "text-red-600",    bg: "bg-red-50",    icon: <AlertCircle size={12} /> },
  request:  { color: "text-slate-500",  bg: "bg-slate-50",  icon: <Wifi size={12} /> },
  response: { color: "text-indigo-600", bg: "bg-indigo-50", icon: <Wifi size={12} /> },
};

export default function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<LogLevel | "all">("all");
  const [hasNewError, setHasNewError] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 初始化 fetch 拦截
  useEffect(() => {
    patchFetchForDebug();
  }, []);

  // 监听调试事件
  useEffect(() => {
    const handler = (e: Event) => {
      const log = (e as CustomEvent<DebugLog>).detail;
      setLogs(prev => [...prev.slice(-199), log]); // 最多保留 200 条
      if (log.level === "error" || log.level === "warning") {
        setHasNewError(true);
      }
    };
    window.addEventListener(DEBUG_EVENT, handler);
    return () => window.removeEventListener(DEBUG_EVENT, handler);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, open]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleOpen = () => {
    setOpen(true);
    setHasNewError(false);
  };

  const copyAll = () => {
    const text = logs
      .filter(l => filter === "all" || l.level === filter)
      .map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.category}] ${l.message}${l.detail ? "\n" + l.detail : ""}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("已复制所有日志到剪贴板");
  };

  const filteredLogs = filter === "all" ? logs : logs.filter(l => l.level === filter);
  const errorCount = logs.filter(l => l.level === "error").length;

  return (
    <>
      {/* 悬浮触发按钮 */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg text-sm font-medium transition-all hover:scale-105 active:scale-95"
        style={{
          background: hasNewError ? "oklch(0.55 0.2 25)" : "oklch(0.22 0.06 250)",
          color: "white",
        }}
        title="打开调试日志"
      >
        <Bug size={15} />
        <span>调试</span>
        {errorCount > 0 && (
          <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {errorCount}
          </span>
        )}
      </button>

      {/* 调试面板 */}
      {open && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-white border-t border-border shadow-2xl"
          style={{ height: "360px" }}
        >
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-slate-50 shrink-0">
            <div className="flex items-center gap-3">
              <Bug size={15} className="text-slate-500" />
              <span className="font-semibold text-sm text-slate-700">调试日志</span>
              <span className="text-xs text-slate-400">{logs.length} 条</span>
              {/* 过滤器 */}
              <div className="flex gap-1 ml-2">
                {(["all", "error", "warning", "success", "request"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                      filter === f
                        ? "bg-slate-700 text-white"
                        : "bg-white text-slate-500 border border-border hover:bg-slate-100"
                    }`}
                  >
                    {f === "all" ? "全部" : f === "error" ? `错误(${errorCount})` : f === "warning" ? "警告" : f === "success" ? "成功" : "请求"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyAll}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-600 hover:bg-slate-200 transition-colors"
                title="复制所有日志"
              >
                <Copy size={12} />
                一键复制
              </button>
              <button
                onClick={() => setLogs([])}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-600 hover:bg-slate-200 transition-colors"
                title="清空日志"
              >
                <Trash2 size={12} />
                清空
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-slate-200 transition-colors"
              >
                <X size={14} className="text-slate-500" />
              </button>
            </div>
          </div>

          {/* 日志列表 */}
          <div className="flex-1 overflow-y-auto font-mono text-xs">
            {filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                暂无日志
              </div>
            ) : (
              filteredLogs.map(log => {
                const cfg = LEVEL_CONFIG[log.level];
                const isExpanded = expanded.has(log.id);
                return (
                  <div
                    key={log.id}
                    className={`border-b border-slate-100 ${log.level === "error" ? "bg-red-50/50" : ""}`}
                  >
                    <div
                      className="flex items-start gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => log.detail && toggleExpand(log.id)}
                    >
                      <span className="text-slate-300 shrink-0 pt-0.5">{log.timestamp}</span>
                      <span className={`shrink-0 pt-0.5 ${cfg.color}`}>{cfg.icon}</span>
                      <span className={`shrink-0 px-1 rounded text-[10px] font-bold ${cfg.color} ${cfg.bg}`}>
                        {log.category}
                      </span>
                      <span className={`flex-1 break-all ${log.level === "error" ? "text-red-700 font-medium" : "text-slate-700"}`}>
                        {log.message}
                      </span>
                      {log.detail && (
                        <span className="shrink-0 text-slate-400">
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </span>
                      )}
                    </div>
                    {log.detail && isExpanded && (
                      <div className="mx-3 mb-2 p-2 rounded bg-slate-900 text-green-300 text-[11px] whitespace-pre-wrap break-all overflow-x-auto">
                        {log.detail}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </>
  );
}
