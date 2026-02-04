import { ClawdBotStatus } from './types';

interface Props {
  status: ClawdBotStatus | null;
  loading: boolean;
  onRetry: () => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StepClawdBot({ status, loading, onRetry, onNext, onBack }: Props) {
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
