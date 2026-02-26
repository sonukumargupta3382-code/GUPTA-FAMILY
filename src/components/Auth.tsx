import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Lock, Mail, UserPlus, LogIn, Loader2, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { SetupGuide } from './SetupGuide';

interface AuthProps {
  onLogin: (user: any, isSignup: boolean) => void;
  error?: string;
  onError: (msg: string) => void;
  onSetupStart?: () => void;
  onSetupComplete?: (user: any) => void;
}

export function Auth({ onLogin, error: propError, onError, onSetupStart, onSetupComplete }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const displayError = propError || localError;

  // Countdown timer effect
  React.useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfilePhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setLocalError("Please enter your email address first.");
      return;
    }
    if (resendCooldown > 0) {
      setLocalError(`Please wait ${resendCooldown} seconds before trying again.`);
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      alert("Password reset email sent! Check your inbox.");
      setLocalError("");
      setResendCooldown(60); // Start cooldown
    } catch (err: any) {
      console.error("Reset Password Error:", err);
      let msg = err.message || "Failed to send reset email.";
      
      // Handle rate limits
      const match = msg.match(/after (\d+) seconds/);
      if (match && match[1]) {
        const seconds = parseInt(match[1], 10);
        setResendCooldown(seconds);
        msg = `Too many requests. Please wait ${seconds} seconds.`;
      } else if (msg.includes("rate limit")) {
        setResendCooldown(60);
        msg = "Too many attempts. Please wait a minute.";
      }

      setLocalError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setStatusMessage('');
    setLoading(true);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    // Basic Validation
    if (!cleanEmail || !cleanPassword) {
      setLocalError("Please fill in all fields.");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // Login Flow
        setStatusMessage('Logging in...');
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (error) throw error;
        
        if (onLogin) onLogin(data.user, false);
      } else {
        // Signup Flow
        if (!name.trim()) throw new Error("Name is required.");
        
        if (onSetupStart) onSetupStart();

        setStatusMessage('Creating Account...');
        
        let photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

        if (profilePhoto) {
            setStatusMessage('Uploading Photo...');
            const fileExt = profilePhoto.name.split('.').pop();
            const fileName = `profile_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('chat-media')
                .upload(filePath, profilePhoto);

            if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage
                    .from('chat-media')
                    .getPublicUrl(filePath);
                photoUrl = publicUrl;
            }
        }

        setStatusMessage('Finalizing...');
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              display_name: name,
              photo_url: photoUrl
            }
          }
        });

        if (authError) throw authError;

        // Manually insert into public.users table if needed (though triggers are better)
        // For now, we rely on metadata or assume a trigger exists, 
        // BUT since we can't create triggers easily here, let's do a manual insert.
        if (authData.user) {
           const { error: dbError } = await supabase.from('users').insert({
             id: authData.user.id,
             email: cleanEmail,
             display_name: name,
             photo_url: photoUrl
           });
           
           if (dbError) console.error("Error creating user profile:", dbError);
        }

        if (onSetupComplete) {
            onSetupComplete(authData.user);
        } else {
            onLogin(authData.user, true);
        }
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      
      if (!isLogin && onSetupComplete) onSetupComplete(null);

      let msg = "Authentication failed. Please try again.";
      if (err.message) msg = err.message;

      // Handle specific Supabase errors
      if (msg.includes("Email not confirmed")) {
        msg = "Email confirmation is ON. Please check your email OR go to Supabase -> Auth -> Providers -> Email and turn OFF 'Confirm email'.";
        setNeedsConfirmation(true);
      } else if (msg.includes("rate limit")) {
        msg = "Too many attempts. Please wait a few minutes before trying again.";
        setResendCooldown(60);
      } else if (msg.includes("Invalid login credentials")) {
        msg = "Invalid email or password. Please try again.";
      } else if (msg.includes("Failed to fetch")) {
        msg = "Network error. Could not connect to Supabase.";
      }
      
      setLocalError(msg);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setStatusMessage('Testing connection...');
    setLoading(true);
    try {
      const start = Date.now();
      
      // 1. Simple Network Check (Fetch URL)
      try {
        await fetch('https://wyzakfvlsedzfyfekqsz.supabase.co', { method: 'HEAD', mode: 'no-cors' });
      } catch (netErr) {
        throw new Error("Network unreachable. Check your internet connection.");
      }

      // 2. Database Check
      const { data, error } = await supabase.from('messages').select('count').limit(1);
      const duration = Date.now() - start;
      
      if (error) {
        // If table doesn't exist, it's still a successful connection (just missing setup)
        if (error.code === '42P01') { // undefined_table
             alert(`Connection Successful! (Took ${duration}ms)\n\nBUT: Tables are missing.\nPlease run the SQL from the Setup Guide.`);
             return;
        }
        throw error;
      }
      
      alert(`Connection Successful! (Took ${duration}ms)\nSupabase is reachable and ready.`);
      setLocalError('');
    } catch (err: any) {
      console.error("Connection Test Error:", err);
      alert(`Connection Failed:\n${err.message}\n\nPossible causes:\n1. Internet is down\n2. Supabase project is paused\n3. Firewall/VPN blocking connection`);
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  };

  const handleResendConfirmation = async () => {
    if (!email || resendCooldown > 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      if (error) throw error;
      alert("Confirmation email resent! Please check your inbox.");
      setNeedsConfirmation(false);
      setLocalError("");
      setResendCooldown(60); // Default cooldown
    } catch (err: any) {
      console.error("Resend Error:", err);
      let msg = err.message;
      
      // Parse cooldown from error message if available
      // Example: "For security purposes, you can only request this after 23 seconds."
      const match = msg.match(/after (\d+) seconds/);
      if (match && match[1]) {
        const seconds = parseInt(match[1], 10);
        setResendCooldown(seconds);
        msg = `Please wait ${seconds} seconds before resending.`;
      } else if (msg.includes("rate limit")) {
        setResendCooldown(60);
        msg = "Please wait a minute before resending.";
      }
      
      setLocalError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {showSetupGuide && <SetupGuide onClose={() => setShowSetupGuide(false)} />}
      
      <div className="bg-slate-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-700 relative">
        <div className="bg-indigo-600 p-6 text-center">
          <h1 className="text-2xl font-bold text-white">GUPTA FAMILY</h1>
          <p className="text-indigo-200 text-sm mt-1">Connect with your loved ones</p>
        </div>

        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-slate-700 p-2 rounded-full">
              {isLogin ? <LogIn className="w-8 h-8 text-indigo-400" /> : <UserPlus className="w-8 h-8 text-indigo-400" />}
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-center text-white mb-6">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Profile Photo</label>
                <div className="flex items-center gap-4 mb-3">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden bg-slate-700 border-2 border-slate-600">
                        {photoPreview ? (
                            <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                            <User className="w-8 h-8 text-slate-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        )}
                    </div>
                    <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm transition-colors">
                        Choose Photo
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                    </label>
                </div>

                <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-slate-500"
                    placeholder="Enter your name"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-slate-500"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                {isLogin ? "Account Password" : "Create Password"}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-slate-900 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-slate-500"
                  placeholder={isLogin ? "Your account password" : "Min. 6 characters"}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {displayError && (
              <div className="text-sm p-3 rounded-lg bg-red-900/50 border border-red-800 text-red-200 text-center">
                <p className="font-medium">{displayError}</p>
                
                {displayError.includes("Network error") && (
                   <button
                     type="button"
                     onClick={testConnection}
                     className="mt-2 text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded transition-colors flex items-center gap-1 mx-auto"
                   >
                     <Loader2 className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                     Test Connection
                   </button>
                )}

                {needsConfirmation && (
                    <button 
                        type="button"
                        onClick={handleResendConfirmation}
                        disabled={resendCooldown > 0 || loading}
                        className={`mt-2 text-xs px-3 py-1 rounded transition-colors ${
                          resendCooldown > 0 
                            ? "bg-slate-700 text-slate-400 cursor-not-allowed" 
                            : "bg-red-800/50 hover:bg-red-800 text-white"
                        }`}
                    >
                        {resendCooldown > 0 
                          ? `Resend available in ${resendCooldown}s` 
                          : "Resend Confirmation Email"
                        }
                    </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{statusMessage || 'Please wait...'}</span>
                </div>
              ) : (
                isLogin ? 'Login to Family Group' : 'Create Account'
              )}
            </button>
          </form>

          {isLogin && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-slate-400 hover:text-indigo-400 underline"
              >
                Forgot Password?
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-600"></div>
                <span className="flex-shrink-0 mx-4 text-slate-500 text-xs">OR</span>
                <div className="flex-grow border-t border-slate-600"></div>
            </div>
            <button
              type="button"
              onClick={() => {
                  setIsLogin(!isLogin);
                  setLocalError('');
                  setStatusMessage('');
              }}
              className="mt-2 w-full border border-indigo-500 text-indigo-400 py-2 rounded-lg font-medium hover:bg-indigo-900/30 transition-colors"
            >
              {isLogin ? "Create New Account" : "Login to Existing Account"}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-700 text-center">
            <p className="text-sm font-bold text-slate-500 tracking-widest">KKG CHEATS</p>
          </div>
        </div>
      </div>
    </div>
  );
}
