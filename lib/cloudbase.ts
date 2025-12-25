import cloudbase from "@cloudbase/js-sdk";

// 声明类型
let app: ReturnType<typeof cloudbase.init> | null = null;
let auth: ReturnType<typeof app.auth> | null = null;
let db: ReturnType<typeof app.database> | null = null;

if (typeof window !== "undefined") {
  // 检查是否配置了 CloudBase 环境 ID
  const hasEnvId = !!process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID;
  
  // 如果没有配置环境 ID，使用开发模式
  if (!hasEnvId) {
    console.log("开发模式：未配置 NEXT_PUBLIC_CLOUDBASE_ENV_ID，使用模拟数据");
    app = {
      auth: () => null,
      database: () => null
    } as any;
    auth = null;
    db = null;
  } else {
    // 配置了环境 ID，正常初始化 CloudBase
    try {
      console.log("生产模式：初始化 CloudBase");
      app = cloudbase.init({
        env: process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID,
      });
      auth = app.auth();
      db = app.database();
      
      // 抑制 CloudBase SDK 的跨域错误
      const originalConsoleError = console.error;
      console.error = (...args: any[]) => {
        const message = args[0]?.toString() || '';
        // 忽略跨域相关的错误
        if (message.includes('cross-origin') || message.includes('toJSON')) {
          return;
        }
        originalConsoleError.apply(console, args);
      };
    } catch (err) {
      console.error("CloudBase初始化失败:", err);
      // 初始化失败时也使用模拟对象
      app = {
        auth: () => null,
        database: () => null
      } as any;
      auth = null;
      db = null;
    }
  }
}

export { app, auth, db };
