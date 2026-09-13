# 快速启动指南

5 分钟内启动 Football AI Community。

## 前置条件

- Docker 20.10+ 和 Docker Compose 2.x
- 互联网连接（首次启动需下载镜像和依赖）

## 最小化配置启动

### 1. 克隆仓库

```bash
git clone https://github.com/zzdzzh/football-ai-community.git
cd football-ai-community
```

### 2. 创建环境配置

```bash
cp .env.example .env
```

**最小化配置**（无需外部 API，仅体验基础功能）：

```env
# .env 文件内容
JWT_SECRET=your-random-secret-here
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
DATA_SOURCE=football-data
```

> 💡 **提示**：生产环境请使用强密码和随机 JWT 密钥

### 3. 启动服务

```bash
docker compose up -d
```

首次启动需要：
- 下载 Node.js 和 Nginx 基础镜像（~200MB）
- 构建应用镜像（2-3 分钟）
- 执行数据库迁移和初始化

### 4. 验证服务

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f
```

等待健康检查通过（约 30-60 秒）。

### 5. 访问应用

- **前台**：http://localhost:8080
- **API**：http://localhost:3000/api/health
- **API 文档**：http://localhost:3000/api/docs

### 6. 登录管理员账号

使用 `.env` 中配置的管理员凭据登录：

- 邮箱：`admin@example.com`
- 密码：`admin123`（或你设置的密码）

## 启用 AI 功能（可选）

如需启用 AI Agent 功能，需配置 LLM API：

```env
# 示例：智谱 BigModel（OpenAI 兼容）
AI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
AI_API_KEY=your-api-key-here
AI_MODEL=glm-4.7-flash

# 交互式 AI（更强模型）
AI_INTERACTIVE_API_KEY=your-interactive-key
AI_INTERACTIVE_MODEL=glm-5.1
```

重启服务：

```bash
docker compose restart server
```

## 启用完整数据源（可选）

如需访问真实的足球数据：

```env
# football-data.org（免费层可用）
FOOTBALL_DATA_API_KEY=your-football-data-key
```

申请地址：https://www.football-data.org/client/register

重启服务：

```bash
docker compose restart server
```

## 常用命令

```bash
# 停止服务
docker compose stop

# 启动服务
docker compose start

# 重启服务
docker compose restart

# 查看日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f server
docker compose logs -f web

# 清理所有容器和数据
docker compose down -v
```

## 故障排查

### 端口冲突

如果 3000 或 8080 端口已被占用，修改 `docker-compose.yml`：

```yaml
services:
  server:
    ports:
      - "3001:3000"  # 改为其他端口
  web:
    ports:
      - "8081:80"    # 改为其他端口
```

### 服务启动失败

```bash
# 查看详细日志
docker compose logs server

# 重新构建镜像
docker compose build --no-cache
docker compose up -d
```

### 健康检查失败

```bash
# 进入容器手动测试
docker compose exec server sh
wget -O- http://localhost:3000/api/health
```

## 下一步

- 📖 阅读 [DEPLOY.md](./DEPLOY.md) 了解生产部署
- 📚 查看 [README.md](./README.md) 了解完整功能
- 🔧 查看 [系统总览.md](./系统总览.md) 了解架构设计

## 获取帮助

- GitHub Issues: https://github.com/zzdzzh/football-ai-community/issues
- 文档：项目根目录的 Markdown 文件

## 许可证

MIT License - 详见 [LICENSE](./LICENSE)
