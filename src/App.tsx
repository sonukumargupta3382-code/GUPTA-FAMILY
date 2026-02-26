/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, ErrorInfo } from 'react';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { SecurityCheck } from './components/SecurityCheck';
import { Chat } from './components/Chat';
import { Loader2, AlertTriangle, Database } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 p-4 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-sm text-slate-400 mb-4 max-w-md bg-slate-800 p-3 rounded overflow-auto">
            {this.state.error?.message}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Reload App
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-900/50 text-red-400 rounded-lg hover:bg-red-900/80"
            >
              Reset App Data
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

function AppContent() {
  const [user, setUser] = useState<any | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isSetupInProgress, setIsSetupInProgress] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isSetupInProgress) {
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isSetupInProgress]);

  // Lock app when visibility changes (background/foreground)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsUnlocked(false); // Lock when app goes to background
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="bg-slate-800 max-w-lg w-full rounded-2xl shadow-xl border border-slate-700 p-8 text-center">
          <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Connect Supabase</h1>
          <p className="text-slate-400 mb-6">
            To use this app, you need to connect your own Supabase project.
          </p>
          
          <div className="bg-slate-900/50 p-4 rounded-lg text-left text-sm text-slate-300 mb-6 space-y-3 border border-slate-700">
            <p className="font-medium text-white">1. Create Project</p>
            <p>Go to <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">supabase.com</a> and create a new project.</p>
            
            <p className="font-medium text-white mt-2">2. Get API Keys</p>
            <p>Go to Project Settings → API. Copy the <code>URL</code> and <code>anon public</code> key.</p>
            
            <p className="font-medium text-white mt-2">3. Add to Environment Variables</p>
            <p>Add these variables to your <code>.env</code> file:</p>
            <code className="block bg-black/30 p-2 rounded mt-1 text-xs font-mono text-emerald-400">
              VITE_SUPABASE_URL=your_url<br/>
              VITE_SUPABASE_ANON_KEY=your_key
            </code>
          </div>
          
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            I've Added the Keys, Reload App
          </button>
        </div>
      </div>
    );
  }

  // If user is not logged in OR we are in the middle of setting up (signup flow)
  if (!user || isSetupInProgress) {
    return <Auth 
      error={authError}
      onError={setAuthError}
      onSetupStart={() => setIsSetupInProgress(true)}
      onSetupComplete={(user) => {
        setIsSetupInProgress(false);
        setUser(user);
        // Only unlock if signup was successful (user is not null)
        if (user) {
          setIsUnlocked(true);
        }
      }}
      onLogin={(u, isSignup) => {
        setUser(u);
        setAuthError('');
        // Unlock immediately after successful login (user just proved identity with password)
        setIsUnlocked(true);
      }} 
    />;
  }

  if (!isUnlocked) {
    return <SecurityCheck user={user} onUnlock={() => setIsUnlocked(true)} />;
  }

  return (
    <>
      {!navigator.onLine && (
        <div className="bg-amber-600 text-white text-xs py-1 text-center font-medium">
          You are currently offline. Some features may not work.
        </div>
      )}
      <Chat user={user} />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

