---
name: database-migration
description: Crear y ejecutar migraciones de base de datos TypeORM
category: database
disable-model-invocation: false
allowed-tools: Bash(npm *)
---

# Database Migration Skill

Gestión segura de migraciones de BD en VITAHUB.

## Crear nueva migración
```bash
cd apps/api
npx typeorm-ts-node-commonjs migration:create -- -d src/infrastructure/database-data-source.ts MigracionNombre
```

## Ver migraciones pendientes
```bash
npm run migration:run -- --dry-run
```

## Ejecutar migraciones (PRODUCCIÓN)
```bash
npm run migration:run
```

## Revertir última migración
```bash
npm run migration:revert
```

## Ver migraciones ejecutadas
```bash
cd apps/api
npx typeorm-ts-node-commonjs migration:show -d src/infrastructure/database-data-source.ts
```

## Checklist antes de migración
- [ ] Backup de BD realizado
- [ ] Tests pasando
- [ ] Migración probada en local
- [ ] Cambios en entities verificados
- [ ] Rollback plan preparado

## Rollback manual (si es necesario)
```bash
npm run migration:revert
npm run migration:revert  # Ejecutar varias veces para revertir múltiples
```
