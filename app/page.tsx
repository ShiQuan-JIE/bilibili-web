'use client';

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ChevronRight,
  Edit2,
  FolderOpen,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Subtitles,
  Timer,
  X,
} from "lucide-react";

import { app, db } from "@/lib/cloudbase";
import { useCloudBaseAuth } from "@/hooks/useCloudBaseAuth";
import type { RawDoc, VideoRecord } from "@/lib/project-records";
import { normalizeRecords } from "@/lib/project-records";

type Project = {
  _id: string;
  name: string;
  createTime?: string;
  videos: VideoRecord[];
};

const compactNumberFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  compactDisplay: "short",
});

const integerFormatter = new Intl.NumberFormat("zh-CN");

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export default function Home() {
  const { status, user, error: authError, signOut, refresh: refreshUser } = useCloudBaseAuth();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [visibleVideoCount, setVisibleVideoCount] = useState(7);
  
  // 删除相关状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // 添加项目相关状态
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectKeyword, setNewProjectKeyword] = useState("");
  const [addingProject, setAddingProject] = useState(false);
  
  const handleDeleteProject = useCallback((id: string, name: string) => {
    setProjectToDelete({ id, name });
    setShowDeleteConfirm(true);
  }, []);
  
  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setProjectToDelete(null);
  }, []);
  
  const handleConfirmDelete = useCallback(async () => {
    if (!projectToDelete) return;
    
    setDeleting(true);
    try {
      // 开发环境下使用模拟实现
      if (process.env.NODE_ENV !== "development") {
        // 生产环境正常删除项目
        await db.collection("bilibili-data").doc(projectToDelete.id).remove();
      } else {
        // 模拟删除操作延迟
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // 更新本地状态
      setProjects(prev => prev.filter(project => project._id !== projectToDelete.id));
      
      if (selectedProjectId === projectToDelete.id) {
        setSelectedProjectId(null);
      }
      
      setShowDeleteConfirm(false);
      setProjectToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除项目失败");
    } finally {
      setDeleting(false);
    }
  }, [projectToDelete, selectedProjectId]);
  
  const handleProjectClick = useCallback((projectId: string) => {
    const element = document.getElementById(`project-${projectId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setSelectedProjectId(projectId);
    }
  }, []);
  
  const handleAddProject = useCallback(() => {
    setShowAddProject(true);
    setNewProjectKeyword("");
  }, []);
  
  const handleCancelAddProject = useCallback(() => {
    setShowAddProject(false);
    setNewProjectKeyword("");
  }, []);
  
  const displayName =
    ("name" in (user ?? {}) ? (user as { name?: string }).name : undefined) ??
    ("username" in (user ?? {}) ? (user as { username?: string }).username : undefined) ??
    user?.uid ??
    "已登录用户";

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } finally {
      router.replace("/login");
    }
  }, [router, signOut]);

  useEffect(() => {
    // 所有环境下，未认证用户都重定向到登录页
    if (status === "unauthenticated") {
      router.replace("/login?redirect=/");
    }
  }, [router, status]);

  const refreshData = useCallback(async () => {
    // 检查是否配置了 CloudBase
    const isDevelopmentMode = !process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID;
    
    // 生产模式下需要认证
    if (!isDevelopmentMode && status !== "authenticated") return;

    setLoading(true);
    setError(null);

    try {
      // 不调用 refreshUser()，避免跨域错误
      // 登录成功后用户信息已经设置好了
      
      // 开发模式下使用模拟数据
      if (isDevelopmentMode) {
        // 模拟项目列表数据
        const mockProjects: Project[] = [
          {
            _id: "mock-1",
            name: "示例项目 1",
            createTime: new Date().toISOString(),
            videos: []
          },
          {
            _id: "mock-2",
            name: "示例项目 2",
            createTime: new Date().toISOString(),
            videos: []
          }
        ];
        setProjects(mockProjects);
        setLastUpdated(new Date());
      } else {
        // 生产环境正常获取数据
        if (!db) {
          throw new Error("数据库未初始化，请检查 CloudBase 配置");
        }
        const snapshot = await db.collection("bilibili-data").limit(1000).get();
        const projectList = (snapshot.data ?? []).map((doc: RawDoc) => ({
          _id: doc._id,
          name: doc.name || "未命名项目",
          createTime: doc.createTime,
          videos: normalizeRecords(doc),
        })) as Project[];
        setProjects(projectList);
        setLastUpdated(new Date());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "数据加载失败");
    } finally {
      setLoading(false);
    }
  }, [status]);

  const handleConfirmAddProject = useCallback(async () => {
    if (!newProjectKeyword.trim()) return;
    
    const isDevelopmentMode = !process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID;
    
    setAddingProject(true);
    try {
      // 开发模式下模拟添加
      if (isDevelopmentMode) {
        // 模拟添加项目成功
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        // 生产环境正常调用云函数
        if (!app) {
          throw new Error("CloudBase 未初始化");
        }
        await app.callFunction({
          name: 'crawler-api',
          data: { keyword: newProjectKeyword.trim() }
        });
      }
      
      await refreshData();
      
      setShowAddProject(false);
      setNewProjectKeyword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加项目失败");
    } finally {
      setAddingProject(false);
    }
  }, [newProjectKeyword, refreshData]);

  useEffect(() => {
    // 开发环境下直接加载数据，无需认证
    if (process.env.NODE_ENV === "development") {
      void refreshData();
    } else if (status === "authenticated") {
      void refreshData();
    }
  }, [status, refreshData]);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [projects.length, selectedProjectId]);

  useEffect(() => {
    const updateVideoCount = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setVisibleVideoCount(2);
      } else if (width < 768) {
        setVisibleVideoCount(3);
      } else if (width < 1024) {
        setVisibleVideoCount(4);
      } else if (width < 1280) {
        setVisibleVideoCount(5);
      } else if (width < 1536) {
        setVisibleVideoCount(6);
      } else {
        setVisibleVideoCount(7);
      }
    };

    updateVideoCount();
    window.addEventListener('resize', updateVideoCount);
    return () => window.removeEventListener('resize', updateVideoCount);
  }, []);

  const handleEditProject = useCallback((projectId: string, currentName: string) => {
    setEditingProjectId(projectId);
    setEditingName(currentName);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingProjectId || !editingName.trim()) return;

    try {
      await db.collection("bilibili-data").doc(editingProjectId).update({
        name: editingName.trim(),
      });
      setProjects((prev) =>
        prev.map((p) =>
          p._id === editingProjectId ? { ...p, name: editingName.trim() } : p
        )
      );
      setEditingProjectId(null);
      setEditingName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失败");
    }
  }, [editingProjectId, editingName]);

  const handleCancelEdit = useCallback(() => {
    setEditingProjectId(null);
    setEditingName("");
  }, []);

  if (status === "checking") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0f172a] text-[#fef3c7]">
        <Activity className="mb-4 h-8 w-8 animate-spin" />
        <p className="text-sm tracking-[0.3em] text-[#f7b733]">正在校验 CloudBase 身份</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden text-[#0f172a]">
      <aside className="relative flex w-64 flex-col border-r border-slate-200 bg-white/95 shadow-[4px_0_20px_rgba(0,0,0,0.05)]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-x-4 top-6 h-32 bg-gradient-to-br from-[#f27f0c]/15 via-transparent to-transparent blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-1 p-6 border-b border-slate-200">
          <h1 className="text-2xl font-semibold text-[#0f172a]">B站热门视频</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 px-2">
            <p className="text-xs text-[#64748b]">近期项目</p>
          </div>
          <nav className="flex flex-col gap-1">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-200" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="py-8 text-center text-sm text-[#64748b]">暂无项目</div>
            ) : (
              projects.map((project) => (
                <div
                  key={project._id}
                  onClick={() => handleProjectClick(project._id)}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all cursor-pointer ${selectedProjectId === project._id ? "bg-slate-100 text-[#0f172a]" : "text-[#64748b] hover:bg-slate-50 hover:text-[#0f172a]"}`}
                >
                  <FolderOpen className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{project.name}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project._id, project.name);
                      }}
                      className="rounded-full p-1 text-[#94a3b8] transition hover:bg-rose-100 hover:text-rose-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {selectedProjectId === project._id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProjectClick(project._id);
                        }}
                        className="rounded-full p-1 text-[#f27f0c] transition hover:bg-slate-100"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </nav>
        </div>

        <div className="relative border-t border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-xl bg-[#f27f0c]/10 p-2.5">
              <ShieldCheck className="h-5 w-5 text-[#f27f0c]" />
            </div>
            <span className="text-sm font-semibold text-[#0f172a] truncate">{displayName}</span>
          </div>
          {authError && (
            <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              {authError}
            </div>
          )}
          <button
            type="button"
            className="w-full rounded-xl border border-[#f27f0c] px-3 py-2 text-sm font-semibold text-[#f27f0c] transition hover:bg-[#f27f0c]/10"
            onClick={() => void handleSignOut()}
          >
            退出登录
          </button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden bg-slate-50/50">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white/95 px-8 py-5 shadow-sm">
          <div className="flex items-center gap-4">
            <Activity className="h-5 w-5 text-[#f27f0c]" />
            <div>
              <h2 className="text-lg font-semibold text-[#0f172a]">项目</h2>
              <p className="text-xs text-[#64748b]">
                共 {projects.length ? integerFormatter.format(projects.length) : "--"} 个项目
                {lastUpdated && ` · 更新于 ${timeFormatter.format(lastUpdated)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={handleAddProject}
              disabled={status !== "authenticated" || addingProject}
              className="flex items-center gap-2 rounded-xl border border-green-500 bg-green-500 px-4 py-2 text-sm font-medium text-white transition hover:border-green-600 hover:bg-green-600 disabled:cursor-not-allowed disabled:border-green-200 disabled:bg-green-100 disabled:text-green-500"
            >
              <Plus className={`h-4 w-4 ${addingProject ? "animate-spin" : ""}`} />
              添加项目
            </button>
            <button
              type="button"
              onClick={() => void refreshData()}
              disabled={status !== "authenticated" || loading}
              className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-[#0f172a] transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-[#94a3b8]"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              刷新
            </button>
          </div>
        </div>

        <section className="flex-1 overflow-y-auto p-8 bg-white">
          {loading ? (
            <div className="space-y-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-4">
                  <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
                  <div className="flex items-center gap-4">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <div key={j} className="h-56 w-44 animate-pulse rounded-xl bg-slate-200" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-32 text-center text-[#64748b]">
              <FolderOpen className="h-12 w-12 text-[#ea580c]" />
              <p className="text-base font-medium">暂无项目</p>
              <p className="text-sm">请添加项目以开始使用</p>
            </div>
          ) : (
            <div className="space-y-8">
              {projects.map((project) => (
                <div id={`project-${project._id}`} key={project._id} className="space-y-4 opacity-100 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    {editingProjectId === project._id ? (
                      <>
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              void handleSaveEdit();
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-lg font-semibold text-[#0f172a] focus:border-[#f27f0c] focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit()}
                          className="rounded-lg bg-[#f27f0c] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#ea580c]"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="rounded-lg p-1.5 text-[#64748b] transition hover:bg-slate-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push(`/projects/${project._id}`)}
                          className="flex items-center gap-1.5 rounded-lg bg-[#f27f0c] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#ea580c] ml-auto"
                        >
                          查看更多
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <h3 className="text-lg font-semibold text-[#0f172a]">
                          {project.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => handleEditProject(project._id, project.name)}
                          className="rounded-lg p-1.5 text-[#64748b] transition hover:bg-slate-100 hover:text-[#0f172a]"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push(`/projects/${project._id}`)}
                          className="flex items-center gap-1.5 rounded-lg bg-[#f27f0c] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#ea580c] ml-auto"
                        >
                          查看更多
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${visibleVideoCount}, minmax(0, 1fr))` }}>
                    {project.videos.slice(0, visibleVideoCount).map((video) => (
                      <div
                        key={video.key}
                        className="group flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-[#f27f0c] hover:-translate-y-1"
                      >
                        <div className="relative w-full pb-[56.25%] overflow-hidden bg-slate-100">
                          {video.videoUrl ? (
                            <a
                              href={video.videoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="absolute inset-0 block w-full h-full"
                            >
                              {video.coverUrl ? (
                                <img
                                  src={video.coverUrl}
                                  alt={video.title}
                                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-sm text-[#64748b]">
                                  无封面
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                            </a>
                          ) : (
                            <>
                              {video.coverUrl ? (
                                <img
                                  src={video.coverUrl}
                                  alt={video.title}
                                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-sm text-[#64748b]">
                                  无封面
                                </div>
                              )}
                            </>
                          )}
                          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm z-10">
                            <Timer className="h-3 w-3" />
                            {video.duration}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 p-3 flex-1 bg-white">
                          {video.videoUrl ? (
                            <a
                              href={video.videoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-semibold leading-snug text-[#0f172a] hover:text-[#f27f0c] transition-colors cursor-pointer min-h-[2.5rem] overflow-hidden"
                              style={{ 
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                textOverflow: 'clip'
                              }}
                            >
                              {video.title}
                            </a>
                          ) : (
                            <h3 
                              className="text-sm font-semibold leading-snug text-[#0f172a] min-h-[2.5rem] overflow-hidden"
                              style={{ 
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                textOverflow: 'clip'
                              }}
                            >
                              {video.title}
                            </h3>
                          )}
                          <p className="text-xs text-[#64748b] overflow-hidden whitespace-nowrap" style={{ textOverflow: 'clip' }}>{video.uploader}</p>

                          <div className="mt-auto flex items-center justify-between text-xs text-[#64748b]">
                            <div className="flex items-center gap-1">
                              <Play className="h-3 w-3 text-[#f27f0c]" />
                              {compactNumberFormatter.format(video.playCount)}
                            </div>
                            <div className="flex items-center gap-1">
                              <Subtitles className="h-3 w-3 text-[#ea580c]" />
                              {compactNumberFormatter.format(video.danmakuCount)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      
      {showDeleteConfirm && projectToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-100 text-rose-500 mb-4">
                <X className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold text-[#0f172a]">确认删除</h3>
              <p className="text-sm text-[#64748b] mt-2">
                您确定要删除项目 "{projectToDelete.name}" 吗？此操作不可恢复。
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-[#0f172a] transition hover:bg-slate-100"
                disabled={deleting}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="flex-1 rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-600"
                disabled={deleting}
              >
                {deleting ? (
                  <div className="flex items-center justify-center gap-2">
                    <Activity className="h-4 w-4 animate-spin" />
                    删除中...
                  </div>
                ) : (
                  "确认删除"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showAddProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-[#0f172a]">添加新项目</h3>
              <p className="text-sm text-[#64748b] mt-2">
                请输入搜索关键词以添加新项目
              </p>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                value={newProjectKeyword}
                onChange={(e) => setNewProjectKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newProjectKeyword.trim()) {
                    void handleConfirmAddProject();
                  } else if (e.key === 'Escape') {
                    handleCancelAddProject();
                  }
                }}
                placeholder="输入搜索关键词..."
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-[#0f172a] focus:border-[#f27f0c] focus:outline-none"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelAddProject}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-[#0f172a] transition hover:bg-slate-100"
                  disabled={addingProject}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmAddProject()}
                  className="flex-1 rounded-lg bg-[#f27f0c] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#ea580c]"
                  disabled={addingProject || !newProjectKeyword.trim()}
                >
                  {addingProject ? (
                    <div className="flex items-center justify-center gap-2">
                      <Activity className="h-4 w-4 animate-spin" />
                      添加中...
                    </div>
                  ) : (
                    "添加项目"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
