---
name: git-workflow
description: Flujo de trabajo Git completo (feature branch, commit, push, PR)
category: version-control
disable-model-invocation: false
allowed-tools: Bash(git *)
---

# Git Workflow Skill

Manejo profesional de ramas y commits en VITAHUB.

## Crear Feature Branch
```bash
git checkout -b feature/nombre-descriptivo
```

## Hacer cambios y commit
```bash
git add archivo1 archivo2  # Específicos, no git add .
git commit -m "feat: descripción del cambio"
```

## Tipos de commits
- `feat:` - Nueva funcionalidad
- `fix:` - Corrección de bug
- `refactor:` - Refactorización
- `test:` - Tests
- `docs:` - Documentación
- `style:` - Formato (sin cambios lógicos)
- `chore:` - Mantenimiento

## Push y Pull Request
```bash
git push origin feature/nombre-descriptivo
# Luego crear PR en GitHub
```

## Merge
```bash
git checkout main
git pull origin main
git merge feature/nombre-descriptivo
git push origin main
```

## Actualizar main local
```bash
git checkout main
git pull origin main
```

## Ver historial
```bash
git log --oneline -10
git log --graph --oneline --all
```

## Descartar cambios
```bash
git checkout -- archivo  # Descartar cambios sin staged
git reset HEAD archivo   # Unstage
```
