/**
 * Shared types for Setup Wizard components
 */

export interface EnvironmentInfo {
  os: { platform: string; release: string; arch: string; hostname: string };
  memory: { total_gb: number; free_gb: number; sufficient: boolean };
  disk: { free_gb: number; total_gb: number; sufficient: boolean };
  user: { home_dir: string; username: string };
}

export interface SecurityProfile {
  id: string;
  name: string;
  description: string;
  allow_network: boolean;
  allow_external_ai: boolean;
  risk_level: string;
}

export interface ClawdBotStatus {
  connected: boolean;
  version?: string;
  error?: string;
}

export interface LocalAIStatus {
  anyAvailable: boolean;
  providers: Array<{ name: string; detected: boolean; models?: string[] }>;
  explanation: string;
}

export const WIZARD_STEPS = [
  'welcome',
  'environment',
  'workspace',
  'clawdbot',
  'localai',
  'security',
  'pin',
  'health',
  'complete',
] as const;

export type WizardStep = typeof WIZARD_STEPS[number];
