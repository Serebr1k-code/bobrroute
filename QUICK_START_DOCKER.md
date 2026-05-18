# 🚀 Quick Start - OmniRoute with Tool Scaffolding

## Docker Deployment (2 минуты)

### Вариант 1: Docker Compose (Рекомендуется)

```bash
# Просто замени image в твоем docker-compose.yml
```

**Твой текущий compose:**
```yaml
services:
  omniroute:
    image: diegosouzapw/omniroute:latest
```

**Новый compose с tool scaffolding:**
```yaml
services:
  omniroute:
    image: ghcr.io/diegosouzapw/omniroute-toolscaffold:toolscaffold-latest
    container_name: omniroute
    restart: unless-stopped
    ports:
      - "127.0.0.1:20128:20128"
    volumes:
      - ./omniroute-data:/app/data
    environment:
      - INITIAL_PASSWORD=hoo0o0o0ooooOooO00oo0OOoooraaay
      - PORT=20128
      - NEXT_PUBLIC_BASE_URL=https://or.de.snnlab.ru
```

**Запуск:**
```bash
docker-compose down    # Останови старый контейнер
docker-compose up -d   # Запусти новый
docker-compose logs -f # Посмотри логи
```

### Вариант 2: Просто один docker run

```bash
docker run -d \
  --name omniroute \
  --restart unless-stopped \
  -p 127.0.0.1:20128:20128 \
  -v ./omniroute-data:/app/data \
  -e INITIAL_PASSWORD=hoo0o0o0ooooOooO00oo0OOoooraaay \
  -e PORT=20128 \
  -e NEXT_PUBLIC_BASE_URL=https://or.de.snnlab.ru \
  ghcr.io/diegosouzapw/omniroute-toolscaffold:toolscaffold-latest
```

## Что изменилось?

### ✨ Новые возможности:

✅ **MS-Web поддержка tools**
  - Раньше: tools не работали
  - Сейчас: полная поддержка через prompt scaffolding

✅ **Muse Spark поддержка tools**
  - Все варианты: muse-spark, muse-spark-thinking, muse-spark-contemplating
  - Работает как обычные tools

✅ **Прозрачная работа**
  - Для пользователя - все то же самое
  - За сценой - JSON форматирование и парсинг

### 📊 Как это работает:

```
User sends tools request
    ↓
System injects tool definitions into prompt
    ↓
Model returns text with <TOOL_CALL>{"tool_name": "...", ...}</TOOL_CALL>
    ↓
System extracts and converts to OpenAI format
    ↓
User gets standard response with tool_calls
```

## Проверка работы

```bash
# Посмотри что контейнер запустился
docker ps | grep omniroute

# Проверь логи
docker logs omniroute

# Проверь здоровье контейнера
docker inspect --format='{{.State.Health.Status}}' omniroute

# Должно вывести: healthy
```

## Откат (если что-то не так)

```bash
# Верни старый image
docker pull diegosouzapw/omniroute:latest
docker-compose down

# Обнови image в compose на старый
# diegosouzapw/omniroute:latest

docker-compose up -d
```

## Где логи?

```bash
# В реальном времени
docker logs -f omniroute

# Последние 100 строк
docker logs --tail 100 omniroute

# С временем
docker logs -f --timestamps omniroute

# Сохранить в файл
docker logs omniroute > omniroute.log 2>&1
```

## Проблемы?

### Контейнер не запускается
```bash
docker logs omniroute
# Смотри error сообщения
```

### Порт занят
```bash
lsof -i :20128
# Kill старый процесс если нужно
```

### Нет доступа к данным
```bash
# Проверь права на папку
ls -la omniroute-data/

# Если нужно, дай права
chmod -R 755 omniroute-data/
```

## Переменные окружения

```yaml
environment:
  PORT: 20128                              # Порт сервера
  INITIAL_PASSWORD: 'твой-пароль'         # Пароль админа
  NEXT_PUBLIC_BASE_URL: 'https://...'    # URL приложения
  NODE_ENV: production                     # Режим работы
```

## Image теги

```
ghcr.io/diegosouzapw/omniroute-toolscaffold:toolscaffold-latest  ← Используй этот

Дополнительно:
- main          → latest from main branch
- main-<sha>    → specific commit
- v1.0.0        → semantic version (когда будут)
```

## Обновление на новую версию

```bash
# Pull новый image
docker pull ghcr.io/diegosouzapw/omniroute-toolscaffold:toolscaffold-latest

# Перезапусти контейнер
docker-compose down
docker-compose up -d
```

## Storage/Persistence

Все данные сохраняются в `./omniroute-data`:
- Конфиги
- База данных (если есть)
- Логи
- Кэш

Можешь забэкапить:
```bash
tar -czf omniroute-backup.tar.gz omniroute-data/
```

## Максимум информации

Полная документация по деплойменту:
→ `/home/Serebr1k/DOCKER_DEPLOYMENT.md`

Информация о tool scaffolding:
→ `/home/Serebr1k/TOOL_SCAFFOLDING_SUMMARY.md`

---

**Готово! Просто замени image и рестартни контейнер.** 🎉
