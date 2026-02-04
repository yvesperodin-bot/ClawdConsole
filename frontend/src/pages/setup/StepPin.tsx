interface Props {
  adminPin: string;
  setAdminPin: (pin: string) => void;
  confirmPin: string;
  setConfirmPin: (pin: string) => void;
  skipPin: boolean;
  setSkipPin: (skip: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StepPin({
  adminPin,
  setAdminPin,
  confirmPin,
  setConfirmPin,
  skipPin,
  setSkipPin,
  onNext,
  onBack,
}: Props) {
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
