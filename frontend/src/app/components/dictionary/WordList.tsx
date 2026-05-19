"use client";

import React from "react";

interface WordListProps {
  words: string[];
  onWordClick: (word: string) => void;
}

export default function WordList({ words, onWordClick }: WordListProps) {
  if (!words || words.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto bg-slate-50 p-3 rounded-xl border border-slate-200 custom-scrollbar-dark">
      {words.map((word, idx) => (
        <span
          key={idx}
          onClick={() => onWordClick(word)}
          className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-bold border border-indigo-100 hover:bg-indigo-100 cursor-pointer shadow-sm transition"
        >
          {word}
        </span>
      ))}
    </div>
  );
}