---
name: deploy
description: Desplegar aplicación VITAHUB a producción (build, test, deploy)
category: deployment
disable-model-invocation: false
allowed-tools: Bash(npm *)
---

# Deploy Skill

Desplegar VITAHUB a producción de forma segura.

## Pasos del Deploy

### 1️⃣ Build
```bash
npm run build:api
npm run build:web
```

### 2️⃣ Validar Ambiente
```bash
npm run check:production-env
npm run validate:env
```

### 3️⃣ Tests
```bash
npm test
```

### 4️⃣ Deploy a cPanel
```bash
npm run deploy:web:cpanel
```

### 5️⃣ Migraciones (si hay)
```bash
npm run migration:run
```

## Verificación Post-Deploy

- [ ] Sitio accesible en URL de producción
- [ ] API respondiendo correctamente
- [ ] Sin errores en Sentry
- [ ] Base de datos sincronizada
- [ ] Assets cargando correctamente
