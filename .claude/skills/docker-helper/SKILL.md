---
name: docker-helper
description: Docker compose y comandos para VITAHUB
category: devops
disable-model-invocation: false
allowed-tools: Bash(docker *)
---

# Docker Helper Skill

Gestión de contenedores para VITAHUB.

## Iniciar stack local
```bash
docker-compose up -d
```

## Ver status
```bash
docker-compose ps
```

## Ver logs
```bash
docker-compose logs -f
docker-compose logs -f api
```

## Detener stack
```bash
docker-compose down
```

## Limpiar todo (containers, volumes)
```bash
docker-compose down -v
```

## Rebuild imagen
```bash
docker-compose build --no-cache
docker-compose up -d
```

## Acceder a contenedor
```bash
docker-compose exec api bash
docker-compose exec db mysql -uuser -ppassword vitahub
```

## Comandos útiles
```bash
docker ps -a              # Ver todos los containers
docker logs container-id  # Ver logs
docker exec -it id bash   # Entrar al container
docker volume ls          # Ver volúmenes
docker network ls         # Ver redes
```

## Resetear ambiente local
```bash
docker-compose down -v
docker-compose up -d
npm run local:seed        # Popular con datos
```
