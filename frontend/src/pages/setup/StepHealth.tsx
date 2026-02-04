interface Props {
  healthCheckDone: boolean;
  loading: boolean;
  error: string | null;
  onComplete: () => void;
  onBack: () => void;
}

export default function StepHealth({
  healthCheckDone,
  loading,
  error,
  onComplete,
  onBack,
}: Props) {
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
