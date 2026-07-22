import { Controller, Delete, Get, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors, Body, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { AuthenticatedRequest } from '@shared/types/request';
import { UploadsService } from './uploads.service';
import { CloudinaryService } from '../../core/cloudinary/cloudinary.service';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import { Upload } from './upload.entity';
import { randomUUID } from 'crypto';

class SyncDriveDto {
  @IsOptional() @IsString() @MaxLength(255) @Matches(/^[A-Za-z0-9_-]+$/)
  folderId?: string;
}

function toUploadResponse(upload: Upload) {
  const { path: _privatePath, ...safe } = upload;
  return safe;
}

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']);

@ApiTags('Archivos')
@Controller('uploads')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class UploadsController {
  constructor(
    private readonly service: UploadsService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.CREATIVE_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.DESIGNER, UserRole.AUDIOVISUAL)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Subir un archivo temporal seguro' })
  @ApiBody({ description: 'Archivo a subir (multipart/form-data)' })
  async upload(@UploadedFile() file: Express.Multer.File | undefined, @Req() req: AuthenticatedRequest) {
    return toUploadResponse(await this.service.upload(file, req.organizationId, req.user.id));
  }

  @Post('images')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.CREATIVE_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.DESIGNER, UserRole.AUDIOVISUAL)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Subir una imagen a Cloudinary' })
  @ApiBody({ description: 'Imagen a subir (multipart/form-data). Máximo 5 MB. Formatos: jpg, png, gif, webp, avif.' })
  async uploadImage(@UploadedFile() file: Express.Multer.File | undefined, @Req() req: AuthenticatedRequest) {
    if (!file?.buffer?.length) throw new BadRequestException('Debes seleccionar una imagen');
    if (!IMAGE_MIME_TYPES.has(file.mimetype)) throw new BadRequestException('Solo se permiten imágenes JPG, PNG, GIF, WebP o AVIF');
    const maxBytes = Math.min(Number(process.env.CLOUDINARY_MAX_IMAGE_BYTES || 5 * 1024 * 1024), 10 * 1024 * 1024);
    if (file.buffer.length > maxBytes) throw new BadRequestException(`La imagen no puede superar los ${Math.round(maxBytes / 1024 / 1024)} MB`);

    const result = await this.cloudinary.uploadImage(file.buffer, req.organizationId, {
      folder: `vitahub/${req.organizationId}`,
      fileName: `${randomUUID()}-${file.originalname}`,
      tags: [`org:${req.organizationId}`, `user:${req.user.id}`],
      mimeType: file.mimetype,
    });
    return { url: result.secureUrl, publicId: result.publicId, width: result.width, height: result.height };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.CREATIVE_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.DESIGNER, UserRole.AUDIOVISUAL)
  @ApiOperation({ summary: 'Obtener metadatos de un archivo' })
  async getMetadata(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return toUploadResponse(await this.service.getFile(id, req.organizationId));
  }

  @Post(':id/drive')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.CREATIVE_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  @ApiOperation({ summary: 'Sincronizar un archivo con Google Drive' })
  async syncDrive(@Param('id') id: string, @Body() dto: SyncDriveDto, @Req() req: AuthenticatedRequest) {
    return toUploadResponse(await this.service.syncToDrive(id, req.organizationId, dto.folderId));
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Eliminar un archivo temporal' })
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.service.delete(id, req.organizationId);
    return { deleted: true };
  }

  @Delete('images/cloudinary/:publicId')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.CREATIVE_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.DESIGNER, UserRole.AUDIOVISUAL)
  @ApiOperation({ summary: 'Eliminar una imagen de Cloudinary' })
  async deleteCloudinaryImage(@Param('publicId') publicId: string, @Req() req: AuthenticatedRequest) {
    await this.cloudinary.destroy(decodeURIComponent(publicId), req.organizationId);
    return { deleted: true };
  }
}
