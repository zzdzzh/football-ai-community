# 部署指南

本文档详细说明如何部署 Football AI Community 到生产环境。

## 前置要求

- Docker 20.10+ 和 Docker Compose 2.x
- 至少 2GB 内存和 10GB 磁盘空间
- （可选）football-data.org API 密钥或 OpenAI 兼容 LLM API 密钥

## 快速开始

### 1. 配置环境变量

复制环境变量模板并填入实际值：

```bash
cp .env.example .env
```

编辑 `.env` 文件，必填项：

```env
# JWT 密钥（生产环境务必使用强随机字符串）
JWT_SECRET=your-production-jwt-secret-change-this

# 管理员账号
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your-secure-password

# 数据源（推荐使用 football-data）
DATA_SOURCE=football-data
FOOTBALL_DATA_API_KEY=your-football-data-api-key
```

可选配置（如需 AI 功能）：

```env
# AI 配置（示例：智谱 BigModel）
AI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
AI_API_KEY=your-api-key
AI_MODEL=glm-4.7-flash
AI_INTERACTIVE_API_KEY=your-interactive-api-key
AI_INTERACTIVE_MODEL=glm-5.1
```

### 2. 启动服务

```bash
docker compose up -d
```

首次启动会：
1. 构建 server 和 web 镜像
2. 创建并挂载数据卷
3. 执行数据库迁移
4. 创建管理员账号
5. 启动健康检查

### 3. 验证部署

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 测试健康检查
curl http://localhost:3000/api/health

# 访问前台
curl http://localhost:8080
```

服务地址：
- **前台**：`http://localhost:8080`
- **后台 API**：`http://localhost:3000`
- **API 文档**：`http://localhost:3000/api/docs`

### 4. 管理命令

```bash
# 停止服务
docker compose stop

# 启动服务
docker compose start

# 重启服务
docker compose restart

# 停止并删除容器（保留数据）
docker compose down

# 停止并删除容器及数据卷
docker compose down -v

# 查看实时日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f server
docker compose logs -f web

# 进入服务器容器
docker compose exec server sh

# 重新构建镜像
docker compose build --no-cache
```

## 数据持久化

Docker Compose 配置已自动挂载以下卷：

- `./server/data:/app/data` - SQLite 数据库和用户上传文件
- `./server/config:/app/config` - 配置文件（如内容过滤黑名单）

数据库文件位于 `./server/data/community.db`。

**备份建议**：
```bash
# 停止服务后备份数据库
docker compose stop server
cp ./server/data/community.db ./backups/community-$(date +%Y%m%d).db
docker compose start server
```

## 数据源配置

### 推荐：football-data.org API

优点：稳定、免费层可用、无需复杂依赖

```env
DATA_SOURCE=football-data
FOOTBALL_DATA_API_KEY=your-api-key
```

申请地址：https://www.football-data.org/client/register

### 备选：Python 爬虫

Docker 环境默认禁用爬虫（依赖复杂、需人工验证码处理）。如确需使用：

1. 本地运行服务器（非 Docker）
2. 配置 `DATA_SOURCE=scraper`
3. 参考 [README.md](./README.md) 安装 Python 环境

## 生产环境建议

### 安全加固

1. **更换默认密钥**
   ```env
   JWT_SECRET=$(openssl rand -hex 32)
   INTERNAL_API_KEY=$(openssl rand -hex 32)
   ```

2. **使用强密码**
   - `ADMIN_PASSWORD` 至少 12 位，包含大小写、数字、符号

3. **限制端口暴露**
   - 如使用反向代理，修改 `docker-compose.yml` 仅暴露内部端口

4. **HTTPS**
   - 使用 Nginx/Traefik + Let's Encrypt 证书
   - 参考 [nginx-proxy](https://github.com/nginx-proxy/nginx-proxy) 或 [Traefik](https://doc.traefik.io/traefik/)

### 性能优化

1. **数据库**
   - SQLite 适合中小规模（< 10万用户）
   - 大规模部署建议迁移至 PostgreSQL

2. **日志**
   - 配置日志轮转：
     ```yaml
     logging:
       driver: "json-file"
       options:
         max-size: "10m"
         max-file: "3"
     ```

3. **资源限制**
   - 在 `docker-compose.yml` 添加：
     ```yaml
     deploy:
       resources:
         limits:
           cpus: '2'
           memory: 1G
     ```

### 监控

```bash
# 资源使用
docker stats

# 健康检查状态
docker inspect football-ai-server | grep Health -A 10
docker inspect football-ai-web | grep Health -A 10
```

## 故障排查

### 服务启动失败

```bash
# 查看详细日志
docker compose logs server

# 常见问题：
# 1. 端口冲突 → 修改 docker-compose.yml 中的端口映射
# 2. 环境变量缺失 → 检查 .env 文件
# 3. 数据库迁移失败 → 删除 server/data 目录后重试
```

### 健康检查失败

```bash
# 进入容器手动测试
docker compose exec server sh
wget -O- http://localhost:3000/api/health

# 检查数据库
ls -la /app/data/
```

### 前台无法访问后台 API

1. 检查 `web/nginx.conf` 中 `proxy_pass` 配置
2. 确认 server 服务名在 Docker 网络中可解析：
   ```bash
   docker compose exec web ping server
   ```

## CI/CD 集成

GitHub Actions 工作流已配置在 `.github/workflows/ci.yml`：

- 后台单元测试 + 契约测试
- 前台 TypeScript 类型检查 + 构建
- Docker 镜像构建测试

推送到 `main` 或 `develop` 分支时自动触发。

## 许可证

MIT License - 详见 [LICENSE](./LICENSE)
