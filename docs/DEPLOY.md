# Linux 部署文档

## 一、环境要求

| 软件 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | >= 18.x | 推荐 LTS 版本 |
| npm | >= 9.x | 随 Node.js 安装 |
| SQLite | 系统自带 | better-sqlite3 内置 |

## 二、安装 Node.js

### 方式一：使用 nvm（推荐）

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 重新加载配置
source ~/.bashrc

# 安装 Node.js 20 LTS
nvm install 20

# 设置默认版本
nvm use 20

# 验证
node -v
npm -v
```

### 方式二：使用包管理器

**Ubuntu/Debian：**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**CentOS/RHEL：**
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

## 三、上传项目

### 方式一：使用 scp

```bash
# 在本地执行，将项目上传到服务器
scp -r question-bank-manager.zip user@server-ip:/home/user/
```

### 方式二：使用 Git

```bash
# 在服务器上克隆项目
git clone https://github.com/your-username/question-bank-manager.git
cd question-bank-manager

# 切换到登录功能分支（如果需要）
git checkout feature/login
```

### 方式三：使用 SFTP 工具

使用 FileZilla、WinSCP 等工具上传项目文件夹。

## 四、解压并安装依赖

```bash
# 解压（如果是 zip 文件）
unzip question-bank-manager.zip
cd question-bank-manager

# 安装后端依赖
npm install

# 安装前端依赖并构建
cd frontend
npm install
npm run build
cd ..
```

## 五、配置环境变量

创建 `.env` 文件（可选）：

```bash
# 服务端口
PORT=3000

# JWT 密钥（建议修改为随机字符串）
JWT_SECRET=your-random-secret-key-here
```

## 六、启动服务

### 方式一：直接启动（测试用）

```bash
node backend/server.js
```

### 方式二：使用 PM2（推荐生产环境）

```bash
# 全局安装 PM2
npm install -g pm2

# 启动服务
pm2 start server.js --name "question-bank"

# 设置开机自启
pm2 startup
pm2 save

# 常用命令
pm2 status          # 查看状态
pm2 logs            # 查看日志
pm2 restart all     # 重启所有服务
pm2 stop all        # 停止所有服务
```

### 方式三：使用 systemd

创建服务文件：

```bash
sudo nano /etc/systemd/system/question-bank.service
```

写入以下内容：

```ini
[Unit]
Description=Question Bank Manager
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username/question-bank-manager
ExecStart=/usr/bin/node backend/server.js
Restart=on-failure
RestartSec=10
Environment=PORT=3000
Environment=JWT_SECRET=your-random-secret-key

[Install]
WantedBy=multi-user.target
```

启用并启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable question-bank
sudo systemctl start question-bank

# 查看状态
sudo systemctl status question-bank

# 查看日志
journalctl -u question-bank -f
```

## 七、配置 Nginx 反向代理（可选）

如果需要使用域名访问或 HTTPS，配置 Nginx：

```bash
sudo nano /etc/nginx/sites-available/question-bank
```

写入以下内容：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或 IP

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/question-bank /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 八、配置 HTTPS（可选）

使用 Let's Encrypt 免费证书：

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

## 九、防火墙配置

```bash
# Ubuntu/Debian
sudo ufw allow 3000/tcp  # 如果直接使用 Node.js 端口
sudo ufw allow 80/tcp    # 如果使用 Nginx
sudo ufw allow 443/tcp   # 如果使用 HTTPS

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

## 十、访问服务

| 访问方式 | 地址 |
|----------|------|
| 直接访问 | `http://服务器IP:3000` |
| Nginx 代理 | `http://你的域名` |
| HTTPS | `https://你的域名` |

## 十一、默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |

**首次登录后请立即修改密码！**

## 十二、常用维护命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs question-bank

# 重启服务
pm2 restart question-bank

# 更新项目
cd /home/your-username/question-bank-manager
git pull origin main
cd frontend && npm run build && cd ..
pm2 restart question-bank

