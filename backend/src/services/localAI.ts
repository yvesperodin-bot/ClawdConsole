import { logAudit, getSetupState, getSecurityProfile } from '../database/db.js';

/**
 * Local AI Detection Service
 *
 * Detects local AI services like Ollama and LM Studio.
 * These are the ONLY AI providers allowed in AIR_GAPPED and LOCAL_ONLY modes.
 */

const OLLAMA_URL = 'http://localhost:11434';
const LM_STUDIO_URL = 'http://localhost:1234';
const TIMEOUT_MS = 3000;

export interface LocalAIProvider {
  name: string;
  detected: boolean;
  url: string;
  version?: string;
  models?: string[];
  error?: string;
}

export interface LocalAIStatus {
  anyAvailable: boolean;
  providers: LocalAIProvider[];
}

/**
 * Check if Ollama is running
 */
async function checkOllama(): Promise<LocalAIProvider> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${OLLAMA_URL}/api/version`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json().catch(() => ({}));

      // Try to get available models
      let models: string[] = [];
      try {
        const modelsResponse = await fetch(`${OLLAMA_URL}/api/tags`, {
          method: 'GET',
        });
        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json();
          models = modelsData.models?.map((m: any) => m.name) || [];
        }
      } catch {
        // Models list is optional
      }

      return {
        name: 'Ollama',
        detected: true,
        url: OLLAMA_URL,
        version: data.version,
        models: models,
      };
    }

    return {
      name: 'Ollama',
      detected: false,
      url: OLLAMA_URL,
      error: 'Not responding',
    };
  } catch (error) {
    return {
      name: 'Ollama',
      detected: false,
      url: OLLAMA_URL,
      error: 'Not running',
    };
  }
}

/**
 * Check if LM Studio is running
 */
async function checkLMStudio(): Promise<LocalAIProvider> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${LM_STUDIO_URL}/v1/models`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      const models = data.data?.map((m: any) => m.id) || [];

      return {
        name: 'LM Studio',
        detected: true,
        url: LM_STUDIO_URL,
        models: models,
      };
    }

    return {
      name: 'LM Studio',
      detected: false,
      url: LM_STUDIO_URL,
      error: 'Not responding',
    };
  } catch (error) {
    return {
      name: 'LM Studio',
      detected: false,
      url: LM_STUDIO_URL,
      error: 'Not running',
    };
  }
}

/**
 * Detect all local AI providers
 */
export async function detectLocalAI(): Promise<LocalAIStatus> {
  const [ollama, lmStudio] = await Promise.all([
    checkOllama(),
    checkLMStudio(),
  ]);

  const providers = [ollama, lmStudio];
  const anyAvailable = providers.some(p => p.detected);

  if (anyAvailable) {
    const detected = providers.filter(p => p.detected).map(p => p.name).join(', ');
    logAudit('LOCAL_AI', 'DETECTED', `Local AI providers detected: ${detected}`, { providers: providers.filter(p => p.detected) }, 'INFO');
  }

  return {
    anyAvailable,
    providers,
  };
}

/**
 * Check if external AI is allowed based on current security profile
 */
export function isExternalAIAllowed(): boolean {
  const setupState = getSetupState();
  if (!setupState) return false;

  const profile = getSecurityProfile(setupState.security_profile);
  return profile?.allow_external_ai ?? false;
}

/**
 * Check if network access is allowed based on current security profile
 */
export function isNetworkAllowed(): boolean {
  const setupState = getSetupState();
  if (!setupState) return false;

  const profile = getSecurityProfile(setupState.security_profile);
  return profile?.allow_network ?? false;
}

/**
 * Friendly messages for local AI status
 */
export const LOCAL_AI_MESSAGES = {
  OLLAMA_RUNNING: 'Ollama is running and ready for local AI processing.',
  OLLAMA_NOT_RUNNING: 'Ollama is not running. Install or start Ollama for local AI.',
  LM_STUDIO_RUNNING: 'LM Studio is running and ready for local AI processing.',
  LM_STUDIO_NOT_RUNNING: 'LM Studio is not running.',
  NONE_AVAILABLE: 'No local AI providers detected. Install Ollama or LM Studio for local AI processing.',
  EXTERNAL_BLOCKED: 'External AI services are blocked by your security profile.',
  EXTERNAL_AVAILABLE: 'External AI services are available (requires approval for each use).',
};

/**
 * Get user-friendly explanation of local AI
 */
export function getLocalAIExplanation(): string {
  return `
Local AI means the artificial intelligence runs entirely on your computer,
not on the internet. This keeps your conversations private and works
even without an internet connection.

Supported local AI providers:
- Ollama: Free, open-source. Download from https://ollama.ai
- LM Studio: User-friendly interface. Download from https://lmstudio.ai

Both are free to use and keep your data on your computer.
  `.trim();
}
