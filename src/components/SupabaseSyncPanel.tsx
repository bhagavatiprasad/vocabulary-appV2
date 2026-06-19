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
  LogOut, 
  RefreshCw, 
  Download, 
  Upload, 
  Globe, 
  Settings, 
  ChevronDown, 
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
  session: any;
  isDark: boolean;
  onLogOut: () => void;
}

export default function SupabaseSyncPanel({
  vocabulary,
  setVocabulary,
  flashSuccess,
  onClose,
  session,
  isDark,
  onLogOut
}: SupabaseSyncPanelProps) {
  // Config override states
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState(getSupabaseConfig());
  const [customUrl, setCustomUrl] = useState(config.url);
  const [customKey, setCustomKey] = useState(config.anonKey);
  const [activeClient, setActiveClient] = useState(() => supabase);

  // DB vocabulary counts
  const [cloudWordCount, setCloudWordCount] = useState<number | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Sync operations states
  const [syncStatus, setSyncStatus] = useState<'idle' | 'pushing' | 'pulling' | 'merging'>('idle');
  const [confirmPullMode, setConfirmPullMode] = useState(false);

  // Fetch count on mount and client changes
  useEffect(() => {
    if (session?.user?.id) {
      checkCloudCount(session.user.id);
    }
  }, [session, activeClient]);

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

  // Sync operations
  const doPush = async () => {
    if (!session) return;
    setSyncStatus('pushing');
    setErrorText(null);
    try {
      const response = await pushLocalToSupabase(activeClient, session.user.id, vocabulary);
      if (response.success) {
        setCloudWordCount(response.count);
        flashSuccess(`Pushed ${response.count} modified items to cloud (overwrote database cache)`);
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
      setCloudWordCount(pulledWords.filter(w => {
        // Find if this is modified
        return true; // We fetch all synced records
      }).length);
      flashSuccess(`Successfully loaded and reconstructed CEFR vocabulary database.`);
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
      flashSuccess(`Merge synchronized! Workspace database unified successfully.`);
      if (session?.user?.id) {
        checkCloudCount(session.user.id);
      }
    } catch (e: any) {
      setErrorText(`Merge failed: ${e.message}`);
    } finally {
      setSyncStatus('idle');
    }
  };

  const textClass = isDark ? 'text-zinc-100' : 'text-slate-800';
  const labelClass = isDark ? 'text-zinc-300' : 'text-slate-705';
  const borderClass = isDark ? 'border-zinc-850' : 'border-slate-200';
  const cardBgClass = isDark ? 'bg-zinc-900' : 'bg-slate-50';

  return (
    <div className={`space-y-5 select-none ${textClass}`}>
      
      {/* HEADER BANNER */}
      <div className={`flex items-center justify-between pb-3 border-b ${borderClass}`}>
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${isDark ? 'bg-zinc-800 text-zinc-100' : 'bg-indigo-100 text-indigo-700'} flex items-center justify-center font-bold`}>
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h4 className={`font-extrabold ${isDark ? 'text-zinc-100' : 'text-slate-900'} text-sm`}>
              Supabase Cloud Sync Engine
            </h4>
            <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-slate-550'} font-bold block`}>
              Active Table: <code className="bg-slate-100/10 px-1 py-0.5 rounded text-indigo-400 font-mono font-bold">public.vocab_words</code>
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className={`${isDark ? 'text-zinc-400 hover:text-zinc-100' : 'text-slate-400 hover:text-slate-750'} font-bold text-xs cursor-pointer focus:outline-none`}
        >
          ✕ Close
        </button>
      </div>

      {/* ERROR ANCHOR */}
      {errorText && (
        <div className={`p-3 border rounded-lg flex items-start gap-2 select-text ${isDark ? 'bg-red-950/40 border-red-900/60 text-red-300' : 'bg-red-50 border-red-200 text-red-700 text-xs'}`}>
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <div>
            <span className="font-bold">Sync Error Occurred:</span>
            <p className="font-mono text-[10px] leading-relaxed break-all mt-0.5">{errorText}</p>
          </div>
        </div>
      )}

      {/* CREDENTIALS / CONFIG OVERRIDE DRAWER */}
      <div className={`border rounded-lg overflow-hidden ${cardBgClass} ${borderClass}`}>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`w-full flex items-center justify-between p-2.5 text-xs font-bold transition-all cursor-pointer focus:outline-none ${isDark ? 'bg-zinc-850 hover:bg-zinc-800 text-zinc-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        >
          <span className="flex items-center gap-1.5 font-sans animate-fade">
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>Connection parameters</span>
            {config.isCustom && (
              <span className="bg-indigo-950/50 text-indigo-300 text-[9px] px-1.5 py-0.5 rounded border border-indigo-900 uppercase font-bold">
                custom
              </span>
            )}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showConfig ? 'rotate-180' : ''}`} />
        </button>

        {showConfig && (
          <div className="p-3 space-y-3.5 border-t border-slate-200/10 text-xs">
            <div className="space-y-1">
              <label className={`font-bold block text-[10px] uppercase font-mono ${labelClass}`}>
                Supabase Project URL:
              </label>
              <div className="relative">
                <Globe className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className={`w-full border rounded p-2 pl-8 font-mono text-[10px] select-text focus:outline-none ${isDark ? 'bg-zinc-950 border-zinc-750 text-slate-200 focus:border-zinc-500' : 'bg-white border-slate-300 text-slate-800 focus:border-indigo-500'}`}
                  placeholder="https://your-project.supabase.co"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className={`font-bold block text-[10px] uppercase font-mono ${labelClass}`}>
                Anon API key:
              </label>
              <div className="relative">
                <Key className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="password"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  className={`w-full border rounded p-2 pl-8 font-mono text-[10px] select-text focus:outline-none ${isDark ? 'bg-zinc-950 border-zinc-750 text-slate-200 focus:border-zinc-500' : 'bg-white border-slate-300 text-slate-800 focus:border-indigo-500'}`}
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                />
              </div>
            </div>

            <div className="flex gap-2 font-semibold">
              <button
                onClick={handleSaveConfig}
                className="flex-1 py-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded cursor-pointer transition-all focus:outline-none"
              >
                Apply parameters
              </button>
              {config.isCustom && (
                <button
                  onClick={handleResetConfig}
                  className={`py-1 px-2.5 border rounded cursor-pointer transition-all focus:outline-none ${isDark ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-white hover:bg-slate-50 text-slate-600'}`}
                >
                  Restore template
                </button>
              )}
            </div>
            
            <p className={`text-[10px] leading-relaxed p-2 rounded border ${isDark ? 'bg-indigo-950/20 text-indigo-300 border-indigo-900/40' : 'bg-indigo-50 text-indigo-800 border-indigo-100'}`}>
              <Info className="w-3 h-3 text-indigo-400 inline mr-1 -mt-0.5" />
              Initial settings default to the clean project parameters integrated in the workspace deployment structure.
            </p>
          </div>
        )}
      </div>

      {session && (
        /* SYNC PANEL VIEW FOR SIGNED-IN USERS */
        <div className="space-y-4">
          
          {/* USER CHIP CARD */}
          <div className={`p-3 border rounded-xl flex items-center justify-between ${isDark ? 'bg-zinc-850 border-zinc-800' : 'bg-indigo-50/70 border-indigo-150'}`}>
            <div className="min-w-0">
              <span className={`text-[9px] font-bold font-mono tracking-wider block uppercase ${isDark ? 'text-zinc-500' : 'text-indigo-600'}`}>
                Active Sync Account
              </span>
              <strong className={`text-xs font-bold block truncate max-w-[180px] ${isDark ? 'text-zinc-100' : 'text-slate-800'}`} title={session.user.email}>
                {session.user.email}
              </strong>
              <span className={`text-[10px] font-mono block ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                Cloud Modifications count: <strong className={isDark ? 'text-indigo-400' : 'text-indigo-700'}>{cloudWordCount !== null ? cloudWordCount : '...'}</strong> rows
              </span>
            </div>

            <button
              onClick={onLogOut}
              className={`p-1 px-2.5 border hover:text-red-650 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer focus:outline-none ${isDark ? 'bg-zinc-900 border-zinc-700 hover:bg-zinc-850 text-zinc-300' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'}`}
              title="Disconnect cloud session"
            >
              <LogOut className="w-3 h-3 text-slate-400 hover:text-red-500" />
              <span>Sign Out</span>
            </button>
          </div>

          {/* CLOUD ACTIONS ROW GRID */}
          <div className={`border rounded-xl p-3.5 space-y-4 ${isDark ? 'bg-zinc-950 border-zinc-850' : 'bg-white border-slate-200'}`}>
            
            <span className={`text-[10px] font-mono font-bold block uppercase ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
              Cloud Synchronization Actions
            </span>

            <div className="space-y-2.5">
              
              {/* Bidirectional Merge */}
              <button
                disabled={syncStatus !== 'idle'}
                onClick={doMerge}
                className="w-full p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md tracking-wide hover:shadow-lg transition-all cursor-pointer flex items-center justify-between focus:outline-none"
              >
                <div className="flex items-center gap-2 text-left">
                  <RefreshCw className={`w-4 h-4 text-indigo-200 ${syncStatus === 'merging' ? 'animate-spin' : ''}`} />
                  <div>
                    <span className="block font-sans font-bold">Unify Merge Sync (Bidirectional)</span>
                    <span className="block text-[9px] text-indigo-200 font-normal">Merges both repositories, syncing only changes.</span>
                  </div>
                </div>
                <CloudLightning className="w-4 h-4 text-indigo-300" />
              </button>

              {confirmPullMode ? (
                <div className={`p-3 border rounded-xl space-y-2.5 animate-fadeIn ${isDark ? 'bg-zinc-900/60 border-amber-900/50 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>
                  <span className="text-[11px] font-bold block flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    Overwrite Local Assets Warning:
                  </span>
                  <p className={`text-[10px] leading-normal ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
                    Pulling from the cloud will completely **overwrite your local dictionary changes** with the remote state. Ensure you have backed up any new edits.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => doPull(true)}
                      className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded transition-all cursor-pointer focus:outline-none"
                    >
                      Yes, Overwrite & Pull
                    </button>
                    <button
                      onClick={() => setConfirmPullMode(false)}
                      className={`py-1.5 px-3 border font-bold text-[10px] rounded transition-all cursor-pointer focus:outline-none ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300' : 'bg-white border-slate-300 text-slate-700'}`}
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
                    className={`p-2.5 rounded-lg flex flex-col items-center justify-center text-center gap-1 text-[11px] font-bold shadow-xs cursor-pointer transition-all border focus:outline-none ${isDark ? 'bg-zinc-800 hover:bg-zinc-755 border-zinc-700 text-zinc-105' : 'bg-slate-900 hover:bg-slate-800 border-slate-950 text-white'}`}
                    title="Overwrite Cloud completely with current local modifications"
                  >
                    <Upload className={`w-4 h-4 text-emerald-400 ${syncStatus === 'pushing' ? 'animate-bounce' : ''}`} />
                    <span>Push Delta</span>
                  </button>

                  {/* Pull Wordlist */}
                  <button
                    disabled={syncStatus !== 'idle'}
                    onClick={() => doPull()}
                    className={`p-2.5 border rounded-lg flex flex-col items-center justify-center text-center gap-1 text-[11px] font-bold shadow-2xs cursor-pointer transition-all focus:outline-none ${isDark ? 'bg-zinc-900 hover:bg-zinc-850 border-zinc-700 text-zinc-200' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                    title="Wipe local dictionary and pull all matches from remote database"
                  >
                    <Download className={`w-4 h-4 text-blue-400 ${syncStatus === 'pulling' ? 'animate-bounce' : ''}`} />
                    <span>Pull Database</span>
                  </button>

                </div>
              )}

            </div>

            {/* SYNC NOTIFICATIONS */}
            <div className={`p-2.5 rounded-lg text-[9px] font-sans leading-relaxed border border-dashed ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
              <span className={`font-bold block mb-0.5 ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>Database Constraints Policy:</span>
              Your remote schema uses RLS (Row Level Security) ensuring only authenticated requests for user ID <code className={`font-bold px-1 rounded select-all ${isDark ? 'bg-zinc-850 text-zinc-300' : 'bg-slate-100 text-indigo-600'}`}>{session.user.id}</code> can view or edit records.
            </div>

          </div>
          
        </div>
      )}

      {/* FOOTER METRICS INFO */}
      <div className={`p-3 rounded-lg flex items-center justify-between text-[11px] font-semibold ${isDark ? 'bg-zinc-900 text-zinc-400' : 'bg-slate-100 text-slate-500'}`}>
        <span>Current Local Items:</span>
        <strong className={`font-bold text-xs ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>{vocabulary.length} words</strong>
      </div>

    </div>
  );
}
