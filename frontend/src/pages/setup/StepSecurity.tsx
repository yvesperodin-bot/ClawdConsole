import { SecurityProfile } from './types';

interface Props {
  profiles: SecurityProfile[];
  selectedProfile: string;
  setSelectedProfile: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StepSecurity({
  profiles,
  selectedProfile,
  setSelectedProfile,
  onNext,
  onBack,
}: Props) {
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
