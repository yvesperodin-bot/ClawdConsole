import { LocalAIStatus } from './types';

interface Props {
  status: LocalAIStatus | null;
  loading: boolean;
  onRetry: () => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StepLocalAI({ status, loading, onRetry, onNext, onBack }: Props) {
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
