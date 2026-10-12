#!/bin/bash

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/z/my-project}"
BUILD_DIR="${BUILD_DIR:?BUILD_DIR is required}"

# 本项目使用 PostgreSQL（见 prisma/schema.prisma 的 provider），schema 保存在
# 外部数据库（如 Neon），构建产物中不再打包 SQLite 文件。部署环境必须注入
# DATABASE_URL —— 缺失时明确失败，避免启动到空数据库。
if [ -z "${DATABASE_URL:-}" ]; then
    echo "❌ DATABASE_URL 未设置"
    echo "   本项目使用 PostgreSQL（Neon）。请通过部署环境注入 DATABASE_URL，例如:"
    echo "   postgresql://user:pass@ep-xxxxx.neon.tech/neondb?sslmode=require"
    echo "   以及 ADMIN_TOKEN（管理后台令牌）"
    exit 1
fi

case "$DATABASE_URL" in
    file:*)
        echo "❌ DATABASE_URL 指向本地文件（file:...），但 schema 已切换为 PostgreSQL"
        echo "   请改用 postgresql:// 连接串"
        exit 1
        ;;
esac

echo "🗄️  同步外部 PostgreSQL 数据库结构..."
(
    cd "$PROJECT_DIR"
    bun run db:push
)

echo "✅ 数据库结构已同步"
