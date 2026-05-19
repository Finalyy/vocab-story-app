"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  UploadCloud, BookOpen, Volume2, Info, Loader2, Sparkles, FileText, 
  Image as ImageIcon, CheckCircle, AlertCircle, RefreshCw,
  BookMarked, Tags, Library, Printer, Trash2, X
} from "lucide-react";

// --- CÁC INTERFACES DỮ LIỆU ---
interface StoryScene { text: string; image_prompt: string; image_url?: string; image_loading?: boolean; }
interface SavedStory { id: string; date: string; title: string; scenes: StoryScene[]; }
interface WordData { word: string; pos?: string; ipa?: string; meaning?: string; en_meaning?: string; example?: string; word_family?: string; synonyms?: string; antonyms?: string; collocations?: string; confusions?: string; }

const HighlightedText = ({ text, targets, onWordClick }: { text: string, targets: string[], onWordClick: (w: string) => void }) => {
  if (!targets || targets.length === 0) return <>{text}</>;
  const parts = useMemo(() => {
    const sortedTargets = [...targets].sort((a, b) => b.length - a.length);
    const escapedTargets = sortedTargets.map(t => t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const pattern = new RegExp(`(^|[^a-zA-Z0-9])(${escapedTargets.join('|')})(?=[^a-zA-Z0-9]|$)`, 'gi');
    return text.split(pattern);
  }, [text, targets]);

  return (
    <>
      {parts.map((part, index) => {
        if (part === undefined) return null;
        const isMatch = targets.some(t => t.toLowerCase() === part.toLowerCase());
        if (isMatch) {
          return (
            <span key={index} onClick={() => onWordClick(part)} className="inline-block bg-[#FDF0D5] text-[#804D0E] font-bold px-1.5 py-0.5 rounded mx-0.5 cursor-pointer hover:bg-[#FCE1AB] border-b-[3px] border-[#DDA343] transition relative group print:border-b-0 print:bg-transparent print:text-black print:p-0 print:mx-0">
              {part}
              <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[11px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-20 print:hidden font-sans font-normal tracking-wide shadow-lg">Tra từ điển</span>
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
};

const ComicScene = ({ scene, index, targets, onWordClick }: { scene: StoryScene, index: number, targets: string[], onWordClick: (w: string) => void }) => {
  return (
    <div className="page-break flex flex-col items-center mb-16 animate-in slide-in-from-bottom-4 duration-500">
      <div className="w-full max-w-2xl bg-white p-3 pb-6 border-[3px] border-slate-900 rounded-sm shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] mb-8 flex flex-col relative transform transition hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(15,23,42,1)] duration-300">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-1 font-black uppercase tracking-widest text-sm border-2 border-white shadow-sm z-10">Cảnh {index + 1}</div>
        <div className="w-full aspect-[4/3] bg-slate-100 border-2 border-slate-900 overflow-hidden relative mt-2">
          {scene.image_loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 no-print"><Loader2 size={36} className="animate-spin text-indigo-500 mb-3" /><span className="text-xs font-bold text-slate-500 tracking-wider uppercase">Đang vẽ phác thảo...</span></div>
          ) : scene.image_url ? (
              <img src={scene.image_url} alt={`Scene ${index+1}`} className="w-full h-full object-cover filter contrast-105 saturate-105 transition-all duration-700 ease-in-out hover:scale-105" />
          ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 bg-slate-50 no-print"><ImageIcon size={40} className="opacity-40" /></div>
          )}
        </div>
      </div>
      <div className="prose prose-lg w-full max-w-2xl px-4 text-justify md:text-xl font-medium text-slate-800 leading-relaxed tracking-wide">
        <p className="indent-8"><HighlightedText text={scene.text} targets={targets} onWordClick={onWordClick} /></p>
      </div>
    </div>
  );
};

const DictionaryModal = ({ wordData, loading, onClose, onSpeak }: { wordData: WordData, loading: boolean, onClose: () => void, onSpeak: (w: string) => void }) => {
  const DictRow = ({ label, value }: { label: string, value?: string }) => {
    if (!value) return null;
    return (
      <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 border-b border-slate-700/30 pb-3 last:border-0 last:pb-0">
        <span className="font-bold text-indigo-300 sm:w-40 shrink-0">- {label}:</span><span className="text-slate-100">{value}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print" onClick={onClose}>
      <div className="bg-[#2B3245] rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col md:flex-row text-slate-100 border border-slate-600" onClick={e => e.stopPropagation()}>
        <div className="md:w-1/3 bg-[#242A38] p-6 md:p-8 flex flex-col items-start border-b md:border-b-0 md:border-r border-slate-700 relative">
          <button onClick={onClose} className="absolute top-4 left-4 md:hidden text-slate-400 hover:text-white"><X size={20}/></button>
          <h3 className="text-3xl font-bold text-white mb-3 mt-4 md:mt-0 tracking-wide capitalize">{wordData.word}</h3>
          {wordData.ipa && (
            <p className="text-lg text-slate-300 font-medium mb-2 flex items-center gap-3">( {wordData.ipa} )
              <button onClick={() => onSpeak(wordData.word)} className="p-1.5 bg-slate-700/50 rounded-full hover:bg-indigo-500 transition text-indigo-300 hover:text-white" title="Phát âm"><Volume2 size={16}/></button>
            </p>
          )}
          {wordData.pos && <p className="text-md text-slate-400 font-medium tracking-wider">({wordData.pos})</p>}
          {loading && <div className="mt-8 flex items-center gap-2 text-indigo-400 text-sm bg-indigo-900/20 px-3 py-2 rounded-lg"><Loader2 size={16} className="animate-spin" /> Đang trích xuất tài liệu...</div>}
        </div>
        <div className="md:w-2/3 p-6 md:p-8 space-y-4 max-h-[70vh] overflow-y-auto text-[15px] leading-relaxed relative bg-[#2B3245] custom-scrollbar-dark">
          <button onClick={onClose} className="absolute top-4 right-4 hidden md:block text-slate-400 hover:text-white transition"><X size={24}/></button>
          {!loading && (
            <div className="space-y-4 pt-2">
              <DictRow label="VN" value={wordData.meaning} /><DictRow label="EN" value={wordData.en_meaning} /><DictRow label="Example" value={wordData.example} /><DictRow label="Họ từ" value={wordData.word_family} /><DictRow label="Đồng nghĩa" value={wordData.synonyms} /><DictRow label="Trái nghĩa" value={wordData.antonyms} /><DictRow label="Cụm thường gặp" value={wordData.collocations} /><DictRow label="Dễ nhầm lẫn" value={wordData.confusions} />
              {!wordData.meaning && !wordData.synonyms && !wordData.word_family && (
                <div className="text-slate-400 italic flex items-center gap-2"><Info size={16} /> Tài liệu gốc không cung cấp dữ liệu phân tích cho từ này.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"create" | "library">("create");
  const [inputText, setInputText] = useState("");
  const [scenes, setScenes] = useState<StoryScene[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedStories, setSavedStories] = useState<SavedStory[]>([]);
  const [selectedWord, setSelectedWord] = useState<WordData | null>(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Động URL kết nối Backend
const getBackendUrl = () => {
  // Ưu tiên dùng đường link đã cấu hình trên Vercel
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
};
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("vocabStoriesLibrary");
    if (stored) { try { setSavedStories(JSON.parse(stored)); } catch (e) {} }
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem("vocabStoriesLibrary", JSON.stringify(savedStories));
  }, [savedStories, mounted]);

  const processUploadedFile = async (file: File) => {
    setFileLoading(true); setUploadStatus({ type: "info", message: `Đang dùng siêu tốc độ quét tài liệu "${file.name}"...` });
    const formData = new FormData(); formData.append("file", file);
    try {
      const response = await fetch(`${getBackendUrl()}/extract-vocab`, { method: "POST", body: formData });
      if (response.ok) {
        const data = await response.json();
        if (data.extracted_words?.length > 0) {
          setInputText(data.extracted_words.join(", "));
          setUploadStatus({ type: "success", message: `Thành công chớp nhoáng! Đã lấy ${data.extracted_words.length} từ vựng.` });
        } else { setUploadStatus({ type: "error", message: "Không tìm thấy từ vựng." }); }
      } else { throw new Error("Máy chủ xử lý file thất bại."); }
    } catch (error: any) { setUploadStatus({ type: "error", message: `Lỗi: ${error.message}` }); } 
    finally { setFileLoading(false); }
  };

  const handleDrag = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(e.type === "dragenter" || e.type === "dragover"); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); if (e.dataTransfer.files?.[0]) processUploadedFile(e.dataTransfer.files[0]); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) processUploadedFile(e.target.files[0]); };

  const handleGenerateStory = async () => {
    if (!inputText.trim()) return;
    setLoading(true); setScenes(null); setErrorMsg(null);
    const vocabList = inputText.split(",").map(w => w.trim()).filter(w => w);

    try {
      const response = await fetch(`${getBackendUrl()}/generate-story`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vocabularies: vocabList, source_language: "Vietnamese", target_language: "English" }),
      });

      if (response.ok) {
        const data = await response.json();
        const initialScenes = data.scenes.map((s: any) => ({ ...s, image_loading: true }));
        setScenes(initialScenes);
        initialScenes.forEach((scene: StoryScene, index: number) => fetchImageForScene(scene.image_prompt, index));
      } else { setErrorMsg("Lỗi Server. Trả về định dạng không mong muốn."); }
    } catch (error) { setErrorMsg("Không kết nối được Backend. Hãy mở file backend/main.py lên chạy nhé."); } 
    finally { setLoading(false); }
  };

  const fetchImageForScene = async (prompt: string, index: number) => {
    try {
      const response = await fetch(`${getBackendUrl()}/generate-image`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (response.ok) {
        const data = await response.json();
        setScenes(prev => prev ? prev.map((s, i) => i === index ? { ...s, image_url: data.image_url, image_loading: false } : s) : prev);
      }
    } catch (err) {
      setScenes(prev => prev ? prev.map((s, i) => i === index ? { ...s, image_loading: false } : s) : prev);
    }
  };

  const handleWordClick = async (word: string) => {
    const cleanWord = word.trim().toLowerCase();
    setDictLoading(true); setSelectedWord({ word: cleanWord });
    try {
      const response = await fetch(`${getBackendUrl()}/dictionary/${cleanWord}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedWord({ ...data, word: cleanWord });
      }
    } catch (err) { console.error("Lỗi tra từ", err); } 
    finally { setDictLoading(false); }
  };

  const speakWord = (text: string) => window.speechSynthesis?.speak(new SpeechSynthesisUtterance(text));
  const getVocabChips = () => inputText.split(",").map(w => w.trim()).filter(w => w.length > 0);
  
  const saveCurrentStory = () => {
    if (!scenes) return;
    const newStory = { id: Date.now().toString(), date: new Date().toLocaleString('vi-VN'), title: `Truyện: ${getVocabChips()?.slice(0, 3).join(", ")}...`, scenes };
    setSavedStories([newStory, ...savedStories]);
    alert("Đã lưu vào Thư viện!");
  };

  if (!mounted) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;
  const chips = getVocabChips();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20 selection:bg-indigo-200 selection:text-indigo-900">
      <style dangerouslySetInnerHTML={{__html: `
        @media print { .no-print { display: none !important; } body { background: white; } .print-full-width { grid-column: span 12 / span 12 !important; box-shadow: none !important; border: none !important; } .page-break { page-break-inside: avoid; margin-bottom: 2rem; } }
        .custom-scrollbar-dark::-webkit-scrollbar { width: 6px; } .custom-scrollbar-dark::-webkit-scrollbar-track { background: #1E2532; border-radius: 10px; } .custom-scrollbar-dark::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; }
      `}} />

      <header className="bg-white shadow-sm border-b border-slate-200 py-4 px-6 sticky top-0 z-10 no-print">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600">
            <BookMarked size={28} className="stroke-[2.5]" />
            <h1 className="text-2xl font-bold tracking-tight">VocabStory AI</h1>
          </div>
          <div className="flex bg-slate-100 p-1.5 rounded-full border border-slate-200">
            <button onClick={() => setActiveTab("create")} className={`px-5 py-1.5 rounded-full text-sm font-semibold transition ${activeTab === "create" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Tạo Truyện</button>
            <button onClick={() => setActiveTab("library")} className={`px-5 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 transition ${activeTab === "library" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><Library size={16} /> Thư Viện</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-8 grid md:grid-cols-12 gap-8">
        {activeTab === "create" && (
          <>
            <div className="md:col-span-5 space-y-6 no-print">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-semibold mb-5 flex items-center gap-2 text-slate-800"><UploadCloud size={20} className="text-indigo-500"/>1. Nạp Tài Liệu</h2>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" className="hidden" />
                <div onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer mb-5 ${dragActive ? "border-indigo-500 bg-indigo-50/50" : "border-slate-300 hover:bg-slate-50 hover:border-indigo-400"}`}>
                  {fileLoading ? (
                    <div className="flex flex-col items-center py-4"><Loader2 className="animate-spin text-indigo-600 mb-3" size={32} /><p className="text-sm font-semibold text-indigo-700">Đang quét siêu tốc...</p></div>
                  ) : (
                    <><div className="flex justify-center gap-4 mb-3 text-slate-400"><FileText size={32} /><ImageIcon size={32} /></div><p className="text-sm text-slate-600 font-medium">Click / Thả tài liệu 16 trang vào đây</p></>
                  )}
                </div>
                {uploadStatus && (
                  <div className={`p-3 rounded-lg flex items-start gap-2 text-sm mb-5 ${uploadStatus.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : uploadStatus.type === "error" ? "bg-rose-50 text-rose-800 border border-rose-100" : "bg-blue-50 text-blue-800 border border-blue-100"}`}>
                    {uploadStatus.type === "success" ? <CheckCircle size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
                    <span className="font-medium">{uploadStatus.message}</span>
                  </div>
                )}
                {chips && chips.length > 0 && (
                  <div className="mb-5">
                    <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1 mb-2"><Tags size={14} /> Từ vựng đã nạp ({chips.length})</span>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto bg-slate-50 p-3 rounded-xl border border-slate-200">
                      {chips.map((word, idx) => <span key={idx} onClick={() => handleWordClick(word)} className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-bold border border-indigo-100 hover:bg-indigo-100 cursor-pointer shadow-sm">{word}</span>)}
                    </div>
                  </div>
                )}
                <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700" rows={4} placeholder="Sửa/thêm từ vựng..." value={inputText} onChange={(e) => setInputText(e.target.value)}></textarea>
                <button onClick={handleGenerateStory} disabled={loading || !inputText} className="w-full mt-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-lg shadow-indigo-200">
                  {loading ? <Loader2 size={22} className="animate-spin" /> : <Sparkles size={22} />}
                  {loading ? "AI Đang Dệt Truyện..." : "Sáng Tác Truyện Chêm"}
                </button>
              </div>
            </div>

            <div className="md:col-span-7 print-full-width">
              <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 min-h-[520px] flex flex-col relative">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100 no-print">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800"><BookOpen size={24} className="text-indigo-500"/>Câu Chuyện Của Bạn</h2>
                  {scenes && (
                    <div className="flex gap-2">
                       <button onClick={saveCurrentStory} className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-bold hover:bg-emerald-100 transition flex items-center gap-1.5"><BookMarked size={16} /> Lưu</button>
                       <button onClick={() => window.print()} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition flex items-center gap-1.5"><Printer size={16} /> Xuất PDF</button>
                    </div>
                  )}
                </div>
                {!scenes && !loading && !errorMsg && <div className="flex-1 flex flex-col items-center justify-center text-slate-400 no-print"><Sparkles size={56} className="mb-4 opacity-40" /><p className="font-medium">Nhấn Tạo Truyện để xem điều kỳ diệu!</p></div>}
                {loading && <div className="flex-1 flex flex-col items-center justify-center text-indigo-500 no-print"><Loader2 size={48} className="animate-spin mb-4" /><p className="animate-pulse font-bold text-lg text-slate-600">Gemini đang đạo diễn cốt truyện...</p></div>}
                {errorMsg && !loading && <div className="flex-1 flex flex-col items-center justify-center text-center no-print"><AlertCircle size={48} className="text-rose-500 mb-3" /><p className="text-sm font-medium text-rose-700 bg-rose-50 p-4 rounded-xl">{errorMsg}</p></div>}
                {scenes && !loading && <div className="space-y-4">{scenes.map((scene, idx) => <ComicScene key={idx} scene={scene} index={idx} targets={chips} onWordClick={handleWordClick} />)}</div>}
              </div>
            </div>
          </>
        )}

        {activeTab === "library" && (
          <div className="md:col-span-12 animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 min-h-[500px]">
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-slate-800"><Library className="text-indigo-500"/> Thư Viện Truyện Tranh</h2>
              {savedStories.length === 0 ? (
                <div className="text-center py-24 text-slate-400"><BookOpen size={64} className="mx-auto mb-4 opacity-30" /><p className="text-lg font-medium">Bạn chưa lưu tác phẩm nào.</p></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {savedStories.map((story) => (
                    <div key={story.id} className="border-2 border-slate-800 rounded-xl p-5 shadow-[4px_4px_0px_0px_rgba(30,41,59,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(30,41,59,1)] transition-all bg-white flex flex-col">
                       <div className="w-full aspect-video bg-slate-200 border-2 border-slate-800 rounded-lg mb-4 overflow-hidden">
                         {story.scenes[0]?.image_url ? <img src={story.scenes[0].image_url} className="w-full h-full object-cover filter contrast-105" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon size={32}/></div>}
                       </div>
                       <h3 className="font-black text-slate-800 text-lg mb-1 leading-snug line-clamp-2">{story.title}</h3>
                       <p className="text-xs text-slate-500 mb-5 font-bold uppercase tracking-wider">{story.date} • {story.scenes.length} Cảnh</p>
                       <div className="mt-auto flex gap-3">
                         <button onClick={() => { setScenes(story.scenes); setActiveTab("create"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex-1 bg-slate-800 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-slate-700 transition">Đọc Lại</button>
                         <button onClick={() => { if(confirm("Xóa truyện này?")) setSavedStories(savedStories.filter(s => s.id !== story.id)); }} className="px-4 bg-rose-50 text-rose-600 rounded-lg font-bold border border-rose-200 hover:bg-rose-100 transition"><Trash2 size={18}/></button>
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {selectedWord && <DictionaryModal wordData={selectedWord} loading={dictLoading} onClose={() => setSelectedWord(null)} onSpeak={speakWord} />}
    </div>
  );
}