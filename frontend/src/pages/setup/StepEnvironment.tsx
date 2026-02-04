import { EnvironmentInfo } from './types';

interface Props {
  environment: EnvironmentInfo | null;
  loading: boolean;
  onNext: () => void;
  onBack: () => void;
}

export default function StepEnvironment({ environment, loading, onNext, onBack }: Props) {
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
