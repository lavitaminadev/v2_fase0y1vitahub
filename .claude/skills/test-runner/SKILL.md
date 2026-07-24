---
name: test-runner
description: Ejecutar tests del API y web con reportes de cobertura
category: testing
disable-model-invocation: false
allowed-tools: Bash(npm *)
---

# Test Runner Skill

Suite completa de testing para VITAHUB.

## Ejecutar todos los tests
```bash
npm test
```

## Tests del API
```bash
npm run test:api
```

## Tests del Frontend
```bash
npm run test:web
```

## Tests con coverage
```bash
npm test -- --coverage
```

## Tests en modo watch (desarrollo)
```bash
npm run test:watch
```

## Ejecutar test específico
```bash
npm run test:api -- auth.service.spec.ts
```

## Generar reporte HTML
```bash
npm test -- --coverage --reporter=html
# Abrir: coverage/index.html
```

## Coverage requirements
- Líneas: 80%
- Funciones: 75%
- Branches: 70%

## Limpiar caché de tests
```bash
npm test -- --clearCache
```

## Debug de test
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Performance baseline
```bash
npm test -- --testTimeout=30000
```
