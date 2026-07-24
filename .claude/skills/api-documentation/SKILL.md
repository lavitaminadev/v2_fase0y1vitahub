---
name: api-documentation
description: Generar y actualizar documentación Swagger de API
category: documentation
disable-model-invocation: false
allowed-tools: Bash(npm *)
---

# API Documentation Skill

Documentar endpoints de VITAHUB automáticamente.

## Ver documentación Swagger
```bash
npm run start:dev
# Acceder: http://localhost:3000/api/docs
```

## Generar documentación
La documentación se genera automáticamente con decoradores @ApiTags, @ApiOperation, @ApiResponse.

## Ejemplo de documentación completa

```typescript
@ApiTags('Clientes')
@Controller('clients')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class ClientsController {
  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear cliente' })
  @ApiResponse({ status: 201, description: 'Cliente creado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(@Body() dto: CreateClientDto) {
    return this.createClient.execute(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar clientes' })
  @ApiResponse({ status: 200, description: 'Lista de clientes' })
  list() {
    return this.listClients.execute();
  }
}
```

## Documentación de DTOs

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ example: 'Acme Corp', description: 'Nombre del cliente' })
  name: string;

  @ApiProperty({ required: false, example: 'industria' })
  industry?: string;
}
```

## Build de documentación
```bash
npm run build:api
# El Swagger se incluye en el build
```

## Desactivar Swagger en producción
```typescript
// En main.ts
if (process.env.NODE_ENV !== 'production') {
  SwaggerModule.setup('api/docs', app, document);
}
```
