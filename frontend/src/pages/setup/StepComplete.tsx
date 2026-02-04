interface Props {
  onFinish: () => void;
}

export default function StepComplete({ onFinish }: Props) {
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
