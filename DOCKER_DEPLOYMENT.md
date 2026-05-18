# OmniRoute with Tool Scaffolding - Docker Deployment Guide

## Quick Start

### Option 1: Using Docker Compose (Recommended)

```bash
# Copy the docker-compose file
cp docker-compose.toolscaffold.yml docker-compose.yml

# Start the container
docker-compose up -d

# View logs
docker-compose logs -f omniroute-toolscaffold

# Stop the container
docker-compose down
```

### Option 2: Direct Docker Command

```bash
docker run -d \
  --name omniroute-toolscaffold \
  --restart unless-stopped \
  -p 127.0.0.1:20128:20128 \
  -v ./omniroute-data:/app/data \
  -e INITIAL_PASSWORD=hoo0o0o0ooooOooO00oo0OOoooraaay \
  -e PORT=20128 \
  -e NEXT_PUBLIC_BASE_URL=https://or.de.snnlab.ru \
  ghcr.io/diegosouzapw/omniroute-toolscaffold:toolscaffold-latest
```

## Image Information

**Repository**: `ghcr.io/diegosouzapw/omniroute-toolscaffold`

**Available Tags**:
- `toolscaffold-latest` - Latest build with tool scaffolding
- `main` - Latest from main branch
- `main-<sha>` - Specific commit hash
- Semantic versions (when released)

## What's Included

✅ Full OmniRoute with all features
✅ Tool Prompt Scaffolding support
✅ MS-Web tool support
✅ Muse model tool support
✅ All testing infrastructure
✅ Production-ready configuration

## Environment Variables

```bash
# Required
PORT=20128
INITIAL_PASSWORD=your-secure-password

# Optional but recommended
NEXT_PUBLIC_BASE_URL=https://your-domain.com
NODE_ENV=production
ENABLE_TOOL_SCAFFOLDING=true
```

## Volume Mounting

The container uses `/app/data` for persistent storage:

```bash
-v ./omniroute-data:/app/data
```

This directory will contain:
- Configuration files
- Database (if applicable)
- Logs
- Cache files

## Health Check

The container includes a health check:

```bash
# Check status
docker inspect --format='{{.State.Health.Status}}' omniroute-toolscaffold

# Expected output: healthy
```

## Port Binding

By default, the service is bound to localhost only for security:

```bash
-p 127.0.0.1:20128:20128
```

To expose to network:
```bash
-p 20128:20128
```

## Building Locally

If you want to build the image yourself:

```bash
cd OmniRoute-with-tool-scaffolding

docker build \
  -f Dockerfile.toolscaffold \
  -t omniroute-toolscaffold:local .

docker run -d \
  --name omniroute-local \
  -p 127.0.0.1:20128:20128 \
  -v ./omniroute-data:/app/data \
  omniroute-toolscaffold:local
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker logs omniroute-toolscaffold

# Check if port is in use
lsof -i :20128

# Restart container
docker restart omniroute-toolscaffold
```

### Permission issues
```bash
# Fix data directory permissions
sudo chown -R $USER:$USER ./omniroute-data

# Or run with proper permissions
docker run ... -u $(id -u):$(id -g) ...
```

### Out of memory
```bash
# Add memory limits to docker-compose
services:
  omniroute-toolscaffold:
    # ... other config ...
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G
```

## Performance Tuning

### CPU Limits
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
    reservations:
      cpus: '1'
```

### Memory Limits
```yaml
deploy:
  resources:
    limits:
      memory: 4G
    reservations:
      memory: 2G
```

## Security Best Practices

1. **Change the password**:
   ```bash
   INITIAL_PASSWORD=$(openssl rand -base64 32)
   docker run ... -e INITIAL_PASSWORD=$INITIAL_PASSWORD ...
   ```

2. **Use network isolation**:
   ```yaml
   networks:
     - omniroute-network
   
   networks:
     omniroute-network:
       driver: bridge
   ```

3. **Enable HTTPS** (via reverse proxy):
   ```nginx
   server {
     listen 443 ssl;
     server_name or.de.snnlab.ru;
     
     ssl_certificate /etc/letsencrypt/live/.../fullchain.pem;
     ssl_certificate_key /etc/letsencrypt/live/.../privkey.pem;
     
     location / {
       proxy_pass http://localhost:20128;
     }
   }
   ```

## Monitoring

### View Real-time Logs
```bash
docker-compose logs -f --tail 100 omniroute-toolscaffold
```

### Check Resource Usage
```bash
docker stats omniroute-toolscaffold
```

### Inspect Container
```bash
docker inspect omniroute-toolscaffold
```

## Updating

### Pull Latest Image
```bash
docker pull ghcr.io/diegosouzapw/omniroute-toolscaffold:toolscaffold-latest

# Stop and remove old container
docker-compose down

# Start with new image
docker-compose up -d
```

### Backup Data Before Update
```bash
cp -r omniroute-data omniroute-data.backup.$(date +%s)
```

## Integration with Nginx

```nginx
upstream omniroute {
  server 127.0.0.1:20128;
}

server {
  server_name or.de.snnlab.ru;

  location / {
    proxy_pass http://omniroute;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Integration with systemd

Create `/etc/systemd/system/omniroute-toolscaffold.service`:

```ini
[Unit]
Description=OmniRoute with Tool Scaffolding
After=docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=10
ExecStart=/usr/bin/docker run \
  --name omniroute-toolscaffold \
  -p 127.0.0.1:20128:20128 \
  -v /data/omniroute:/app/data \
  -e INITIAL_PASSWORD=your-password \
  ghcr.io/diegosouzapw/omniroute-toolscaffold:toolscaffold-latest

ExecStop=/usr/bin/docker stop omniroute-toolscaffold

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable omniroute-toolscaffold
sudo systemctl start omniroute-toolscaffold
sudo systemctl status omniroute-toolscaffold
```

## Support

For issues:
1. Check `/omniroute-data/logs`
2. Review docker logs: `docker logs omniroute-toolscaffold`
3. Check GitHub Issues
4. Refer to main OmniRoute documentation

---

**Image**: ghcr.io/diegosouzapw/omniroute-toolscaffold:toolscaffold-latest
**Based on**: OmniRoute with Tool Prompt Scaffolding
**Node Version**: 18-alpine
