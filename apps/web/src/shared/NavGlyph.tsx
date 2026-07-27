const GLYPHS: Record<string, string> = {
  Dashboard: 'DB', Clientes: 'CL', Contratos: 'CT', Catalogo: 'CA', 'Catálogo': 'CA',
  'Leads CRM': 'CR', Briefs: 'BR', Produccion: 'PR', 'Producción': 'PR', Gamificacion: 'XP',
  'Gamificación': 'XP', Contenido: 'CO', Documentos: 'DO', Knowledge: 'KN', Aprobaciones: 'AP',
  Reuniones: 'RE', Reportes: 'RP', Facturacion: 'FA', 'Facturación': 'FA', Operaciones: 'OP',
  Direccion: 'DI', 'Dirección': 'DI', Integraciones: 'IN', Onboarding: 'ON', Usuarios: 'US',
  Configuracion: 'CF', 'Mi Dashboard': 'DB', 'Mi Parrilla': 'PA',
  Reservas: 'RS',
};

export function NavGlyph({ label }: { label: string }) {
  return <span className="nav-glyph" aria-hidden="true">{GLYPHS[label] ?? label.slice(0, 2).toUpperCase()}</span>;
}
