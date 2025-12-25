'use server';

import cloudbase from "@cloudbase/node-sdk";

const DEFAULT_ENV_ID = "cloud1-3gy44slx114f4c73";

type ServerCloudbaseApp = ReturnType<typeof cloudbase.init>;

declare global {
  var __SERVER_CLOUDBASE_APP__: ServerCloudbaseApp | undefined;
}

const getServerApp = (): ServerCloudbaseApp => {
  if (globalThis.__SERVER_CLOUDBASE_APP__) {
    return globalThis.__SERVER_CLOUDBASE_APP__;
  }

  const envId = process.env.CLOUDBASE_ENV_ID ?? DEFAULT_ENV_ID;
  const secretId = process.env.CLOUDBASE_SECRET_ID;
  const secretKey = process.env.CLOUDBASE_SECRET_KEY;
  const token = process.env.CLOUDBASE_TOKEN;

  // 配置 CloudBase 初始化参数
  const config: any = {
    env: envId,
  };

  // 仅在提供了 secretId 和 secretKey 时添加认证信息
  if (secretId && secretKey) {
    config.secretId = secretId;
    config.secretKey = secretKey;
    
    // 如果有 token，也添加进去（适用于临时密钥）
    if (token) {
      config.token = token;
    }
  }

  try {
    const app = cloudbase.init(config);
    globalThis.__SERVER_CLOUDBASE_APP__ = app;
    return app;
  } catch (error) {
    console.warn('CloudBase 初始化失败，将使用模拟实现:', error);
    
    // 创建一个模拟的 CloudBase 应用，只提供本地运行所需的基本功能
    const mockApp = {
      database: () => ({
        collection: () => ({
          doc: () => ({
            get: async () => ({
              data: []
            })
          })
        })
      })
    } as any;
    
    globalThis.__SERVER_CLOUDBASE_APP__ = mockApp;
    return mockApp;
  }
};

export const getServerDb = () => {
  const app = getServerApp();
  return app.database();
};

