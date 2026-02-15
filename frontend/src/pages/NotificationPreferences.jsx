import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState({ email: true, inApp: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadPrefs();
  }, []);

  async function loadPrefs() {
    try {
      const res = await api.getNotificationPrefs();
      setPrefs(res.data);
    } catch {}
    setLoading(false);
  }

  async function handleToggle(key) {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setSaving(true);
    setMessage('');
    try {
      await api.updateNotificationPrefs(updated);
      setMessage('Preferences saved');
      setTimeout(() => setMessage(''), 2000);
    } catch {
      setPrefs(prefs);
      setMessage('Failed to save preferences');
    }
    setSaving(false);
  }

  if (loading) return <p>Loading preferences...</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Notification Preferences</h1>
      </div>
      {message && (
        <div style={{
          padding: '8px 12px',
          borderRadius: '6px',
          marginBottom: '16px',
          background: message.includes('Failed') ? '#fee2e2' : '#d1fae5',
          color: message.includes('Failed') ? '#991b1b' : '#065f46',
          fontSize: '14px',
        }}>
          {message}
        </div>
      )}
      <div className="card">
        <div className="notification-pref-row">
          <div className="notification-pref-info">
            <div className="notification-pref-label">In-App Notifications</div>
            <div className="notification-pref-desc">
              Receive notifications within the application when tasks are assigned to you or task statuses change.
            </div>
          </div>
          <button
            className={`toggle-switch ${prefs.inApp ? 'toggle-on' : 'toggle-off'}`}
            onClick={() => handleToggle('inApp')}
            disabled={saving}
            aria-label="Toggle in-app notifications"
          >
            <span className="toggle-knob" />
          </button>
        </div>
        <div className="notification-pref-divider" />
        <div className="notification-pref-row">
          <div className="notification-pref-info">
            <div className="notification-pref-label">Email Notifications</div>
            <div className="notification-pref-desc">
              Receive email notifications when tasks are assigned to you or task statuses change.
            </div>
          </div>
          <button
            className={`toggle-switch ${prefs.email ? 'toggle-on' : 'toggle-off'}`}
            onClick={() => handleToggle('email')}
            disabled={saving}
            aria-label="Toggle email notifications"
          >
            <span className="toggle-knob" />
          </button>
        </div>
      </div>
    </div>
  );
}
