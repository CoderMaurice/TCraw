# TCraw 线上部署手册（给 AI 执行）

本文档描述 `ssh zt` 上 TCraw / LibreChat 线上环境的唯一正确部署方式。执行部署的 AI 必须严格遵守，不要根据 LibreChat 默认文档自行改目录。

## 线上固定结构

唯一入口：

```bash
/opt/librechat/compose.zt.yml
```

运行配置：

```bash
/opt/librechat/.env
/opt/librechat/librechat.yaml
/opt/librechat/DEPLOYMENT.md
```

唯一持久化数据根目录：

```bash
/root/projects/TCraw/data
```

当前 compose 必须使用这些绝对路径：

```bash
/root/projects/TCraw/data/data-node:/data/db
/root/projects/TCraw/data/images:/app/client/public/images
/root/projects/TCraw/data/uploads:/app/uploads
/root/projects/TCraw/data/logs:/app/logs
/root/projects/TCraw/data/skill:/app/skill
/root/projects/TCraw/data/meili_data_v1.35.1:/meili_data
/root/projects/TCraw/data/pgdata2:/var/lib/postgresql/data
```

禁止事项：

- 不要把 Mongo、Meilisearch、pgvector、uploads、images、logs、skill 挂到 `/opt/librechat/...`。
- 不要在 `/root/projects/TCraw/compose.zt.yml` 启动线上服务。
- 不要在 `/opt/librechat` 放源码并从那里构建或运行。
- 不要执行 `docker compose down -v`。
- 不要删除 `/root/projects/TCraw/data`。
- 不要把 compose 里的数据卷改回相对路径，例如 `./data-node`。

## 当前生产容器

应存在并运行：

```bash
LibreChat
chat-mongodb
chat-meilisearch
librechat-vectordb
librechat-rag-api
```

检查命令：

```bash
ssh zt 'docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep -E "LibreChat|chat-mongodb|chat-meilisearch|librechat-vectordb|librechat-rag-api"'
```

## 部署前检查

在本地仓库确认当前分支和改动：

```bash
git status --short
git rev-parse --short HEAD
```

在服务器确认线上 compose 仍然指向正确数据目录：

```bash
ssh zt 'grep -n "image:\|root/projects/TCraw/data\|data-node" /opt/librechat/compose.zt.yml'
```

确认线上接口可访问：

```bash
ssh zt 'curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:13080'
```

确认核心数据量，不要求数量固定，但不能突然变成 0：

```bash
ssh zt 'docker exec chat-mongodb mongosh --quiet --eval '"'"'
const dbx=db.getSiblingDB("LibreChat");
for (const c of ["users","conversations","messages","skills","skillfiles","mcpservers","agents","aclentries"]) {
  print(c + "\t" + dbx[c].countDocuments({}));
}
'"'"''
```

## 标准部署流程

设置镜像标签。标签必须可追溯，建议使用当前 commit 和简短说明：

```bash
export SHA="$(git rev-parse --short HEAD)"
export IMAGE_TAG="zitoo-tcrawl:${SHA}-short-description"
export BUILD_DIR="/tmp/tcrawl-deploy-${SHA}"
```

把源码同步到服务器临时构建目录：

```bash
ssh zt "rm -rf '$BUILD_DIR' && mkdir -p '$BUILD_DIR'"
rsync -az --delete \
  --exclude .git \
  --exclude node_modules \
  --exclude '**/node_modules' \
  --exclude '**/dist' \
  --exclude client/dist \
  --exclude api/dist \
  --exclude packages/api/dist \
  --exclude packages/data-provider/dist \
  ./ "zt:$BUILD_DIR/"
```

在服务器构建镜像：

```bash
ssh zt "cd '$BUILD_DIR' && docker build -t '$IMAGE_TAG' ."
```

备份 compose：

```bash
ssh zt 'cp /opt/librechat/compose.zt.yml /opt/librechat/compose.zt.yml.bak.$(date +%Y%m%d%H%M%S)'
```

只替换 compose 的 `api.image`，不要改任何 volume：

