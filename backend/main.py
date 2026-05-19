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
from collections import OrderedDict

# --- 1. KHỞI TẠO BIẾN MÔI TRƯỜNG ---
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# --- 2. CẤU HÌNH APP & CACHE ---
app = FastAPI(title="VocabStory Pro API", version="7.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LRUCache(OrderedDict):
    def __init__(self, capacity=50):
        super().__init__()
        self.capacity = capacity
    def put(self, key, value):
        self[key] = value
        self.move_to_end(key)
        if len(self) > self.capacity:
            self.popitem(last=False)

document_cache = LRUCache(capacity=50)

# --- 3. SCHEMAS ---
class StoryRequest(BaseModel):
    vocabularies: List[str]
    source_language: str = "Vietnamese"
    target_language: str = "English"

class ImageRequest(BaseModel):
    prompt: str

# --- 4. HÀM GỌI TRỰC TIẾP GOOGLE API (KHÔNG DÙNG THƯ VIỆN) ---
def call_gemini_direct(prompt: str, file_bytes=None, mime_type=None):
    if not GEMINI_API_KEY:
        raise Exception("Chưa cấu hình GEMINI_API_KEY")
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
    
    parts = [{"text": prompt}]
    if file_bytes and mime_type:
        parts.insert(0, {
            "inline_data": {
                "mime_type": mime_type,
                "data": base64.b64encode(file_bytes).decode('utf-8')
            }
        })

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {"responseMimeType": "application/json"}
    }
    
    res = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
    
    if res.status_code == 200:
        data = res.json()
        raw_text = data['candidates'][0]['content']['parts'][0]['text']
        # Dọn dẹp rác markdown nếu có
        return raw_text.replace("```json", "").replace("```", "").strip()
    else:
        raise Exception(f"Google API Error: {res.text}")

# --- 5. CÁC API ENDPOINTS ---
@app.post("/api/v1/extract-vocab")
async def extract_vocab(file: UploadFile = File(...)):
    try:
        file_bytes = await file.read()
        mime_type = file.content_type or "application/pdf"
        
        if "pdf" in mime_type or file.filename.endswith(".pdf"):
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            extracted_text = "".join([page.extract_text() or "" for page in reader.pages])
            if not extracted_text.strip():
                raise ValueError("File PDF trống.")
            document_cache.put(file.filename, extracted_text)

            prompt = f"""
            Trích xuất danh sách các từ vựng tiếng Anh mục tiêu từ tài liệu sau.
            TÀI LIỆU: {extracted_text[:15000]}
            BẮT BUỘC TRẢ VỀ JSON VỚI CẤU TRÚC:
            {{"extracted_words": ["word1", "word2"], "raw_text": "bản sao nội dung..."}}
            """
            response_text = call_gemini_direct(prompt)
            
        else:
            prompt = """
            Trích xuất toàn bộ từ vựng tiếng Anh và văn bản trong ảnh.
            BẮT BUỘC TRẢ VỀ JSON VỚI CẤU TRÚC:
            {"extracted_words": ["word1"], "raw_text": "văn bản..."}
            """
            response_text = call_gemini_direct(prompt, file_bytes=file_bytes, mime_type=mime_type)

        result_data = json.loads(response_text)
        if "raw_text" in result_data:
            document_cache.put(file.filename, result_data["raw_text"])

        clean_words = list(dict.fromkeys([str(w).lower().strip() for w in result_data.get("extracted_words", []) if len(str(w)) > 1]))
        return {"filename": file.filename, "extracted_words": clean_words}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi trích xuất: {str(e)}")

@app.post("/api/v1/generate-story")
async def generate_story(request: StoryRequest):
    try:
        vocab_text = ", ".join(request.vocabularies)
        prompt = f"""
        You MUST return ONLY a valid JSON object. Do not use Markdown.
        Write a short 3-scene story using these words: {vocab_text}.
        The story must be written in {request.target_language} (with brief {request.source_language} meanings embedded).
        Strict JSON format:
        {{
            "scenes": [
                {{"text": "Scene text here", "image_prompt": "English description for illustration"}}
            ]
        }}
        """
        response_text = call_gemini_direct(prompt)
        return json.loads(response_text)
    except Exception as e:
        return {"scenes": [{"text": f"Lỗi Server: {str(e)}", "image_prompt": ""}]}

@app.post("/api/v1/generate-image")
async def generate_image(request: ImageRequest):
    if not GEMINI_API_KEY:
        return {"image_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800"}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key={GEMINI_API_KEY}"
    comic_prompt = f"Western comic book graphic novel illustration style, line art, flat bold colors. Scene: {request.prompt}"
    try:
        res = requests.post(url, json={"instances": [{"prompt": comic_prompt}], "parameters": {"sampleCount": 1, "aspectRatio": "4:3"}}, timeout=25)
        if res.status_code == 200:
            return {"image_url": f"data:image/jpeg;base64,{res.json()['predictions'][0]['bytesBase64Encoded']}"}
        return {"image_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800"}
    except Exception:
        return {"image_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800"}

@app.get("/api/v1/dictionary/{word}")
async def get_dictionary(word: str):
    try:
        full_context = list(document_cache.values())[-1] if document_cache else "Không có"
        dict_prompt = f"""
        Tra cứu từ "{word}" theo tài liệu: {full_context[:5000]}
        BẮT BUỘC TRẢ VỀ JSON (Để trống "" nếu không có):
        {{
            "word": "{word}", "meaning": "", "en_meaning": "", "example": "", "ipa": "", "pos": "", 
            "synonyms": "", "antonyms": "", "word_family": "", "collocations": "", "confusions": ""
        }}
        """
        response_text = call_gemini_direct(dict_prompt)
        return json.loads(response_text)
    except Exception:
        return {"word": word, "meaning": "Vốn từ quan trọng trong tài liệu."}