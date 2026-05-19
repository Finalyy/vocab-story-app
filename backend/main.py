import os
import io
import json
import requests
import pypdf
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv

# --- KHỞI TẠO BIẾN MÔI TRƯỜNG ---
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# --- CẤU HÌNH APP ---
app = FastAPI(title="VocabStory Pro API", version="8.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SCHEMAS CHUẨN ---
class StoryRequest(BaseModel):
    vocabularies: List[str]
    source_language: str = "Vietnamese"
    target_language: str = "English"

# --- HÀM LÕI: TỰ ĐỘNG QUÉT MODEL TRÁNH LỖI 404 ---
def generate_with_gemini(prompt: str):
    if not GEMINI_API_KEY:
        raise Exception("Server thiếu GEMINI_API_KEY")

    # Danh sách các model từ mới nhất đến cũ nhất. 
    # Nếu API Key không hỗ trợ cái này, tự động nhảy sang cái kia.
    models = ['gemini-1.5-flash-latest', 'gemini-1.5-pro-latest', 'gemini-pro']
    last_err = ""

    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json"} # Ép Google trả về JSON thuần
        }
        try:
            res = requests.post(url, json=payload, timeout=30)
            if res.status_code == 200:
                raw_text = res.json()['candidates'][0]['content']['parts'][0]['text']
                # Xóa sạch các ký tự markdown thừa nếu AI lỡ tạo ra
                return raw_text.replace("```json", "").replace("```", "").strip()
            else:
                last_err = res.text
        except Exception as e:
            last_err = str(e)
            continue
            
    raise Exception(f"Google API từ chối tất cả Model. Chi tiết: {last_err}")

# --- API ENDPOINTS ---
@app.post("/api/v1/extract-vocab")
async def extract_vocab(file: UploadFile = File(...)):
    try:
        file_bytes = await file.read()
        mime_type = file.content_type or "application/pdf"
        
        if "pdf" in mime_type or file.filename.endswith(".pdf"):
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            extracted_text = "".join([page.extract_text() or "" for page in reader.pages])
            if not extracted_text.strip():
                raise ValueError("Tài liệu PDF trống hoặc không thể đọc chữ.")

            prompt = f"""
            Extract a list of key English vocabulary words from the following text.
            TEXT: {extracted_text[:15000]}
            You MUST return ONLY a valid JSON object matching this structure:
            {{"extracted_words": ["word1", "word2", "word3"]}}
            """
            
            response_text = generate_with_gemini(prompt)
            result_data = json.loads(response_text)
            
            # Lọc từ vựng trùng lặp và rác
            clean_words = list(dict.fromkeys([str(w).lower().strip() for w in result_data.get("extracted_words", []) if len(str(w)) > 1]))
            return {"filename": file.filename, "extracted_words": clean_words}
        else:
            raise HTTPException(status_code=400, detail="Hiện tại API chỉ hỗ trợ bóc tách PDF.")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/generate-story")
async def generate_story(request: StoryRequest):
    try:
        vocab_text = ", ".join(request.vocabularies)
        prompt = f"""
        Write a creative, short 3-scene comic story. 
        You MUST integrate these specific vocabulary words naturally: {vocab_text}.
        The narrative text must be in {request.target_language}.
        
        You MUST return ONLY a valid JSON object matching this exact structure:
        {{
            "scenes": [
                {{
                    "text": "The narrative text for the scene goes here.",
                    "image_prompt": "A highly detailed English prompt to generate an illustration for this scene."
                }}
            ]
        }}
        """
        response_text = generate_with_gemini(prompt)
        return json.loads(response_text)
    except Exception as e:
        return {"scenes": [{"text": f"Lỗi Server: {str(e)}", "image_prompt": ""}]}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)