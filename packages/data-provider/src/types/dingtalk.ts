export type DingTalkBindingStatus = 'disabled' | 'connecting' | 'connected' | 'error';

export interface DingTalkBinding {
  id: string;
  agentId: string;
  clientId: string;
  robotCode?: string;
  enabled: boolean;
  status: DingTalkBindingStatus;
  hasClientSecret: boolean;
  lastConnectedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DingTalkBindingResponse {
  binding: DingTalkBinding | null;
}

export interface UpsertDingTalkBindingRequest {
  clientId: string;
  clientSecret?: string;
  robotCode?: string;
  enabled: boolean;
}
