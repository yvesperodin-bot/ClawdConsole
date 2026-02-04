import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../services/api';

/**
 * Setup Wizard - First-run setup for Clawd Console
 * This wizard is mandatory on first run and guides users through configuration.
 */

interface EnvironmentInfo {
  os: { platform: string; release: string; arch: string; hostname: string };
  memory: { total_gb: number; free_gb: number; sufficient: boolean };
  disk: { free_gb: number; total_gb: number; sufficient: boolean };
  user: { home_dir: string; username: string };
}

interface SecurityProfile {
  id: string;
  name: string;
  description: string;
  allow_network: boolean;
  allow_external_ai: boolean;
  risk_level: string;
}

interface ClawdBotStatus {
  connected: boolean;
  version?: string;
  error?: string;
}

interface LocalAIStatus {
  anyAvailable: boolean;
  providers: Array<{ name: string; detected: boolean; models?: string[] }>;
  explanation: string;
}

const WIZARD_STEPS = [
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

type WizardStep = typeof WIZARD_STEPS[number];

export default function SetupWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wizard data
  const [environment, setEnvironment] = useState<EnvironmentInfo | null>(null);
  const [workspacePath, setWorkspacePath] = useState('');
  const [workspaceValid, setWorkspaceValid] = useState<boolean | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState('');
  const [clawdbotStatus, setClawdbotStatus] = useState<ClawdBotStatus | null>(null);
  const [localAIStatus, setLocalAIStatus] = useState<LocalAIStatus | null>(null);
  const [securityProfiles, setSecurityProfiles] = useState<SecurityProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState('AIR_GAPPED');
  const [adminPin, setAdminPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [skipPin, setSkipPin] = useState(false);
  const [healthCheckDone, setHealthCheckDone] = useState(false);

  // Load default workspace on mount
  useEffect(() => {
    loadDefaultWorkspace();
  }, []);

  async function loadDefaultWorkspace() {
    const result = await apiGet<{ path: string }>('/api/setup/default-workspace');
    if (result.data) {
      setWorkspacePath(result.data.path);
    }
  }

  async function loadEnvironment() {
    setLoading(true);
    const result = await apiGet<EnvironmentInfo>('/api/setup/environment');
    if (result.data) {
      setEnvironment(result.data);
    }
    setLoading(false);
  }

  async function validateWorkspace() {
    if (!workspacePath.trim()) {
      setWorkspaceValid(false);
      setWorkspaceMessage('Please enter a folder path.');
      return;
    }
    setLoading(true);
    const result = await apiPost<{ valid: boolean; message: string }>('/api/setup/validate-workspace', {
      path: workspacePath,
    });
    if (result.data) {
      setWorkspaceValid(result.data.valid);
      setWorkspaceMessage(result.data.message);
    } else {
      setWorkspaceValid(false);
      setWorkspaceMessage(result.error || 'Could not validate path.');
    }
    setLoading(false);
  }

  async function checkClawdBot() {
    setLoading(true);
    const result = await apiGet<ClawdBotStatus>('/api/setup/check-clawdbot');
    if (result.data) {
      setClawdbotStatus(result.data);
    }
    setLoading(false);
  }

  async function checkLocalAI() {
    setLoading(true);
    const result = await apiGet<LocalAIStatus>('/api/setup/check-local-ai');
    if (result.data) {
      setLocalAIStatus(result.data);
    }
    setLoading(false);
  }

  async function loadSecurityProfiles() {
    const result = await apiGet<{ profiles: SecurityProfile[] }>('/api/setup/security-profiles');
    if (result.data) {
      setSecurityProfiles(result.data.profiles);
    }
  }

  async function runHealthCheck() {
    setLoading(true);
    await apiPost('/api/setup/run-health-check', {});
    setHealthCheckDone(true);
    setLoading(false);
  }

  async function completeSetup() {
    setLoading(true);
    setError(null);

    const pinToSend = skipPin || adminPin.length < 4 ? null : adminPin;

    const result = await apiPost<{ success: boolean; error?: string }>('/api/setup/complete', {
      workspace_path: workspacePath,
      security_profile: selectedProfile,
      admin_pin: pinToSend,
    });

    if (result.data?.success) {
      setCurrentStep('complete');
    } else {
      setError(result.data?.error || result.error || 'Setup failed. Please try again.');
    }
    setLoading(false);
  }

  function nextStep() {
    const currentIndex = WIZARD_STEPS.indexOf(currentStep);
    if (currentIndex < WIZARD_STEPS.length - 1) {
      const next = WIZARD_STEPS[currentIndex + 1];
      setCurrentStep(next);

      // Trigger data loading for certain steps
      if (next === 'environment') loadEnvironment();
      if (next === 'clawdbot') checkClawdBot();
      if (next === 'localai') checkLocalAI();
      if (next === 'security') loadSecurityProfiles();
      if (next === 'health') runHealthCheck();
    }
  }

  function prevStep() {
    const currentIndex = WIZARD_STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(WIZARD_STEPS[currentIndex - 1]);
    }
  }

  function finishSetup() {
    navigate('/');
  }

  const stepIndex = WIZARD_STEPS.indexOf(currentStep);
  const progress = Math.round(((stepIndex + 1) / WIZARD_STEPS.length) * 100);

  return (
    <div className="setup-wizard">
      <div className="setup-header">
        <h1>Clawd Console Setup</h1>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="step-indicator">Step {stepIndex + 1} of {WIZARD_STEPS.length}</div>
      </div>

      <div className="setup-content">
        {currentStep === 'welcome' && (
          <StepWelcome onNext={nextStep} />
        )}

        {currentStep === 'environment' && (
          <StepEnvironment
            environment={environment}
            loading={loading}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {currentStep === 'workspace' && (
          <StepWorkspace
            workspacePath={workspacePath}
            setWorkspacePath={setWorkspacePath}
            workspaceValid={workspaceValid}
            workspaceMessage={workspaceMessage}
            validateWorkspace={validateWorkspace}
            loading={loading}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {currentStep === 'clawdbot' && (
          <StepClawdBot
            status={clawdbotStatus}
            loading={loading}
            onRetry={checkClawdBot}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {currentStep === 'localai' && (
          <StepLocalAI
            status={localAIStatus}
            loading={loading}
            onRetry={checkLocalAI}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {currentStep === 'security' && (
          <StepSecurity
            profiles={securityProfiles}
            selectedProfile={selectedProfile}
            setSelectedProfile={setSelectedProfile}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {currentStep === 'pin' && (
          <StepPin
            adminPin={adminPin}
            setAdminPin={setAdminPin}
            confirmPin={confirmPin}
            setConfirmPin={setConfirmPin}
            skipPin={skipPin}
            setSkipPin={setSkipPin}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {currentStep === 'health' && (
          <StepHealth
            healthCheckDone={healthCheckDone}
            loading={loading}
            error={error}
            onComplete={completeSetup}
            onBack={prevStep}
          />
        )}

        {currentStep === 'complete' && (
          <StepComplete onFinish={finishSetup} />
        )}
      </div>
    </div>
  );
}

// Individual step components

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="step-content">
      <h2>Welcome to Clawd Console</h2>
      <p className="step-description">
        Clawd Console is your local-first AI control interface. It helps you work with AI
        assistants while keeping your data private and secure on your own computer.
      </p>
      <div className="info-box">
        <h3>What makes Clawd Console different:</h3>
        <ul>
          <li><strong>Local-first:</strong> Everything runs on your computer, not in the cloud</li>
          <li><strong>You're in control:</strong> All AI actions require your approval</li>
          <li><strong>Private by default:</strong> No internet access unless you choose to enable it</li>
          <li><strong>Transparent:</strong> Every action is logged and visible to you</li>
        </ul>
      </div>
      <p className="step-description">
        This setup wizard will guide you through configuring Clawd Console.
        It only takes a few minutes.
      </p>
      <div className="step-actions">
        <button className="btn btn-primary" onClick={onNext}>Get Started</button>
      </div>
    </div>
  );
}

function StepEnvironment({
  environment,
  loading,
  onNext,
  onBack,
}: {
  environment: EnvironmentInfo | null;
  loading: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  if (loading || !environment) {
    return (
      <div className="step-content">
        <h2>Checking Your System</h2>
        <p className="step-description">Please wait while we check your system...</p>
      </div>
    );
  }

  const allGood = environment.memory.sufficient && environment.disk.sufficient;

  return (
    <div className="step-content">
      <h2>System Check</h2>
      <p className="step-description">
        Let's make sure your computer meets the requirements for Clawd Console.
      </p>

      <div className="check-grid">
        <div className={`check-item ${environment.memory.sufficient ? 'check-pass' : 'check-warn'}`}>
          <div className="check-label">Memory (RAM)</div>
          <div className="check-value">{environment.memory.total_gb} GB total</div>
          <div className="check-status">
            {environment.memory.sufficient ? 'Good' : 'May be low'}
          </div>
        </div>

        <div className={`check-item ${environment.disk.sufficient ? 'check-pass' : 'check-warn'}`}>
          <div className="check-label">Disk Space</div>
          <div className="check-value">{environment.disk.free_gb} GB free</div>
          <div className="check-status">
            {environment.disk.sufficient ? 'Good' : 'May be low'}
          </div>
        </div>

        <div className="check-item check-pass">
          <div className="check-label">Operating System</div>
          <div className="check-value">{environment.os.platform}</div>
          <div className="check-status">Supported</div>
        </div>
      </div>

      {!allGood && (
        <div className="warning-box">
          Your system may have limited resources, but you can still proceed.
          Performance might be affected.
        </div>
      )}

      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={onNext}>Continue</button>
      </div>
    </div>
  );
}

function StepWorkspace({
  workspacePath,
  setWorkspacePath,
  workspaceValid,
  workspaceMessage,
  validateWorkspace,
  loading,
  onNext,
  onBack,
}: {
  workspacePath: string;
  setWorkspacePath: (path: string) => void;
  workspaceValid: boolean | null;
  workspaceMessage: string;
  validateWorkspace: () => void;
  loading: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="step-content">
      <h2>Choose Your Workspace</h2>
      <p className="step-description">
        The workspace is a folder where Clawd Console will store files and data.
        For your safety, AI can only access files inside this folder.
      </p>

      <div className="form-group">
        <label>Workspace Folder Path</label>
        <input
          type="text"
          value={workspacePath}
          onChange={(e) => {
            setWorkspacePath(e.target.value);
            // Reset validation when path changes
          }}
          placeholder="e.g., C:\AI_WORKSPACE or /home/user/AI_WORKSPACE"
        />
        <button
          className="btn btn-secondary btn-small"
          onClick={validateWorkspace}
          disabled={loading}
        >
          {loading ? 'Checking...' : 'Validate Path'}
        </button>
      </div>

      {workspaceMessage && (
        <div className={`validation-message ${workspaceValid ? 'valid' : 'invalid'}`}>
          {workspaceMessage}
        </div>
      )}

      <div className="info-box">
        <strong>Why a workspace?</strong>
        <p>
          This is a security feature. By limiting AI access to one folder, we prevent
          accidental access to sensitive files on your computer.
        </p>
      </div>

      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={workspaceValid === false}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function StepClawdBot({
  status,
  loading,
  onRetry,
  onNext,
  onBack,
}: {
  status: ClawdBotStatus | null;
  loading: boolean;
  onRetry: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="step-content">
      <h2>ClawdBot Connection</h2>
      <p className="step-description">
        ClawdBot is the AI assistant that runs on your computer. Let's check if it's running.
      </p>

      {loading ? (
        <div className="status-checking">Checking connection...</div>
      ) : status ? (
        <div className={`connection-status ${status.connected ? 'connected' : 'disconnected'}`}>
          <div className="status-icon">{status.connected ? '✓' : '✗'}</div>
          <div className="status-text">
            {status.connected ? (
              <>ClawdBot is running{status.version && ` (version ${status.version})`}</>
            ) : (
              'ClawdBot is not running'
            )}
          </div>
        </div>
      ) : null}

      {status && !status.connected && (
        <div className="info-box">
          <strong>ClawdBot not detected</strong>
          <p>
            Don't worry — you can still continue setup. ClawdBot can be started later.
            Some features will be limited until ClawdBot is running.
          </p>
          <button className="btn btn-secondary btn-small" onClick={onRetry}>
            Check Again
          </button>
        </div>
      )}

      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={onNext}>Continue</button>
      </div>
    </div>
  );
}

function StepLocalAI({
  status,
  loading,
  onRetry,
  onNext,
  onBack,
}: {
  status: LocalAIStatus | null;
  loading: boolean;
  onRetry: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="step-content">
      <h2>Local AI Providers</h2>
      <p className="step-description">
        Local AI means the AI runs entirely on your computer — your conversations stay private.
      </p>

      {loading ? (
        <div className="status-checking">Detecting local AI...</div>
      ) : status ? (
        <>
          <div className="provider-list">
            {status.providers.map((provider) => (
              <div
                key={provider.name}
                className={`provider-item ${provider.detected ? 'detected' : 'not-detected'}`}
              >
                <div className="provider-name">{provider.name}</div>
                <div className="provider-status">
                  {provider.detected ? (
                    <>Detected {provider.models && `(${provider.models.length} models)`}</>
                  ) : (
                    'Not running'
                  )}
                </div>
              </div>
            ))}
          </div>

          {!status.anyAvailable && (
            <div className="info-box">
              <strong>No local AI detected</strong>
              <p>
                You can install Ollama or LM Studio later to enable local AI features.
                Both are free and keep your data on your computer.
              </p>
              <button className="btn btn-secondary btn-small" onClick={onRetry}>
                Check Again
              </button>
            </div>
          )}
        </>
      ) : null}

      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={onNext}>Continue</button>
      </div>
    </div>
  );
}

function StepSecurity({
  profiles,
  selectedProfile,
  setSelectedProfile,
  onNext,
  onBack,
}: {
  profiles: SecurityProfile[];
  selectedProfile: string;
  setSelectedProfile: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="step-content">
      <h2>Security Profile</h2>
      <p className="step-description">
        Choose how much access Clawd Console has. You can change this later.
      </p>

      <div className="profile-list">
        {profiles.map((profile) => (
          <label
            key={profile.id}
            className={`profile-option ${selectedProfile === profile.id ? 'selected' : ''}`}
          >
            <input
              type="radio"
              name="security-profile"
              value={profile.id}
              checked={selectedProfile === profile.id}
              onChange={() => setSelectedProfile(profile.id)}
            />
            <div className="profile-content">
              <div className="profile-header">
                <span className="profile-name">{profile.name}</span>
                <span className={`profile-risk risk-${profile.risk_level.toLowerCase()}`}>
                  {profile.risk_level} risk
                </span>
              </div>
              <div className="profile-description">{profile.description}</div>
              <div className="profile-features">
                <span className={profile.allow_network ? 'feature-on' : 'feature-off'}>
                  Network: {profile.allow_network ? 'Allowed' : 'Blocked'}
                </span>
                <span className={profile.allow_external_ai ? 'feature-on' : 'feature-off'}>
                  External AI: {profile.allow_external_ai ? 'With approval' : 'Blocked'}
                </span>
              </div>
            </div>
          </label>
        ))}
      </div>

      <div className="info-box">
        <strong>Recommendation:</strong> Start with Air-Gapped for maximum security.
        You can always upgrade later if you need more features.
      </div>

      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={onNext}>Continue</button>
      </div>
    </div>
  );
}

function StepPin({
  adminPin,
  setAdminPin,
  confirmPin,
  setConfirmPin,
  skipPin,
  setSkipPin,
  onNext,
  onBack,
}: {
  adminPin: string;
  setAdminPin: (pin: string) => void;
  confirmPin: string;
  setConfirmPin: (pin: string) => void;
  skipPin: boolean;
  setSkipPin: (skip: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const pinsMatch = adminPin === confirmPin;
  const pinValid = adminPin.length >= 4;
  const canProceed = skipPin || (pinValid && pinsMatch);

  return (
    <div className="step-content">
      <h2>Admin PIN (Optional)</h2>
      <p className="step-description">
        Set a PIN to protect sensitive settings like security profile changes.
        This is optional but recommended.
      </p>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={skipPin}
            onChange={(e) => setSkipPin(e.target.checked)}
          />
          Skip PIN setup (not recommended)
        </label>
      </div>

      {!skipPin && (
        <>
          <div className="form-group">
            <label>Enter PIN (minimum 4 digits)</label>
            <input
              type="password"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter PIN"
              maxLength={8}
            />
          </div>

          <div className="form-group">
            <label>Confirm PIN</label>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Confirm PIN"
              maxLength={8}
            />
          </div>

          {adminPin && confirmPin && !pinsMatch && (
            <div className="validation-message invalid">PINs do not match</div>
          )}
        </>
      )}

      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={onNext} disabled={!canProceed}>
          Continue
        </button>
      </div>
    </div>
  );
}

function StepHealth({
  healthCheckDone,
  loading,
  error,
  onComplete,
  onBack,
}: {
  healthCheckDone: boolean;
  loading: boolean;
  error: string | null;
  onComplete: () => void;
  onBack: () => void;
}) {
  return (
    <div className="step-content">
      <h2>Final Check</h2>
      <p className="step-description">
        We're running a final health check to make sure everything is ready.
      </p>

      <div className="health-status">
        {loading ? (
          <div className="status-checking">Running health check...</div>
        ) : healthCheckDone ? (
          <div className="health-done">
            <div className="status-icon success">✓</div>
            <div>Health check complete. Ready to finish setup.</div>
          </div>
        ) : null}
      </div>

      {error && (
        <div className="error-box">{error}</div>
      )}

      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
        <button
          className="btn btn-primary"
          onClick={onComplete}
          disabled={loading || !healthCheckDone}
        >
          {loading ? 'Completing...' : 'Complete Setup'}
        </button>
      </div>
    </div>
  );
}

function StepComplete({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="step-content">
      <h2>Setup Complete!</h2>
      <div className="success-icon">✓</div>
      <p className="step-description">
        Clawd Console is now configured and ready to use.
      </p>

      <div className="info-box">
        <strong>What's next?</strong>
        <ul>
          <li>The Dashboard shows your current status</li>
          <li>Use Chat to interact with your local AI</li>
          <li>All AI actions will appear in Approvals for your review</li>
          <li>Check Logs to see everything that happens</li>
        </ul>
      </div>

      <div className="step-actions">
        <button className="btn btn-primary btn-large" onClick={onFinish}>
          Start Using Clawd Console
        </button>
      </div>
    </div>
  );
}
