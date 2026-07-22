import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { ImageUpload } from '../../shared/ImageUpload';
import type { DesignConfig, FormField, ReservationForm } from './types';
import { localInputToUtc } from './local-time';
import { contrastText, normalizeHexColor } from '../../shared/color-contrast';
import { APP_PUBLIC_URL_CONFIGURED, APP_PUBLIC_URL_IS_HTTPS, publicReservationUrl } from '../../core/public-url';
import { imageOverlayAlpha, safeDesignChoice, safeNumber, uuid, visible } from './booking-utils';

const FIELD_LIBRARY = [
  ['text', 'Texto corto'], ['textarea', 'Texto largo'], ['email', 'Correo'],
  ['phone', 'Teléfono'], ['select', 'Selector'], ['multi_select', 'Selección múltiple'],
  ['number', 'Número'], ['date', 'Fecha'], ['consent', 'Aceptación'],
  ['coupon', 'Cupón promocional'],
] as const;
const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const STEPS = ['Estructura', 'Disponibilidad', 'Diseño', 'Publicación'];
const TIMEZONES = ['America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Lima', 'America/Bogota', 'America/Mexico_City', 'America/New_York', 'Europe/Madrid'];
const DESIGN_TEMPLATES: Array<{ name: string; config: Record<string, string> }> = [
  { name: 'Vita Natural', config: { primaryColor: '#173f35', accentColor: '#ea0f63', backgroundColor: '#f3f5ef', textColor: '#3f4e49', fontFamily: 'system-ui', backgroundMode: 'gradient', backgroundGradient: 'linear-gradient(135deg, #f3f5ef 0%, #dce9df 100%)', backgroundOpacity: '88', backgroundPosition: 'center', buttonRadius: '12', fieldRadius: '10' } },
  { name: 'Editorial', config: { primaryColor: '#222222', accentColor: '#c56d3d', backgroundColor: '#f4eee5', textColor: '#37332f', fontFamily: 'Georgia, serif', backgroundMode: 'gradient', backgroundGradient: 'linear-gradient(145deg, #f4eee5 0%, #e5d3bf 100%)', backgroundOpacity: '84', backgroundPosition: 'center', buttonRadius: '4', fieldRadius: '4' } },
  { name: 'Energía', config: { primaryColor: '#40205f', accentColor: '#ff4f87', backgroundColor: '#f8f2ff', textColor: '#332541', fontFamily: 'Inter, sans-serif', backgroundMode: 'gradient', backgroundGradient: 'linear-gradient(135deg, #fff0f6 0%, #eee5ff 100%)', backgroundOpacity: '82', backgroundPosition: 'center', buttonRadius: '999', fieldRadius: '16' } },
];
const RECOMMENDED_FIELDS = new Set(['text', 'phone', 'email', 'number', 'consent']);
const DEFAULT_BACKGROUND_GRADIENT = 'linear-gradient(135deg, #f3f5ef 0%, #dce9df 100%)';
const BACKGROUND_POSITIONS = [
  ['left top', 'Arriba izquierda'], ['center top', 'Arriba centro'], ['right top', 'Arriba derecha'],
  ['left center', 'Centro izquierda'], ['center center', 'Centro'], ['right center', 'Centro derecha'],
  ['left bottom', 'Abajo izquierda'], ['center bottom', 'Abajo centro'], ['right bottom', 'Abajo derecha'],
] as const;
const BACKGROUND_SIZES = [['cover', 'Cubrir pantalla'], ['contain', 'Mostrar completa'], ['auto', 'Tamaño original']] as const;
const LAYOUT_POSITIONS = [['right', 'Formulario derecha'], ['center', 'Formulario centro'], ['left', 'Formulario izquierda']] as const;
const LOGO_POSITIONS = [['left', 'Logo izquierda'], ['center', 'Logo centro'], ['right', 'Logo derecha']] as const;

function campaignReservationUrl(form: ReservationForm, baseUrl = publicReservationUrl(form.publicSlug, form.publicUrl)): string {
  if (!form.campaignId?.trim()) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set('utm_source', 'meta');
  url.searchParams.set('utm_campaign', form.campaignId.trim());
  return url.toString();
}

function reservationDesignStyle(design: DesignConfig): CSSProperties {
  const primary = normalizeHexColor(design.primaryColor, '#173f35');
  const accent = normalizeHexColor(design.accentColor, '#ea0f63');
  const background = normalizeHexColor(design.backgroundColor, '#f3f5ef');
  const backgroundOpacity = imageOverlayAlpha(design.backgroundOpacity);
  const backgroundImage = design.backgroundMode === 'gradient'
    ? design.backgroundGradient || DEFAULT_BACKGROUND_GRADIENT
    : design.backgroundMode === 'image' && design.backgroundImage
      ? `linear-gradient(rgba(243,245,239,${backgroundOpacity}),rgba(243,245,239,${backgroundOpacity})),url(${design.backgroundImage})`
      : undefined;
  return {
    '--booking-primary': primary,
    '--booking-primary-contrast': contrastText(primary),
    '--booking-primary-text': accessiblePreviewForeground(primary, background, '#173f35'),
    '--booking-primary-page-text': accessiblePreviewForeground(primary, background, '#173f35'),
    '--booking-accent': accent,
    '--booking-accent-contrast': contrastText(accent),
    '--booking-accent-text': accessiblePreviewForeground(accent, background, '#9f3e26'),
    '--booking-bg': background,
    '--booking-text': design.textColor || '#3f4e49',
    '--booking-font': design.fontFamily || 'system-ui',
    '--booking-button-radius': `${design.buttonRadius || '12'}px`,
    '--booking-field-radius': `${design.fieldRadius || '10'}px`,
    '--booking-logo-size': `${safeNumber(design.logoSize, 64, 32, 180)}px`,
    '--booking-title-size': `${safeNumber(design.titleSize, 72, 32, 96)}px`,
    '--booking-welcome-size': `${safeNumber(design.welcomeSize, 16, 12, 24)}px`,
    color: design.textColor || '#3f4e49',
    fontFamily: design.fontFamily || 'system-ui',
    backgroundColor: background,
    backgroundImage,
    '--booking-logo-align': safeDesignChoice(design.logoPosition, ['left', 'center', 'right'], 'left'),
    backgroundPosition: design.backgroundAnchor || design.backgroundPosition || 'center center',
    backgroundSize: safeDesignChoice(design.backgroundSize, ['cover', 'contain', 'auto'], 'cover'),
  } as CSSProperties;
}

