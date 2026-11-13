import React, { useState } from 'react';
import { usePos } from '../context/PosContext';

interface LoginViewProps {
  onLoginSuccess: (mode: 'GST' | 'NON_GST' | 'DEVELOPER') => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const { isOnline, login } = usePos();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaPromptVisible, setMfaPromptVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [serverUrl, setServerUrl] = useState(
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  );
  const [serverStatusText, setServerStatusText] = useState(
    'Ready — Embedded Server & Local Vault Active'
  );
  const [serverStatusColor, setServerStatusColor] = useState<'green' | 'amber' | 'gray'>('green');

  const handleVerifyServer = async () => {
    setServerStatusText('Checking server...');
    setServerStatusColor('gray');
    try {
      const base = serverUrl.trim().replace(/\/+$/, '');
      const res = await fetch(`${base}/api/state`, { method: 'GET' });
      if (res.ok) {
        setServerStatusText(`Connected to Server (${base})`);
        setServerStatusColor('green');
      } else {
        setServerStatusText('Local Embedded Mode Active');
        setServerStatusColor('amber');
      }
    } catch {
      setServerStatusText('Offline / Local Embedded Vault Active');
      setServerStatusColor('amber');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();
    if (!trimmedUser || !trimmedPass) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setSubmitting(true);
    const res = await login({
      username: trimmedUser,
      password: trimmedPass,
      mfaCode,
    });
    setSubmitting(false);

    if (!res.ok) {
      if (res.mfaRequired) {
        setMfaPromptVisible(true);
      }
      setErrorMsg(res.error || 'Invalid username or password.');
      return;
    }

    if (
      res.role === 'DEVELOPER' ||
      trimmedUser.toLowerCase() === 'devloper' ||
      trimmedUser.toLowerCase() === 'dev'
    ) {
      onLoginSuccess('DEVELOPER');
    } else {
      onLoginSuccess(res.resolvedProfile || 'GST');
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center p-4 select-none font-sans">
      <div className="w-full max-w-[390px] bg-white border border-slate-300 shadow-md">
        {/* Top Dark Slate Header Banner matching SecureLoginForm in MainForm.cs */}
        <div className="bg-[#0f172a] px-6 py-5">
          <h1 className="text-[20px] font-bold text-white tracking-tight">KANHA POS &amp; ERP</h1>
          <p className="text-xs text-[#94a3b8] mt-1">
            Enter your username and password to sign in
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-5 space-y-3.5 text-xs">
          <div>
            <label className="block text-[13px] font-bold text-[#334155] mb-1.5">Username</label>
            <input
              type="text"
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#2563eb] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-bold text-[#334155] mb-1.5">Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#2563eb] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <label className="inline-flex items-center gap-2 text-xs text-[#64748b] cursor-pointer">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Show password</span>
            </label>
          </div>

          {mfaPromptVisible && (
            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1">
                MFA Security PIN
              </label>
              <input
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="Enter 6-digit MFA PIN"
                className="w-full border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-[#2563eb] focus:outline-none"
              />
            </div>
          )}

          {errorMsg && (
            <div className="text-xs font-bold text-[#dc2626] min-h-[18px]">{errorMsg}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-[42px] bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-60 text-white font-bold text-[14px] transition-colors cursor-pointer"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>

          <div className="border-t border-[#e2e8f0] pt-3 mt-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#64748b] whitespace-nowrap">
                Server Connection:
              </span>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="flex-1 min-w-0 border border-slate-300 px-2 py-1 text-[11px] text-slate-800 focus:border-[#2563eb] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleVerifyServer}
                className="px-2.5 py-1 bg-[#f1f5f9] hover:bg-slate-200 border border-slate-300 text-[#1e293b] font-bold text-[11px] cursor-pointer"
              >
                Verify
              </button>
            </div>

            <div
              className={`text-[11px] ${
                serverStatusColor === 'green'
                  ? 'text-[#16a34a]'
                  : serverStatusColor === 'amber'
                  ? 'text-[#d97706]'
                  : 'text-slate-500'
              }`}
            >
              {isOnline ? serverStatusText : 'Offline / Local Embedded Vault Active'}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
