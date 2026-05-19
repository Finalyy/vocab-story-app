import os
import io
import json
import base64
import requests
import pypdf
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

app = FastAPI(title="VocabStory Pro API", version="8.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class StoryRequest(BaseModel):
    vocabularies: List[str]

def call_gemini_direct(prompt: str):
    if not GEMINI_API_KEY:
        raise Exception("Chưa cấu hình GEMINI_API_KEY")
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"}
    }
    
    res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=30)
    if res.status_code == 200:
        raw_text = res.json()['candidates'][0]['content']['parts'][0]['text']
        return raw_text.replace("```json", "").replace("```", "").strip()
    else:
        raise Exception(f"Google API Error: {res.text}")

@app.post("/api/v1/extract-vocab")
async def extract_vocab(file: UploadFile = File(...)):
    try:
        file_bytes = await file.read()
        if file.filename.endswith(".pdf"):
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            extracted_text = "".join([page.extract_text() or "" for page in reader.pages])
            if not extracted_text.strip():
                raise ValueError("Tài liệu PDF không có dữ liệu chữ.")

            prompt = f"""
            Extract a list of key English vocabulary words from the following text.
            TEXT: {extracted_text[:15000]}
            Return ONLY a valid JSON object matching this structure:
            {{"extracted_words": ["word1", "word2"]}}
            """
            response_text = call_gemini_direct(prompt)
            result_data = json.loads(response_text)
            clean_words = list(dict.fromkeys([str(w).lower().strip() for w in result_data.get("extracted_words", []) if len(str(w)) > 1]))
            return {"filename": file.filename, "extracted_words": clean_words}
        else:
            raise HTTPException(status_code=400, detail="Hệ thống hiện tại ưu tiên tối ưu cho định dạng file PDF.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/generate-story")
async def generate_story(request: StoryRequest):
    try:
        vocab_text = ", ".join(request.vocabularies)
        
        # PROMPT MỚI: ÉP BUỘC VIẾT TRUYỆN CHÊM TIẾNG VIỆT CHUẨN
        prompt = f"""
        Viết một câu chuyện chêm gồm 3 cảnh (3 scenes).
        BẮT BUỘC sử dụng các từ vựng tiếng Anh sau: {vocab_text}.
        
        LUẬT VIẾT TRUYỆN CHÊM NGHIÊM NGẶT: 
        1. Ngôn ngữ kể chuyện chính BẮT BUỘC phải là TIẾNG VIỆT.
        2. Các từ vựng yêu cầu phải được CHÊM (giữ nguyên tiếng Anh) vào giữa câu tiếng Việt, kèm theo nghĩa tiếng Việt trong ngoặc đơn.
        3. Ví dụ chuẩn: "Hôm nay tôi đến bệnh viện và gặp một cô nurse (y tá) rất xinh đẹp."
        
        Return ONLY a valid JSON object matching this exact structure:
        {{
            "scenes": [
                {{
                    "text": "Nội dung câu chuyện chêm bằng TIẾNG VIỆT...",
                    "image_prompt": "A detailed ENGLISH prompt to generate a comic illustration for this scene."
                }}
            ]
        }}
        """
        response_text = call_gemini_direct(prompt)
        return json.loads(response_text)
    except Exception as e:
        return {"scenes": [{"text": f"Lỗi Server: {str(e)}", "image_prompt": ""}]}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)