# 备份数据库
cp data/default.db data/default.db.backup.$(date +%Y%m%d)
```

## 十二点五、从 v1.0.0 升级到 v2.0.0

v2.0.0 对目录结构做了重大调整：后端源码迁入 `backend/`，运行时数据（`default.db`、`db-config.json`、`databases/`、`tmp-uploads/`）统一存放在 `data/` 目录。**v1.0.0 用户升级时必须执行一次数据迁移，否则服务会读到新的空数据库。**

### PM2 / systemd 裸机部署

```bash
# 1. 停止服务
pm2 stop question-bank

# 2. 拉取代码并安装依赖
cd /home/your-username/question-bank-manager
git pull origin main
npm install

# 3. 迁移历史数据到 data/（一次性执行，自动改写 db-config.json 中的路径）
node scripts/migrate-data-dir.js

# 4. 重新构建前端
cd frontend && npm run build && cd ..

# 5. 启动路径已变更（server.js 迁至 backend/），重建 PM2 进程
pm2 delete question-bank
pm2 start backend/server.js --name "question-bank"
pm2 save
```

使用 systemd 的部署请同步修改服务文件中的 `ExecStart` 为 `/usr/bin/node backend/server.js`，然后 `sudo systemctl daemon-reload && sudo systemctl restart question-bank`。

### Docker 部署

数据卷挂载（`./data:/app/data`）与 v1.0.0 保持一致，无需数据迁移，重新构建即可：

```bash
docker compose up -d --build
```

## 十三、常见问题

### 1. 端口被占用

```bash
# 查看端口占用
lsof -i :3000

# 杀死进程
kill -9 PID
```

### 2. 权限问题

```bash
# 修改文件权限
chmod -R 755 question-bank-manager
```

### 3. 数据库锁定

```bash
# 停止服务后复制数据库
pm2 stop question-bank
cp data/default.db data/default.db.backup
pm2 start question-bank
```

### 4. 内存不足

```bash
# 查看内存使用
free -h

# 增加 swap 空间
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 十四、目录结构

```
question-bank-manager/
├── package.json        # 项目配置
├── backend/            # 后端源码
│   ├── server.js       # 主服务文件
│   ├── db-init.js      # 数据库初始化
│   ├── routes/         # API 路由
│   └── middleware/     # 中间件
├── data/               # 运行时数据（DATA_DIR 默认目录）
│   ├── default.db      # SQLite 数据库
│   ├── db-config.json  # 数据库配置
│   ├── databases/      # 上传的数据库
│   └── tmp-uploads/    # 上传临时文件
├── frontend/           # 前端代码
│   ├── src/            # 源代码
│   └── dist/           # 构建产物
└── docs/DEPLOY.md      # 部署文档（本文件）
```

---

## 十五、Docker 部署

### 1. 环境要求

| 软件 | 版本要求 |
|------|----------|
| Docker | >= 20.x |
| Docker Compose | >= 2.x |

### 2. 快速启动

```bash
# 克隆项目后，在项目根目录执行
docker compose up -d --build
```

首次启动会自动：
- 构建前端（Vite）
- 安装后端依赖
- 初始化数据库
- 创建默认管理员账号 `admin / admin123`

启动后访问 `http://你的服务器IP:3000`

### 3. 数据持久化

所有数据存储在项目根目录的 `data/` 文件夹中：

```
data/
├── default.db          # SQLite 数据库
├── db-config.json      # 运行时配置
├── databases/          # 上传的数据库文件
└── tmp-uploads/        # 临时上传目录
```

备份时只需复制 `data/` 目录即可。

### 4. 环境变量

在 `docker-compose.yml` 中修改：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `JWT_SECRET` | `change-me-in-production` | JWT 密钥，**务必修改** |
| `DATA_DIR` | `/app/data` | 数据存储目录 |

### 5. 常用命令

```bash
# 启动
docker compose up -d

# 查看日志
docker compose logs -f

# 停止
docker compose down

# 重新构建（代码更新后）
docker compose up -d --build

# 进入容器
docker exec -it question-bank-manager sh
```

### 6. 自定义端口

修改 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "8080:3000"  # 外部 8080 映射到容器 3000
```

### 7. Nginx 反向代理（可选）

```nginx
server {
    listen 80;
    server_name qb.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
