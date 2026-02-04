interface Props {
  workspacePath: string;
  setWorkspacePath: (path: string) => void;
  workspaceValid: boolean | null;
  workspaceMessage: string;
  validateWorkspace: () => void;
  loading: boolean;
  onNext: () => void;
  onBack: () => void;
}

export default function StepWorkspace({
  workspacePath,
  setWorkspacePath,
  workspaceValid,
  workspaceMessage,
  validateWorkspace,
  loading,
  onNext,
  onBack,
}: Props) {
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
          onChange={(e) => setWorkspacePath(e.target.value)}
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
