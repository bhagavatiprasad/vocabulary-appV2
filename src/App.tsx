/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
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
  FileCode,
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
  ExternalLink
} from 'lucide-react';
import { defaultVocabulary, cefrLevels } from './data/defaultVocabulary';
import { parseVocabularyCSV } from './utils/csvParser';
import { VocabularyWord } from './types';
import SupabaseSyncPanel from './components/SupabaseSyncPanel';

export default function App() {
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
    return defaultVocabulary;
  });

  // UI Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedPos, setSelectedPos] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Interactive CSV Exporter States
  const [exportFormat, setExportFormat] = useState<'FLAT' | 'GROUPED' | 'MAP'>('FLAT');
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

  // Modern Theme visibility toggle states
  const [showJsonPanel, setShowJsonPanel] = useState(true);
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

  // Save vocabulary to local storage on modification
  useEffect(() => {
    localStorage.setItem('user_vocabulary', JSON.stringify(vocabulary));
  }, [vocabulary]);

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
        return { ...word, status: newStatus };
      }
      return word;
    }));
  };

  // Clean wipe storage resets
  const handleResetToDefault = () => {
    if (window.confirm("Verify resets: Clear custom words and restore original CEFR dataset standards?")) {
      setVocabulary(defaultVocabulary);
      localStorage.removeItem('user_vocabulary');
      flashSuccess("Restored original CEFR dataset corpus.");
      setCurrentPage(1);
      setActiveWordId(null);
    }
  };

  // Word node submit instantiation
  const handleCreateCustomWord = () => {
    if (!newWordSpelling.trim()) {
      alert("Spelling word field cannot be left empty.");
      return;
    }

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
      status: 'Learning',
      level: newWordLevel as any,
      levelName: levelNameMap[newWordLevel] || 'Elementary'
    };

    setVocabulary(prev => [newWordItem, ...prev]);
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

  // Formatted preview format builders
  const structuredJSON = useMemo(() => {
    if (exportFormat === 'FLAT') {
      return JSON.stringify(filteredVocabulary, null, 2);
    } else if (exportFormat === 'GROUPED') {
      const grouped: Record<string, Omit<VocabularyWord, 'level' | 'levelName'>[]> = {};
      filteredVocabulary.forEach(item => {
        const lvl = item.level;
        if (!grouped[lvl]) grouped[lvl] = [];
        grouped[lvl].push({
          id: item.id,
          word: item.word,
          pos: item.pos,
          meaning: item.meaning,
          status: item.status
        });
      });
      return JSON.stringify(grouped, null, 2);
    } else {
      const map: Record<string, { pos: string; meaning: string; level: string; status: string }> = {};
      filteredVocabulary.forEach(item => {
        map[item.word] = {
          pos: item.pos,
          meaning: item.meaning,
          level: item.level,
          status: item.status
        };
      });
      return JSON.stringify(map, null, 2);
    }
  }, [filteredVocabulary, exportFormat]);

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(structuredJSON).then(() => {
      flashSuccess("Copied JSON structured dataset export!");
    }).catch(err => console.error(err));
  };

  const handleDownloadJSON = () => {
    try {
      const blob = new Blob([structuredJSON], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cefr_vocabulary_${exportFormat.toLowerCase()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      flashSuccess("JSON Download generated successfully!");
    } catch (err) {
      console.error(err);
    }
  };

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased">
      
      {/* GLOBAL HEADER BAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Brand Logo & Badging titles */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-md animate-pulse">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  VocabCanvas CEFR
                </h1>
                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-wide">
                  Dataset Curation Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Professional corpus editor with live structured export capabilities
              </p>
            </div>
          </div>

          {/* Core Panel action triggers */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Live side JSON visibility trigger */}
            <button
              onClick={() => {
                setShowJsonPanel(!showJsonPanel);
                flashSuccess(showJsonPanel ? "Disabled structured JSON sidebar" : "Enabled structured JSON sidebar view.");
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 border transition-all cursor-pointer ${
                showJsonPanel 
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-inner' 
                  : 'bg-white text-slate-705 hover:bg-slate-50 border-slate-200'
              }`}
              title="Toggle Live exportable JSON pane view on right hand side"
            >
              <FileCode className="w-4 h-4" />
              <span>{showJsonPanel ? "Live JSON Panel On" : "JSON Panel Hidden"}</span>
            </button>

            {/* Supabase Cloud Sync Action Trigger */}
            <button
              onClick={() => {
                setShowSupabaseModal(true);
                flashSuccess("Opened Cloud Sync dashboard.");
              }}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-indigo-200 transition-all cursor-pointer shadow-3xs"
              title="Synchronize, backup, or load your vocabulary cards with Supabase Postgres"
            >
              <Database className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Supabase Sync</span>
            </button>

            {/* Excel Row Importer visibility trigger */}
            <button
              onClick={() => {
                setShowImporter(!showImporter);
                flashSuccess(showImporter ? "Spreadsheet row importer panel shut" : "Excel spreadsheet copy/paste importer panel active.");
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 border transition-all cursor-pointer ${
                showImporter 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-inner hover:bg-emerald-100' 
                  : 'bg-white text-slate-705 hover:bg-slate-50 border-slate-200'
              }`}
              title="Toggle Pasteable Spreadsheet rows panel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{showImporter ? "Row Importer Active" : "Show CSV Importer"}</span>
            </button>

            <div className="h-6 w-px bg-slate-200" />

            {/* Add Custom Vocabulary item trigger */}
            <button
              onClick={() => setShowAddWordModal(true)}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Word Wizard</span>
            </button>

            {/* Custom GitHub Hosting Info trigger */}
            <button
              onClick={() => setShowGithubGuide(true)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="Display information on how to build and host this on your custom GitHub Pages"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
              <span>GitHub Hosting Guide</span>
            </button>
          </div>
        </div>
      </header>

      {/* SYSTEM META METRIC PROGRESS MONITORING BLOCK */}
      <section className="bg-slate-100/80 border-b border-slate-200 py-3 px-4 shadow-3xs select-none">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span className="text-xs text-slate-500 font-bold tracking-wide uppercase font-mono">
              CURATION ACTIVE
            </span>
            <span className="text-xs text-slate-400 font-medium">•</span>
            <span className="text-xs font-semibold text-slate-650 bg-white border px-1.5 py-0.5 rounded-sm">
              UTF-8 Live Cache
            </span>
          </div>

          <div className="text-xs text-slate-600 font-medium flex items-center gap-2">
            <span className="font-mono text-[11px] text-slate-400">Mastered Progress:</span>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${stats.masteredPercentage}%` }} 
              />
            </div>
            <span className="font-mono text-[11px] font-bold text-emerald-600 shrink-0">
              {stats.masteredPercentage}% ({stats.mastered} words)
            </span>
          </div>

          <div className="text-xs text-slate-600 font-medium flex items-center gap-2">
            <span className="font-mono text-[11px] text-slate-400">Learning Active:</span>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-amber-450 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${stats.learningPercentage}%` }} 
              />
            </div>
            <span className="font-mono text-[11px] font-bold text-amber-600 shrink-0">
              {stats.learningPercentage}% ({stats.learning} words)
            </span>
          </div>

          <div className="flex justify-end gap-2.5">
            <button
              onClick={() => setShowAboutModal(true)}
              className="text-xs text-indigo-650 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" />
              <span>About Corpus</span>
            </button>
            <button
              onClick={handleResetToDefault}
              className="text-xs text-slate-500 hover:text-red-650 font-semibold inline-flex items-center gap-1 cursor-pointer"
              title="Wipe custom entries and reload initial CEFR corpus dictionary values"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Template</span>
            </button>
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
                      <>
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
                                    <button
                                      onClick={() => {
                                        const editPrompt = window.prompt(`Update dictionary meaning for "${word.word}":`, word.meaning);
                                        if (editPrompt !== null) {
                                          setVocabulary(prev => prev.map(w => w.id === word.id ? { ...w, meaning: editPrompt } : w));
                                          flashSuccess(`Definition updated successfully!`);
                                        }
                                      }}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded font-bold transition-colors"
                                      title="Inline text editor for word meaning"
                                    >
                                      Edit Definition
                                    </button>
                                    
                                    <button
                                      onClick={() => {
                                        const spellingPrompt = window.prompt(`Rename spelling name for "${word.word}":`, word.word);
                                        if (spellingPrompt !== null && spellingPrompt.trim()) {
                                          setVocabulary(prev => prev.map(w => w.id === word.id ? { ...w, word: spellingPrompt.trim() } : w));
                                          flashSuccess(`Spelling modified to "${spellingPrompt.trim()}"!`);
                                        }
                                      }}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded font-bold transition-colors"
                                      title="Modify the exact literal spelling string"
                                    >
                                      Rename Spelling
                                    </button>

                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Verify delete: Remove "${word.word}" from vocabulary library?`)) {
                                          setVocabulary(prev => prev.filter(w => w.id !== word.id));
                                          setActiveWordId(null);
                                          flashSuccess(`Deleted word entry successfully.`);
                                        }
                                      }}
                                      className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 rounded font-bold transition-colors inline-flex items-center gap-1"
                                      title="Remove from localized catalog memory"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Delete Row</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
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

        {/* REUSABLE STRUCTURED LIVE EXPORT PANEL (TOGGLEABLE) */}
        <AnimatePresence>
          {showJsonPanel && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="w-full lg:w-85 border border-slate-200 rounded-xl overflow-hidden bg-slate-900 text-slate-200 flex flex-col shadow-xs"
            >
              
              {/* Output Header */}
              <div className="p-3 bg-slate-950 flex items-center justify-between border-b border-slate-850 shrink-0">
                <span className="text-[11px] font-bold font-mono tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span>STRUCTURED DATAPOOL OUT</span>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopyJSON}
                    className="text-[9px] font-mono font-bold bg-slate-800 text-slate-300 hover:text-white px-2 py-0.5 rounded border border-slate-750 transition-colors cursor-pointer"
                  >
                    Copy Output
                  </button>
                  <button
                    onClick={handleDownloadJSON}
                    className="text-[9px] font-mono font-bold bg-indigo-900 text-indigo-200 hover:text-white px-2 py-0.5 rounded border border-indigo-850 transition-colors cursor-pointer"
                    title="Export JSON payload"
                  >
                    Save.json
                  </button>
                </div>
              </div>

              {/* Schema variations picker */}
              <div className="p-3 bg-slate-900/60 border-b border-slate-950 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
                <span className="font-mono">JSON Mapping Schema:</span>
                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                  {(['FLAT', 'GROUPED', 'MAP'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setExportFormat(f)}
                      className={`px-2 py-0.5 text-[9px] rounded-md font-bold cursor-pointer transition-all ${
                        exportFormat === f 
                          ? 'bg-indigo-600 text-white shadow-xs' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live JSON Preview Box Workspace */}
              <div className="flex-grow overflow-auto p-4 font-mono text-[10px] leading-relaxed bg-slate-950/95 scrollbar-thin select-text selection:bg-indigo-900 selection:text-white">
                <pre className="text-emerald-400 font-mono whitespace-pre-wrap select-all">
                  <code>{structuredJSON}</code>
                </pre>
              </div>

              {/* Visual active schema Blueprint guide */}
              <div className="p-3.5 bg-slate-950 border-t border-slate-850">
                <span className="text-[9px] font-bold text-slate-500 tracking-wider block uppercase mb-1.5">
                  Blueprinted Output Model
                </span>
                <div className="p-2.5 bg-slate-900 rounded-lg text-[9px] text-slate-300 font-mono border border-slate-800">
                  {exportFormat === 'FLAT' && (
                    <pre className="overflow-x-auto select-none leading-relaxed text-indigo-300">{`[\n  {\n    "id": "string",\n    "word": "string",\n    "pos": "verb|noun...",\n    "meaning": "string",\n    "status": "Learning" | "Mastered"\n  }\n]`}</pre>
                  )}
                  {exportFormat === 'GROUPED' && (
                    <pre className="overflow-x-auto select-none leading-relaxed text-emerald-300">{`{\n  "A1": [\n    { "id", "word", "pos", "meaning", "status" }\n  ],\n  "B1": [ ... ]\n}`}</pre>
                  )}
                  {exportFormat === 'MAP' && (
                    <pre className="overflow-x-auto select-none leading-relaxed text-pink-300">{`{\n  "[word_spelling]": {\n    "pos": "string",\n    "meaning": "string",\n    "level": "A1" | "B2",\n    "status": "string"\n  }\n}`}</pre>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
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
                  onClick={() => setShowAddWordModal(false)}
                  className="text-slate-400 hover:text-slate-700 font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Wizard Form Frame */}
              <div className="py-4 space-y-4">
                
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs select-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xl max-w-md w-full text-left"
            >
              <SupabaseSyncPanel
                vocabulary={vocabulary}
                setVocabulary={setVocabulary}
                flashSuccess={flashSuccess}
                onClose={() => setShowSupabaseModal(false)}
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
