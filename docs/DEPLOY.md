# Guía de Despliegue - VITAHUB

## Despliegue con Docker Compose

### Requisitos del servidor

- Docker `>=24`
- Docker Compose `>=2.20`
- 2 GB RAM mínimos
- 10 GB disco

### Pasos

```bash
# 1. Clonar en el servidor
git clone https://github.com/tu-org/hubvit.git /opt/vitahub
cd /opt/vitahub

# 2. Configurar variables de producción
cp .env.example .env
# Editar JWT_SECRET, DB_PASSWORD, etc.

# 3. Iniciar todos los servicios
cd infrastructure
docker-compose up -d

# 4. Verificar estado
docker-compose ps
docker-compose logs -f api
```

### Servicios

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| `mysql` | `3306` | Base de datos MySQL 8 |
| `redis` | `6379` | Caché Redis 7 |
| `api` | `3000` | API NestJS |
| `web` | `80` | Frontend (Nginx) |

## Consideraciones de Producción

### Seguridad
- Cambiar `JWT_SECRET` por un valor seguro
- Cambiar `DB_PASSWORD` por una contraseña fuerte
- Configurar `NODE_ENV=production` (desactiva `synchronize`)
- Usar HTTPS con certificado SSL (reverse proxy Nginx/Caddy)
- Restringir CORS al dominio del frontend

### Base de Datos
- Ejecutar migraciones manualmente (nunca usar `synchronize` en producción)
- Hacer backup diario de MySQL
- Configurar `utf8mb4_unicode_ci` como charset

### API
- Usar PM2 o similar para gestión de procesos (ver `ecosystem.config.js`)
- Configurar rate limiting (ThrottlerModule)
- Monitorear logs con `logging.interceptor.ts`

### Frontend
- Compilar assets estáticos con `npm run build:web`
- Servir con Nginx (ver `nginx.conf`)
- Configurar cache de assets estáticos

## Health Check Endpoints

```bash
# Health check general
curl http://localhost:3000/api/health

# Health check base de datos
curl http://localhost:3000/api/health/db
```

Respuesta esperada:
```json
{
  "status": "ok",
  "uptime": 12345,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "database": { "status": "ok", "connected": true },
  "memory": { "status": "ok", "freeMb": 1024, "totalMb": 8192, "usagePercent": "45.2%" },
  "disk": { "status": "ok", "writable": true },
  "redis": { "status": "ok", "connected": true }
}
```

## Monitoreo

### Logs
- La API escribe logs estructurados (NestJS Logger)
- Los interceptores capturan métricas de request/respons e
- Endpoint `GET /metrics` (solo admin) expone métricas del sistema

### Alertas sugeridas
- Health check cada 30 segundos
- Alerta si `status != "ok"`
- Alerta si uso de memoria > 85%
- Alerta si disco > 90%

## Backup Strategy

### Base de Datos
```bash
# Backup diario con mysqldump
docker exec vitahub-mysql mysqldump -u vitahub -p vitahub > /backups/vitahub_$(date +%Y%m%d).sql

# Retención: 7 días diarios, 4 semanas semanales, 12 meses mensuales
```

### Archivos
- Los archivos subidos se almacenan en `STORAGE_PATH` (default: `./storage`)
- Backup periódico del directorio de almacenamiento
- Si se usa S3/GCS, la durabilidad está garantizada por el proveedor

## Configuración de Nginx (Frontend)

Ver `infrastructure/deployment/nginx.conf` para la configuración de producción.

## PM2 (Procesos)

Ver `infrastructure/deployment/ecosystem.config.js` para la configuración de PM2 con:
- Auto-reinicio en caso de fallo
- Logs rotativos
- Monitoreo de memoria
- Modo cluster (opcional)
