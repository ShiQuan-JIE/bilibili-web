# 部署到腾讯云 CloudBase 云托管

## 前置准备

1. 确保已安装 [CloudBase CLI](https://docs.cloudbase.net/cli-v1/intro.html)
   ```bash
   npm install -g @cloudbase/cli
   ```

2. 登录 CloudBase
   ```bash
   cloudbase login
   ```

## 部署步骤

### 方法一：使用 CloudBase CLI 部署

1. **初始化云托管配置**（如果还没有）
   ```bash
   cd bilibili-web-main
   cloudbase init
   ```

2. **配置环境变量**
   
   在腾讯云控制台 > CloudBase > 云托管 > 你的服务 > 环境变量中添加：
   - `DEEPSEEK_API_KEY`: 你的 DeepSeek API 密钥
   - `CLOUDBASE_ENV_ID`: CloudBase 环境 ID
   - `CLOUDBASE_SECRET_ID`: CloudBase Secret ID
   - `CLOUDBASE_SECRET_KEY`: CloudBase Secret Key
   - `NODE_ENV`: production

3. **构建并部署**
   ```bash
   # 构建 Docker 镜像并推送
   cloudbase run deploy --name bilibili-web --image-tag latest
   ```

### 方法二：使用 Docker 手动部署

1. **构建 Docker 镜像**
   ```bash
   cd bilibili-web-main
   docker build -t bilibili-web:latest .
   ```

2. **测试镜像**
   ```bash
   docker run -p 3000:3000 \
     -e DEEPSEEK_API_KEY=your_key \
     -e CLOUDBASE_ENV_ID=your_env_id \
     -e CLOUDBASE_SECRET_ID=your_secret_id \
     -e CLOUDBASE_SECRET_KEY=your_secret_key \
     bilibili-web:latest
   ```

3. **推送到腾讯云容器镜像服务**
   ```bash
   # 登录腾讯云容器镜像服务
   docker login ccr.ccs.tencentyun.com
   
   # 标记镜像
   docker tag bilibili-web:latest ccr.ccs.tencentyun.com/your-namespace/bilibili-web:latest
   
   # 推送镜像
   docker push ccr.ccs.tencentyun.com/your-namespace/bilibili-web:latest
   ```

4. **在云托管控制台创建服务**
   - 进入 CloudBase 控制台 > 云托管
   - 创建新服务，选择刚推送的镜像
   - 配置端口：3000
   - 配置环境变量（见上方）
   - 部署

### 方法三：使用腾讯云控制台直接部署

1. **打包代码**
   ```bash
   cd bilibili-web-main
   zip -r bilibili-web.zip . -x "node_modules/*" ".next/*" ".git/*"
   ```

2. **上传到云托管**
   - 进入 CloudBase 控制台 > 云托管
   - 创建新服务
   - 选择"代码包部署"
   - 上传 bilibili-web.zip
   - 系统会自动检测 Dockerfile 并构建

## 环境变量说明

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | `sk-xxx` |
| `CLOUDBASE_ENV_ID` | CloudBase 环境 ID | `cloud1-xxx` |
| `CLOUDBASE_SECRET_ID` | CloudBase Secret ID | `AKIDxxx` |
| `CLOUDBASE_SECRET_KEY` | CloudBase Secret Key | `xxx` |
| `NODE_ENV` | 运行环境 | `production` |
| `PORT` | 服务端口（可选） | `3000` |

## 验证部署

部署成功后，访问云托管分配的域名，应该能看到登录页面。

## 常见问题

### 1. 构建失败
- 检查 Node.js 版本是否为 22
- 确保 package.json 中的依赖完整
- 查看构建日志中的错误信息

### 2. 启动失败
- 检查环境变量是否配置正确
- 查看容器日志
- 确保端口 3000 已正确暴露

### 3. 无法访问
- 检查云托管服务状态
- 确认域名配置正确
- 检查防火墙和安全组设置

## 更新部署

修改代码后重新部署：

```bash
# 方法一：使用 CLI
cloudbase run deploy --name bilibili-web --image-tag latest

# 方法二：重新构建并推送镜像
docker build -t bilibili-web:latest .
docker tag bilibili-web:latest ccr.ccs.tencentyun.com/your-namespace/bilibili-web:latest
docker push ccr.ccs.tencentyun.com/your-namespace/bilibili-web:latest
```

## 性能优化建议

1. **启用 CDN**：在 CloudBase 控制台配置 CDN 加速静态资源
2. **配置缓存**：设置合理的缓存策略
3. **监控告警**：配置云监控和告警规则
4. **自动扩缩容**：根据流量配置自动扩缩容策略

## 回滚

如果新版本有问题，可以快速回滚到上一个版本：

```bash
cloudbase run rollback --name bilibili-web
```

或在控制台手动选择历史版本进行回滚。