function accessiblePreviewForeground(color: string, background: string, fallback: string) {
  return contrastText(background) === '#ffffff' ? '#ffffff' : color || fallback;
}

function updatePayload(form: Partial<ReservationForm>): Partial<ReservationForm> {
  const payload: Partial<ReservationForm> = {
    name: form.name, status: form.status, timezone: form.timezone,
    durationMinutes: form.durationMinutes, bufferMinutes: form.bufferMinutes,
    dailyCapacity: form.dailyCapacity,
    capacityPerSlot: form.capacityPerSlot, minimumNoticeHours: form.minimumNoticeHours,
    maximumAdvanceDays: form.maximumAdvanceDays, confirmationMode: form.confirmationMode,
    fieldSchema: form.fieldSchema, designConfig: form.designConfig,
    scheduleConfig: form.scheduleConfig, servicesConfig: form.servicesConfig,
    resourcesConfig: form.resourcesConfig, campaignId: form.campaignId,
    crmEnabled: form.crmEnabled, calendarEnabled: form.calendarEnabled,
    metaCapiEnabled: form.metaCapiEnabled,
    teamNotifications: form.teamNotifications,
  };
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== null)) as Partial<ReservationForm>;
}

export function ReservationBuilderPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const clientMode = user?.role === 'client';
  const qc = useQueryClient();
  const [step, setStep] = useState(clientMode ? 1 : 0);
  const [draft, setDraft] = useState<ReservationForm | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [copied, setCopied] = useState(false);
  const [block, setBlock] = useState({ startsAt: '', endsAt: '', reason: '' });
  const [blockRepeat, setBlockRepeat] = useState(1);
  const [fullDayDate, setFullDayDate] = useState('');
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('desktop');
  const [canvasDragOver, setCanvasDragOver] = useState(false);

  const { data, isLoading } = useQuery<ReservationForm>({ queryKey: ['reservation-form', id], queryFn: () => api.get(`/reservations/forms/${id}`) });
  const { data: blocks = [] } = useQuery<Array<{ id: string; startsAt: string; endsAt: string; reason?: string }>>({ queryKey: ['reservation-blocks', id], queryFn: () => api.get(`/reservations/forms/${id}/blocks`) });
  useEffect(() => { if (data) setDraft(data); }, [data]);
  useEffect(() => {
    if (saved) return undefined;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [saved]);
  const change = useCallback((patch: Partial<ReservationForm>) => { setDraft((current) => (current ? { ...current, ...patch } : current)); setSaved(false); }, []);
  const publicUrl = useMemo(() => draft ? publicReservationUrl(draft.publicSlug, draft.publicUrl) : '', [draft]);
  const publicUrlReady = APP_PUBLIC_URL_IS_HTTPS || publicUrl.startsWith('https://');
  const campaignUrl = useMemo(() => draft ? campaignReservationUrl(draft, publicUrl) : '', [draft, publicUrl]);
  const designPreviewStyle = useMemo(() => reservationDesignStyle(draft?.designConfig || {}), [draft?.designConfig]);

  const saveMutation = useMutation({
    mutationFn: (body: Partial<ReservationForm>) => api.patch<ReservationForm>(`/reservations/forms/${id}`, updatePayload(body)),
    onSuccess: (next) => { setDraft(next); setSaved(true); qc.invalidateQueries({ queryKey: ['reservation-forms'] }); },
  });
  const saveDesignAsset = useCallback((key: 'logoUrl' | 'backgroundImage', url: string) => {
    if (!draft) return;
    const designConfig = key === 'backgroundImage' && url
      ? { ...draft.designConfig, [key]: url, backgroundMode: 'image' }
      : { ...draft.designConfig, [key]: url };
    change({ designConfig });
    saveMutation.mutate({ ...draft, designConfig });
  }, [change, draft, saveMutation]);
  const blockMutation = useMutation({
    mutationFn: (body: { startsAt: string; endsAt: string; reason?: string }) => api.post(`/reservations/forms/${id}/blocks`, { ...body, startsAt: localInputToUtc(body.startsAt, draft?.timezone || 'America/Santiago'), endsAt: localInputToUtc(body.endsAt, draft?.timezone || 'America/Santiago') }),
    onSuccess: () => { setBlock({ startsAt: '', endsAt: '', reason: '' }); setBlockRepeat(1); setFullDayDate(''); qc.invalidateQueries({ queryKey: ['reservation-blocks', id] }); },
  });
  const batchBlockMutation = useMutation({
    mutationFn: async (body: { startsAt: string; endsAt: string; reason?: string; repeat: number }) => {
      const tz = draft?.timezone || 'America/Santiago';
      const addWeeks = (localStr: string, weeks: number) => {
        const date = new Date(localStr + 'T00:00:00');
        date.setDate(date.getDate() + weeks * 7);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const time = localStr.slice(11, 16);
        return `${y}-${m}-${d}T${time}`;
      };
      const dtos = Array.from({ length: body.repeat }, (_, index) => {
        const s = addWeeks(body.startsAt, index);
        const e = addWeeks(body.endsAt, index);
        return { startsAt: localInputToUtc(s, tz), endsAt: localInputToUtc(e, tz), reason: body.reason };
      });
      return api.post(`/reservations/forms/${id}/blocks/batch`, dtos);
    },
    onSuccess: () => { setBlock({ startsAt: '', endsAt: '', reason: '' }); setBlockRepeat(1); setFullDayDate(''); qc.invalidateQueries({ queryKey: ['reservation-blocks', id] }); },
  });
  const blockFullDay = () => {
    if (!fullDayDate || !draft) return;
    const startsAt = `${fullDayDate}T00:00`;
    const endsAt = `${fullDayDate}T23:59`;
    blockMutation.mutate({ startsAt, endsAt, reason: 'Cierre de día completo' });
  };
  const deleteBlock = useMutation({ mutationFn: (blockId: string) => api.delete(`/reservations/blocks/${blockId}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['reservation-blocks', id] }) });

  if (isLoading || !draft) return <LoadingSpinner text="Abriendo constructor..." />;
  const fields = draft.fieldSchema || [];
  const active = fields.find((field) => field.id === selected);
  const windows = draft.scheduleConfig?.windows || [];

  const addField = (type: string) => {
    const field: FormField = { id: `field_${uuid().slice(0, 8)}`, type, label: FIELD_LIBRARY.find(([key]) => key === type)?.[1] || 'Campo', required: false, ...(['select', 'multi_select'].includes(type) ? { options: ['Opción 1', 'Opción 2'] } : {}) };
    change({ fieldSchema: [...fields, field] }); setSelected(field.id);
  };
  const duplicateField = (field: FormField) => {
    const copy: FormField = { ...field, id: `field_${uuid().slice(0, 8)}`, label: `${field.label} copia`, system: false };
    const index = fields.findIndex((item) => item.id === field.id);
    const next = [...fields];
    next.splice(index + 1, 0, copy);
    change({ fieldSchema: next });
    setSelected(copy.id);
  };
  const moveField = (fieldId: string, direction: -1 | 1) => {
    const from = fields.findIndex((field) => field.id === fieldId); const to = from + direction;
    if (from < 0 || to < 0 || to >= fields.length) return;
    const next = [...fields]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); change({ fieldSchema: next });
  };
  const reorder = (fromId: string, toId: string) => {
    const from = fields.findIndex((field) => field.id === fromId); const to = fields.findIndex((field) => field.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...fields]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); change({ fieldSchema: next });
  };
  const updateField = (patch: Partial<FormField>) => change({ fieldSchema: fields.map((field) => field.id === selected ? { ...field, ...patch } : field) });
  const toggleDay = (day: number) => change({ scheduleConfig: { windows: windows.some((window) => window.day === day) ? windows.filter((window) => window.day !== day) : [...windows, { day, start: '09:00', end: '18:00' }] } });
  const updateWindow = (index: number, patch: { start?: string; end?: string }) => change({ scheduleConfig: { windows: windows.map((window, current) => current === index ? { ...window, ...patch } : window) } });
  const addWindow = (day: number) => change({ scheduleConfig: { windows: [...windows, { day, start: '20:00', end: '23:00' }] } });
  const removeWindow = (index: number) => change({ scheduleConfig: { windows: windows.filter((_, current) => current !== index) } });
  const copyLink = async () => { await navigator.clipboard.writeText(campaignUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  const publicPreviewReady = draft.status === 'published' && saved;
  const publishedButDirty = draft.status === 'published' && !saved;
  const previewLabel = publicPreviewReady ? 'Vista previa pública' : 'Vista previa interna';
  const openPreview = () => {
    if (publicPreviewReady) window.open(campaignUrl, '_blank', 'noopener,noreferrer');
    else if (publishedButDirty) savePublishAndPreview();
    else setStep(2);
  };
  function savePublishAndPreview() {
    if (!draft || windows.length === 0) return;
    saveMutation.mutate(
      { ...draft, status: 'published' },
      { onSuccess: (next) => window.open(campaignReservationUrl(next), '_blank', 'noopener,noreferrer') },
    );
  }

  return <div className="reservation-builder">
    <header className="builder-top">
      <div><Link to={clientMode ? '/portal/reservations' : '/reservations'}>← Reservas</Link><div><input type="text" autoComplete="off" aria-label="Nombre del formulario" value={draft.name} disabled={clientMode} onChange={(event) => change({ name: event.target.value })} /><span>{saved ? 'Todos los cambios guardados' : 'Cambios sin guardar'}</span></div></div>
      <div className="builder-top-actions"><button type="button" className="btn btn-outline btn-sm" onClick={openPreview}>{previewLabel}</button><button className="btn btn-primary btn-sm" disabled={saved || saveMutation.isPending} onClick={() => saveMutation.mutate(draft)}>{saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}</button></div>
    </header>
    {saveMutation.error && <div className="builder-error alert alert-error">{saveMutation.error.message}</div>}
    {!clientMode && <div className="builder-progress">{STEPS.map((label, index) => <button className={step === index ? 'active' : step > index ? 'done' : ''} key={label} onClick={() => setStep(index)}><span>{step > index ? '✓' : index + 1}</span>{label}</button>)}</div>}

    {step === 0 && <Fragment>
      <div className="builder-grid">
        <aside className="field-library"><span className="page-eyebrow">BIBLIOTECA DE CAMPOS</span><h3>Agrega campos</h3><p>Arrastra al formulario o usa el botón Agregar. En celular, usa los botones.</p><div className="field-library-help"><strong>Recomendados para Meta</strong><small>Nombre, teléfono, correo y consentimiento mejoran la calidad de match.</small></div>{FIELD_LIBRARY.map(([type, label]) => <button draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('new-field', type); }} onDragEnd={() => setCanvasDragOver(false)} onClick={() => addField(type)} key={type} className={RECOMMENDED_FIELDS.has(type) ? 'recommended' : ''}><span>{label.slice(0, 2).toUpperCase()}</span><div><strong>{label}</strong><small>{RECOMMENDED_FIELDS.has(type) ? 'Recomendado para reservas' : 'Campo opcional'}</small></div><em>Agregar</em></button>)}</aside>
        <main className={`builder-canvas ${canvasDragOver ? 'drag-over' : ''}`} onDragEnter={() => setCanvasDragOver(true)} onDragLeave={(event) => { if (event.currentTarget === event.target) setCanvasDragOver(false); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = event.dataTransfer.types.includes('new-field') ? 'copy' : 'move'; setCanvasDragOver(true); }} onDrop={(event) => { event.preventDefault(); setCanvasDragOver(false); const type = event.dataTransfer.getData('new-field'); if (type) { addField(type); return; } const from = event.dataTransfer.getData('field-id'); if (from && fields.length > 1) { const current = fields.find((field) => field.id === from); if (current && fields[fields.length - 1]?.id !== from) change({ fieldSchema: [...fields.filter((field) => field.id !== from), current] }); } }}>
          <div className="canvas-intro"><span>FORMULARIO</span><h2>{draft.designConfig.title || draft.name}</h2><p>{draft.designConfig.welcome}</p><small>Toda esta superficie recibe campos arrastrados. También puedes ordenar arrastrando cada fila o usar Subir/Bajar.</small></div>
          {fields.map((field, index) => <article tabIndex={0} draggable onDragStart={(event) => event.dataTransfer.setData('field-id', field.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); const from = event.dataTransfer.getData('field-id'); if (from) reorder(from, field.id); }} className={`canvas-field ${selected === field.id ? 'selected' : ''}`} key={field.id} onClick={() => setSelected(field.id)} onFocus={() => setSelected(field.id)}>
            <span className="drag-handle" aria-label="Arrastrar para ordenar">⠿</span><div><label>{field.label}{field.required && ' *'}{field.system && <em> Protegido</em>}</label><div className="field-preview-input">{field.placeholder || (['select', 'multi_select'].includes(field.type) ? 'Selecciona una opción' : 'Respuesta del visitante')}</div></div><div className="field-order"><button type="button" aria-label={`Subir ${field.label}`} disabled={index === 0} onClick={(event) => { event.stopPropagation(); moveField(field.id, -1); }}>Subir</button><button type="button" aria-label={`Bajar ${field.label}`} disabled={index === fields.length - 1} onClick={(event) => { event.stopPropagation(); moveField(field.id, 1); }}>Bajar</button><button type="button" aria-label={`Duplicar ${field.label}`} onClick={(event) => { event.stopPropagation(); duplicateField(field); }}>Duplicar</button></div>
          </article>)}
          <div className="canvas-drop"><strong>Todo este formulario es zona para arrastrar</strong><span>Suelta en cualquier espacio libre para agregar al final, o sobre un campo para ordenar.</span></div>
        </main>
        <aside className="field-settings">{active ? <><span className="page-eyebrow">CONFIGURACIÓN</span><h3>{active.label}</h3>{active.system && <div className="alert alert-info">Campo protegido: puedes editar texto y orden, pero no eliminarlo porque ayuda a crear la reserva o medir conversiones.</div>}<label>Etiqueta<input className="input" value={active.label} onChange={(event) => updateField({ label: event.target.value })} /></label><label>Texto de ayuda<input className="input" value={active.placeholder || ''} onChange={(event) => updateField({ placeholder: event.target.value })} /></label><label className="toggle-row"><input type="checkbox" checked={active.required} onChange={(event) => updateField({ required: event.target.checked })} /> Campo obligatorio</label>{active.options && <label>Opciones<textarea className="input" rows={6} value={active.options.join('\n')} onChange={(event) => updateField({ options: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} /></label>}<div className="field-settings-actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => duplicateField(active)}>Duplicar</button>{!active.system && <button className="btn btn-outline btn-danger btn-sm" onClick={() => { change({ fieldSchema: fields.filter((field) => field.id !== active.id) }); setSelected(null); }}>Eliminar campo</button>}</div></> : <div className="settings-empty"><strong>Selecciona un campo</strong><p>Aquí podrás editar su etiqueta, validación y opciones. Para agregar, usa botones o arrastra desde la biblioteca.</p></div>}</aside>
      </div>
    </Fragment>}

    {step === 1 && <div className="builder-stage"><div className="stage-heading"><span className="page-eyebrow">AGENDA Y CAPACIDAD</span><h2>¿Cuándo pueden reservar?</h2><p>Define el horario habitual y usa bloqueos para cierres, feriados o excepciones.</p></div><div className="schedule-layout">
      <div className="schedule-card"><h3>Reglas generales</h3><div className="schedule-settings schedule-settings-wide"><label>Zona horaria<select className="input" value={draft.timezone} onChange={(event) => change({ timezone: event.target.value })}>{TIMEZONES.map((timezone) => <option key={timezone}>{timezone}</option>)}</select></label><label>Duración<select className="input" value={draft.durationMinutes} onChange={(event) => change({ durationMinutes: Number(event.target.value) })}>{[15, 30, 45, 60, 90, 120].map((value) => <option key={value} value={value}>{value} minutos</option>)}</select></label><label>Separación (min)<input className="input" type="number" min="0" max="240" value={draft.bufferMinutes} onChange={(event) => change({ bufferMinutes: Number(event.target.value) })} /></label><label>Cupos por bloque<input className="input" type="number" min="1" max="500" value={draft.capacityPerSlot} onChange={(event) => change({ capacityPerSlot: Number(event.target.value) })} /></label><label>Tope diario de reservas<small>0 = sin límite. Al alcanzarlo, el día se muestra completo.</small><input className="input" type="number" min="0" max="5000" value={draft.dailyCapacity ?? 0} onChange={(event) => change({ dailyCapacity: Number(event.target.value) })} /></label><label>Anticipación mínima (h)<input className="input" type="number" min="0" value={draft.minimumNoticeHours} onChange={(event) => change({ minimumNoticeHours: Number(event.target.value) })} /></label><label>Ventana máxima (días)<input className="input" type="number" min="1" max="365" value={draft.maximumAdvanceDays} onChange={(event) => change({ maximumAdvanceDays: Number(event.target.value) })} /></label>            <label>Confirmación<select className="input" value={draft.confirmationMode} onChange={(event) => change({ confirmationMode: event.target.value })}><option value="automatic">Automática</option><option value="manual">Revisión manual</option></select></label>
            <label className="wide">Notificaciones al equipo<small>Correos que recibirán aviso por cada reserva (separados por coma).</small><input className="input" value={(draft.teamNotifications || []).join(', ')} onChange={(event) => change({ teamNotifications: event.target.value.split(/[,;\s]+/).filter(Boolean) })} placeholder="equipo@empresa.cl" /></label>
            <label className="toggle-row"><input type="checkbox" checked={draft.designConfig?.couponEnabled !== 'false'} onChange={(event) => change({ designConfig: { ...draft.designConfig, couponEnabled: event.target.checked ? 'true' : 'false' } })} /> Habilitar cupón promocional en el formulario</label></div><h3>Semana habitual</h3><div className="week-editor week-editor-multi">{DAYS.map((label, day) => { const dayWindows = windows.map((window, index) => ({ window, index })).filter((entry) => entry.window.day === day); return <div key={label} className={dayWindows.length ? 'enabled' : ''}><label className="toggle-row"><input type="checkbox" checked={dayWindows.length > 0} onChange={() => toggleDay(day)} /><strong>{label}</strong></label><div className="day-windows">{dayWindows.map(({ window, index }) => <div key={`${day}-${index}`}><input aria-label={`Inicio ${label}`} type="time" value={window.start} onChange={(event) => updateWindow(index, { start: event.target.value })} /><span>a</span><input aria-label={`Fin ${label}`} type="time" value={window.end} onChange={(event) => updateWindow(index, { end: event.target.value })} /><button type="button" aria-label={`Quitar franja de ${label}`} onClick={() => removeWindow(index)}>×</button></div>)}{dayWindows.length > 0 && dayWindows.length < 4 && <button type="button" className="add-window" onClick={() => addWindow(day)}>+ Agregar franja</button>}{dayWindows.length === 0 && <em>Cerrado</em>}</div></div>; })}</div></div>
      <aside className="schedule-card"><h3>Cierres y bloqueos</h3><p className="page-subtitle">Bloquea una hora, un día completo o un periodo especial.</p><form className="block-form" onSubmit={(event) => { event.preventDefault(); if (blockRepeat > 1) { batchBlockMutation.mutate({ ...block, repeat: blockRepeat }); } else { blockMutation.mutate(block); } }}><label>Desde<input className="input" type="datetime-local" required value={block.startsAt} onChange={(event) => setBlock({ ...block, startsAt: event.target.value })} /></label><label>Hasta<input className="input" type="datetime-local" required value={block.endsAt} onChange={(event) => setBlock({ ...block, endsAt: event.target.value })} /></label><label>Motivo<input className="input" value={block.reason} onChange={(event) => setBlock({ ...block, reason: event.target.value })} placeholder="Feriado, evento interno..." /></label><label>Repetir durante<small>Cantidad de semanas consecutivas.</small><input className="input" type="number" min="1" max="12" value={blockRepeat} onChange={(event) => setBlockRepeat(Number(event.target.value))} /></label>{(blockMutation.error || batchBlockMutation.error) && <div className="alert alert-error">{(blockMutation.error || batchBlockMutation.error)?.message}</div>}<button className="btn btn-primary btn-block" disabled={blockMutation.isPending || batchBlockMutation.isPending}>{batchBlockMutation.isPending ? 'Creando bloqueos...' : blockRepeat > 1 ? `Crear ${blockRepeat} bloqueos` : 'Agregar bloqueo'}</button></form><div className="block-full-day"><label>Cerrar día completo<small>Selecciona una fecha para cerrarla toda.</small><input className="input" type="date" value={fullDayDate} onChange={(event) => setFullDayDate(event.target.value)} /></label><button className="btn btn-outline btn-block" disabled={!fullDayDate || blockMutation.isPending || batchBlockMutation.isPending} onClick={blockFullDay}>Cerrar día</button></div><div className="block-list">{blocks.length === 0 ? <p className="page-subtitle">No hay bloqueos futuros.</p> : blocks.map((item) => <div key={item.id}><div><strong>{item.reason || 'Agenda cerrada'}</strong><small>{new Date(item.startsAt).toLocaleString('es-CL')} → {new Date(item.endsAt).toLocaleString('es-CL')}</small></div><button onClick={() => deleteBlock.mutate(item.id)}>Quitar</button></div>)}</div></aside>
    </div></div>}

    {step === 2 && <div className="builder-stage"><div className="stage-heading"><span className="page-eyebrow">ENTORNO VISUAL</span><h2>Haz que la reserva se sienta propia.</h2><p>Personaliza logo, colores, mensaje y fondo sin afectar la claridad del flujo. El texto claro u oscuro se ajusta automáticamente para conservar contraste.</p></div><div className="design-studio"><div className="design-controls"><label>Título público<input className="input" value={draft.designConfig.title || ''} onChange={(event) => change({ designConfig: { ...draft.designConfig, title: event.target.value } })} /></label><label>Mensaje de bienvenida<textarea className="input" rows={4} value={draft.designConfig.welcome || ''} onChange={(event) => change({ designConfig: { ...draft.designConfig, welcome: event.target.value } })} /></label><ImageUpload
              label="Logo de la empresa"
              value={draft.designConfig.logoUrl}
              onChange={(url) => saveDesignAsset('logoUrl', url)}
              placeholder="https://empresa.cl/logo.png"
              maxSizeMB={3}
            />
            <DesignAdvancedControls design={draft.designConfig} onChange={(designConfig) => change({ designConfig })} />
            <div className="design-templates">{DESIGN_TEMPLATES.map((template) => <button type="button" key={template.name} onClick={() => change({ designConfig: { ...draft.designConfig, ...template.config } })}>{template.name}</button>)}</div>
            <label>Tipo de fondo<select className="input" value={draft.designConfig.backgroundMode || (draft.designConfig.backgroundImage ? 'image' : 'color')} onChange={(event) => change({ designConfig: { ...draft.designConfig, backgroundMode: event.target.value, ...(event.target.value === 'gradient' && !draft.designConfig.backgroundGradient ? { backgroundGradient: DEFAULT_BACKGROUND_GRADIENT } : {}) } })}><option value="color">Color plano</option><option value="gradient">Degradado</option><option value="image">Imagen</option></select></label>
            <label>Degradado<input className="input" value={draft.designConfig.backgroundGradient || DEFAULT_BACKGROUND_GRADIENT} onChange={(event) => change({ designConfig: { ...draft.designConfig, backgroundGradient: event.target.value } })} /></label>
            <label>Opacidad de fondo ({draft.designConfig.backgroundOpacity || '88'}%)<input type="range" min="0" max="100" value={draft.designConfig.backgroundOpacity || '88'} onChange={(event) => change({ designConfig: { ...draft.designConfig, backgroundOpacity: event.target.value } })} /></label>
            <label>Posición del fondo<select className="input" value={draft.designConfig.backgroundPosition || 'center'} onChange={(event) => change({ designConfig: { ...draft.designConfig, backgroundPosition: event.target.value } })}><option value="center">Centro</option><option value="top">Arriba</option><option value="bottom">Abajo</option><option value="left">Izquierda</option><option value="right">Derecha</option></select></label>
            <label>Forma de botones<select className="input" value={draft.designConfig.buttonRadius || '12'} onChange={(event) => change({ designConfig: { ...draft.designConfig, buttonRadius: event.target.value } })}><option value="4">Rectos</option><option value="12">Suaves</option><option value="999">Píldora</option></select></label>
            <label>Forma de campos<select className="input" value={draft.designConfig.fieldRadius || '10'} onChange={(event) => change({ designConfig: { ...draft.designConfig, fieldRadius: event.target.value } })}><option value="2">Rectos</option><option value="10">Suaves</option><option value="18">Redondeados</option></select></label>
            <div className="preview-device-toggle"><button type="button" className={previewDevice === 'mobile' ? 'active' : ''} onClick={() => setPreviewDevice('mobile')}>Vista móvil</button><button type="button" className={previewDevice === 'desktop' ? 'active' : ''} onClick={() => setPreviewDevice('desktop')}>Vista escritorio</button></div>
            <ImageUpload
              label="Imagen de fondo"
              value={draft.designConfig.backgroundImage}
              onChange={(url) => saveDesignAsset('backgroundImage', url)}
              placeholder="https://..."
              maxSizeMB={5}
            />            <div className="color-controls"><label>Principal<input type="color" value={draft.designConfig.primaryColor || '#173f35'} onChange={(event) => change({ designConfig: { ...draft.designConfig, primaryColor: event.target.value } })} /></label><label>Acento<input type="color" value={draft.designConfig.accentColor || '#ea0f63'} onChange={(event) => change({ designConfig: { ...draft.designConfig, accentColor: event.target.value } })} /></label><label>Fondo<input type="color" value={draft.designConfig.backgroundColor || '#f3f5ef'} onChange={(event) => change({ designConfig: { ...draft.designConfig, backgroundColor: event.target.value } })} /></label><label>Color de letras<input type="color" value={draft.designConfig.textColor || '#3f4e49'} onChange={(event) => change({ designConfig: { ...draft.designConfig, textColor: event.target.value } })} /></label></div><label>Tipo de letra<select className="input" value={draft.designConfig.fontFamily || 'system-ui'} onChange={(event) => change({ designConfig: { ...draft.designConfig, fontFamily: event.target.value } })}><option value="system-ui">Sistema</option><option value="Inter, sans-serif">Inter</option><option value="Georgia, serif">Georgia</option><option value="'Courier New', monospace">Monospace</option></select></label></div><ReservationLivePreview draft={draft} fields={fields} previewDevice={previewDevice} style={designPreviewStyle} /></div></div>}

    {step === 3 && <div className="builder-stage"><div className="stage-heading"><span className="page-eyebrow">PUBLICACIÓN</span><h2>Verifica la medición y comparte.</h2><p>En esta fase VitaHub utiliza exclusivamente el Pixel de la empresa y Conversions API.</p></div><div className="publish-grid"><div className="publish-summary"><h3>Revisión operativa</h3><div><span>Campos configurados</span><strong>{fields.length}</strong></div><div><span>Días habilitados</span><strong>{new Set(windows.map((window) => window.day)).size}</strong></div><div><span>CRM de reservas</span><strong>{draft.capabilities?.crm ? 'Habilitado' : 'No habilitado'}</strong></div><div><span>Pixel de la empresa</span><strong>{draft.pixelName ? `${draft.pixelName} · ••••${draft.pixelId?.slice(-4) || '----'}` : draft.pixelId ? `••••${draft.pixelId.slice(-4)}` : 'Sin Pixel asignado'}</strong></div><div><span>Estado de Meta</span><strong className={draft.metaReady ? 'status-ready' : 'status-warning'}>{draft.metaReady ? 'Listo para CAPI' : 'En alerta'}</strong></div><div><span>Token CAPI</span><strong>{draft.metaReady ? 'Validado' : 'Pendiente'}</strong></div><div><span>Dominio público</span><strong className={publicUrlReady ? 'status-ready' : 'status-warning'}>{publicUrlReady ? 'HTTPS listo' : 'Pendiente HTTPS'}</strong></div>{!clientMode && <label className={`meta-publication-toggle ${draft.metaCapiEnabled ? 'active' : ''}`}><input type="checkbox" checked={Boolean(draft.metaCapiEnabled)} disabled={!draft.capabilities?.metaConversions} onChange={(event) => change({ metaCapiEnabled: event.target.checked })} /><span><strong>Enviar conversiones a Meta</strong><small>Schedule al reservar y Reserva_Asistida al marcar asistencia.</small></span></label>}<label>Referencia de campaña en VitaHub<input className="input" value={draft.campaignId || ''} onChange={(event) => change({ campaignId: event.target.value })} placeholder="Ej.: invierno-reservas-2026" /><small>Es una etiqueta de atribución. Las campañas reales se leerán en Fase 2 con ads_read.</small></label>{!publicUrlReady && <div className="alert alert-warning">Para anuncios reales necesitas configurar VITE_APP_PUBLIC_URL y APP_PUBLIC_URL con dominio HTTPS de iHosting. En local puedes probar, pero no uses este enlace en Meta.</div>}{draft.capabilities?.metaConversions && !draft.metaReady && <div className="alert alert-warning">Meta está habilitado para la empresa, pero esta reserva publicará en modo alerta: el formulario podrá salir igual, y la conversión sólo se enviará si la empresa tiene Pixel y token válidos.</div>}</div><div className="publish-link"><span>ENLACE HTTPS PARA ANUNCIOS</span><strong>{campaignUrl}</strong><div><button className="btn btn-outline" onClick={copyLink}>{copied ? 'Copiado' : 'Copiar enlace'}</button>{publicPreviewReady ? <a className="btn btn-outline" href={campaignUrl} target="_blank" rel="noreferrer">Probar experiencia</a> : <button type="button" className="btn btn-outline" onClick={() => setStep(2)}>{publishedButDirty ? 'Guardar para probar' : 'Ver vista interna'}</button>}</div><small>{publicPreviewReady ? 'El enlace añade utm_source=meta y la referencia indicada; fbclid llegará automáticamente desde el anuncio.' : 'La experiencia pública se habilita después de publicar y guardar el formulario.'}</small><button className="btn reservation-cta" disabled={saveMutation.isPending || windows.length === 0} onClick={() => saveMutation.mutate({ ...draft, status: 'published' })}>{draft.status === 'published' ? 'Guardar y mantener publicado' : 'Publicar formulario'}</button>{windows.length === 0 && <small>Debes habilitar al menos un día antes de publicar.</small>}{!APP_PUBLIC_URL_CONFIGURED && <small>Dominio público no configurado en frontend; usando origen actual solo para prueba local.</small>}{draft.capabilities?.metaConversions && !draft.metaReady && <small>Se publicará igual, pero Meta quedará en alerta hasta que el Pixel y el token estén listos.</small>}</div></div></div>}

    <footer className="builder-footer"><span>Paso {step + 1} de {STEPS.length}</span>{!clientMode && step > 0 && <button className="btn btn-outline btn-sm" onClick={() => setStep(step - 1)}>Anterior</button>}{!clientMode && step < STEPS.length - 1 && <button className="btn btn-primary btn-sm" onClick={() => setStep(step + 1)}>Continuar</button>}<button className="btn btn-outline btn-sm" disabled={saved || saveMutation.isPending} onClick={() => saveMutation.mutate(draft)}>Guardar</button></footer>
  </div>;
}

function DesignAdvancedControls({
  design,
  onChange,
}: {
  design: DesignConfig;
  onChange: (design: DesignConfig) => void;
}) {
  const update = (patch: Partial<DesignConfig>) => onChange({ ...design, ...patch });
  const activePosition = design.backgroundAnchor || design.backgroundPosition || 'center center';
  const activeLayout = design.layoutPosition || 'right';
  const activeLogo = design.logoPosition || 'left';

  return (
    <section className="design-custom-panel">
      <div>
        <span>Diseño personalizado</span>
        <strong>Ubicación y fondo</strong>
        <small>Controles seguros: personalizas la página sin romper móvil, contraste ni publicación.</small>
      </div>
      <div className="design-control-group">
        <span>Marca superior</span>
        <label className="toggle-row"><input type="checkbox" checked={visible(design.showPoweredBy)} onChange={(event) => update({ showPoweredBy: String(event.target.checked) })} /> Mostrar “Gestionado con”</label>
        <textarea className="input" rows={2} value={design.poweredByText || 'Gestionado con\nVITAHUB Reservas'} onChange={(event) => update({ poweredByText: event.target.value })} />
        <label className="toggle-row"><input type="checkbox" checked={visible(design.showSecureBadge)} onChange={(event) => update({ showSecureBadge: String(event.target.checked) })} /> Mostrar sello “Reserva segura”</label>
        <input className="input" value={design.secureBadgeText || 'Reserva segura'} onChange={(event) => update({ secureBadgeText: event.target.value })} />
      </div>
      <div className="design-control-group">
        <span>Encabezado público</span>
        <label className="toggle-row"><input type="checkbox" checked={visible(design.showLogo)} onChange={(event) => update({ showLogo: String(event.target.checked) })} /> Mostrar logo</label>
        <label>Tamaño del logo ({design.logoSize || '64'}px)<input type="range" min="32" max="180" value={design.logoSize || '64'} onChange={(event) => update({ logoSize: event.target.value })} /></label>
        <label className="toggle-row"><input type="checkbox" checked={visible(design.showEyebrow)} onChange={(event) => update({ showEyebrow: String(event.target.checked) })} /> Mostrar etiqueta superior</label>
        <input className="input" value={design.eyebrowText || 'AGENDA EN LÍNEA'} onChange={(event) => update({ eyebrowText: event.target.value })} />
        <label>Tamaño del título ({design.titleSize || '72'}px)<input type="range" min="32" max="96" value={design.titleSize || '72'} onChange={(event) => update({ titleSize: event.target.value })} /></label>
        <label className="toggle-row"><input type="checkbox" checked={visible(design.showWelcome)} onChange={(event) => update({ showWelcome: String(event.target.checked) })} /> Mostrar mensaje de bienvenida</label>
        <label>Tamaño del mensaje ({design.welcomeSize || '16'}px)<input type="range" min="12" max="24" value={design.welcomeSize || '16'} onChange={(event) => update({ welcomeSize: event.target.value })} /></label>
      </div>
      <div className="design-control-group">
        <span>Datos rápidos</span>
        <label className="toggle-row"><input type="checkbox" checked={visible(design.showFacts)} onChange={(event) => update({ showFacts: String(event.target.checked) })} /> Mostrar minutos, confirmación y zona horaria</label>
        <div className="design-mini-grid"><input className="input" value={design.durationLabel || 'minutos'} onChange={(event) => update({ durationLabel: event.target.value })} /><input className="input" value={design.confirmationLabel || 'confirmación'} onChange={(event) => update({ confirmationLabel: event.target.value })} /><input className="input" value={design.timezoneLabel || 'zona horaria'} onChange={(event) => update({ timezoneLabel: event.target.value })} /></div>
        <div className="design-mini-grid"><input className="input" value={design.automaticLabel || 'Directa'} onChange={(event) => update({ automaticLabel: event.target.value })} /><input className="input" value={design.manualLabel || 'Manual'} onChange={(event) => update({ manualLabel: event.target.value })} /><input className="input" value={design.timezoneValue || ''} placeholder="Ej.: Santiago" onChange={(event) => update({ timezoneValue: event.target.value })} /></div>
      </div>
      <div className="design-control-group">
        <span>Plantillas visuales</span>
        <div className="design-templates">{DESIGN_TEMPLATES.map((template) => <button type="button" key={template.name} onClick={() => onChange({ ...design, ...template.config })}>{template.name}</button>)}</div>
      </div>
      <label>Mensaje de confirmación<textarea className="input" rows={3} value={design.confirmationMessage || ''} onChange={(event) => update({ confirmationMessage: event.target.value })} placeholder="Tu reserva quedó registrada. Te esperamos." /></label>
      <label>Tipo de fondo<select className="input" value={design.backgroundMode || (design.backgroundImage ? 'image' : 'color')} onChange={(event) => update({ backgroundMode: event.target.value, ...(event.target.value === 'gradient' && !design.backgroundGradient ? { backgroundGradient: DEFAULT_BACKGROUND_GRADIENT } : {}) })}><option value="color">Color plano</option><option value="gradient">Degradado</option><option value="image">Imagen</option></select></label>
      <label>Degradado<input className="input" value={design.backgroundGradient || DEFAULT_BACKGROUND_GRADIENT} onChange={(event) => update({ backgroundGradient: event.target.value })} /></label>
      <div className="color-controls"><label>Principal<input type="color" value={design.primaryColor || '#173f35'} onChange={(event) => update({ primaryColor: event.target.value })} /></label><label>Acento<input type="color" value={design.accentColor || '#ea0f63'} onChange={(event) => update({ accentColor: event.target.value })} /></label><label>Fondo<input type="color" value={design.backgroundColor || '#f3f5ef'} onChange={(event) => update({ backgroundColor: event.target.value })} /></label><label>Color de letras<input type="color" value={design.textColor || '#3f4e49'} onChange={(event) => update({ textColor: event.target.value })} /></label></div>
      <label>Tipo de letra<select className="input" value={design.fontFamily || 'system-ui'} onChange={(event) => update({ fontFamily: event.target.value })}><option value="system-ui">Sistema</option><option value="Inter, sans-serif">Inter</option><option value="Georgia, serif">Georgia</option><option value="'Courier New', monospace">Monospace</option></select></label>
      <div className="design-mini-grid"><label>Forma de botones<select className="input" value={design.buttonRadius || '12'} onChange={(event) => update({ buttonRadius: event.target.value })}><option value="4">Rectos</option><option value="12">Suaves</option><option value="999">Píldora</option></select></label><label>Forma de campos<select className="input" value={design.fieldRadius || '10'} onChange={(event) => update({ fieldRadius: event.target.value })}><option value="2">Rectos</option><option value="10">Suaves</option><option value="18">Redondeados</option></select></label></div>
      <label>Visibilidad del fondo ({design.backgroundOpacity || '88'}%)<input type="range" min="0" max="100" value={design.backgroundOpacity || '88'} onChange={(event) => update({ backgroundOpacity: event.target.value })} /></label>
      <div className="design-control-group">
        <span>Posición del fondo</span>
        <div className="position-grid">
          {BACKGROUND_POSITIONS.map(([value, label]) => <button type="button" key={value} className={activePosition === value ? 'active' : ''} title={label} aria-label={label} onClick={() => update({ backgroundAnchor: value, backgroundPosition: value.includes('top') ? 'top' : value.includes('bottom') ? 'bottom' : value.includes('left') ? 'left' : value.includes('right') ? 'right' : 'center' })} />)}
        </div>
      </div>
      <div className="segmented-control">
        <span>Tamaño del fondo</span>
        <div>{BACKGROUND_SIZES.map(([value, label]) => <button type="button" key={value} className={(design.backgroundSize || 'cover') === value ? 'active' : ''} onClick={() => update({ backgroundSize: value })}>{label}</button>)}</div>
      </div>
      <div className="segmented-control">
        <span>Ubicación del formulario</span>
        <div>{LAYOUT_POSITIONS.map(([value, label]) => <button type="button" key={value} className={activeLayout === value ? 'active' : ''} onClick={() => update({ layoutPosition: value })}>{label}</button>)}</div>
      </div>
      <div className="segmented-control">
        <span>Alineación del logo</span>
        <div>{LOGO_POSITIONS.map(([value, label]) => <button type="button" key={value} className={activeLogo === value ? 'active' : ''} onClick={() => update({ logoPosition: value })}>{label}</button>)}</div>
      </div>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => update({ showPoweredBy: 'true', poweredByText: 'Gestionado con\nVITAHUB Reservas', showSecureBadge: 'true', secureBadgeText: 'Reserva segura', showLogo: 'true', showEyebrow: 'true', eyebrowText: 'AGENDA EN LÍNEA', showWelcome: 'true', showFacts: 'true', logoSize: '64', titleSize: '72', welcomeSize: '16', durationLabel: 'minutos', confirmationLabel: 'confirmación', timezoneLabel: 'zona horaria', automaticLabel: 'Directa', manualLabel: 'Manual', timezoneValue: '', backgroundOpacity: '88', backgroundAnchor: 'center center', backgroundPosition: 'center', backgroundSize: 'cover', layoutPosition: 'right', logoPosition: 'left' })}>Restablecer diseño público</button>
    </section>
  );
}

function ReservationLivePreview({
  draft,
  fields,
  previewDevice,
  style,
}: {
  draft: ReservationForm;
  fields: FormField[];
  previewDevice: 'mobile' | 'desktop';
  style: CSSProperties;
}) {
  const design = draft.designConfig || {};
  const systemFields = new Map(fields.map((field) => [field.id, field]));
  const customFields = fields.filter((field) => !['name', 'email', 'phone'].includes(field.id)).slice(0, 6);
  const sampleSlots = ['12:00', '13:30', '20:00'];

  return (
    <div className={`design-preview live ${previewDevice} layout-${safeDesignChoice(design.layoutPosition, ['left', 'center', 'right'], 'right')}`} style={style}>
      <div className="preview-public-shell">
        <section className="preview-public-intro">
          {design.logoUrl && visible(design.showLogo) && <img className="reservation-logo-preview" src={design.logoUrl} alt="Logo configurado" />}
          <span>AGENDA EN LÍNEA</span>
          <h2>{design.title || draft.name}</h2>
          <p>{design.welcome || 'Elige el horario que mejor te acomode.'}</p>
          <div className="preview-public-facts">
            <div><strong>{draft.durationMinutes}</strong><span>minutos</span></div>
            <div><strong>{draft.confirmationMode === 'automatic' ? 'Directa' : 'Manual'}</strong><span>confirmación</span></div>
            <div><strong>{draft.timezone.split('/').pop()?.replaceAll('_', ' ')}</strong><span>zona horaria</span></div>
          </div>
        </section>
        <section className="preview-public-card">
          <div className="booking-step-title"><span>01</span><div><strong>Selecciona fecha y hora</strong><small>Vista previa de disponibilidad.</small></div></div>
          <div className="preview-slot-group">
            <h3>Hoy</h3>
            <div>{sampleSlots.map((slot, index) => <button type="button" className={index === 0 ? 'active' : ''} key={slot}>{slot}<small>{draft.capacityPerSlot} disp.</small></button>)}</div>
          </div>
          <div className="booking-step-title"><span>02</span><div><strong>Datos de la reserva</strong><small>Estos son los campos configurados.</small></div></div>
          <div className="preview-public-fields">
            <PreviewField label={systemFields.get('name')?.label || 'Nombre completo'} required={systemFields.get('name')?.required !== false} />
            <PreviewField label={systemFields.get('phone')?.label || 'Teléfono'} required={Boolean(systemFields.get('phone')?.required)} />
            <PreviewField label={systemFields.get('email')?.label || 'Correo'} required={Boolean(systemFields.get('email')?.required)} />
            <PreviewField label="Número de personas" />
            {customFields.map((field) => <PreviewField key={field.id} label={field.label} required={field.required} type={field.type} />)}
          </div>
          <span className="preview-submit">Confirmar reserva</span>
          <p className="privacy-note">Tus datos no son públicos y quedan asociados exclusivamente a esta empresa.</p>
        </section>
      </div>
    </div>
  );
}

function PreviewField({ label, required, type = 'text' }: { label: string; required?: boolean; type?: string }) {
  if (type === 'consent') return <label className="preview-consent"><span className="preview-checkbox" />{label}{required ? ' *' : ''}</label>;
  if (type === 'textarea') return <label>{label}{required ? ' *' : ''}<span className="preview-input textarea" /></label>;
  if (type === 'select' || type === 'multi_select') return <label>{label}{required ? ' *' : ''}<span className="preview-input select">Selecciona una opción</span></label>;
  return <label>{label}{required ? ' *' : ''}<span className="preview-input" /></label>;
}