```bash
ssh zt "python3 - <<'PY'
from pathlib import Path
image = '${IMAGE_TAG}'
path = Path('/opt/librechat/compose.zt.yml')
text = path.read_text()
lines = text.splitlines()
in_api = False
changed = False
for i, line in enumerate(lines):
    if line.startswith('  api:'):
        in_api = True
        continue
    if in_api and line.startswith('  ') and not line.startswith('    ') and line.strip().endswith(':'):
        in_api = False
    if in_api and line.strip().startswith('image:'):
        lines[i] = '    image: ' + image
        changed = True
        break
if not changed:
    raise SystemExit('api.image not found')
path.write_text('\\n'.join(lines) + '\\n')
PY"
```

校验 compose：

```bash
ssh zt 'docker compose -f /opt/librechat/compose.zt.yml config >/tmp/tcrawl-compose-check.yml'
```

启动：

```bash
ssh zt 'cd /opt/librechat && docker compose -f compose.zt.yml up -d'
```

## 部署后验证

确认容器运行：

```bash
ssh zt 'docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep -E "LibreChat|chat-mongodb|chat-meilisearch|librechat-vectordb|librechat-rag-api"'
```

确认 API：

```bash
ssh zt 'curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:13080'
```

确认 Mongo 实际挂载仍然是旧数据源：

```bash
ssh zt 'docker inspect chat-mongodb --format "{{range .Mounts}}{{println .Source \"=>\" .Destination}}{{end}}"'
```

输出必须包含：

```text
/root/projects/TCraw/data/data-node => /data/db
```

确认关键数据量：

```bash
ssh zt 'docker exec chat-mongodb mongosh --quiet --eval '"'"'
const dbx=db.getSiblingDB("LibreChat");
for (const c of ["conversations","messages","skills","mcpservers","agents"]) {
  print(c + "\t" + dbx[c].countDocuments({}));
}
'"'"''
```

确认 compose 没有误用 `/opt/librechat` 数据路径：

```bash
ssh zt 'grep -n "/opt/librechat/.*data-node\|/opt/librechat/.*uploads\|/opt/librechat/.*images\|./data-node" /opt/librechat/compose.zt.yml && exit 1 || echo "volume paths ok"'
```

## 清理

部署成功后可以删除临时构建目录：

```bash
ssh zt "rm -rf '$BUILD_DIR'"
```

可以只保留当前生产镜像，删除旧的 `zitoo-tcrawl` 镜像：

```bash
ssh zt 'CURRENT="$(docker inspect LibreChat --format "{{.Config.Image}}")"; docker images --format "{{.Repository}}:{{.Tag}} {{.ID}}" | while read ref id; do if [ "${ref#zitoo-tcrawl:}" != "$ref" ] && [ "$ref" != "$CURRENT" ]; then docker rmi -f "$id"; fi; done'
```

不要清理以下目录：

```bash
/root/projects/TCraw/data
/opt/librechat/.env
/opt/librechat/librechat.yaml
/opt/librechat/compose.zt.yml
```

## 回滚

如果新镜像启动失败，先查当前和备份：

```bash
ssh zt 'grep -n "image:" /opt/librechat/compose.zt.yml; ls -t /opt/librechat/compose.zt.yml.bak* | head'
```

回滚方式：

```bash
ssh zt 'cp /opt/librechat/compose.zt.yml.bak.YYYYMMDDHHMMSS /opt/librechat/compose.zt.yml'
ssh zt 'cd /opt/librechat && docker compose -f compose.zt.yml up -d'
```

回滚后仍要验证 Mongo 挂载路径和数据量。

## 事故排查：数据突然变少

优先检查是否又切错数据目录：

```bash
ssh zt 'docker inspect chat-mongodb --format "{{range .Mounts}}{{println .Source \"=>\" .Destination}}{{end}}"'
ssh zt 'grep -n "data-node\|uploads\|images\|pgdata2\|meili_data" /opt/librechat/compose.zt.yml'
```

正确数据目录是：

```bash
/root/projects/TCraw/data/data-node
```

如果看到 `/opt/librechat/data-node`、`./data-node` 或其他路径，说明 compose 被改坏了。不要恢复数据库文件，先把 compose volume 改回 `/root/projects/TCraw/data/...` 后重启。

## 本次整理后的服务器约定

`/opt/librechat` 不再作为源码目录，只作为部署控制目录。正常情况下里面只应有：

```text
.env
DEPLOYMENT.md
compose.zt.yml
librechat.yaml
compose.zt.yml.bak.*
```

应用代码全部来自 Docker 镜像。持久化数据全部来自 `/root/projects/TCraw/data`。
