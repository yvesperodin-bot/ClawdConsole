import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../services/api';
import {
  StepWelcome,
  StepEnvironment,
  StepWorkspace,
  StepClawdBot,
  StepLocalAI,
  StepSecurity,
  StepPin,
  StepHealth,
  StepComplete,
} from './setup';
import type {
  EnvironmentInfo,
  SecurityProfile,
  ClawdBotStatus,
  LocalAIStatus,
} from './setup';

/**
 * Setup Wizard - First-run setup for Clawd Console
 * This wizard is mandatory on first run and guides users through configuration.
 *
 * This is a thin orchestrator that manages state and navigation.
 * Individual steps are in ./setup/ directory.
 */

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
