import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import type { FormField, ReservationForm } from './types';
import { plainDateInZone } from './local-time';
import { accessibleForeground, contrastText, normalizeHexColor } from '../../shared/color-contrast';
import { BrandMark } from '../../shared/Brand';
import { MetaPixel } from '../../shared/MetaPixel';
import { readMetaMatchData } from '../../shared/meta-match';
import { imageOverlayAlpha, safeDesignChoice, safeNumber, uuid, visible, slotDateKey } from './booking-utils';

interface Slot { startsAt: string; available: number }
interface Created { id: string; referenceCode: string; status: string; startsAt: string }
const DEFAULT_BACKGROUND_GRADIENT = 'linear-gradient(135deg, #f3f5ef 0%, #dce9df 100%)';

export function PublicReservationPage() {
  const { slug = '' } = useParams();
  const params = new URLSearchParams(window.location.search);
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [guest, setGuest] = useState({ guestName: '', guestEmail: '', guestPhone: '', partySize: 1 });
  const [website, setWebsite] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponValid, setCouponValid] = useState<boolean | null>(null);
  const [couponMsg, setCouponMsg] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [idempotencyKey] = useState(() => {
    const stored = sessionStorage.getItem('vh-booking-key');
    if (stored) return stored;
    const key = uuid();
    sessionStorage.setItem('vh-booking-key', key);
    return key;
  });
  const [sessionId] = useState(() => uuid());
  const [renderedAt] = useState(() => new Date().toISOString());
  const [monthOffset, setMonthOffset] = useState(0);
  const [slotDays, setSlotDays] = useState(14);
  const started = useRef(false);
  const formRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const focusTimerRef = useRef<number>(0);
  const utmSource = params.get('utm_source') || undefined;
  const utmCampaign = params.get('utm_campaign') || undefined;
  const { data: form, isLoading, error } = useQuery<ReservationForm>({ queryKey: ['public-form', slug], queryFn: () => api.get(`/public/reservations/${slug}`), retry: false });
  const from = form ? plainDateInZone(new Date(), form.timezone) : new Date().toISOString().slice(0, 10);
  const fromDate = useMemo(() => {
    if (!form) return from;
    const [y, m, d] = from.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, d));
    start.setUTCMonth(start.getUTCMonth() + monthOffset);
    return `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;
  }, [from, monthOffset, form]);
  const slotParams = new URLSearchParams({ from: fromDate, days: String(slotDays), ...(serviceId ? { serviceId } : {}), ...(resourceId ? { resourceId } : {}) });
  const { data: slots = [], isFetching: loadingSlots } = useQuery<Slot[]>({ queryKey: ['public-slots', slug, fromDate, slotDays, serviceId, resourceId], queryFn: () => api.get(`/public/reservations/${slug}/slots?${slotParams}`), enabled: Boolean(form), staleTime: 30_000, gcTime: 60_000 });

  const pageTitle = useMemo(() => form ? `${form.name} · Reserva en línea · VITAHUB` : 'Reserva en línea · VITAHUB', [form]);
  const pageDescription = useMemo(() => form ? `Reserva tu hora para ${form.name}. ${form.designConfig?.welcome || 'Agenda fácil y segura.'}` : 'Agenda tu hora de forma fácil y segura.', [form]);

  useEffect(() => {
    const prevTitle = document.title;
    const metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
    const ogDesc = document.querySelector('meta[property="og:description"]') as HTMLMetaElement | null;
    const prevDesc = metaDesc?.content;
    const prevOgTitle = ogTitle?.content;
    const prevOgDesc = ogDesc?.content;
    document.title = pageTitle;
    const setMeta = (selector: string, content: string) => { const el = document.querySelector(selector) as HTMLMetaElement | null; if (el) el.content = content; };
    setMeta('meta[name="description"]', pageDescription);
    setMeta('meta[property="og:title"]', pageTitle);
    setMeta('meta[property="og:description"]', pageDescription);
    setMeta('meta[property="og:type"]', 'website');
    setMeta('meta[property="og:url"]', window.location.href);
    return () => {
      document.title = prevTitle;
      if (metaDesc && prevDesc !== undefined) metaDesc.content = prevDesc;
      if (ogTitle && prevOgTitle !== undefined) ogTitle.content = prevOgTitle;
      if (ogDesc && prevOgDesc !== undefined) ogDesc.content = prevOgDesc;
    };
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
        couponCode: couponCode.trim() || undefined,
        eventSourceUrl: window.location.href,
        utmSource, utmMedium: params.get('utm_medium') || undefined,
        utmCampaign, utmContent: params.get('utm_content') || undefined,
        clickId: params.get('gclid') || meta.fbclid || undefined,
        fbc: meta.fbc, fbp: meta.fbp,
      });
    },
  });

  const validateCoupon = useMutation({
    mutationFn: () => api.post(`/public/reservations/${slug}/coupon-validate`, { code: couponCode.trim() }),
    onSuccess: () => { setCouponValid(true); setCouponMsg('Cupón válido'); },
    onError: (err: Error) => { setCouponValid(false); setCouponMsg(err.message); },
  });

  useEffect(() => {
    if (!submit.data?.id || !window.fbq) return;
    if (!form?.pixelId) return;
    window.fbq('trackSingle', form.pixelId, 'Schedule', {}, { eventID: `schedule:${submit.data.id}` });
  }, [form?.pixelId, submit.data?.id]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!guest.guestName.trim()) errs.name = 'El nombre es obligatorio';
    if (systemFields.phone?.required && !guest.guestPhone.trim()) errs.phone = 'El teléfono es obligatorio';
    if (systemFields.email?.required && guest.guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.guestEmail)) errs.email = 'Correo inválido';
    for (const field of customFields) {
      if (field.required && field.type === 'consent' && !answers[field.id]) errs[field.id] = 'Debes aceptar';
      if (field.required && ['text', 'textarea', 'phone', 'email', 'select'].includes(field.type) && !answers[field.id]) errs[field.id] = 'Campo obligatorio';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goToConfirm = () => {
    if (!selected) return;
    if (!validate()) return;
    confirmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setStep(3);
  };

  const goToForm = () => {
    if (!selectedDate && selected) setSelectedDate(slotDateKey(selected, form!.timezone));
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setStep(2);
    window.clearTimeout(focusTimerRef.current);
    focusTimerRef.current = window.setTimeout(() => nameInputRef.current?.focus(), 300);
  };

  const goBackToSlots = () => {
    setStep(1);
    setSelectedDate('');
    setSelected('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const retryRef = useRef(false);

  const retrySubmit = () => {
    retryRef.current = true;
    submit.reset();
  };

  useEffect(() => {
    if (retryRef.current && !submit.isPending && !submit.error && !submit.data) {
      retryRef.current = false;
      submit.mutate();
    }
  }, [submit.isPending, submit.error, submit.data]);

  useEffect(() => {
    if (submit.isError && submit.error?.message?.includes('acaba de ocuparse')) {
      setStep(2);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [submit.isError, submit.error]);

  if (isLoading) return <LoadingSpinner text="Cargando disponibilidad..." />;
  if (error || !form) return <div className="public-booking-error"><BrandMark /><h1>Este formulario no está disponible</h1><p>Puede estar pausado o el enlace ya no es válido.</p></div>;

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
    '--booking-primary': primary, '--booking-primary-contrast': contrastText(primary),
    '--booking-primary-text': accessibleForeground(primary, '#ffffff', '#173f35'),
    '--booking-primary-page-text': accessibleForeground(primary, background, '#173f35'),
    '--booking-accent': accent, '--booking-accent-contrast': contrastText(accent),
    '--booking-accent-text': accessibleForeground(accent, background, '#9f3e26'),
    '--booking-bg': background, '--booking-text': textColor, '--booking-font': fontFamily,
    '--booking-button-radius': `${design.buttonRadius || '12'}px`,
    '--booking-field-radius': `${design.fieldRadius || '10'}px`,
    '--booking-logo-align': safeDesignChoice(design.logoPosition, ['left', 'center', 'right'], 'left'),
    '--booking-logo-size': `${safeNumber(design.logoSize, 64, 32, 180)}px`,
    '--booking-title-size': `${safeNumber(design.titleSize, 72, 32, 96)}px`,
    '--booking-welcome-size': `${safeNumber(design.welcomeSize, 16, 12, 24)}px`,
    color: textColor, fontFamily, backgroundColor: background, backgroundImage,
    backgroundPosition: design.backgroundAnchor || design.backgroundPosition || 'center center',
    backgroundSize: safeDesignChoice(design.backgroundSize, ['cover', 'contain', 'auto'], 'cover'),
    backgroundRepeat: 'no-repeat',
  } as CSSProperties;

  // Success page
  if (submit.data) {
    const svcDuration = serviceId ? (form.servicesConfig || []).find((s) => s.id === serviceId)?.durationMinutes : null;
    const icsDuration = (svcDuration || form.durationMinutes || 60) * 60000;
    const icsBody = 'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:' + new Date(submit.data.startsAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z\nDTEND:' + new Date(new Date(submit.data.startsAt).getTime() + icsDuration).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z\nSUMMARY:' + form.name + '\nDESCRIPTION:Reserva ' + submit.data.referenceCode + '\nEND:VEVENT\nEND:VCALENDAR';
    return <main className="public-booking" style={style}><MetaPixel pixelId={form?.pixelId} /><section className="booking-success"><span className="success-icon">✓</span><h1>{submit.data.status === 'pending' ? 'Solicitud recibida' : 'Reserva confirmada'}</h1><p>{design.confirmationMessage || 'Tu reserva quedó registrada. Te esperamos.'}</p><p className="success-datetime">{new Date(submit.data.startsAt).toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short', timeZone: form.timezone })}</p><div className="success-code"><strong>Código {submit.data.referenceCode}</strong></div><small className="success-note">Guarda este código para cualquier cambio o consulta.</small><div className="success-actions"><a className="btn btn-outline" href={'data:text/calendar;charset=utf-8,' + encodeURIComponent(icsBody)} download={`reserva-${submit.data.referenceCode}.ics`}>Agregar al calendario</a>{submit.data.status === 'pending' ? <small>Recibirás una confirmación pronto.</small> : <Link className="btn btn-outline" to={`/book/${slug}`}>Volver al inicio</Link>}</div></section></main>;
  }

  const customFields = (form.fieldSchema || []).filter((field) => !['name', 'email', 'phone'].includes(field.id));
  const services = form.servicesConfig || [];
  const resources = form.resourcesConfig || [];
  const selectedService = services.find((service) => service.id === serviceId);
  const systemFields = Object.fromEntries((form.fieldSchema || []).map((field) => [field.id, field]));
  const poweredByText = design.poweredByText || 'Gestionado con\nVITAHUB Reservas';
  const badgeText = design.secureBadgeText || 'Reserva segura';
  const eyebrowText = design.eyebrowText || 'AGENDA EN LÍNEA';
  const durationLabel = design.durationLabel || 'minutos';
  const confirmationLabel = design.confirmationLabel || 'confirmación';
  const timezoneLabel = design.timezoneLabel || 'zona horaria';

  // Calendar grid
  const slotsByDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const key = slotDateKey(slot.startsAt, form.timezone);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(slot);
    }
    return map;
  }, [slots, form.timezone]);

  // Build 28-day calendar grid from "fromDate"
  const calendarDays = useMemo(() => {
    const [y, m, d] = fromDate.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, d));
    const days: Array<{ date: string; day: number; weekday: string; slots: Slot[]; hasSlots: boolean }> = [];
    for (let i = 0; i < 28; i++) {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + i);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dayNum = String(date.getUTCDate()).padStart(2, '0');
      const key = `${year}-${month}-${dayNum}`;
      const weekday = new Intl.DateTimeFormat('es-CL', { weekday: 'short', timeZone: form.timezone }).format(date);
      const daySlots = slotsByDate.get(key) || [];
      days.push({ date: key, day: date.getUTCDate(), weekday, slots: daySlots, hasSlots: daySlots.length > 0 });
    }
    return days;
  }, [fromDate, slotsByDate, form.timezone]);

  const selectedDaySlots = slotsByDate.get(selectedDate) || [];

  if (form.status === 'paused') return <main className="public-booking" style={style}><MetaPixel pixelId={form?.pixelId} /><section className="booking-success"><h1>Formulario en mantenimiento</h1><p>Este formulario no acepta reservas en este momento. Vuelve más tarde o contacta al establecimiento.</p></section></main>;
  return <main className={`public-booking layout-${safeDesignChoice(design.layoutPosition, ['left', 'center', 'right'], 'right')}`} style={style} onFocusCapture={markStarted} onPointerDown={markStarted}>
    <MetaPixel pixelId={form.pixelId} />
    {(visible(design.showPoweredBy) || visible(design.showSecureBadge)) && <header>{visible(design.showPoweredBy) ? <div className="public-brand"><BrandMark decorative /><small>{poweredByText.split('\n').map((line) => <Fragment key={line}>{line}<br /></Fragment>)}</small></div> : <span />}{visible(design.showSecureBadge) && <em>{badgeText}</em>}</header>}
    <div className="public-booking-layout">
      <section className="public-booking-intro">{design.logoUrl && visible(design.showLogo) && <img className="public-booking-logo" src={design.logoUrl} alt="Logo de la empresa" />}{visible(design.showEyebrow) && <span>{eyebrowText}</span>}<h1>{design.title || form.name}</h1>{visible(design.showWelcome) && <p>{design.welcome || 'Elige el horario que mejor te acomode.'}</p>}{visible(design.showFacts) && <div className="public-booking-facts"><div><strong>{selectedService?.durationMinutes || form.durationMinutes}</strong><span>{durationLabel}</span></div><div><strong>{form.confirmationMode === 'automatic' ? (design.automaticLabel || 'Directa') : (design.manualLabel || 'Manual')}</strong><span>{confirmationLabel}</span></div><div><strong>{design.timezoneValue || form.timezone.split('/').pop()?.replaceAll('_', ' ')}</strong><span>{timezoneLabel}</span></div></div>}</section>
      <form className="public-booking-card" onSubmit={(event) => { event.preventDefault(); if (step === 3) { submit.mutate(); } else if (step === 2) { goToConfirm(); } else { goToForm(); } }}>
        {/* Step indicator */}
        <div className="booking-steps"><div className={`booking-step-dot ${step >= 1 ? 'active' : ''}`}><span>1</span><small>Fecha</small></div><div className={`booking-step-dot ${step >= 2 ? 'active' : ''}`}><span>2</span><small>Datos</small></div><div className={`booking-step-dot ${step >= 3 ? 'active' : ''}`}><span>3</span><small>Confirmar</small></div></div>

        {/* Step 1 - Calendar */}
        {step === 1 && <div>
          <div className="booking-step-title"><span>01</span><div><strong>Selecciona fecha</strong><small>Elige un día disponible en el calendario.</small></div></div>
          {(services.length > 0 || resources.length > 0) && <div className="public-resource-choice">
            {services.length > 0 && <label>Servicio<select required value={serviceId} onChange={(event) => { setServiceId(event.target.value); setSelected(''); }}><option value="">Selecciona un servicio</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}{service.durationMinutes ? ` · ${service.durationMinutes} min` : ''}</option>)}</select></label>}
            {resources.length > 0 && <label>Profesional o sucursal<select required value={resourceId} onChange={(event) => { setResourceId(event.target.value); setSelected(''); }}><option value="">Selecciona una opción</option>{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</select></label>}
          </div>}
          {loadingSlots && <div className="no-slots"><LoadingSpinner text="Buscando disponibilidad..." /></div>}
          {!loadingSlots && calendarDays.length > 0 && <div>
            <div className="calendar-month-nav"><button type="button" className="btn btn-outline btn-xs" disabled={monthOffset <= 0} onClick={() => { setMonthOffset((m) => Math.max(0, m - 1)); setSelected(''); setSelectedDate(''); }}>← Mes anterior</button><span>{new Date(fromDate + 'T00:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric', timeZone: form.timezone })}</span><button type="button" className="btn btn-outline btn-xs" onClick={() => { setMonthOffset((m) => m + 1); setSelected(''); setSelectedDate(''); }}>Mes siguiente →</button></div>
            <div className="calendar-grid">{calendarDays.map((day) => <button type="button" key={day.date} className={`calendar-day ${day.hasSlots ? 'has-slots' : 'no-slots'} ${selectedDate === day.date ? 'selected' : ''}`} disabled={!day.hasSlots} onClick={() => { if (day.hasSlots) { setSelectedDate(day.date); setSelected(''); } }}><span className="calendar-weekday">{day.weekday}</span><span className="calendar-number">{day.day}</span></button>)}</div>
            <div className="calendar-hint"><span className="dot available" /> Disponible <span className="dot taken" /> Sin cupo</div>
            {slotDays <= 60 && <button type="button" className="btn btn-outline btn-sm calendar-load-more" onClick={() => setSlotDays((d) => d + 14)}>Cargar más fechas</button>}
          </div>}
          {!loadingSlots && calendarDays.length === 0 && <div className="no-slots"><strong>Sin horarios disponibles</strong><p>Prueba otro servicio o contacta al local.</p></div>}

          {selectedDate && <div className="slot-time-picker">
            <h3>Horarios de {calendarDays.find((d) => d.date === selectedDate)?.weekday} {calendarDays.find((d) => d.date === selectedDate)?.day}</h3>
            <div className="slot-time-grid">{selectedDaySlots.map((slot) => <button type="button" className={`slot-time-btn ${selected === slot.startsAt ? 'active' : ''}`} onClick={() => { setSelected(slot.startsAt); goToForm(); }} key={slot.startsAt}>
              <strong>{new Date(slot.startsAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: form.timezone })}</strong>
              <small>{slot.available} cupo{slot.available !== 1 ? 's' : ''}</small>
            </button>)}</div>
          </div>}
          <button className="public-submit" disabled={!selected} onClick={goToForm} type="button"><span>Continuar →</span></button>
        </div>}

        {/* Step 2 - Form */}
        {step === 2 && <div ref={formRef}>
          <div className="booking-step-title"><span>02</span><div><strong>Tus datos</strong><small>Se usarán solo para gestionar tu atención.</small></div></div>
          <div className="booking-selected-slot">{selected && <div className="selected-slot-badge"><span>📅</span><strong>{new Date(selected).toLocaleString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: form.timezone })}</strong><button type="button" className="btn btn-outline btn-xs" onClick={goBackToSlots}>Cambiar</button></div>}</div>
          <div className="public-fields">
            <label>Nombre completo <span className="required-star">*</span><input ref={nameInputRef} className={errors.name ? 'input-error' : ''} required autoComplete="name" value={guest.guestName} onChange={(event) => setGuest({ ...guest, guestName: event.target.value })} />{errors.name && <span className="field-error">{errors.name}</span>}</label>
            <label>Teléfono <span className="required-star">*</span><input type="tel" className={errors.phone ? 'input-error' : ''} required autoComplete="tel" value={guest.guestPhone} onChange={(event) => setGuest({ ...guest, guestPhone: event.target.value })} />{errors.phone && <span className="field-error">{errors.phone}</span>}</label>
            <label>Correo<input type="email" className={errors.email ? 'input-error' : ''} autoComplete="email" value={guest.guestEmail} onChange={(event) => setGuest({ ...guest, guestEmail: event.target.value })} />{errors.email && <span className="field-error">{errors.email}</span>}</label>
            <label>Número de personas<input type="number" min="1" max="500" value={guest.partySize} onChange={(event) => setGuest({ ...guest, partySize: Number(event.target.value) })} /></label>
            {customFields.map((field) => <PublicField key={field.id} field={field} value={answers[field.id]} onChange={(value) => setAnswers({ ...answers, [field.id]: value })} error={errors[field.id]} />)}
            <label className="booking-honeypot" aria-hidden="true">Sitio web<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
          </div>
          {/* Coupon */}
          {(form.fieldSchema?.some((f) => f.type === 'coupon') || form.designConfig?.couponEnabled !== 'false') && <div className="coupon-section"><div className="booking-step-title"><span>─</span><div><strong>¿Tienes un cupón?</strong></div></div><div className="coupon-row"><input className="input" value={couponCode} onChange={(event) => { setCouponCode(event.target.value); setCouponValid(null); setCouponMsg(''); }} placeholder="Código" /><button type="button" className="btn btn-outline btn-sm" disabled={!couponCode.trim() || validateCoupon.isPending} onClick={() => validateCoupon.mutate()}>{validateCoupon.isPending ? '...' : 'Aplicar'}</button></div>{couponMsg && <div className={`coupon-feedback ${couponValid ? 'coupon-valid' : 'coupon-invalid'}`}>{couponMsg}</div>}</div>}
          {submit.error && <div className="alert alert-error">{submit.error.message}</div>}
          {submit.error?.message?.includes('acaba de ocuparse') && <div className="slot-alternatives"><strong>Horarios alternativos cercanos:</strong>{slots.filter((s) => s.startsAt !== selected).sort((a, b) => Math.abs(new Date(a.startsAt).getTime() - new Date(selected).getTime()) - Math.abs(new Date(b.startsAt).getTime() - new Date(selected).getTime())).slice(0, 3).map((alt) => <button type="button" key={alt.startsAt} onClick={() => { setSelected(alt.startsAt); submit.reset(); setStep(2); window.clearTimeout(focusTimerRef.current); focusTimerRef.current = window.setTimeout(() => nameInputRef.current?.focus(), 300); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{new Date(alt.startsAt).toLocaleString('es-CL', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: form.timezone })}</button>)}<button type="button" className="btn btn-sm btn-retry" onClick={retrySubmit}>Reintentar</button></div>}
          <div className="step-nav"><button type="button" className="btn btn-outline" onClick={goBackToSlots}>← Volver</button><button type="button" className="public-submit" onClick={goToConfirm}>Revisar y confirmar →</button></div>
        </div>}

        {/* Step 3 - Confirm */}
        {step === 3 && <div ref={confirmRef}>
          <div className="booking-step-title"><span>03</span><div><strong>Confirma tu reserva</strong><small>Revisa que todo esté correcto antes de enviar.</small></div></div>
          <div className="confirm-card"><div className="confirm-row"><span>Fecha y hora</span><strong>{new Date(selected).toLocaleString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: form.timezone })}</strong></div>{selectedService && <div className="confirm-row"><span>Servicio</span><strong>{selectedService.name}</strong></div>}<div className="confirm-row"><span>Nombre</span><strong>{guest.guestName}</strong></div>{guest.guestPhone && <div className="confirm-row"><span>Teléfono</span><strong>{guest.guestPhone}</strong></div>}{guest.guestEmail && <div className="confirm-row"><span>Correo</span><strong>{guest.guestEmail}</strong></div>}<div className="confirm-row"><span>Personas</span><strong>{guest.partySize}</strong></div>{couponValid && <div className="confirm-row"><span>Cupón</span><strong>{couponCode}</strong></div>}</div>
          {submit.isPending && <div className="booking-loading-overlay"><LoadingSpinner text="Confirmando disponibilidad..." /></div>}
          {submit.error && <div className="alert alert-error">{submit.error.message}</div>}
          {submit.error?.message?.includes('acaba de ocuparse') && <div className="slot-alternatives"><strong>Horarios alternativos cercanos:</strong>{slots.filter((s) => s.startsAt !== selected).sort((a, b) => Math.abs(new Date(a.startsAt).getTime() - new Date(selected).getTime()) - Math.abs(new Date(b.startsAt).getTime() - new Date(selected).getTime())).slice(0, 3).map((alt) => <button type="button" key={alt.startsAt} onClick={() => { setSelected(alt.startsAt); submit.reset(); setStep(2); confirmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{new Date(alt.startsAt).toLocaleString('es-CL', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: form.timezone })}</button>)}<button type="button" className="btn btn-sm btn-retry" onClick={retrySubmit}>Reintentar</button></div>}
          <div className="step-nav"><button type="button" className="btn btn-outline" disabled={submit.isPending} onClick={() => setStep(2)}>← Editar datos</button><button type="submit" className="public-submit" disabled={submit.isPending}>{submit.isPending ? 'Confirmando...' : form.confirmationMode === 'automatic' ? 'Confirmar reserva' : 'Enviar solicitud'}</button></div>
          <p className="privacy-note">Tus datos no son públicos y quedan asociados exclusivamente a esta empresa.</p>
        </div>}
      </form>
    </div>
  </main>;
}

function PublicField({ field, value, onChange, error }: { field: FormField; value: unknown; onChange: (value: unknown) => void; error?: string }) {
  if (field.type === 'coupon') return null; // coupon is rendered separately, not here
  if (field.type === 'consent') return <div className={`public-consent ${error ? 'has-error' : ''}`}><label><input type="checkbox" required={field.required} checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span>{field.label} <span className="required-star">*</span></span></label>{error && <span className="field-error">{error}</span>}</div>;
  if (field.type === 'multi_select') { const selected = Array.isArray(value) ? value as string[] : []; return <fieldset className="public-multi"><legend>{field.label}</legend>{field.options?.map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />{option}</label>)}</fieldset>; }
  if (field.type === 'select') return <label>{field.label}{field.required && <span className="required-star"> *</span>}<select className={error ? 'input-error' : ''} required={field.required} value={String(value || '')} onChange={(event) => onChange(event.target.value)}><option value="">Selecciona</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>{error && <span className="field-error">{error}</span>}</label>;
  if (field.type === 'textarea') return <label>{field.label}{field.required && <span className="required-star"> *</span>}<textarea className={error ? 'input-error' : ''} required={field.required} value={String(value || '')} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />{error && <span className="field-error">{error}</span>}</label>;
  return <label>{field.label}{field.required && <span className="required-star"> *</span>}<input className={error ? 'input-error' : ''} type={field.type === 'phone' ? 'tel' : field.type} required={field.required} value={String(value || '')} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />{error && <span className="field-error">{error}</span>}</label>;
}
