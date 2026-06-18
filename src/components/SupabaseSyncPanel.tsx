/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Database, 
  Key, 
  CloudLightning, 
  Mail, 
  Lock, 
  LogIn, 
  UserPlus, 
  LogOut, 
  RefreshCw, 
  Download, 
  Upload, 
  Globe, 
  Settings, 
  ChevronDown, 
  Check, 
  AlertTriangle,
  Info
} from 'lucide-react';
import { supabase, recreateSupabaseClient, getSupabaseConfig, saveSupabaseConfig, resetSupabaseConfig } from '../lib/supabase';
import { VocabularyWord } from '../types';
import { pushLocalToSupabase, pullFromSupabase, mergeSyncWithSupabase, fetchSupabaseWords } from '../lib/supabaseSync';

interface SupabaseSyncPanelProps {
  vocabulary: VocabularyWord[];
  setVocabulary: React.Dispatch<React.SetStateAction<VocabularyWord[]>>;
  flashSuccess: (msg: string) => void;
  onClose: () => void;
}

export default function SupabaseSyncPanel({
  vocabulary,
  setVocabulary,
  flashSuccess,
  onClose
}: SupabaseSyncPanelProps) {
  // Config override states
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState(getSupabaseConfig());
  const [customUrl, setCustomUrl] = useState(config.url);
  const [customKey, setCustomKey] = useState(config.anonKey);
  const [activeClient, setActiveClient] = useState(() => supabase);

  // Authenticated states
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Sign in / Sign up form states
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Sourced items state
  const [cloudWordCount, setCloudWordCount] = useState<number | null>(null);

  // Sync operations states
  const [syncStatus, setSyncStatus] = useState<'idle' | 'pushing' | 'pulling' | 'merging'>('idle');
  const [confirmPullMode, setConfirmPullMode] = useState(false);

  // Monitor Auth sessions on mounting and config shifts
  useEffect(() => {
    // Read session initially
    activeClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkCloudCount(session.user.id);
      }
    }).catch(err => {
      console.error("Auth error:", err);
    });

    const { data: { subscription } } = activeClient.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setErrorText(null);
      if (session) {
        checkCloudCount(session.user.id);
      } else {
        setCloudWordCount(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [activeClient]);

  // Load cloud inventory word count
  const checkCloudCount = async (userId: string) => {
    try {
      const rows = await fetchSupabaseWords(activeClient, userId);
      setCloudWordCount(rows.length);
    } catch (e: any) {
      console.warn("Could not load cloud count:", e);
    }
  };

  // Re-init client based on user specifications
  const handleSaveConfig = () => {
    try {
      saveSupabaseConfig(customUrl, customKey);
      const newConfig = getSupabaseConfig();
      setConfig(newConfig);
      
      const newClient = recreateSupabaseClient(newConfig.url, newConfig.anonKey);
      setActiveClient(newClient);
      
      flashSuccess("Supabase target configuration saved!");
      setShowConfig(false);
      setErrorText(null);
    } catch (e: any) {
      setErrorText(`Failed to bind client configuration: ${e.message}`);
    }
  };

  const handleResetConfig = () => {
    resetSupabaseConfig();
    const origConfig = getSupabaseConfig();
    setConfig(origConfig);
    setCustomUrl(origConfig.url);
    setCustomKey(origConfig.anonKey);
    
    const newClient = recreateSupabaseClient(origConfig.url, origConfig.anonKey);
    setActiveClient(newClient);

    flashSuccess("Restored native target connection properties.");
    setShowConfig(false);
    setErrorText(null);
  };

  // Authentication Handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorText("Please fill out both email and password fields.");
      return;
    }

    setLoading(true);
    setErrorText(null);

    try {
      if (isSignUp) {
        const { data, error } = await activeClient.auth.signUp({
          email: email.trim(),
          password: password.trim()
        });
        if (error) throw error;
        
        if (data.session) {
          flashSuccess("Created account and signed in successfully!");
        } else {
          flashSuccess("Sign up successful! Please check your email inbox if verification is required.");
        }
      } else {
        const { error } = await activeClient.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim()
        });
        if (error) throw error;
        flashSuccess("Logged in to cloud sync server.");
      }
    } catch (e: any) {
      setErrorText(e.message || "Authentication attempt failed. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogOut = async () => {
    setLoading(true);
    try {
      await activeClient.auth.signOut();
      flashSuccess("Logged out of sync profile.");
      setErrorText(null);
    } catch (e: any) {
      setErrorText(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Sync operations
  const doPush = async () => {
    if (!session) return;
    setSyncStatus('pushing');
    setErrorText(null);
    try {
      const response = await pushLocalToSupabase(activeClient, session.user.id, vocabulary);
      if (response.success) {
        setCloudWordCount(response.count);
        flashSuccess(`Pushed ${response.count} items into cloud database (Overwrote Cloud).`);
      }
    } catch (e: any) {
      setErrorText(`Push failed: ${e.message}`);
    } finally {
      setSyncStatus('idle');
    }
  };

  const doPull = async (force: boolean = false) => {
    if (!session) return;
    if (vocabulary.length > 0 && !force) {
      setConfirmPullMode(true);
      return;
    }

    setConfirmPullMode(false);
    setSyncStatus('pulling');
    setErrorText(null);
    try {
      const pulledWords = await pullFromSupabase(activeClient, session.user.id, vocabulary);
      setVocabulary(pulledWords);
      setCloudWordCount(pulledWords.length);
      flashSuccess(`Successfully loaded ${pulledWords.length} words from Supabase cloud database.`);
    } catch (e: any) {
      setErrorText(`Pull failed: ${e.message}`);
    } finally {
      setSyncStatus('idle');
    }
  };

  const doMerge = async () => {
    if (!session) return;
    setSyncStatus('merging');
    setErrorText(null);
    try {
      const mergedList = await mergeSyncWithSupabase(activeClient, session.user.id, vocabulary);
      setVocabulary(mergedList);
      setCloudWordCount(mergedList.length);
      flashSuccess(`Merged sync finalized! Unified set contains ${mergedList.length} items.`);
    } catch (e: any) {
      setErrorText(`Merge failed: ${e.message}`);
    } finally {
      setSyncStatus('idle');
    }
  };

  return (
    <div className="space-y-5 select-none text-slate-800">
      
      {/* HEADER BANNER */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center font-bold text-indigo-700">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-900 text-sm">
              Supabase Cloud Sync Engine
            </h4>
            <span className="text-[10px] text-slate-450 font-bold block">
              Active Table: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono font-bold">public.vocab_words</code>
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 font-bold text-xs cursor-pointer"
        >
          ✕ Close
        </button>
      </div>

      {/* ERROR ANCHOR */}
      {errorText && (
        <div className="p-3 bg-red-50 border border-red-250 text-red-700 text-xs rounded-lg flex items-start gap-2 select-text">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <div>
            <span className="font-bold">Sync Error Occurred:</span>
            <p className="font-mono text-[10px] leading-relaxed break-all mt-0.5">{errorText}</p>
          </div>
        </div>
      )}

      {/* CREDENTIALS / CONFIG OVERRIDE DRAWER */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="w-full flex items-center justify-between p-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold transition-all cursor-pointer"
        >
          <span className="flex items-center gap-1.5 font-sans">
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>Connection parameters</span>
            {config.isCustom && (
              <span className="bg-indigo-50 text-indigo-700 text-[9px] px-1.5 py-0.5 rounded border border-indigo-200 uppercase font-bold">
                custom
              </span>
            )}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showConfig ? 'rotate-180' : ''}`} />
        </button>

        {showConfig && (
          <div className="p-3 space-y-3.5 border-t border-slate-200 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-650 block text-[10px] uppercase font-mono">
                Supabase Project URL:
              </label>
              <div className="relative">
                <Globe className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full bg-white border border-slate-350 rounded p-2 pl-8 font-mono text-[10px] select-text focus:outline-none focus:border-indigo-500"
                  placeholder="https://your-project.supabase.co"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-650 block text-[10px] uppercase font-mono">
                Anon API key:
              </label>
              <div className="relative">
                <Key className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="password"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  className="w-full bg-white border border-slate-350 rounded p-2 pl-8 font-mono text-[10px] select-text focus:outline-none focus:border-indigo-500"
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                />
              </div>
            </div>

            <div className="flex gap-2 font-semibold">
              <button
                onClick={handleSaveConfig}
                className="flex-1 py-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded cursor-pointer transition-all"
              >
                Apply parameters
              </button>
              {config.isCustom && (
                <button
                  onClick={handleResetConfig}
                  className="py-1 px-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 rounded cursor-pointer transition-all"
                >
                  Restore template
                </button>
              )}
            </div>
            
            <p className="text-[10px] text-slate-450 leading-relaxed bg-indigo-50/50 p-2 rounded border border-indigo-100">
              <Info className="w-3 h-3 text-indigo-500 inline mr-1 -mt-0.5" />
              Initial settings default to the project URL and anon publishable keys provided in the workspace declaration.
            </p>
          </div>
        )}
      </div>

      {/* AUTHENTICATION FLOW ZONE */}
      {!session ? (
        <form onSubmit={handleAuth} className="space-y-3 p-4 border border-slate-200 rounded-xl bg-white shadow-3xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide">
              AUTHENTICATE USER
            </span>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorText(null);
              }}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
            >
              {isSignUp ? "Already have account? Sign In" : "Need profile? Register"}
            </button>
          </div>

          <p className="text-[11px] text-slate-500 font-medium">
            {isSignUp 
              ? "Register a new student account to instantiate your cloud database vocabulary rows."
              : "Sign in with your email details to communicate with Supabase Row Level Security (RLS)."}
          </p>

          <div className="space-y-2.5">
            <div className="relative">
              <Mail className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 pl-9 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800 select-text"
                placeholder="email@example.com"
              />
            </div>

            <div className="relative">
              <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 pl-9 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800 select-text"
                placeholder="password (min 6 characters)"
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-lg shrink-0 flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all cursor-pointer mt-1"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : isSignUp ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Register User Profile</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Authenticate Sync Session</span>
              </>
            )}
          </button>
        </form>
      ) : (
        /* SYNC PANEL VIEW FOR SIGNED-IN USERS */
        <div className="space-y-4">
          
          {/* USER CHIP CARD */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-150 rounded-xl flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[9px] font-bold font-mono text-indigo-650 tracking-wider block uppercase">
                Active Sync Account
              </span>
              <strong className="text-slate-800 text-xs font-bold block truncate max-w-[180px]" title={session.user.email}>
                {session.user.email}
              </strong>
              <span className="text-[10px] font-mono text-slate-500 block">
                Cloud Inventory: <strong className="text-indigo-700">{cloudWordCount !== null ? cloudWordCount : '...'}</strong> rows
              </span>
            </div>

            <button
              onClick={handleLogOut}
              disabled={loading}
              className="p-1 px-2.5 bg-white border border-slate-205 hover:bg-slate-55 text-slate-600 hover:text-red-700 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
              title="Disconnect cloud session"
            >
              <LogOut className="w-3 h-3 text-slate-400 hover:text-red-600" />
              <span>Sign Out</span>
            </button>
          </div>

          {/* CLOUD ACTIONS ROW GRID */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-4">
            
            <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">
              Cloud Synchronization Actions
            </span>

            <div className="space-y-2.5">
              
              {/* Bidirectional Merge */}
              <button
                disabled={syncStatus !== 'idle'}
                onClick={doMerge}
                className="w-full p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md tracking-wide hover:shadow-lg transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2 text-left">
                  <RefreshCw className={`w-4 h-4 text-indigo-200 ${syncStatus === 'merging' ? 'animate-spin' : ''}`} />
                  <div>
                    <span className="block font-sans font-bold">Unify Merge Sync (Bidirectional)</span>
                    <span className="block text-[9px] text-indigo-150 font-normal">Merges both repositories, keeping and pushing all items.</span>
                  </div>
                </div>
                <CloudLightning className="w-4 h-4 text-indigo-300" />
              </button>

              {confirmPullMode ? (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2.5 animate-fadeIn">
                  <span className="text-[11px] font-bold text-amber-900 block flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    Overwrite Local Assets Warning:
                  </span>
                  <p className="text-[10px] text-amber-855 leading-normal">
                    Pulling from the cloud will completely **overwrite and erase your local dictionary cache** ({vocabulary.length} words). Ensure you have pushed any new local progress.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => doPull(true)}
                      className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded transition-all cursor-pointer"
                    >
                      Yes, Overwrite & Pull
                    </button>
                    <button
                      onClick={() => setConfirmPullMode(false)}
                      className="py-1.5 px-3 bg-white border border-slate-350 text-slate-705 font-bold text-[10px] rounded hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-1">
                  
                  {/* Push Wordlist */}
                  <button
                    disabled={syncStatus !== 'idle'}
                    onClick={doPush}
                    className="p-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg flex flex-col items-center justify-center text-center gap-1 text-[11px] font-bold shadow-xs cursor-pointer transition-all border border-slate-950"
                    title="Overwrite Cloud completely with current local wordlist"
                  >
                    <Upload className={`w-4 h-4 text-teal-400 ${syncStatus === 'pushing' ? 'animate-bounce' : ''}`} />
                    <span>Push to Cloud</span>
                  </button>

                  {/* Pull Wordlist */}
                  <button
                    disabled={syncStatus !== 'idle'}
                    onClick={() => doPull()}
                    className="p-2.5 bg-white border border-slate-250 hover:bg-slate-50 disabled:opacity-50 text-slate-700 rounded-lg flex flex-col items-center justify-center text-center gap-1 text-[11px] font-bold shadow-2xs cursor-pointer transition-all"
                    title="Wipe local dictionary and pull all matches from remote database"
                  >
                    <Download className={`w-4 h-4 text-blue-500 ${syncStatus === 'pulling' ? 'animate-bounce' : ''}`} />
                    <span>Pull from Cloud</span>
                  </button>

                </div>
              )}

            </div>

            {/* SYNC NOTIFICATIONS */}
            <div className="p-2.5 bg-slate-50 rounded-lg text-[9px] text-slate-500 font-sans leading-relaxed border border-dashed border-slate-200">
              <span className="font-bold text-slate-600 block mb-0.5">Database Constraints Policy:</span>
              Your remote schema uses RLS (Row Level Security) ensuring only authenticated requests for user ID <code className="bg-slate-100 font-bold px-0.5 rounded text-indigo-650 select-all">{session.user.id}</code> can view or edit records.
            </div>

          </div>
          
        </div>
      )}

      {/* FOOTER METRICS INFO */}
      <div className="p-3 bg-slate-100 rounded-lg flex items-center justify-between text-[11px] font-semibold text-slate-500">
        <span>Current Local Items:</span>
        <strong className="text-slate-800 font-bold text-xs">{vocabulary.length} words</strong>
      </div>

    </div>
  );
}
