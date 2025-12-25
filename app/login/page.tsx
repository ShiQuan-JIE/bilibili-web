'use client';

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  KeyRound,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";

import { useCloudBaseAuth } from "@/hooks/useCloudBaseAuth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = useMemo(() => searchParams?.get("redirect") ?? "/", [searchParams]);
  const { status, error, signInWithCredentials } = useCloudBaseAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(redirect);
    }
  }, [router, redirect, status]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!username.trim() || !password) {
        setLocalError("请输入用户名和密码");
        return;
      }

      setSubmitting(true);
      setLocalError(null);

      try {
        await signInWithCredentials(username.trim(), password);
        // 登录成功后由useEffect监听status变化来处理重定向
      } catch (err) {
        const friendly = err instanceof Error ? err.message : "登录失败，请重试";
        setLocalError(friendly);
      } finally {
        setSubmitting(false);
      }
    },
    [password, signInWithCredentials, username],
  );

  const helperMessage = localError ?? error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="flex items-center justify-center">
            <div className="rounded-2xl bg-[#f27f0c]/10 p-4">
              <ShieldCheck className="h-8 w-8 text-[#f27f0c]" />
            </div>
          </div>

          <div className="mt-6 text-center">
            <h2 className="text-2xl font-semibold text-[#0f172a]">Bilibili 控制台</h2>
            <p className="mt-2 text-sm text-[#64748b]">请登录以继续</p>
          </div>

          <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#64748b]">用户名</span>
              <div className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 focus-within:border-[#f27f0c] focus-within:ring-2 focus-within:ring-[#f27f0c]/20">
                <LayoutDashboard className="h-4 w-4 text-[#f27f0c]" />
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="请输入用户名"
                  className="w-full bg-transparent text-sm font-medium text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none"
                />
              </div>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#64748b]">密码</span>
              <div className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 focus-within:border-[#f27f0c] focus-within:ring-2 focus-within:ring-[#f27f0c]/20">
                <KeyRound className="h-4 w-4 text-[#f27f0c]" />
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入密码"
                  className="w-full bg-transparent text-sm font-medium text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none"
                />
              </div>
            </label>

            {helperMessage && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {helperMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="group mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#f27f0c] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-[#f27f0c]/30 transition-all hover:bg-[#e06b00] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{submitting ? "登录中..." : "登录"}</span>
              {!submitting && <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#f27f0c] border-t-transparent" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
