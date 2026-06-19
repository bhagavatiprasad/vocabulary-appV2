/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, Fragment } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Download, 
  Copy, 
  SlidersHorizontal, 
  BookOpen, 
  Award, 
  Upload, 
  Check, 
  Database,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  GraduationCap,
  Sparkles,
  HelpCircle,
  Hash,
  Settings,
  X,
  FileSpreadsheet,
  Info,
  Layers,
  ChevronDown,
  Trash2,
  Plus,
  ExternalLink,
  Sun,
  Moon,
  Lock,
  Mail,
  UserPlus,
  LogIn
} from 'lucide-react';
import { defaultVocabulary, cefrLevels } from './data/defaultVocabulary';
import { parseVocabularyCSV } from './utils/csvParser';
import { VocabularyWord } from './types';
import SupabaseSyncPanel from './components/SupabaseSyncPanel';
import { supabase } from './lib/supabase';
import { syncSingleWordToCloud, deleteSingleWordFromCloud } from './lib/supabaseSync';

export default function App() {
  // Authentication states
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Forgot password flow states
  const [forgotPasswordActive, setForgotPasswordActive] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [passwordResetSent, setPasswordResetSent] = useState(false);

  // Reset password popup/modal
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);

  const isDark = false;

  // Vocabulary Database State
  const [vocabulary, setVocabulary] = useState<VocabularyWord[]>(() => {
    const saved = localStorage.getItem('user_vocabulary');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved vocabulary", e);
      }
    }
    // Default fallback vocabulary starts with status: 'Familiar'
    return defaultVocabulary.map(w => ({
      ...w,
      status: w.status === 'Learning' ? 'Familiar' : w.status
    }));
  });

  // UI Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedPos, setSelectedPos] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const [csvInput, setCsvInput] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination Settings State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    const saved = localStorage.getItem('user_vocab_items_per_page');
    return saved ? parseInt(saved, 10) : 9;
  });

  // Save items per page setting
  useEffect(() => {
    localStorage.setItem('user_vocab_items_per_page', itemsPerPage.toString());
  }, [itemsPerPage]);

  // Selected word details expansion id
  const [activeWordId, setActiveWordId] = useState<string | null>(null);

  // Safe inline editing & verification states
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editField, setEditField] = useState<'meaning' | 'spelling' | 'delete' | 'resetDefault' | null>(null);
  const [tempEditValue, setTempEditValue] = useState("");

  // Modern Theme visibility toggle states
  const [showImporter, setShowImporter] = useState(false);
  const [showAddWordModal, setShowAddWordModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showGithubGuide, setShowGithubGuide] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);

  // Custom modal state inputs for Adding Words
  const [newWordSpelling, setNewWordSpelling] = useState("");
  const [newWordPos, setNewWordPos] = useState("noun");
  const [newWordMeaning, setNewWordMeaning] = useState("");
  const [newWordLevel, setNewWordLevel] = useState("A1");
  const [addValidationError, setAddValidationError] = useState<string | null>(null);

  // Save vocabulary to local storage on modification
  useEffect(() => {
    localStorage.setItem('user_vocabulary', JSON.stringify(vocabulary));
  }, [vocabulary]);

  // Authenticate, password recovery listeners
  useEffect(() => {
    // Determine initially active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setAuthLoading(false);

      if (event === 'PASSWORD_RECOVERY') {
        setShowResetPasswordModal(true);
      }
    });

    // Check url hash for recovery redirect: e.g. #access_token=...&type=recovery
    if (window.location.hash && window.location.hash.includes('type=recovery')) {
      setShowResetPasswordModal(true);
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sync user's cloud changes dynamically when session is active
  useEffect(() => {
    if (session?.user?.id) {
      const loadUserCloudWords = async () => {
        try {
          const { data, error } = await supabase
            .from('vocab_words')
            .select('*')
            .eq('user_id', session.user.id);
          
          if (error) throw error;
          if (data && data.length > 0) {
            // Reconstruct overlaying on defaults
            const reconstructedMap = new Map<string, VocabularyWord>();
            defaultVocabulary.forEach((originalWord: VocabularyWord) => {
              const key = `${originalWord.word.toLowerCase()}_${originalWord.level.toLowerCase()}`;
              reconstructedMap.set(key, { ...originalWord });
            });

            data.forEach((row: any) => {
              const level = row.classification as any;
              const key = `${row.word.toLowerCase()}_${level.toLowerCase()}`;
              const matchedDefault = defaultVocabulary.find(
                w => w.word.toLowerCase() === row.word.toLowerCase() && w.level === level
              );
              reconstructedMap.set(key, {
                id: row.id,
                word: row.word,
                pos: row.type || 'noun',
                meaning: matchedDefault?.meaning || "Definition imported from cloud database.",
                status: row.status || 'Familiar',
                level: level,
                levelName: matchedDefault?.levelName || level,
              });
            });

            setVocabulary(Array.from(reconstructedMap.values()));
          }
        } catch (err) {
          console.warn("Could not auto-fetch user cache:", err);
        }
      };
      loadUserCloudWords();
    }
  }, [session]);

  // Auth Operations
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError("Email and password cannot be empty.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword.trim()
        });
        if (error) throw error;
        if (data.session) {
          flashSuccess("Success! Account created and authenticated.");
        } else {
          flashSuccess("Success! Account registered. Please verify your email inbox if required.");
          setIsSignUp(false); // return to sign in
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword.trim()
        });
        if (error) throw error;
        flashSuccess("Welcome back! Cloud sync session verified.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to authenticate.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail.trim()) {
      setAuthError("Please type your recovery email address.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      let redirectToUrl = window.location.origin;
      if (window.location.host.includes("github.io")) {
        redirectToUrl = "https://bhagavatiprasad.github.io/vocabulary-appV2/";
      }
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail.trim(), {
        redirectTo: redirectToUrl,
      });
      if (error) throw error;
      setPasswordResetSent(true);
      flashSuccess("Verification message dispatched via Supabase cloud!");
    } catch (err: any) {
      setAuthError(err.message || "Failed to trigger recovery event.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUpdatePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setResetError("Secret password must contain at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetError("Passwords do not match.");
      return;
    }
    setAuthLoading(true);
    setResetError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      flashSuccess("Account key updated successfully! Please login again with your new credentials.");
      setShowResetPasswordModal(false);
      setNewPassword('');
      setConfirmNewPassword('');
      await supabase.auth.signOut();
    } catch (err: any) {
      setResetError(err.message || "Failed to update user password.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogOut = async () => {
    setAuthLoading(true);
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('user_vocabulary');
      // Revert vocabulary to pristine state with status: 'Familiar'
      setVocabulary(defaultVocabulary.map(w => ({
        ...w,
        status: w.status === 'Learning' ? 'Familiar' : w.status
      })));
      flashSuccess("Logged out of sync profile.");
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Flush positive prompt indicator
  const flashSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Derive active Parts of Speech
  const uniquePartsOfSpeech = useMemo(() => {
    const s = new Set<string>();
    vocabulary.forEach(word => {
      if (word.pos) s.add(word.pos);
    });
    return Array.from(s).sort();
  }, [vocabulary]);

  // Reset page when settings or filter metrics shift
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedLevel, selectedPos, selectedStatus, itemsPerPage]);

  // Handle spreadsheet row parses
  const handleImportCSV = (override: boolean) => {
    if (!csvInput.trim()) {
      setErrorMsg("Empty input. Paste some raw CSV or spreadsheet columns first.");
      return;
    }

    try {
      const parsed = parseVocabularyCSV(csvInput);
      if (parsed.length === 0) {
        setErrorMsg("Parsing empty. Please verify row elements look like (word, part of speech, definition, status).");
        return;
      }

      if (override) {
        setVocabulary(parsed);
        flashSuccess(`Replaced entire catalog with ${parsed.length} pristine list items.`);
      } else {
        const mergedMap = new Map<string, VocabularyWord>();
        vocabulary.forEach(w => mergedMap.set(w.word.toLowerCase() + '_' + w.level, w));
        
        parsed.forEach(w => {
          mergedMap.set(w.word.toLowerCase() + '_' + w.level, w);
        });

        const merged = Array.from(mergedMap.values());
        setVocabulary(merged);
        flashSuccess(`Merged ${parsed.length} spreadsheet records successfully.`);
      }

      setCsvInput('');
      setErrorMsg(null);
      setCurrentPage(1);
    } catch (e: any) {
      setErrorMsg(`Parsing failure: ${e.message || e}`);
    }
  };

  // Pre-load default template snippet of raw spreadsheet
  const handleLoadSampleCSV = () => {
    const sampleCSV = `Words B1 (Intermediate),Part of Speech,Basic Meaning,Status
confident,adjective,feeling or showing certainty or self-reliance,Learning
opportunity,noun,a set of circumstances that makes it possible,Familiar
challenge,noun,a call to take part in a contest or duel,Mastered
strategy,noun,a plan of action designed to achieve major goals,Learning
Words A1 (Elementary),Part of Speech,Basic Meaning,Status
friendly,adjective,kind and pleasant in behavior,Mastered
journey,noun,an act of traveling from one place to another,Familiar`;
    setCsvInput(sampleCSV.trim());
    setErrorMsg(null);
    flashSuccess("Pasted pre-formatted CSV template!");
  };

  // Status toggle handler
  const handleToggleStatus = (id: string, newStatus: 'Learning' | 'Familiar' | 'Mastered') => {
    setVocabulary(prev => prev.map(word => {
      if (word.id === id) {
        const updated = { ...word, status: newStatus };
        if (session?.user?.id) {
          syncSingleWordToCloud(supabase, session.user.id, updated);
        }
        return updated;
      }
      return word;
    }));
  };

  // Clean wipe storage resets
  const handleResetToDefault = () => {
    if (window.confirm("Verify resets: Clear custom words and restore original CEFR dataset standards?")) {
      const resetList = defaultVocabulary.map(w => ({
        ...w,
        status: w.status === 'Learning' ? 'Familiar' : w.status
      }));
      setVocabulary(resetList);
      localStorage.removeItem('user_vocabulary');
      if (session?.user?.id) {
        // Clear database, then repopulate only the modified elements (which is 0 initially)
        supabase.from('vocab_words').delete().eq('user_id', session.user.id).then(() => {
          flashSuccess("Restored original CEFR dataset corpus.");
        });
      } else {
        flashSuccess("Restored original CEFR dataset corpus.");
      }
      setCurrentPage(1);
      setActiveWordId(null);
    }
  };

  // Word node submit instantiation
  const handleCreateCustomWord = () => {
    if (!newWordSpelling.trim()) {
      setAddValidationError("Spelling word field cannot be left empty.");
      return;
    }

    setAddValidationError(null);

    const levelNameMap: Record<string, string> = {
      A1: 'Elementary',
      A2: 'Pre-Intermediate',
      B1: 'Intermediate',
      B2: 'Upper Intermediate',
      C1: 'Advanced',
      C2: 'Proficiency'
    };

    const cleanSpell = newWordSpelling.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
    const newWordItem: VocabularyWord = {
      id: `${newWordLevel.toLowerCase()}_${cleanSpell}_${Date.now()}`,
      word: newWordSpelling.trim(),
      pos: newWordPos.trim().toLowerCase(),
      meaning: newWordMeaning.trim() || "No explicit definition specified.",
      status: 'Familiar', // default status to 'Familiar'
      level: newWordLevel as any,
      levelName: levelNameMap[newWordLevel] || 'Elementary'
    };

    setVocabulary(prev => [newWordItem, ...prev]);
    if (session?.user?.id) {
      syncSingleWordToCloud(supabase, session.user.id, newWordItem);
    }
    flashSuccess(`Added custom entry "${newWordSpelling.trim()}" successfully.`);
    
    // Clear & dismiss modals
    setNewWordSpelling("");
    setNewWordMeaning("");
    setNewWordPos("noun");
    setNewWordLevel("A1");
    setShowAddWordModal(false);
  };

  // Filter list selection logic
  const filteredVocabulary = useMemo(() => {
    return vocabulary.filter(w => {
      const matchQuery = 
        w.word.toLowerCase().includes(searchQuery.toLowerCase()) || 
        w.meaning.toLowerCase().includes(searchQuery.toLowerCase());
      const matchLevel = selectedLevel === 'ALL' || w.level === selectedLevel;
      const matchPos = selectedPos === 'ALL' || w.pos === selectedPos;
      const matchStatus = selectedStatus === 'ALL' || w.status === selectedStatus;
      return matchQuery && matchLevel && matchPos && matchStatus;
    });
  }, [vocabulary, searchQuery, selectedLevel, selectedPos, selectedStatus]);

  // Paginated partition view
  const paginatedWords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredVocabulary.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredVocabulary, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredVocabulary.length / itemsPerPage);

  // Derive metric updates
  const stats = useMemo(() => {
    const total = filteredVocabulary.length;
    const mastered = filteredVocabulary.filter(w => w.status === 'Mastered').length;
    const familiar = filteredVocabulary.filter(w => w.status === 'Familiar').length;
    const learning = filteredVocabulary.filter(w => w.status === 'Learning').length;

    return {
      total,
      mastered,
      familiar,
      learning,
      masteredPercentage: total > 0 ? Math.round((mastered / total) * 100) : 0,
      familiarPercentage: total > 0 ? Math.round((familiar / total) * 100) : 0,
      learningPercentage: total > 0 ? Math.round((learning / total) * 100) : 0,
    };
  }, [filteredVocabulary]);

  const activeWord = useMemo(() => {
    return vocabulary.find(w => w.id === activeWordId) || null;
  }, [vocabulary, activeWordId]);

  if (authLoading) {
    return (
      <div className={`min-h-screen font-sans flex flex-col justify-center items-center p-4 ${isDark ? 'bg-black text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
          <span className="text-xs font-mono font-bold tracking-wider uppercase">Checking sync authorization state...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen font-sans flex flex-col justify-center items-center p-4 transition-all relative bg-slate-50 text-slate-800">
        
        <div className="w-full max-w-md">
          
          {/* Logo / Branding */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-3 animate-bounce">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              VocabCanvas CEFR
            </h1>
            <p className="text-xs mt-1 font-semibold text-slate-500">
              Verified Account Required to Gain Database Sandbox Access
            </p>
          </div>

          <div className="p-6 rounded-2xl border shadow-xl bg-white border-slate-200">
            
            {/* Header message */}
            <div className="mb-6 flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold tracking-wider font-mono uppercase text-indigo-500">
                {forgotPasswordActive ? "Recover Credentials" : isSignUp ? "Create Workspace Key" : "Authenticate Session"}
              </span>
            </div>

            {/* ERROR BANNER */}
            {authError && (
              <div className={`p-3 rounded-lg border text-xs font-semibold mb-4 ${isDark ? 'bg-red-950/40 border-red-900/60 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
                {authError}
              </div>
            )}

            {/* Reset Password Sent Alert */}
            {passwordResetSent && (
              <div className={`p-3 rounded-lg border text-xs font-semibold mb-4 leading-relaxed ${isDark ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-300' : 'bg-emerald-50 border-emerald-250 text-emerald-700'}`}>
                ✨ Password reset verification received! Please monitor your inbox and search updates for a reset hyperlink message from Supabase.
              </div>
            )}

            {forgotPasswordActive ? (
              /* FORGOT PASSWORD FORM */
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className={`text-xs font-bold block ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                    Account Email Address:
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      className={`w-full border rounded-lg p-2.5 pl-9 text-xs focus:outline-none ${isDark ? 'bg-zinc-900 border-zinc-750 text-slate-200 focus:border-indigo-500' : 'bg-white border-slate-300 text-slate-800 focus:border-indigo-500'}`}
                      placeholder="e.g. curator@example.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 focus:outline-none"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${authLoading ? 'animate-spin' : ''}`} />
                  <span>Send Recovery Email Flow</span>
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordActive(false);
                      setPasswordResetSent(false);
                    }}
                    className={`text-xs font-bold transition-all ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-indigo-600 hover:text-indigo-800'}`}
                  >
                    ← Return to Connection Lobby
                  </button>
                </div>
              </form>
            ) : (
              /* LOGIN & SIGNUP FORM */
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                
                <div className="space-y-1">
                  <label className={`text-xs font-bold block ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                    Email Address:
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400 font-bold" />
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className={`w-full border rounded-lg p-2.5 pl-9 text-xs focus:outline-none ${isDark ? 'bg-zinc-900 border-zinc-750 text-slate-200 focus:border-indigo-500' : 'bg-white border-slate-300 text-slate-800 focus:border-indigo-500'}`}
                      placeholder="curator@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className={`text-xs font-bold block ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                      Secret Password:
                    </label>
                    <button
                      type="button"
                      onClick={() => setForgotPasswordActive(true)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer focus:outline-none"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className={`w-full border rounded-lg p-2.5 text-xs focus:outline-none ${isDark ? 'bg-zinc-900 border-zinc-750 text-slate-200 focus:border-indigo-500' : 'bg-white border-slate-300 text-slate-800 focus:border-indigo-500'}`}
                    placeholder="••••••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md focus:outline-none"
                >
                  {isSignUp ? (
                    <>
                      <UserPlus className="w-3.5 h-3.5 shrink-0" />
                      <span>Register New Workspace</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-3.5 h-3.5 shrink-0" />
                      <span>Authenticate Workspace</span>
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setAuthError(null);
                    }}
                    className={`text-xs font-bold hover:underline ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    {isSignUp ? "Already registered? Login to existing profile" : "New curator database? Register profile here"}
                  </button>
                </div>

              </form>
            )}

          </div>

          <div className="text-center mt-6">
            <span className={`text-[10px] font-semibold tracking-wide ${isDark ? 'text-zinc-650' : 'text-slate-400'}`}>
              VocabCanvas CEFR • Robust Cloud-Persisted Diagnostic System
            </span>
          </div>

        </div>

      </div>
    );
  }

  // Define dynamic class mappings to keep HTML layout compliant with Theme choices
  const isDarkClass = isDark ? 'bg-zinc-950 text-slate-100 border-zinc-800' : 'bg-white text-slate-800 border-slate-205';

  return (
    <div className={`min-h-screen font-sans flex flex-col antialiased transition-colors ${isDark ? 'bg-black text-slate-100' : 'bg-slate-50 text-slate-850'}`}>
      
      {/* 4. PASSWORDS RESET POPUP MODAL */}
      <AnimatePresence>
        {showResetPasswordModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl relative ${isDark ? 'bg-zinc-950 border-zinc-805 text-zinc-100' : 'bg-white border-slate-200 text-slate-800'}`}
            >
              <div className="flex items-center gap-2 mb-4">
                <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
                <h3 className={`text-sm font-extrabold font-sans uppercase tracking-wider ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                  Custom Password Recovery
                </h3>
              </div>

              {resetError && (
                <div className={`p-2.5 rounded-lg border text-[11px] font-semibold mb-3 ${isDark ? 'bg-red-950/40 border-red-900/40 text-red-300' : 'bg-red-50 border-red-150 text-red-705'}`}>
                  {resetError}
                </div>
              )}

              <form onSubmit={handleUpdatePasswordSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className={`text-[11px] uppercase font-bold block ${isDark ? 'text-zinc-300' : 'text-slate-650'}`}>
                    Specify New Secret Password:
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`w-full border rounded-lg p-2 text-xs focus:outline-none ${isDark ? 'bg-zinc-900 border-zinc-750 text-slate-200 focus:border-indigo-500' : 'bg-white border-slate-300 text-slate-805 focus:border-indigo-500'}`}
                    placeholder="Min 6 characters"
                  />
                </div>

                <div className="space-y-1 font-sans">
                  <label className={`text-[11px] uppercase font-bold block ${isDark ? 'text-zinc-300' : 'text-slate-650'}`}>
                    Confirm Secret Password:
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className={`w-full border rounded-lg p-2 text-xs focus:outline-none ${isDark ? 'bg-zinc-900 border-zinc-750 text-slate-200 focus:border-indigo-500' : 'bg-white border-slate-300 text-slate-805 focus:border-indigo-500'}`}
                    placeholder="Match exactly"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-all shadow-sm focus:outline-none"
                >
                  Save Account Key Settings
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GLOBAL HEADER BAR */}
      <header className={`border-b sticky top-0 z-40 px-4 py-3 shadow-xs transition-colors ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Brand Logo & Badging titles */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-md animate-pulse shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-lg font-extrabold tracking-tight ${isDark ? 'text-zinc-50' : 'text-slate-900'}`}>
                  VocabCanvas CEFR
                </h1>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide shrink-0 ${isDark ? 'bg-indigo-950/40 text-indigo-300 border-indigo-900' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                  Dataset Curation Engine
                </span>
                {session && (
                  <span className={`text-[9px] font-mono font-bold border px-1.5 py-0.5 rounded ${isDark ? 'bg-zinc-900 text-zinc-400 border-zinc-750' : 'bg-slate-105 text-slate-500 border-slate-250'}`}>
                    ID: {session.user.email.split('@')[0]}
                  </span>
                )}
              </div>
              <p className={`text-xs font-medium ${isDark ? 'text-zinc-450' : 'text-slate-500'}`}>
                Professional corpus editor with live structured export capabilities
              </p>
            </div>
          </div>

          {/* Core Panel action triggers */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Supabase Cloud Sync Action Trigger */}
            <button
              onClick={() => {
                setShowSupabaseModal(true);
                flashSuccess("Opened Cloud Sync dashboard.");
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 border transition-all cursor-pointer shadow-3xs focus:outline-none ${
                isDark 
                  ? 'bg-indigo-950/20 hover:bg-indigo-950/40 text-indigo-300 border-indigo-900' 
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
              }`}
              title="Synchronize, backup, or load your vocabulary cards with Supabase Postgres"
            >
              <Database className={`w-4 h-4 shrink-0 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
              <span>Cloud Storage Sync</span>
            </button>

            {/* Excel Row Importer visibility trigger */}
            <button
              onClick={() => {
                setShowImporter(!showImporter);
                flashSuccess(showImporter ? "Spreadsheet row importer panel shut" : "Excel spreadsheet copy/paste importer panel active.");
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 border transition-all cursor-pointer focus:outline-none ${
                showImporter 
                  ? (isDark ? 'bg-emerald-950/30 text-emerald-300 border-emerald-900' : 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-inner') 
                  : (isDark ? 'bg-zinc-900 text-zinc-305 hover:bg-zinc-800 border-zinc-750' : 'bg-white text-slate-705 hover:bg-slate-50 border-slate-200')
              }`}
              title="Toggle Pasteable Spreadsheet rows panel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{showImporter ? "Row Importer Active" : "CSV Row Importer"}</span>
            </button>

            <div className={`h-6 w-px ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />

            {/* Add Custom Vocabulary item trigger */}
            <button
              onClick={() => setShowAddWordModal(true)}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer focus:outline-none"
            >
              <Plus className="w-4 h-4" />
              <span>Add Word Wizard</span>
            </button>

            {/* Custom GitHub Hosting Info trigger */}
            <button
              onClick={() => setShowGithubGuide(true)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer focus:outline-none ${
                isDark 
                  ? 'bg-zinc-900 border border-zinc-750 hover:bg-zinc-850 text-zinc-100' 
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
              title="Display information on how to build and host this on your custom GitHub Pages"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
              <span>GitHub Hosting Guide</span>
            </button>
          </div>
        </div>
      </header>

      {/* SYSTEM META METRIC PROGRESS MONITORING BLOCK */}
      <section className={`border-b py-3 px-4 shadow-3xs select-none transition-colors ${isDark ? 'bg-zinc-900/80 border-zinc-850' : 'bg-slate-100/80 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span className={`text-[10px] font-bold tracking-wide uppercase font-mono ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              CURATION ACTIVE
            </span>
            <span className={`text-xs font-medium ${isDark ? 'text-zinc-650' : 'text-slate-300'}`}>•</span>
            <span className={`text-xs font-semibold border px-1.5 py-0.5 rounded-sm ${isDark ? 'text-zinc-350 bg-zinc-950 border-zinc-800' : 'text-slate-650 bg-white border-slate-200'}`}>
              UTF-8 Live Cache
            </span>
          </div>

          <div className="text-xs text-slate-600 font-medium flex items-center gap-2">
            <span className="font-mono text-[11px] text-slate-400">Mastered Progress:</span>
            <div className={`w-full rounded-full h-2 overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-slate-205'}`}>
              <div 
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${stats.masteredPercentage}%` }} 
              />
            </div>
            <span className={`font-mono text-[11px] font-bold shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-650'}`}>
              {stats.masteredPercentage}% ({stats.mastered} words)
            </span>
          </div>

          <div className={`text-xs font-medium flex items-center gap-2 ${isDark ? 'text-zinc-300' : 'text-slate-605'}`}>
            <span className="font-mono text-[11px] text-slate-400">Learning Active:</span>
            <div className={`w-full rounded-full h-2 overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-slate-205'}`}>
              <div 
                className="bg-amber-450 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${stats.learningPercentage}%` }} 
              />
            </div>
            <span className={`font-mono text-[11px] font-bold shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-655'}`}>
              {stats.learningPercentage}% ({stats.learning} words)
            </span>
          </div>

          <div className="flex justify-end gap-2.5">
            <button
              onClick={() => setShowAboutModal(true)}
              className="text-xs font-semibold inline-flex items-center gap-1 cursor-pointer focus:outline-none text-indigo-600 hover:text-indigo-800"
            >
              <Info className="w-3.5 h-3.5" />
              <span>About Corpus</span>
            </button>
            {editField === 'resetDefault' ? (
              <div className="inline-flex items-center gap-1.5 transition-all text-xs border px-2 py-1 rounded-lg bg-red-50 border-red-200 text-red-700">
                <span className="font-extrabold font-sans">Wipe memory & Reset?</span>
                <button
                  onClick={() => {
                    const resetList = defaultVocabulary.map(w => ({
                      ...w,
                      status: 'Familiar' as any
                    }));
                    setVocabulary(resetList);
                    localStorage.removeItem('user_vocabulary');
                    if (session?.user?.id) {
                      supabase.from('vocab_words').delete().eq('user_id', session.user.id).then(() => {
                        flashSuccess("Restored original CEFR dataset corpus.");
                      });
                    } else {
                      flashSuccess("Restored original CEFR dataset corpus.");
                    }
                    setCurrentPage(1);
                    setActiveWordId(null);
                    setEditField(null);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white font-extrabold px-1.5 py-0.5 rounded text-[10px] cursor-pointer"
                >
                  Yes, Reset
                </button>
                <button
                  onClick={() => setEditField(null)}
                  className="font-semibold cursor-pointer text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditField('resetDefault')}
                className="text-xs font-semibold inline-flex items-center gap-1 cursor-pointer focus:outline-none text-slate-500 hover:text-red-600"
                title="Wipe custom entries and reload initial CEFR corpus dictionary values"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Template</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* CORE WORKSPACE PANES CONTAINER */}
      <main className="max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8 flex-grow flex flex-col lg:flex-row gap-6 overflow-hidden">
        
        {/* COLLAPSIBLE / TAB OPTIONS SIDEBAR */}
        <aside className="w-full lg:w-64 flex-none space-y-6">
          
          {/* CEFR LEVELS AND COUNT EXPLORER */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs p-4">
            <div className="flex items-center gap-1.5 mb-3 border-b border-slate-100 pb-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h2 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">
                CEFR Standard Index
              </h2>
            </div>

            <div className="space-y-1">
              {/* Reset to see all categories */}
              <button
                onClick={() => setSelectedLevel('ALL')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-all text-left cursor-pointer ${
                  selectedLevel === 'ALL'
                    ? 'bg-indigo-600 text-white font-bold shadow-sm'
                    : 'text-slate-650 hover:bg-slate-100 font-medium'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>📂</span>
                  <span>All Curated Words</span>
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold ${
                  selectedLevel === 'ALL' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {vocabulary.length}
                </span>
              </button>

              {/* CEFR specific collections looping */}
              {cefrLevels.map(lvl => {
                const count = vocabulary.filter(w => w.level === lvl.code).length;
                const isActive = selectedLevel === lvl.code;
                return (
                  <button
                    key={lvl.code}
                    onClick={() => setSelectedLevel(lvl.code)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-all text-left cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white font-bold shadow-sm'
                        : 'text-slate-650 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span>📄</span>
                      <span className="truncate">{lvl.code} • {lvl.name}</span>
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                      isActive ? 'bg-indigo-700 text-indigo-50' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DENSITY HIGHLIGHT METERS */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs p-4 space-y-3">
            <h3 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">
              Level Group Dense Ratio
            </h3>
            <div className="space-y-2.5 font-mono text-[11px]">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span className="text-emerald-700 font-bold">A-Level Elementary</span>
                  <span>{vocabulary.filter(w => w.level === 'A1' || w.level === 'A2').length} words</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-1.5 rounded-full" 
                    style={{ width: `${Math.round((vocabulary.filter(w => w.level === 'A1' || w.level === 'A2').length / vocabulary.length) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span className="text-blue-700 font-bold">B-Level Intermediate</span>
                  <span>{vocabulary.filter(w => w.level === 'B1' || w.level === 'B2').length} words</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-500 h-1.5 rounded-full" 
                    style={{ width: `${Math.round((vocabulary.filter(w => w.level === 'B1' || w.level === 'B2').length / vocabulary.length) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span className="text-indigo-700 font-bold">C-Level Proficiency</span>
                  <span>{vocabulary.filter(w => w.level === 'C1' || w.level === 'C2').length} words</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-1.5 rounded-full" 
                    style={{ width: `${Math.round((vocabulary.filter(w => w.level === 'C1' || w.level === 'C2').length / vocabulary.length) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* HELP TIPBOX CARD */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-4 rounded-xl text-white shadow-md space-y-2">
            <div className="flex items-center gap-1.5 text-indigo-300 font-bold text-xs uppercase tracking-wider font-mono">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span>Fast-Curation Tip</span>
            </div>
            <p className="text-slate-200 text-xs leading-relaxed font-sans">
              Double-click or tap the status pills inside the table list to immediately cycle entries through <strong className="text-white">Learning</strong>, <strong className="text-white">Familiar</strong> or <strong className="text-white">Mastered</strong> states. Instant schema outputs will rebuild live inside the side dataset panel!
            </p>
          </div>
        </aside>

        {/* PRIMARY VIEWPORT & DATA FILTER WELLS */}
        <section className="flex-grow flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          
          {/* SEARCH, ADAPTIVE PAGINATION SETTING, AND STATUS TOGGLE BAR */}
          <div className="p-4 bg-slate-50/50 border-b border-slate-200 space-y-3 shrink-0">
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              
              {/* Search keywords */}
              <div className="relative md:col-span-6">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Filter semantic words or definition terms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg p-2 pl-9 text-xs font-semibold focus:outline-none placeholder:text-slate-450 text-slate-800 transition-all shadow-2xs select-text"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-800 font-bold text-xs cursor-pointer select-none"
                    title="Clear filter keywords"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Part Of Speech enum select options */}
              <div className="relative md:col-span-3">
                <select
                  value={selectedPos}
                  onChange={(e) => setSelectedPos(e.target.value)}
                  className="w-full select-none rounded-lg border border-slate-300 bg-white p-2 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs transition-all"
                  title="Filter vocabulary elements by grammatical type"
                >
                  <option value="ALL">★ Grammars pos (All)</option>
                  {uniquePartsOfSpeech.map(pos => (
                    <option key={pos} value={pos}>{pos.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              {/* DYNAMIC WORDS PER PAGE SETTINGS SELECTOR */}
              <div className="relative md:col-span-3">
                <div className="flex items-center bg-white border border-slate-300 rounded-lg p-1.5 shadow-2xs">
                  <span className="text-[10px] font-mono font-bold text-slate-400 px-1 shrink-0 uppercase">
                    Items / Page:
                  </span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(parseInt(e.target.value, 10))}
                    className="w-full font-mono font-bold text-xs bg-transparent text-slate-800 outline-none cursor-pointer text-center select-none"
                    title="Dynamically adjust how many rows are shown per page"
                  >
                    <option value={5}>5 words</option>
                    <option value={9}>9 words</option>
                    <option value={15}>15 words</option>
                    <option value={25}>25 words</option>
                    <option value={50}>50 words</option>
                    <option value={100}>100 words</option>
                  </select>
                </div>
              </div>
            </div>

            {/* STATUS FILTER PILLS & RE-INDEX OVERVIEW */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
              <div className="flex flex-wrap items-center gap-1.5 select-none">
                <span className="text-slate-450 font-bold font-mono text-[10px] tracking-wider uppercase pl-1">
                  Vocabulary State:
                </span>
                {[
                  { key: 'ALL', label: '★ All States' },
                  { key: 'Learning', label: 'Learning' },
                  { key: 'Familiar', label: 'Familiar' },
                  { key: 'Mastered', label: 'Mastered' }
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setSelectedStatus(item.key)}
                    className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                      selectedStatus === item.key
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="text-[11px] font-mono text-slate-500 font-bold bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-3xs flex items-center gap-1">
                <span>Display Density:</span>
                <strong className="text-indigo-600">{filteredVocabulary.length}</strong>
                <span>/ {vocabulary.length} total words</span>
              </div>
            </div>
          </div>

          {/* SINK DATAGRID WORD DICTIONARY TABLE */}
          <div className="flex-grow overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider select-none z-20 border-b border-slate-200 shadow-3xs">
                <tr>
                  <th className="p-3 font-semibold">Vocabulary Word</th>
                  <th className="p-3 font-semibold">CEFR Classification</th>
                  <th className="p-3 font-semibold">Type</th>
                  <th className="p-3 font-semibold">Active Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedWords.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-slate-400">
                      <div className="max-w-md mx-auto space-y-2">
                        <p className="text-sm font-bold text-slate-600">
                          Empty grid! No vocabulary items matched your settings.
                        </p>
                        <p className="text-xs text-slate-450 text-center px-4 leading-normal">
                          Try typing keywords differently, selecting "All States", resetting categories index map, or typing custom items.
                        </p>
                        <button
                          onClick={() => {
                            setSelectedLevel('ALL');
                            setSelectedPos('ALL');
                            setSelectedStatus('ALL');
                            setSearchQuery('');
                          }}
                          className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold hover:bg-indigo-100 rounded-lg cursor-pointer transition-colors mt-2"
                        >
                          Clear Current Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedWords.map(word => {
                    const isSelected = activeWordId === word.id;
                    
                    const levelDesignBadgeThemes: Record<string, string> = {
                      A1: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                      A2: 'bg-teal-50 text-teal-700 border-teal-200',
                      B1: 'bg-blue-50 text-blue-700 border-blue-200',
                      B2: 'bg-sky-50 text-sky-700 border-sky-200',
                      C1: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                      C2: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
                    };

                    const statusBadgeThemes: Record<string, string> = {
                      Mastered: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
                      Familiar: 'bg-indigo-55 text-indigo-900 border-indigo-200 font-semibold',
                      Learning: 'bg-amber-100 text-amber-900 border-amber-300',
                    };

                    return (
                      <Fragment key={word.id}>
                        <tr
                          key={word.id}
                          onClick={() => setActiveWordId(isSelected ? null : word.id)}
                          className={`hover:bg-slate-50/85 transition-colors cursor-pointer ${
                            isSelected ? 'bg-indigo-50/30' : ''
                          }`}
                        >
                          {/* Spill word name with bullet icon */}
                          <td className="p-3 font-bold text-slate-900 capitalize">
                            <span className="inline-flex items-center gap-1.5 select-text">
                              <span className="text-slate-400">📘</span>
                              <span>{word.word}</span>
                            </span>
                          </td>
                          {/* CEFR Level designation details */}
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${levelDesignBadgeThemes[word.level] || 'bg-slate-50'}`}>
                              {word.level} • {word.levelName}
                            </span>
                          </td>
                          {/* POS grammatical representation */}
                          <td className="p-3 text-slate-550 font-mono italic">
                            {word.pos}
                          </td>
                          {/* Quick Interactive Cycle Trigger toggle */}
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                const transitionsMap: Record<string, 'Learning' | 'Familiar' | 'Mastered'> = {
                                  Learning: 'Familiar',
                                  Familiar: 'Mastered',
                                  Mastered: 'Learning',
                                };
                                const nextState = transitionsMap[word.status];
                                handleToggleStatus(word.id, nextState);
                                flashSuccess(`Modified status for "${word.word}" to ${nextState}`);
                              }}
                              className={`px-2.5 py-0.5 border text-[10px] rounded-full uppercase tracking-wider transition-all select-none cursor-pointer ${statusBadgeThemes[word.status]}`}
                              title="Double click or tap to cycle states"
                            >
                              {word.status}
                            </button>
                          </td>
                        </tr>

                        {/* Collapsing Detail view containing CRUD editor blocks */}
                        {isSelected && (
                          <tr key={`${word.id}-detail-collapser`} className="bg-slate-50/40">
                            <td colSpan={4} className="p-4 border-t border-b border-indigo-100/50">
                              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                                
                                <div className="flex justify-between items-center text-[10px] font-mono text-indigo-700 font-extrabold pb-1 border-b border-slate-100">
                                  <span>CURATION LEXICON WELL METADATA</span>
                                  <button 
                                    onClick={() => setActiveWordId(null)}
                                    className="text-slate-400 hover:text-red-700 font-bold text-xs"
                                  >
                                    ✕ Minimize Panel
                                  </button>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[10px] text-slate-450 font-mono font-bold uppercase block">
                                    Current Definition / Explanations:
                                  </span>
                                  <p className="text-slate-800 text-sm select-text leading-relaxed font-semibold">
                                    {word.meaning || "(Empty dictionary explain element. Please add definition below.)"}
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-4 pt-3 text-[10px] font-mono text-slate-500 border-t border-dashed border-slate-200">
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 select-none">
                                    <span>Database node id: <strong className="text-slate-700 font-mono select-all bg-slate-100 px-1 py-0.5 rounded">{word.id}</strong></span>
                                    <span>Grammar: <strong className="text-slate-705 underline">{word.pos}</strong></span>
                                    <span>Level Group: <strong className="text-indigo-650">{word.levelName} ({word.level})</strong></span>
                                  </div>

                                  {/* Inline item editing modifiers */}
                                  <div className="flex items-center gap-2">
                                    {editingWordId === word.id && editField === 'meaning' ? (
                                      <div className="flex flex-col gap-1.5 w-full bg-slate-50 border border-slate-200 p-3 rounded-lg animate-fadeIn select-none">
                                        <label className="text-[10px] font-bold text-slate-600 block">EDIT DEFINITION MEANING:</label>
                                        <textarea
                                          value={tempEditValue}
                                          onChange={(e) => setTempEditValue(e.target.value)}
                                          className="bg-white border border-slate-300 text-xs rounded-lg p-1.5 w-full focus:outline-none focus:border-indigo-500 font-semibold select-text"
                                          rows={2}
                                          autoFocus
                                        />
                                        <div className="flex gap-1.5 justify-end">
                                          <button
                                            onClick={() => {
                                              const updated = { ...word, meaning: tempEditValue };
                                              setVocabulary(prev => prev.map(w => w.id === word.id ? updated : w));
                                              if (session?.user?.id) {
                                                syncSingleWordToCloud(supabase, session.user.id, updated);
                                              }
                                              setEditingWordId(null);
                                              setEditField(null);
                                              flashSuccess(`Definition updated successfully!`);
                                            }}
                                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[10px] transition-all cursor-pointer"
                                          >
                                            Save
                                          </button>
                                          <button
                                            onClick={() => {
                                              setEditingWordId(null);
                                              setEditField(null);
                                            }}
                                            className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-[10px] transition-all cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : editingWordId === word.id && editField === 'spelling' ? (
                                      <div className="flex flex-col gap-1.5 w-full bg-slate-50 border border-slate-200 p-3 rounded-lg animate-fadeIn select-none">
                                        <label className="text-[10px] font-bold text-slate-600 block">RENAME WORD NAME:</label>
                                        <input
                                          type="text"
                                          value={tempEditValue}
                                          onChange={(e) => setTempEditValue(e.target.value)}
                                          className="bg-white border border-slate-300 text-xs rounded-lg p-1.5 w-full focus:outline-none focus:border-indigo-500 font-bold select-text"
                                          autoFocus
                                        />
                                        <div className="flex gap-1.5 justify-end">
                                          <button
                                            onClick={() => {
                                              if (!tempEditValue.trim()) return;
                                              const updated = { ...word, word: tempEditValue.trim() };
                                              setVocabulary(prev => prev.map(w => w.id === word.id ? updated : w));
                                              if (session?.user?.id) {
                                                syncSingleWordToCloud(supabase, session.user.id, updated);
                                              }
                                              setEditingWordId(null);
                                              setEditField(null);
                                              flashSuccess(`Spelling modified to "${tempEditValue.trim()}"!`);
                                            }}
                                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[10px] transition-all cursor-pointer"
                                          >
                                            Rename
                                          </button>
                                          <button
                                            onClick={() => {
                                              setEditingWordId(null);
                                              setEditField(null);
                                            }}
                                            className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-[10px] transition-all cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : editingWordId === word.id && editField === 'delete' ? (
                                      <div className="flex flex-col gap-1.5 w-full bg-red-50/70 border border-red-200 p-3 rounded-md animate-fadeIn text-red-900 select-none">
                                        <span className="text-[10px] font-bold text-red-700 flex items-center gap-1">
                                          ⚠️ Confirm Delete Operation:
                                        </span>
                                        <p className="text-[10.5px] leading-normal font-semibold">
                                          Wipe and remove **"{word.word}"** from local memory?
                                        </p>
                                        <div className="flex gap-1.5 justify-end transition-all mt-1">
                                          <button
                                            onClick={() => {
                                              setVocabulary(prev => prev.filter(w => w.id !== word.id));
                                              if (session?.user?.id) {
                                                deleteSingleWordFromCloud(supabase, session.user.id, word.word, word.level);
                                              }
                                              setActiveWordId(null);
                                              setEditingWordId(null);
                                              setEditField(null);
                                              flashSuccess(`Deleted word entry successfully.`);
                                            }}
                                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-[10px] cursor-pointer"
                                          >
                                            Yes, Delete
                                          </button>
                                          <button
                                            onClick={() => {
                                              setEditingWordId(null);
                                              setEditField(null);
                                            }}
                                            className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-55 text-slate-705 rounded text-[10px] cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => {
                                            setEditingWordId(word.id);
                                            setEditField('meaning');
                                            setTempEditValue(word.meaning || '');
                                          }}
                                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded font-bold transition-colors cursor-pointer"
                                          title="Inline text editor for word meaning"
                                        >
                                          Edit Definition
                                        </button>
                                        
                                        <button
                                          onClick={() => {
                                            setEditingWordId(word.id);
                                            setEditField('spelling');
                                            setTempEditValue(word.word);
                                          }}
                                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded font-bold transition-colors cursor-pointer"
                                          title="Modify the exact literal spelling string"
                                        >
                                          Rename Spelling
                                        </button>

                                        <button
                                          onClick={() => {
                                            setEditingWordId(word.id);
                                            setEditField('delete');
                                          }}
                                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-850 rounded font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                                          title="Remove from localized catalog memory"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                          <span>Delete Row</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* TABLE PAGINATION ACTION STRIP */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 select-none">
            <span className="text-xs font-mono font-bold text-slate-500">
              Matches Found: <strong className="text-indigo-600 text-sm font-sans">{filteredVocabulary.length}</strong> words
            </span>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg select-none cursor-pointer text-slate-705 inline-flex items-center gap-1 hover:shadow-2xs active:scale-95 transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                
                <span className="text-xs font-semibold text-slate-650 font-mono px-2 py-1 bg-white border rounded">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg select-none cursor-pointer text-slate-705 inline-flex items-center gap-1 hover:shadow-2xs active:scale-95 transition-all"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* SPREADSHEET COPY-PASTABLE IMPORTER GRID (TOGGLEABLE PANEL) */}
          <AnimatePresence>
            {showImporter && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-slate-200 bg-[#FCFDFE] shrink-0"
              >
                <div className="p-4 border-b border-indigo-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>EXCEL / SPREADSHEET ROW PARSER DIRECT CSV ENGINE</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleLoadSampleCSV}
                        className="px-2.5 py-1 text-xs font-bold bg-white border border-emerald-200 rounded text-emerald-700 hover:bg-emerald-50 cursor-pointer select-none"
                      >
                        Paste Excel Sample Columns
                      </button>

                      <button
                        onClick={() => setShowImporter(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs font-bold"
                        title="Dismiss Panel View"
                      >
                        ✕ Close
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed font-sans">
                    Instantly import words copy-pasted straight from columns in Microsoft Excel, Google Sheets, or any raw text CSV file. We map: <strong className="text-slate-700 font-mono select-none bg-slate-100 px-1 rounded text-[10px]">Word, Part of Speech, Definition, Status</strong>.
                  </p>

                  <div className="space-y-1.5">
                    <textarea
                      rows={4}
                      className="w-full text-xs font-mono p-2.5 border border-slate-350 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg select-text bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none"
                      placeholder="e.g. paste Excel row grid data or CSV strings here. E.g:
creative,adjective,having good imagination or original ideas,Mastered"
                      value={csvInput}
                      onChange={(e) => setCsvInput(e.target.value)}
                    />
                  </div>

                  {errorMsg && (
                    <div className="p-2.5 bg-rose-50 border border-rose-250 rounded-lg text-rose-700 font-mono text-[11px] font-bold">
                      ⚠ IMPORT WARNING: {errorMsg}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 pt-1.5">
                    <button
                      onClick={() => handleImportCSV(false)}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs select-none transition-all cursor-pointer text-center inline-flex justify-center items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Merge pasted rows into dictionary</span>
                    </button>

                    <button
                      onClick={() => handleImportCSV(true)}
                      className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs rounded-lg shadow-xs select-none transition-all cursor-pointer text-center inline-flex justify-center items-center gap-1.5"
                      title="WARNING: Overwrite everything! Wipes any active listings."
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                      <span>Complete Overwrite Dictionary</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>


      </main>

      {/* --- REUSABLE SYSTEM DIALOG MODEL: ADD WORD WIZARD --- */}
      <AnimatePresence>
        {showAddWordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs select-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xl max-w-lg w-full text-left"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-55 text-indigo-700 flex items-center justify-center font-bold">
                    📝
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Add CEFR Vocabulary Node Wizard
                  </h3>
                </div>
                <button 
                  onClick={() => {
                    setShowAddWordModal(false);
                    setAddValidationError(null);
                  }}
                  className="text-slate-400 hover:text-slate-700 font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Wizard Form Frame */}
              <div className="py-4 space-y-4">
                
                {addValidationError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-bold flex items-center gap-1.5 animate-fadeIn">
                    <span>⚠️</span>
                    <span>{addValidationError}</span>
                  </div>
                )}

                {/* Spelling Word */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block">
                    Word literal spelling:
                  </label>
                  <input
                    type="text"
                    value={newWordSpelling}
                    onChange={(e) => setNewWordSpelling(e.target.value)}
                    placeholder="e.g. sustainable"
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg p-2 text-xs text-slate-800 font-semibold focus:outline-none select-text"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Part Of Speech drop selection */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 text-xs block">
                      Part of Speech:
                    </label>
                    <select
                      value={newWordPos}
                      onChange={(e) => setNewWordPos(e.target.value)}
                      className="w-full select-none rounded-lg border border-slate-300 bg-white p-2 text-xs font-bold text-slate-705 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="noun">noun</option>
                      <option value="verb">verb</option>
                      <option value="adjective">adjective</option>
                      <option value="adverb">adverb</option>
                      <option value="preposition">preposition</option>
                    </select>
                  </div>

                  {/* Level classification drop selection */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 text-xs block">
                      CEFR Category Level:
                    </label>
                    <select
                      value={newWordLevel}
                      onChange={(e) => setNewWordLevel(e.target.value)}
                      className="w-full select-none rounded-lg border border-slate-300 bg-white p-2 text-xs font-bold text-slate-705 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="A1">A1 (Elementary)</option>
                      <option value="A2">A2 (Pre-Intermediate)</option>
                      <option value="B1">B1 (Intermediate)</option>
                      <option value="B2">B2 (Upper Intermediate)</option>
                      <option value="C1">C1 (Advanced)</option>
                      <option value="C2">C2 (Proficiency)</option>
                    </select>
                  </div>
                </div>

                {/* Meaning input text area */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block">
                    Meaning Definition Description:
                  </label>
                  <textarea
                    rows={3}
                    value={newWordMeaning}
                    onChange={(e) => setNewWordMeaning(e.target.value)}
                    placeholder="Describe semantic details, translation keys, examples, and contextual occurrences..."
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg p-2 text-xs text-slate-800 font-semibold focus:outline-none select-text"
                  />
                </div>
              </div>

              {/* Footer CTA */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setShowAddWordModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-650 hover:text-slate-800 font-bold text-xs rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCustomWord}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-sm"
                >
                  Create Word Node
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- NEW INTERACTIVE DIALOG MODAL: SUPABASE SYNC ENGINE --- */}
      <AnimatePresence>
        {showSupabaseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs select-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className={`rounded-xl border p-6 shadow-2xl max-w-md w-full text-left ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-205'}`}
            >
              <SupabaseSyncPanel
                vocabulary={vocabulary}
                setVocabulary={setVocabulary}
                flashSuccess={flashSuccess}
                onClose={() => setShowSupabaseModal(false)}
                session={session}
                isDark={isDark}
                onLogOut={handleLogOut}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- ABOUT EXPLAINER DIALOG MODAL --- */}
      <AnimatePresence>
        {showAboutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs select-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xl max-w-md w-full text-left"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">
                  About CEFR Dataset Compiler
                </h3>
                <button 
                  onClick={() => setShowAboutModal(false)}
                  className="text-slate-400 hover:text-slate-700 font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="py-4 space-y-3 text-xs leading-relaxed text-slate-650">
                <p>
                  VocabCanvas CEFR is designed for ESL development teams, language curriculum designers, and software engineers seeking to curate, compile, and export standard core academic wordlists.
                </p>
                <p>
                  The interactive system allows you to tag words with three active development states: <strong className="text-slate-800">Learning</strong>, <strong className="text-slate-800">Familiar</strong>, and <strong className="text-slate-800">Mastered</strong>.
                </p>
                <p>
                  Any state mutations are written instantly to localized cache and converted into formatted download payloads.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowAboutModal(false)}
                  className="px-5 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- NEW INTERACTIVE MODAL: GITHUB PAGES HOSTING GUIDE --- */}
      <AnimatePresence>
        {showGithubGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs select-none">
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xl max-w-xl w-full text-left font-sans"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                    🚀
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    How to Host VocabCanvas on GitHub Pages
                  </h3>
                </div>
                <button 
                  onClick={() => setShowGithubGuide(false)}
                  className="text-slate-405 hover:text-slate-700 font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="py-4 space-y-3.5 text-xs text-slate-650 max-h-96 overflow-y-auto leading-relaxed">
                
                <p>
                  Since this is a client-side Single Page Application built with React and Vite, you can easily host it for free on <strong className="text-slate-805">GitHub Pages</strong> with these clear, direct instructions:
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <p className="font-bold text-slate-805 text-xs flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-750 flex items-center justify-center text-[10px]">1</span>
                    Build Production static deliverables
                  </p>
                  <p>Run the build script in your terminal to compile the code assets:</p>
                  <code className="block bg-slate-950 text-emerald-400 p-2 rounded font-mono text-[10px] select-all">
                    npm run build
                  </code>
                  <p>This creates a self-contained static directory inside <strong className="text-slate-700 font-mono">/dist</strong>.</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <p className="font-bold text-slate-805 text-xs flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-755 flex items-center justify-center text-[10px]">2</span>
                    Initiate Git repository
                  </p>
                  <p>If you haven't initiated a git repo yet, run these typical command lines:</p>
                  <code className="block bg-slate-950 text-emerald-400 p-2 rounded font-mono text-[10px] select-all leading-normal whitespace-pre">
                    git init{"\n"}
                    git add .{"\n"}
                    git commit -m "feat: host cefr vocabulary dataset compiler"
                  </code>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <p className="font-bold text-slate-805 text-xs flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-755 flex items-center justify-center text-[10px]">3</span>
                    Push to GitHub & Host
                  </p>
                  <p className="mb-1">Create a new public repository on GitHub, map the remote url, and push your main files:</p>
                  <code className="block bg-slate-950 text-emerald-400 p-2 rounded font-mono text-[10px] select-all leading-normal whitespace-pre">
                    git remote add origin https://github.com/your-username/your-repository.git{"\n"}
                    git branch -M main{"\n"}
                    git push -u origin main
                  </code>
                  <p className="text-[10px] text-slate-500 pt-1 leading-normal">
                    Then in GitHub settings: Nav to <strong className="text-slate-700">Settings → Pages</strong>, select "GitHub Actions" or choose deploy branch as your main/master folder, and configure it to run index.html. Your application goes live instantly!
                  </p>
                </div>

              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-100 flex-wrap">
                <span className="text-[10px] text-slate-400 font-mono font-bold">Deployable Codebase Ready</span>
                <button
                  onClick={() => setShowGithubGuide(false)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow-sm transition-all text-center"
                >
                  Understood
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- ACCENTS TO CONSOLE --- */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-slate-900 border border-slate-800 text-white rounded-xl shadow-2xl flex items-center gap-2.5 text-xs"
          >
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
