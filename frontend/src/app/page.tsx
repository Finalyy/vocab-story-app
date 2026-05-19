"use client";
import React, { useState, useEffect } from "react";
import { BookOpen, Printer, Save, Trash2, Loader2, Sparkles, BookMarked, Library } from "lucide-react";

const BACKEND_URL = "https://vocab-story-app-1.onrender.com/api/v1";

export default function Page() {
  const [inputText, setInputText] = useState("");
  const [scenes, setScenes] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [library, setLibrary] = useState<any[]>([]);
  const [tab, setTab] = useState("create");

  useEffect(() => {
    const saved = localStorage.getItem("my_stories");
    if (saved) setLibrary(JSON.parse(saved));
  }, []);

  const generateStory = async () => {
    setLoading(true); setScenes(null);
    try {
      const res = await fetch(`${BACKEND_URL}/generate-story`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vocabularies: inputText.split(","), target_language: "English" }),
      });
      const data = await res.json();
      setScenes(data.scenes);
    } catch (e) { alert("Lỗi kết nối Backend!"); }
    finally { setLoading(false); }
  };

  const saveToLibrary = () => {
    if (!scenes) return;
    const newLib = [{ id: Date.now(), title: inputText.substring(0, 20), scenes }, ...library];
    setLibrary(newLib);
    localStorage.setItem("my_stories", JSON.stringify(newLib));
    alert("Đã lưu vào thư viện!");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <header className="max-w-5xl mx-auto flex justify-between items-center mb-10 no-print">
        <h1 className="text-3xl font-black text-indigo-600 flex items-center gap-2">
          <BookMarked size={32} /> VOCAB STORY AI
        </h1>
        <div className="flex bg-white shadow rounded-full p-1">
          <button onClick={() => setTab("create")} className={`px-6 py-2 rounded-full font-bold ${tab==='create'?'bg-indigo-600 text-white':'text-gray-500'}`}>Tạo Truyện</button>
          <button onClick={() => setTab("library")} className={`px-6 py-2 rounded-full font-bold ${tab==='library'?'bg-indigo-600 text-white':'text-gray-500'}`}>Thư Viện</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto">
        {tab === "create" ? (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4 no-print">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="font-bold mb-4">Nhập từ vựng (cách nhau bằng dấu phẩy)</h2>
                <textarea className="w-full h-32 p-4 border rounded-xl focus:ring-2 ring-indigo-500 outline-none" 
                  value={inputText} onChange={(e)=>setInputText(e.target.value)} placeholder="nurse, hospital, patient..."/>
                <button onClick={generateStory} disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl mt-4 flex items-center justify-center gap-2 hover:bg-indigo-700">
                  {loading ? <Loader2 className="animate-spin"/> : <Sparkles/>} SÁNG TÁC NGAY
                </button>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-indigo-100 min-h-[500px]">
              <div className="flex justify-between mb-6 no-print">
                 <h2 className="text-xl font-bold">Kết Quả</h2>
                 {scenes && (
                   <div className="flex gap-2">
                     <button onClick={saveToLibrary} className="p-2 bg-green-50 text-green-600 rounded-lg"><Save/></button>
                     <button onClick={()=>window.print()} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Printer/></button>
                   </div>
                 )}
              </div>
              {scenes ? (
                <div className="space-y-10">
                  {scenes.map((s, i) => (
                    <div key={i} className="border-b pb-8 last:border-0 page-break">
                      <div className="bg-gray-100 aspect-video rounded-lg mb-4 flex items-center justify-center text-gray-400 overflow-hidden">
                         <img src={`https://source.unsplash.com/800x600/?${s.image_prompt.replace(/ /g,'+')}`} alt="AI Scene" className="w-full h-full object-cover"/>
                      </div>
                      <p className="text-lg leading-relaxed text-gray-700 italic">"{s.text}"</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 text-gray-300"><BookOpen size={64} className="mx-auto mb-4 opacity-20"/><p>Truyện của bạn sẽ hiện ở đây...</p></div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {library.map((story) => (
              <div key={story.id} className="bg-white p-5 rounded-xl shadow-md border border-gray-100">
                <h3 className="font-bold text-lg mb-4 text-indigo-700">{story.title}</h3>
                <button onClick={()=>{setScenes(story.scenes); setTab("create")}} className="w-full bg-indigo-50 text-indigo-600 py-2 rounded-lg font-bold">Xem lại</button>
                <button onClick={()=>{const n=library.filter(x=>x.id!==story.id); setLibrary(n); localStorage.setItem("my_stories", JSON.stringify(n))}} className="w-full text-red-400 text-sm mt-3">Xóa</button>
              </div>
            ))}
          </div>
        )}
      </main>

      <style jsx global>{`
        @media print { .no-print { display: none !important; } .page-break { page-break-inside: avoid; } }
      `}</style>
    </div>
  );
}