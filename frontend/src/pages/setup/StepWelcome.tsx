interface Props {
  onNext: () => void;
}

export default function StepWelcome({ onNext }: Props) {
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
