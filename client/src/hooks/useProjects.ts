/**
 * useProjects — 历史项目管理 Hook
 */

import { useState, useEffect, useCallback } from "react";
import { Project, projectApi } from "@/lib/api";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await projectApi.list();
      setProjects(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取项目列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return { projects, loading, error, refetch: fetchProjects };
}
