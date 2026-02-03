# OpenClaw DingTalk 插件安装指南

## 前置条件

### 系统要求
- Node.js >= 18.0.0
- npm 或 pnpm
- OpenClaw >= 2026.1.29

### 检查 OpenClaw 安装
```bash
# 检查 OpenClaw 是否已安装
openclaw --version

# 或者查看安装目录
ls ~/openclaw  # Linux/Mac
dir %USERPROFILE%\openclaw  # Windows
```

---

## 安装方式

### 方式 A: 从本地路径安装（推荐用于开发）

#### 1. 克隆仓库
```bash
git clone https://github.com/wulien/openclaw-dingtalk.git
cd openclaw-dingtalk
```

#### 2. 安装依赖
```bash
npm install
```

#### 3. 安装插件到 OpenClaw
```bash
openclaw plugins install .
```

### 方式 B: 从 GitHub 直接安装
```bash
openclaw plugins install https://github.com/wulien/openclaw-dingtalk
```

### 方式 C: 从 npm 安装（需要先发布）
```bash
openclaw plugins install dingtalk
```

---

## 配置

### 1. 获取钉钉应用凭证

#### 1.1 创建钉钉企业内部应用
1. 访问 [钉钉开放平台](https://open.dingtalk.com)
2. 进入"应用开发" → "企业内部应用" → "创建应用"
3. 填写应用信息（名称、描述、图标）

#### 1.2 获取凭证
在应用详情页面获取：
- **Client ID** (AppKey)
- **Client Secret** (AppSecret)
- **Robot Code** (机器人 Code)

#### 1.3 配置权限
在"权限管理"页面，开通以下权限：
- ✅ 企业内部应用机器人（必须）
- ✅ 消息通知权限（必须）
- ✅ 单聊消息读取权限（必须）
- ✅ 群会话消息读取权限（可选，如果需要群聊功能）

#### 1.4 配置事件订阅（重要！）
在"事件订阅"页面：
1. 选择 **"Stream 模式"**（不是 HTTP 回调）
2. 订阅以下事件：
   - ✅ 机器人接收消息
3. 保存并 **发布应用**

### 2. 配置 OpenClaw

```bash
# 启用钉钉渠道
openclaw config set channels.dingtalk.enabled true

# 配置凭证
openclaw config set channels.dingtalk.clientId "YOUR_CLIENT_ID"
openclaw config set channels.dingtalk.clientSecret "YOUR_CLIENT_SECRET"
openclaw config set channels.dingtalk.robotCode "YOUR_ROBOT_CODE"

# 配置连接模式（Stream 模式）
openclaw config set channels.dingtalk.connectionMode "stream"

# 配置策略（可选）
openclaw config set channels.dingtalk.dmPolicy "pairing"
openclaw config set channels.dingtalk.groupPolicy "allowlist"
```

### 3. 验证配置

```bash
# 查看配置
openclaw config get channels.dingtalk

# 查看插件列表
openclaw plugins list | grep dingtalk
```

---

## 启动

### 1. 启动 Gateway

```bash
# 前台启动（用于调试）
openclaw gateway --verbose

# 后台启动（Linux/Mac）
nohup openclaw gateway --verbose > openclaw-gateway.log 2>&1 &

# 后台启动（Windows，使用 PowerShell）
Start-Process openclaw -ArgumentList "gateway","--verbose" -NoNewWindow -RedirectStandardOutput "openclaw-gateway.log"
```

### 2. 查看日志

```bash
# 实时查看日志
tail -f openclaw-gateway.log  # Linux/Mac
Get-Content openclaw-gateway.log -Wait  # Windows PowerShell
```

### 3. 验证连接

启动后，日志中应该看到：
```
[dingtalk] [default] starting DingTalk provider
[dingtalk channel] Starting Stream client for account default
[dingtalk stream-client] Connecting to DingTalk Stream...
[dingtalk stream-client] Connected successfully ✅
[dingtalk channel] Stream connected for account default ✅
```

---

## 测试

### 1. 在钉钉中查找机器人
1. 打开钉钉手机端或 PC 端
2. 搜索你的机器人名称
3. 确认能找到机器人

### 2. 发送测试消息
向机器人发送消息："你好"

### 3. 查看日志
应该看到：
```
[dingtalk stream-client] Received robot message: {...}
[dingtalk channel] Processing message from user: xxx
[ai] Sending to Claude...
[dingtalk channel] Sending response...
```

---

## 故障排查

### 问题 1: 插件未加载

**检查**：
```bash
openclaw plugins list | grep dingtalk
```

**解决方案**：
```bash
# 重新安装插件
openclaw plugins install .

# 检查插件目录
ls ~/.openclaw/extensions/dingtalk  # Linux/Mac
dir %USERPROFILE%\.openclaw\extensions\dingtalk  # Windows
```

### 问题 2: JSON 解析错误（BOM 头问题）

**现象**：
```
invalid package.json: SyntaxError: Unexpected token '﻿'
```

**解决方案**：
1. 使用 VS Code 打开 package.json
2. 点击右下角的编码（UTF-8）
3. 选择"通过编码保存" → "UTF-8"（不是 UTF-8 with BOM）
4. 保存文件

或者运行检查脚本：
```bash
npm run check-encoding
```

### 问题 3: 插件 ID 不匹配警告

**现象**：
```
Config warnings:
- plugins.entries.dingtalk: plugin dingtalk: plugin id mismatch
```

**解决方案**：
确保 package.json 的 name 字段与 openclaw.plugin.json 的 id 字段一致，都应该是 "dingtalk"。

### 问题 4: Stream 连接失败

**检查**：
```bash
# 查看配置
openclaw config get channels.dingtalk

# 测试网络连接
curl https://api.dingtalk.com
```

**解决方案**：
1. 确认 clientId 和 clientSecret 正确
2. 确认网络可以访问钉钉 API
3. 查看详细错误日志

### 问题 5: 收不到消息

**检查清单**：
- [ ] 钉钉开放平台 → 事件订阅 → 确认选择了"Stream 模式"
- [ ] 确认订阅了"机器人接收消息"事件
- [ ] 确认应用已发布
- [ ] 确认权限已开通
- [ ] 确认 robotCode 配置正确

**解决方案**：
1. 重新配置事件订阅
2. 发布应用
3. 重启 Gateway

---

## 卸载

```bash
# 卸载插件
openclaw plugins uninstall dingtalk

# 或者手动删除
rm -rf ~/.openclaw/extensions/dingtalk  # Linux/Mac
rmdir /s %USERPROFILE%\.openclaw\extensions\dingtalk  # Windows

# 清理配置
openclaw config delete channels.dingtalk
```

---

## 开发

### 本地开发
```bash
# 克隆仓库
git clone https://github.com/wulien/openclaw-dingtalk.git
cd openclaw-dingtalk

# 安装依赖
npm install

# 类型检查
npm run typecheck

# 测试（需要配置 .env）
npm run test:standalone
```

### 检查编码
```bash
# 检查 BOM
npm run check-encoding
```

---

## 更多信息

- [GitHub 仓库](https://github.com/wulien/openclaw-dingtalk)
- [问题反馈](https://github.com/wulien/openclaw-dingtalk/issues)
- [钉钉开放平台文档](https://open.dingtalk.com/document/)
- [OpenClaw 文档](https://docs.openclaw.ai)

---

**最后更新**: 2026-02-03
**插件版本**: 0.1.0
**OpenClaw 版本**: >= 2026.1.29
