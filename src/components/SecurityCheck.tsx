import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Loader2 } from 'lucide-react';

interface SecurityCheckProps {
  user: any;
  onUnlock: () => void;
}

export function SecurityCheck({ user, onUnlock }: SecurityCheckProps) {
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Defensive check: If user is null, don't render or redirect
  if (!user) {
    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="text-white text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                <p>Reloading session...</p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="mt-4 text-xs text-indigo-400 underline"
                >
                    Click to reload manually
                </button>
            </div>
        </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

      // Simplified Security Check: Hardcoded PIN "KKG"
      if (pass === "KKG") {
          onUnlock();
      } else {
          setError('Incorrect Security PIN. Hint: KKG');
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-slate-800 rounded-2xl shadow-xl p-8 text-center border border-slate-700">
        <div className="mx-auto bg-indigo-900/50 w-16 h-16 rounded-full flex items-center justify-center mb-6 border border-indigo-500/30">
          <Lock className="w-8 h-8 text-indigo-400" />
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Family Security Check</h2>
        <p className="text-slate-400 text-sm mb-6">
          Enter the Family PIN to access GUPTA FAMILY
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 text-white text-center text-2xl tracking-widest py-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-slate-600"
            placeholder="PIN"
            autoFocus
          />

          {error && (
            <div className="bg-red-900/50 p-3 rounded-lg border border-red-800">
                <p className="text-red-300 text-sm font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Unlock App'}
          </button>
        </form>
        
        <div className="mt-6">
            <p className="text-xs text-slate-500 mb-2">
                Logged in as {user.email}
            </p>
            <button
                onClick={() => {
                    supabase.auth.signOut();
                    window.location.reload();
                }}
                className="text-xs text-red-400 hover:text-red-300 underline"
            >
                Not you? Logout
            </button>
        </div>
      </div>
    </div>
  );
}
