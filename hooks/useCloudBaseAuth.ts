'use client';

import { useCallback, useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/cloudbase";

type CloudBaseUser = {
  uid?: string;
  name?: string;
  username?: string;
} | null;

type AuthStatus = "checking" | "authenticated" | "unauthenticated" | "error";

type AuthErrorShape = {
  code?: string;
  message?: string;
  error?: string;
  error_code?: number;
  error_description?: string;
};

const UNKNOWN_ERROR_MESSAGE = "登录失败，请稍后再试";

const mapErrorToMessage = (err: unknown): string => {
  if (typeof err === "string") {
    return err;
  }

  if (err && typeof err === "object") {
    const { code, message, error_description, error, msg } = err as AuthErrorShape & { msg?: string };

    // 优先使用后端返回的 error_description
    if (error_description) {
      return error_description;
    }

    // 检查 CloudBase SDK 特定的错误字段
    if (msg) {
      return msg;
    }

    // 处理 CloudBase 常见错误码
    switch (code || error) {
      case "INVALID_CREDENTIALS":
      case "invalid_username_or_password":
      case "AUTH_FAILED":
        return "用户名或密码错误";
      case "USER_NOT_FOUND":
      case "USER_DOES_NOT_EXIST":
        return "账户不存在，请联系管理员";
      case "RATE_LIMIT_EXCEEDED":
      case "REQUEST_LIMITED":
        return "操作过于频繁，请稍后再试";
      case "CAPTCHA_REQUIRED":
        return "已触发风控，请在控制台完成图形验证码验证";
      case "NETWORK_ERROR":
        return "网络错误，请检查网络连接";
      case "AUTH_EXPIRED":
        return "登录已过期，请重新登录";
      case "UNAUTHORIZED":
        return "未授权访问，请重新登录";
      default:
        // CloudBase SDK 可能返回的错误信息
        if (message?.includes("secret id error") || message?.includes("SIGN_PARAM_INVALID")) {
          return "CloudBase 配置错误，请检查环境变量";
        }
        return message ?? UNKNOWN_ERROR_MESSAGE;
    }
  }

  return UNKNOWN_ERROR_MESSAGE;
};

export function useCloudBaseAuth() {
  // 所有环境初始状态都是 checking，确保登录流程正常执行
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<CloudBaseUser>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // 检查是否配置了 CloudBase
    const hasEnvId = typeof window !== "undefined" && !!process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID;
    
    // 如果没有配置 CloudBase 环境 ID，说明是开发模式
    if (!hasEnvId) {
      // 开发模式下需要用户登录
      setUser(null);
      setStatus("unauthenticated");
      setError(null);
      return;
    }

    // 如果auth未初始化，返回未认证状态
    if (!auth) {
      setUser(null);
      setStatus("unauthenticated");
      setError(null);
      return;
    }

    try {
      // 按照CloudBase文档，使用getCurrentUser获取当前用户信息
      // 该方法会自动刷新令牌并返回当前登录用户
      const currentUser = await auth.getCurrentUser();
      
      if (currentUser) {
        // 用户已登录，根据CloudBase文档，currentUser包含完整的用户信息
        setUser({
          uid: currentUser.uid,
          username: currentUser.username || currentUser.uid || "user"
        });
        setStatus("authenticated");
        setError(null);
      } else {
        // 用户未登录
        setUser(null);
        setStatus("unauthenticated");
        setError(null);
      }
    } catch (err) {
      console.error("获取用户信息失败:", err);
      // 如果获取失败，设置为未认证状态
      setUser(null);
      setStatus("unauthenticated");
      setError(null);
    }
  }, []);

  useEffect(() => {
    // 初始化时刷新用户信息（只执行一次）
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithDefaultPage = useCallback(async () => {
    // 检查是否配置了 CloudBase
    const hasEnvId = typeof window !== "undefined" && !!process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID;
    
    // 开发模式下不执行默认登录页面
    if (!hasEnvId) {
      return;
    }

    if (auth) {
      await auth.toDefaultLoginPage({});
    }
  }, []);

  const signInWithCredentials = useCallback(
    async (username: string, password: string) => {
      console.log("[登录流程] 开始登录", { username, timestamp: Date.now() });
      
      // 检查是否配置了 CloudBase
      const hasEnvId = typeof window !== "undefined" && !!process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID;
      console.log("[登录流程] 环境检查", { hasEnvId, timestamp: Date.now() });
      
      // 开发模式下模拟登录成功
      if (!hasEnvId) {
        console.log("[登录流程] 开发模式，模拟登录成功", { timestamp: Date.now() });
        setUser({ uid: "dev-user-123", username });
        setStatus("authenticated");
        setError(null);
        console.log("[登录流程] 开发模式登录完成，状态已更新", { timestamp: Date.now() });
        return;
      }

      // 如果auth未初始化，返回错误
      if (!auth) {
        const friendly = "认证服务未初始化";
        console.error("[登录流程] 认证服务未初始化", { timestamp: Date.now() });
        setStatus("unauthenticated");
        setError(friendly);
        throw new Error(friendly);
      }

      setStatus("checking");
      setError(null);
      console.log("[登录流程] 开始调用CloudBase认证API", { timestamp: Date.now() });

      try {
        // 按照CloudBase SDK v2.23.3的API，使用用户名密码登录应该调用signIn方法
        // 传入包含username和password的对象参数
        const loginResult = await auth.signIn({ username, password });
        
        console.log("[登录流程] CloudBase登录成功", { timestamp: Date.now() });
        
        // 使用登录结果中的用户信息直接更新状态
        // CloudBase SDK signIn方法返回LoginState对象，包含user属性
        const userInfo = loginResult?.user || await auth.getCurrentUser();
        
        if (userInfo) {
          console.log("[登录流程] 获取用户信息成功，uid:", userInfo.uid, { timestamp: Date.now() });
          setUser({
            uid: userInfo.uid,
            username: userInfo.username || userInfo.uid || username,
          });
          setStatus("authenticated");
          setError(null);
          console.log("[登录流程] 登录状态更新完成", { timestamp: Date.now() });
        } else {
          // 登录成功但获取用户信息失败
          const errorMsg = "登录成功但获取用户信息失败";
          console.error("[登录流程] ", errorMsg, { timestamp: Date.now() });
          throw new Error(errorMsg);
        }
      } catch (err) {
        console.error("[登录流程] 登录失败详细信息:", err, { timestamp: Date.now() });
        const friendly = mapErrorToMessage(err);
        setStatus("unauthenticated");
        setError(friendly);
        throw new Error(friendly);
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    // 检查是否配置了 CloudBase
    const hasEnvId = typeof window !== "undefined" && !!process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID;
    
    // 开发模式下模拟登出
    if (!hasEnvId) {
      setUser(null);
      setStatus("unauthenticated");
      setError(null);
      return;
    }

    // 如果auth未初始化，直接设置为未认证状态
    if (!auth) {
      setUser(null);
      setStatus("unauthenticated");
      setError(null);
      return;
    }

    try {
      // 按照CloudBase文档，调用signOut方法登出
      await auth.signOut();
      // 登出成功后更新状态
      setUser(null);
      setStatus("unauthenticated");
      setError(null);
    } catch (err) {
      console.error("登出失败:", err);
      // 即使登出失败，也将状态设置为未认证
      setUser(null);
      setStatus("unauthenticated");
      setError(null);
    }
  }, []);

  return {
    status,
    user,
    error,
    refresh,
    signInWithDefaultPage,
    signInWithCredentials,
    signOut,
  };
}
