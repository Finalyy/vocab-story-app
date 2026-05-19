"use client";

import React, { useState, useCallback, useRef } from "react";
import { UploadCloud, FileText, Image as ImageIcon, Loader2 } from "lucide-react";

interface FileUploaderProps {
  onUploadSuccess: (words: string[]) => void;
  setExternalLoading: (loading: boolean) => void;
  setExternalStatus: (status: { type: "success" | "error" | "info"; message: string } | null) => void;
}

export default function FileUploader({ onUploadSuccess, setExternalLoading, setExternalStatus }: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getBackendUrl = () => {
    // 1. Nếu bạn đang chạy thử trên máy tính (Local) hoặc điện thoại chung Wifi
    if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname.startsWith("192.168."))) {
      // Ép về IP local máy tính của bạn (Hãy đổi 127.0.0.1 thành IP mạng nội bộ của bạn nếu test trên điện thoại)
      return "http://127.0.0.1:8000/api/v1";
    }
    // 2. Nếu chạy bản online trên mạng, tự động gọi lên Render Cloud
    return "https://vocab-story-app-1.onrender.com/api/v1"; // <-- Hãy thay link Render thật của bạn vào đây nếu deploy online
  };

  const processUploadedFile = async (file: File) => {
    setLoading(true);
    setExternalLoading(true);
    setExternalStatus({ type: "info", message: `Đang quét siêu tốc tài liệu "${file.name}"...` });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${getBackendUrl()}/extract-vocab`, { method: "POST", body: formData });
      if (response.ok) {
        const data = await response.json();
        if (data.extracted_words?.length > 0) {
          onUploadSuccess(data.extracted_words);
          setExternalStatus({ type: "success", message: `Thành công! Đã lấy ${data.extracted_words.length} từ vựng.` });
        } else {
          setExternalStatus({ type: "error", message: "Không tìm thấy từ vựng nào trong file." });
        }
      } else {
        throw new Error("Máy chủ xử lý file thất bại.");
      }
    } catch (error: any) {
      setExternalStatus({ type: "error", message: `Lỗi: ${error.message}` });
    } finally {
      setLoading(false);
      setExternalLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) processUploadedFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="w-full">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={(e) => e.target.files?.[0] && processUploadedFile(e.target.files[0])} 
        accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" 
        className="hidden" 
      />
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer mb-5 ${
          dragActive ? "border-indigo-500 bg-indigo-50/50" : "border-slate-300 hover:bg-slate-50 hover:border-indigo-400"
        }`}
      >
        {loading ? (
          <div className="flex flex-col items-center py-4">
            <Loader2 className="animate-spin text-indigo-600 mb-3" size={32} />
            <p className="text-sm font-semibold text-indigo-700">Đang quét siêu tốc...</p>
          </div>
        ) : (
          <>
            <div className="flex justify-center gap-4 mb-3 text-slate-400">
              <FileText size={32} />
              <ImageIcon size={32} />
            </div>
            <p className="text-sm text-slate-600 font-medium">Click / Thả tài liệu vào đây</p>
          </>
        )}
      </div>
    </div>
  );
}