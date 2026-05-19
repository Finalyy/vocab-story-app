"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  BookOpen, Volume2, Info, Loader2, Sparkles,
  Image as ImageIcon, AlertCircle, CheckCircle, BookMarked, Tags,
  Library, Printer, Trash2, X, Save
} from "lucide-react";
import ToastProvider from "./components/providers/ToastProvider";
import FileUploader from "./components/upload/FileUploader";
import WordList from "./components/dictionary/WordList";

interface StoryScene { text: string; image_prompt: string; image_url?: string; image_loading?: boolean; }
interface SavedStory { id: string; date: string; title: string; scenes: StoryScene[]; }

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
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 no-print"><Loader2 size={36} className="animate-spin text-indigo-500 mb-3" /><span className="text-xs font-bold text-slate-500 tracking-wider uppercase">Đang vẽ...</span></div>
          ) : scene.image_url ? (
            <img 
              src={scene.image_url} 
              alt={`Scene ${index + 1}`} 
              onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1513001900722-370f803f498d?w=800"; }} 
              className="w-full h-full object-cover filter contrast-105 saturate-105 transition-all duration-700 ease-in-out hover:scale-105" 
            />
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

export default function Page() {
  const [activeTab, setActiveTab] = useState<"create" | "library">("create");
  const [inputText, setInputText] = useState("");
  const [scenes, setScenes] = useState<StoryScene[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedStories, setSavedStories] = useState<SavedStory[]>([]);
  const [mounted, setMounted] = useState(false);

  const BACKEND_URL = "https://vocab-story-app-1.onrender.com/api/v1";

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("vocabStoriesLibrary");
    if (stored) { try { setSavedStories(JSON.parse(stored)); } catch (e) { } }
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem("vocabStoriesLibrary", JSON.stringify(savedStories));
  }, [savedStories, mounted]);

  const handleUploadSuccess = (words: string[]) => {
    setInputText(words.join(", "));
  };

  const handleGenerateStory = async () => {
    if (!inputText.trim()) return;
    setLoading(true); setScenes(null); setErrorMsg(null);
    const vocabList = inputText.split(",").map(w => w.trim()).filter(w => w);

    try {
      const response = await fetch(`${BACKEND_URL}/generate-story`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vocabularies: vocabList }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.scenes && data.scenes[0] && data.scenes[0].text.includes("Lỗi Server")) {
            setErrorMsg(data.scenes[0].text);
            return;
        }

        const initialScenes = data.scenes.map((s: any) => ({ ...s, image_loading: true }));
        setScenes(initialScenes);
        
        initialScenes.forEach((scene: StoryScene, index: number) => {
            // Rút gọn prompt và thêm mã ngẫu nhiên để tránh nghẽn mạng vẽ ảnh
            const cleanPrompt = scene.image_prompt.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 100);
            const seed = Math.floor(Math.random() * 10000);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt + " western comic")}?width=800&height=600&nologo=true&seed=${seed}`;
            
            setTimeout(() => {
                setScenes(prev => prev ? prev.map((s, i) => i === index ? { ...s, image_url: imageUrl, image_loading: false } : s) : prev);
            }, 1800 * (index + 1)); // Giãn thời gian load ảnh ra một chút cho an toàn
        });

      } else { setErrorMsg("AI trả về sai định dạng. Vui lòng thử lại!"); }
    } catch (error) { setErrorMsg("Không kết nối được Backend. Hãy đảm bảo Server đang mở."); }
    finally { setLoading(false); }
  };

  const handleWordClick = (word: string) => { console.log("Tra từ: ", word); };
  const getVocabChips = () => {
    if (!inputText || typeof inputText !== "string") return [];
    return inputText.split(",").map(w => w.trim()).filter(w => w.length > 0);
  };

  const saveCurrentStory = () => {
    if (!scenes) return;
    const newStory = { id: Date.now().toString(), date: new Date().toLocaleString('vi-VN'), title: `Truyện: ${getVocabChips()?.slice(0, 3).join(", ")}...`, scenes };
    setSavedStories([newStory, ...savedStories]);
    alert("Đã lưu tác phẩm vào Thư Viện!");
  };

  if (!mounted) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;
  const chips = getVocabChips();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20 selection:bg-indigo-200 selection:text-indigo-900">
      <ToastProvider />
      <style dangerouslySetInnerHTML={{
        __html: `
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
                <h2 className="text-lg font-semibold mb-5 flex items-center gap-2 text-slate-800">1. Nạp Tài Liệu</h2>
                
                <FileUploader onUploadSuccess={handleUploadSuccess} setExternalLoading={setFileLoading} setExternalStatus={setUploadStatus} />

                {uploadStatus && (
                  <div className={`p-3 rounded-lg flex items-start gap-2 text-sm mb-5 ${uploadStatus.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : uploadStatus.type === "error" ? "bg-rose-50 text-rose-800 border border-rose-100" : "bg-blue-50 text-blue-800 border border-blue-100"}`}>
                    {uploadStatus.type === "success" ? <CheckCircle size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
                    <span className="font-medium">{uploadStatus.message}</span>
                  </div>
                )}

                {chips && Array.isArray(chips) && chips.length > 0 && (
                  <div className="mb-5">
                    <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1 mb-2"><Tags size={14} /> Từ vựng đã nạp ({chips.length})</span>
                    <WordList words={chips} onWordClick={handleWordClick} />
                  </div>
                )}

                <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 mt-2" rows={4} placeholder="Sửa/thêm từ vựng (ví dụ: hospital, care, patient)..." value={inputText} onChange={(e) => setInputText(e.target.value)}></textarea>
                
                <button onClick={handleGenerateStory} disabled={loading || !inputText} className="w-full mt-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-lg shadow-indigo-200">
                  {loading ? <Loader2 size={22} className="animate-spin" /> : <Sparkles size={22} />}
                  {loading ? "AI Đang Dệt Truyện..." : "Sáng Tác Truyện Chêm"}
                </button>
              </div>
            </div>

            <div className="md:col-span-7 print-full-width">
              <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 min-h-[520px] flex flex-col relative">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100 no-print">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800"><BookOpen size={24} className="text-indigo-500" />Câu Chuyện Của Bạn</h2>
                  {scenes && (
                    <div className="flex gap-2">
                      <button onClick={saveCurrentStory} className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-bold hover:bg-emerald-100 transition flex items-center gap-1.5"><Save size={16} /> Lưu Thư Viện</button>
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

        {/* TAB THƯ VIỆN */}
        {activeTab === "library" && (
          <div className="md:col-span-12 animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 min-h-[500px]">
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-slate-800"><Library className="text-indigo-500" /> Thư Viện Truyện Tranh</h2>
              {savedStories.length === 0 ? (
                <div className="text-center py-24 text-slate-400"><BookOpen size={64} className="mx-auto mb-4 opacity-30" /><p className="text-lg font-medium">Bạn chưa lưu tác phẩm nào.</p></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {savedStories.map((story) => (
                    <div key={story.id} className="border-2 border-slate-800 rounded-xl p-5 shadow-[4px_4px_0px_0px_rgba(30,41,59,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(30,41,59,1)] transition-all bg-white flex flex-col">
                      <div className="w-full aspect-video bg-slate-200 border-2 border-slate-800 rounded-lg mb-4 overflow-hidden">
                        {story.scenes[0]?.image_url ? <img src={story.scenes[0].image_url} className="w-full h-full object-cover filter contrast-105" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon size={32} /></div>}
                      </div>
                      <h3 className="font-black text-slate-800 text-lg mb-1 leading-snug line-clamp-2">{story.title}</h3>
                      <p className="text-xs text-slate-500 mb-5 font-bold uppercase tracking-wider">{story.date} • {story.scenes.length} Cảnh</p>
                      <div className="mt-auto flex gap-3">
                        <button onClick={() => { setScenes(story.scenes); setActiveTab("create"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex-1 bg-slate-800 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-slate-700 transition">Đọc Lại</button>
                        <button onClick={() => { if (confirm("Xóa truyện này?")) setSavedStories(savedStories.filter(s => s.id !== story.id)); }} className="px-4 bg-rose-50 text-rose-600 rounded-lg font-bold border border-rose-200 hover:bg-rose-100 transition"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}