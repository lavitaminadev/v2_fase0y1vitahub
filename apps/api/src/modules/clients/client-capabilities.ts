export const CLIENT_CAPABILITY_KEYS = ['reservations', 'crm', 'metaConversions'] as const;

export type ClientCapabilityKey = (typeof CLIENT_CAPABILITY_KEYS)[number];
export type ClientCapabilities = Record<ClientCapabilityKey, boolean>;

export const DEFAULT_CLIENT_CAPABILITIES: ClientCapabilities = {
  reservations: true,
  crm: true,
  metaConversions: false,
};

export function normalizeClientCapabilities(value?: Partial<ClientCapabilities> | null): ClientCapabilities {
  return {
    ...DEFAULT_CLIENT_CAPABILITIES,
    ...(value || {}),
  };
}
