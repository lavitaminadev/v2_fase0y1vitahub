import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

function validRecipient(value: string): boolean {
  return value.length <= 320 && !/[\r\n]/.test(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter?: Transporter;
  private readonly from: string;
  private readonly replyTo?: string;

  constructor() {
    const enabled = process.env.SMTP_ENABLED === 'true';
    this.from = process.env.SMTP_FROM?.trim() || '';
    this.replyTo = process.env.SMTP_REPLY_TO?.trim() || undefined;
    if (!enabled) return;

    const port = Number(process.env.SMTP_PORT || 465);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      requireTLS: !secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(to: string, subject: string, html: string): Promise<boolean> {
    const recipient = to.trim().toLowerCase();
    if (!validRecipient(recipient)) {
      this.logger.warn('Email skipped because the recipient is invalid');
      return false;
    }
    if (!this.transporter) {
      this.logger.warn('Email not sent because SMTP_ENABLED is false');
      return false;
    }

    try {
      const result = await this.transporter.sendMail({
        from: this.from,
        to: recipient,
        replyTo: this.replyTo,
        subject: subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 255),
        html,
      });
      const accepted = Array.isArray(result.accepted) ? result.accepted.length : 0;
      if (!accepted) this.logger.warn(`SMTP rejected message ${result.messageId}`);
      return accepted > 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown SMTP error';
      this.logger.error(`SMTP delivery failed: ${message}`);
      return false;
    }
  }

  async sendCollectionEmail(clientName: string, clientEmail: string, invoiceNumber: string, amount: number, dueDate: string): Promise<boolean> {
    const safeName = escapeHtml(clientName);
    const safeNumber = escapeHtml(invoiceNumber);
    const safeDate = escapeHtml(dueDate);
    return this.send(
      clientEmail,
      `Recordatorio de pago - Factura ${invoiceNumber}`,
      `<h2>Estimado(a) ${safeName}</h2>
       <p>Le recordamos que la factura <strong>${safeNumber}</strong> por <strong>$${amount.toLocaleString('es-CL')}</strong>
       con vencimiento el <strong>${safeDate}</strong> se encuentra pendiente de pago.</p>
       <p>Por favor, realice el pago a la brevedad para evitar interrupciones en el servicio.</p>
       <p>Saludos,<br>Equipo La Vitamina</p>`,
    );
  }

  async sendUdBudgetAlert(clientName: string, clientEmail: string, used: number, total: number): Promise<boolean> {
    const pct = total > 0 ? Math.round((used / total) * 100) : 100;
    const safeName = escapeHtml(clientName);
    return this.send(
      clientEmail,
      `Alerta de presupuesto UD - ${clientName}`,
      `<h2>Estimado(a) ${safeName}</h2>
       <p>Ha utilizado el <strong>${pct}%</strong> de su presupuesto de diseño mensual
       (${used.toLocaleString('es-CL')} de ${total.toLocaleString('es-CL')} UD contratadas).</p>
       ${pct >= 100 ? '<p><strong>Su presupuesto se ha agotado.</strong> Las nuevas solicitudes quedarán en espera hasta el próximo ciclo.</p>' : '<p>Le recomendamos planificar las solicitudes restantes del mes.</p>'}
       <p>Saludos,<br>Equipo La Vitamina</p>`,
    );
  }

  async sendPieceStuckAlert(designerEmail: string, pieceTitle: string, hoursStuck: number): Promise<boolean> {
    const safeTitle = escapeHtml(pieceTitle);
    return this.send(
      designerEmail,
      `Alerta: Pieza estancada - ${pieceTitle}`,
      `<h2>Alerta de producción</h2>
       <p>La pieza <strong>${safeTitle}</strong> lleva <strong>${Math.round(hoursStuck)} horas</strong> sin movimiento.</p>
       <p>Por favor, revise y actualice su estado.</p>`,
    );
  }

  async sendTemporaryPassword(name: string, recipient: string, password: string, loginUrl: string): Promise<boolean> {
    return this.send(
      recipient,
      'Acceso temporal a VITAHUB',
      `<h2>Hola ${escapeHtml(name)}</h2>
       <p>Un administrador generó un acceso temporal para tu cuenta.</p>
       <p>Contraseña temporal: <strong>${escapeHtml(password)}</strong></p>
       <p><a href="${escapeHtml(loginUrl)}">Ingresar a VITAHUB</a></p>
       <p>El sistema solicitará crear una contraseña personal al iniciar sesión.</p>`,
    );
  }

  async sendPasswordReset(name: string, recipient: string, resetUrl: string): Promise<boolean> {
    return this.send(
      recipient,
      'Recupera tu acceso a VITAHUB',
      `<h2>Hola ${escapeHtml(name)}</h2>
       <p>Recibimos una solicitud para restablecer tu contraseña.</p>
       <p><a href="${escapeHtml(resetUrl)}">Crear una nueva contraseña</a></p>
       <p>Este enlace vence en 30 minutos. Si no solicitaste el cambio, ignora este mensaje.</p>`,
    );
  }
}
