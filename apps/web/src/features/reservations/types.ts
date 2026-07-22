export interface FormField { id: string; type: string; label: string; required: boolean; placeholder?: string; options?: string[]; system?: boolean }
export interface DesignConfig {
  primaryColor?: string; accentColor?: string; backgroundColor?: string; textColor?: string;
  title?: string; welcome?: string; confirmationMessage?: string;
  logoUrl?: string; backgroundImage?: string; backgroundMode?: string; backgroundGradient?: string;
  backgroundOpacity?: string; backgroundPosition?: string; backgroundAnchor?: string; backgroundSize?: string;
  layoutPosition?: string; logoPosition?: string; logoSize?: string; showLogo?: string;
  showPoweredBy?: string; poweredByText?: string; showSecureBadge?: string; secureBadgeText?: string;
  showEyebrow?: string; eyebrowText?: string; showWelcome?: string; showFacts?: string;
  titleSize?: string; welcomeSize?: string; durationLabel?: string; confirmationLabel?: string;
  timezoneLabel?: string; automaticLabel?: string; manualLabel?: string; timezoneValue?: string;
  buttonRadius?: string; fieldRadius?: string; fontFamily?: string; couponEnabled?: string;
  [key: string]: string | undefined;
}
export interface ReservationForm { id: string; clientId: string; name: string; publicSlug: string; publicUrl?: string; status: string; mode: string; timezone: string; durationMinutes: number; bufferMinutes: number; capacityPerSlot: number; dailyCapacity: number; minimumNoticeHours: number; maximumAdvanceDays: number; confirmationMode: string; fieldSchema: FormField[]; designConfig: DesignConfig; scheduleConfig: { windows?: Array<{ day: number; start: string; end: string }> }; servicesConfig?: Array<{ id: string; name: string; durationMinutes?: number; capacity?: number }>; resourcesConfig?: Array<{ id: string; name: string; capacity?: number }>; campaignId?: string; crmEnabled?: boolean; calendarEnabled?: boolean; metaCapiEnabled?: boolean; teamNotifications?: string[]; pixelId?: string | null; pixelName?: string | null; metaReady?: boolean; capabilities?: { reservations: boolean; crm: boolean; metaConversions: boolean }; updatedAt: string }
export interface Reservation { id: string; formId: string; referenceCode: string; status: string; startsAt: string; partySize: number; guestName: string; guestEmail?: string; guestPhone?: string; answers?: Record<string, unknown>; utmSource?: string; utmCampaign?: string; internalNotes?: string; createdAt?: string }
