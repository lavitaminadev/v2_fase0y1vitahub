import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  AfterLoad, BeforeInsert, BeforeUpdate,
} from 'typeorm';
import { OrganizationFeatures, normalizeOrganizationFeatures } from './organization-features';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl?: string;

  @Column({ name: 'welcome_message', type: 'varchar', length: 500, nullable: true })
  welcomeMessage?: string;

  @Column({ type: 'varchar', length: 3, default: 'CLP' })
  currency: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Modulos habilitados. Ver `organization-features.ts` para el criterio y los valores por defecto. */
  @Column({ type: 'json', nullable: true })
  features: OrganizationFeatures;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * Se normaliza en los tres puntos para que el resto del sistema nunca reciba `null` ni
   * un objeto incompleto: una clave ausente debe resolverse al valor por defecto, no a
   * `undefined`, porque `undefined` en una comprobacion de permiso significa "apagado"
   * por accidente.
   */
  @AfterLoad()
  @BeforeInsert()
  @BeforeUpdate()
  normalizeFeatures(): void {
    this.features = normalizeOrganizationFeatures(this.features);
  }
}
