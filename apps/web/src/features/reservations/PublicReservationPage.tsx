import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import type { FormField, ReservationForm } from './types';
import { plainDateInZone } from './local-time';
import { accessibleForeground, contrastText, normalizeHexColor } from '../../shared/color-contrast';
import { BrandMark } from '../../shared/Brand';
import { MetaPixel } from '../../shared/MetaPixel';
import { readMetaMatchData } from '../../shared/meta-match';

interface Slot { startsAt: string; available: number }
interface Created { id: string; referenceCode: string; status: string; startsAt: string }
const DEFAULT_BACKGROUND_GRADIENT = 'linear-gradient(135deg, #f3f5ef 0%, #dce9df 100%)';

function imageOverlayAlpha(value?: string): number {
  const visibility = Math.max(0, Math.min(100, Number(value || 88))) / 100;
  return Number((1 - visibility).toFixed(3));
}

function safeDesignChoice(value: string | undefined, allowed: readonly string[], fallback: string): string {
  return value && allowed.includes(value) ? value : fallback;
}

function safeNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function visible(value: string | undefined, fallback = true): boolean {
  if (value === 'false') return false;
  if (value === 'true') return true;
  return fallback;
}

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export function PublicReservationPage() {
  const { slug = '' } = useParams();
  const params = new URLSearchParams(window.location.search);
  const [selected, setSelected] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [guest, setGuest] = useState({ guestName: '', guestEmail: '', guestPhone: '', partySize: 1 });
  const [website, setWebsite] = useState('');
  const [idempotencyKey] = useState(() => uuid());
  const [sessionId] = useState(() => uuid());
  const [renderedAt] = useState(() => new Date().toISOString());
  const started = useRef(false);
  const utmSource = params.get('utm_source') || undefined;
  const utmCampaign = params.get('utm_campaign') || undefined;

  const { data: form, isLoading, error } = useQuery<ReservationForm>({ queryKey: ['public-form', slug], queryFn: () => api.get(`/public/reservations/${slug}`), retry: false });
  const from = form ? plainDateInZone(new Date(), form.timezone) : new Date().toISOString().slice(0, 10);
  const slotParams = new URLSearchParams({ from, days: '31', ...(serviceId ? { serviceId } : {}), ...(resourceId ? { resourceId } : {}) });
  const { data: slots = [], isFetching: loadingSlots } = useQuery<Slot[]>({ queryKey: ['public-slots', slug, from, serviceId, resourceId], queryFn: () => api.get(`/public/reservations/${slug}/slots?${slotParams}`), enabled: Boolean(form) });

  const pageTitle = useMemo(() => form ? `${form.name} · Reserva en línea · VITAHUB` : 'Reserva en línea · VITAHUB', [form]);
  const pageDescription = useMemo(() => form ? `Reserva tu hora para ${form.name}. ${form.designConfig?.welcome || 'Agenda fácil y segura.'}` : 'Agenda tu hora de forma fácil y segura.', [form]);

  useEffect(() => {
    document.title = pageTitle;
    const setMeta = (selector: string, content: string) => { const el = document.querySelector(selector) as HTMLMetaElement | null; if (el) el.content = content; };
    setMeta('meta[name="description"]', pageDescription);
    setMeta('meta[property="og:title"]', pageTitle);
    setMeta('meta[property="og:description"]', pageDescription);
    setMeta('meta[property="og:type"]', 'website');
    setMeta('meta[property="og:url"]', window.location.href);
  }, [pageTitle, pageDescription]);

  useEffect(() => {
    if (!form) return;
    api.post(`/public/reservations/${slug}/events`, { type: 'view', sessionId, utmSource, utmCampaign }).catch(() => undefined);
  }, [form, sessionId, slug, utmCampaign, utmSource]);

  const markStarted = () => {
    if (started.current) return;
    started.current = true;
    api.post(`/public/reservations/${slug}/events`, { type: 'start', sessionId, utmSource, utmCampaign }).catch(() => undefined);
  };

  const submit = useMutation({
    mutationFn: () => {
      const meta = readMetaMatchData();
      return api.post<Created>(`/public/reservations/${slug}`, {
      startsAt: selected, serviceId: serviceId || undefined, resourceId: resourceId || undefined,
      ...guest, answers, idempotencyKey, website, renderedAt, consentVersion: 'v1',
      eventSourceUrl: window.location.href,
      utmSource, utmMedium: params.get('utm_medium') || undefined,
      utmCampaign, utmContent: params.get('utm_content') || undefined,
      clickId: params.get('gclid') || meta.fbclid || undefined,
      fbc: meta.fbc,
      fbp: meta.fbp,
      });
    },
  });

  useEffect(() => {
    if (!submit.data?.id || !window.fbq) return;
    if (!form?.pixelId) return;
    window.fbq('trackSingle', form.pixelId, 'Schedule', {}, { eventID: `schedule:${submit.data.id}` });
  }, [form?.pixelId, submit.data?.id]);

  if (isLoading) return <LoadingSpinner text="Cargando disponibilidad..." />;
  if (error || !form) return <div className="public-booking-error"><BrandMark /><h1>Este formulario no está disponible</h1><p>Puede estar pausado o el enlace ya no es válido.</p></div>;

  const groups = Object.entries(slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    const key = new Date(slot.startsAt).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: form.timezone });
    (acc[key] ??= []).push(slot); return acc;
  }, {}));
  const design = form.designConfig || {};
  const primary = normalizeHexColor(design.primaryColor, '#173f35');
  const accent = normalizeHexColor(design.accentColor, '#ea0f63');
  const background = normalizeHexColor(design.backgroundColor, '#f3f5ef');
  const textColor = design.textColor || '#3f4e49';
  const fontFamily = design.fontFamily || 'system-ui';
  const backgroundOpacity = imageOverlayAlpha(design.backgroundOpacity);
  const backgroundImage = design.backgroundMode === 'gradient'
    ? design.backgroundGradient || DEFAULT_BACKGROUND_GRADIENT
    : design.backgroundMode === 'image' && design.backgroundImage
      ? `linear-gradient(rgba(243,245,239,${backgroundOpacity}),rgba(243,245,239,${backgroundOpacity})),url(${design.backgroundImage})`
      : undefined;
  const style = {
    '--booking-primary': primary,
    '--booking-primary-contrast': contrastText(primary),
    '--booking-primary-text': accessibleForeground(primary, '#ffffff', '#173f35'),
    '--booking-primary-page-text': accessibleForeground(primary, background, '#173f35'),
    '--booking-accent': accent,
    '--booking-accent-contrast': contrastText(accent),
    '--booking-accent-text': accessibleForeground(accent, background, '#9f3e26'),
    '--booking-bg': background,
    '--booking-text': textColor,
    '--booking-font': fontFamily,
    '--booking-button-radius': `${design.buttonRadius || '12'}px`,
    '--booking-field-radius': `${design.fieldRadius || '10'}px`,
    '--booking-logo-align': safeDesignChoice(design.logoPosition, ['left', 'center', 'right'], 'left'),
    '--booking-logo-size': `${safeNumber(design.logoSize, 64, 32, 180)}px`,
    '--booking-title-size': `${safeNumber(design.titleSize, 72, 32, 96)}px`,
    '--booking-welcome-size': `${safeNumber(design.welcomeSize, 16, 12, 24)}px`,
    color: textColor,
    fontFamily,
    backgroundColor: background,
    backgroundImage,
    backgroundPosition: design.backgroundAnchor || design.backgroundPosition || 'center center',
    backgroundSize: safeDesignChoice(design.backgroundSize, ['cover', 'contain', 'auto'], 'cover'),
    backgroundRepeat: 'no-repeat',
  } as CSSProperties;

  if (submit.data) return <main className="public-booking" style={style}><MetaPixel pixelId={form?.pixelId} /><section className="booking-success"><span>✓</span><h1>{submit.data.status === 'pending' ? 'Solicitud recibida' : 'Reserva confirmada'}</h1><p>{design.confirmationMessage || 'Tu reserva quedó registrada. Te esperamos.'}</p><p>{new Date(submit.data.startsAt).toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short', timeZone: form.timezone })}</p><strong>Código {submit.data.referenceCode}</strong><small>Guarda este código para cualquier cambio o consulta.</small></section></main>;

  const customFields = (form.fieldSchema || []).filter((field) => !['name', 'email', 'phone'].includes(field.id));
  const services = form.servicesConfig || [];
  const resources = form.resourcesConfig || [];
  const selectedService = services.find((service) => service.id === serviceId);
  const systemFields = Object.fromEntries((form.fieldSchema || []).map((field) => [field.id, field]));
  const alternatives = selected ? slots.filter((slot) => slot.startsAt !== selected).sort((a, b) => Math.abs(new Date(a.startsAt).getTime() - new Date(selected).getTime()) - Math.abs(new Date(b.startsAt).getTime() - new Date(selected).getTime())).slice(0, 3) : [];
  const poweredByText = design.poweredByText || 'Gestionado con\nVITAHUB Reservas';
  const badgeText = design.secureBadgeText || 'Reserva segura';
  const eyebrowText = design.eyebrowText || 'AGENDA EN LÍNEA';
  const durationLabel = design.durationLabel || 'minutos';
  const confirmationLabel = design.confirmationLabel || 'confirmación';
  const timezoneLabel = design.timezoneLabel || 'zona horaria';

  return <main className={`public-booking layout-${safeDesignChoice(design.layoutPosition, ['left', 'center', 'right'], 'right')}`} style={style} onFocusCapture={markStarted} onPointerDown={markStarted}>
    <MetaPixel pixelId={form.pixelId} />
    {(visible(design.showPoweredBy) || visible(design.showSecureBadge)) && <header>{visible(design.showPoweredBy) ? <div className="public-brand"><BrandMark decorative /><small>{poweredByText.split('\n').map((line) => <Fragment key={line}>{line}<br /></Fragment>)}</small></div> : <span />}{visible(design.showSecureBadge) && <em>{badgeText}</em>}</header>}
    <div className="public-booking-layout">
      <section className="public-booking-intro">{design.logoUrl && visible(design.showLogo) && <img className="public-booking-logo" src={design.logoUrl} alt="Logo de la empresa" />}{visible(design.showEyebrow) && <span>{eyebrowText}</span>}<h1>{design.title || form.name}</h1>{visible(design.showWelcome) && <p>{design.welcome || 'Elige el horario que mejor te acomode.'}</p>}{visible(design.showFacts) && <div className="public-booking-facts"><div><strong>{selectedService?.durationMinutes || form.durationMinutes}</strong><span>{durationLabel}</span></div><div><strong>{form.confirmationMode === 'automatic' ? (design.automaticLabel || 'Directa') : (design.manualLabel || 'Manual')}</strong><span>{confirmationLabel}</span></div><div><strong>{design.timezoneValue || form.timezone.split('/').pop()?.replaceAll('_', ' ')}</strong><span>{timezoneLabel}</span></div></div>}</section>
      <form className="public-booking-card" onSubmit={(event) => { event.preventDefault(); submit.mutate(); }}>
        {(services.length > 0 || resources.length > 0) && <div className="public-resource-choice">
          {services.length > 0 && <label>Servicio<select required value={serviceId} onChange={(event) => { setServiceId(event.target.value); setSelected(''); }}><option value="">Selecciona un servicio</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}{service.durationMinutes ? ` · ${service.durationMinutes} min` : ''}</option>)}</select></label>}
          {resources.length > 0 && <label>Profesional, sucursal o recurso<select required value={resourceId} onChange={(event) => { setResourceId(event.target.value); setSelected(''); }}><option value="">Selecciona una opción</option>{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</select></label>}
        </div>}
        <div className="booking-step-title"><span>01</span><div><strong>Selecciona fecha y hora</strong><small>Solo mostramos horarios realmente disponibles.</small></div></div>
        {loadingSlots ? <div className="no-slots">Actualizando agenda...</div> : groups.length ? <div className="slot-groups">{groups.slice(0, 10).map(([day, daySlots]) => <div key={day}><h3>{day}</h3><div>{daySlots.map((slot) => <button type="button" className={selected === slot.startsAt ? 'active' : ''} onClick={() => setSelected(slot.startsAt)} key={slot.startsAt}>{new Date(slot.startsAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: form.timezone })}<small>{slot.available} disp.</small></button>)}</div></div>)}</div> : <div className="no-slots"><strong>Sin horarios en los próximos días</strong><p>Prueba otro servicio, profesional o contacta directamente al local.</p></div>}
        {alternatives.length > 0 && <div className="slot-alternatives"><strong>También podría servirte</strong>{alternatives.map((slot) => <button type="button" key={slot.startsAt} onClick={() => setSelected(slot.startsAt)}>{new Date(slot.startsAt).toLocaleString('es-CL', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: form.timezone })}</button>)}</div>}
        <div className="booking-step-title"><span>02</span><div><strong>Datos de la reserva</strong><small>Se utilizarán únicamente para gestionar tu atención.</small></div></div>
        <div className="public-fields">
          <label>Nombre completo<input required={systemFields.name?.required !== false} autoComplete="name" value={guest.guestName} onChange={(event) => setGuest({ ...guest, guestName: event.target.value })} /></label>
          <label>Teléfono<input type="tel" required={Boolean(systemFields.phone?.required)} autoComplete="tel" value={guest.guestPhone} onChange={(event) => setGuest({ ...guest, guestPhone: event.target.value })} /></label>
          <label>Correo<input type="email" required={Boolean(systemFields.email?.required)} autoComplete="email" value={guest.guestEmail} onChange={(event) => setGuest({ ...guest, guestEmail: event.target.value })} /></label>
          <label>Número de personas<input type="number" min="1" max="500" value={guest.partySize} onChange={(event) => setGuest({ ...guest, partySize: Number(event.target.value) })} /></label>
          {customFields.map((field) => <PublicField key={field.id} field={field} value={answers[field.id]} onChange={(value) => setAnswers({ ...answers, [field.id]: value })} />)}
          <label className="booking-honeypot" aria-hidden="true">Sitio web<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
        </div>
        {submit.error && <div className="alert alert-error">{submit.error.message}</div>}
        <button className="public-submit" disabled={!selected || submit.isPending}>{submit.isPending ? 'Confirmando disponibilidad...' : form.confirmationMode === 'automatic' ? 'Confirmar reserva' : 'Enviar solicitud'}<span>→</span></button>
        <p className="privacy-note">Tus datos no son públicos y quedan asociados exclusivamente a esta empresa.</p>
      </form>
    </div>
  </main>;
}

function PublicField({ field, value, onChange }: { field: FormField; value: unknown; onChange: (value: unknown) => void }) {
  if (field.type === 'consent') return <label className="public-consent"><input type="checkbox" required={field.required} checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span>{field.label}</span></label>;
  if (field.type === 'multi_select') { const selected = Array.isArray(value) ? value as string[] : []; return <fieldset className="public-multi"><legend>{field.label}</legend>{field.options?.map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />{option}</label>)}</fieldset>; }
  if (field.type === 'select') return <label>{field.label}<select required={field.required} value={String(value || '')} onChange={(event) => onChange(event.target.value)}><option value="">Selecciona</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select></label>;
  if (field.type === 'textarea') return <label>{field.label}<textarea required={field.required} value={String(value || '')} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} /></label>;
  return <label>{field.label}<input type={field.type === 'phone' ? 'tel' : field.type} required={field.required} value={String(value || '')} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} /></label>;
}
