import { IsUUID } from 'class-validator';

export class ClientIdDto {
  @IsUUID() clientId: string;
}
