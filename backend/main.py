import os
import io
import json
import requests
import pypdf
import uvicorn
import google.generativeai as genai
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv
from collections import OrderedDict

# --- 1. KHỞI TẠO BIẾN MÔI TRƯỜNG ---
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# --- 2. CẤU HÌNH APP & BỘ NHỚ ĐỆM ---
app = FastAPI(title="VocabStory Pro API", version="6.0.0")

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

# --- 3. SCHEMAS TỐI ƯU ---
class StoryRequest(BaseModel):
    vocabularies: List[str]
    source_language: str = "Vietnamese"
    target_language: str = "English"

class ImageRequest(BaseModel):
    prompt: str

# --- 4. HÀM AI "BẤT TỬ" TỰ ĐỘNG CHUYỂN MODEL KHI LỖI ---
def generate_with_fallback(prompt, file_data=None, mime_type=None):
    # Danh sách model được quét tự động để chống lỗi 404
    models_to_try = [
        'gemini-1.5-flash-latest', 
        'gemini-1.5-flash', 
        'gemini-1.0-pro', 
        'gemini-pro'
    ]
    last_error = ""
    
    for m in models_to_try:
        try:
            model = genai.GenerativeModel(m)
            if file_data and mime_type:
                response = model.generate_content([{"mime_type": mime_type, "data": file_data}, prompt])
            else:
                response = model.generate_content(prompt)
            return response
        except Exception as e:
            last_error = str(e)
            continue
            
    raise Exception(f"Google API từ chối tất cả Model. Lỗi: {last_error}")

def clean_json_response(text):
    return text.replace("```json", "").replace("```", "").strip()

# --- 5. CÁC API ENDPOINTS ---
@app.get("/")
def read_root():
    return {"status": "Production Ready", "version": "6.0.0"}

@app.post("/api/v1/extract-vocab")
async def extract_vocab(file: UploadFile = File(...)):
    if not GEMINI_API_KEY:
         return {"filename": file.filename, "extracted_words": ["hospital", "patient", "care", "medicine"]}

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
            TÀI LIỆU: {extracted_text[:35000]}
            BẮT BUỘC TRẢ VỀ JSON VỚI CẤU TRÚC:
            {{"extracted_words": ["word1", "word2"], "raw_text": "bản sao nội dung..."}}
            """
            response = generate_with_fallback(prompt)
            
        else:
            prompt = """
            Trích xuất toàn bộ từ vựng tiếng Anh và văn bản trong ảnh.
            BẮT BUỘC TRẢ VỀ JSON VỚI CẤU TRÚC:
            {"extracted_words": ["word1"], "raw_text": "văn bản..."}
            """
            response = generate_with_fallback(prompt, file_data=file_bytes, mime_type=mime_type)

        result_data = json.loads(clean_json_response(response.text))
        if "raw_text" in result_data:
            document_cache.put(file.filename, result_data["raw_text"])

        clean_words = list(dict.fromkeys([str(w).lower().strip() for w in result_data.get("extracted_words", []) if len(str(w)) > 1]))
        return {"filename": file.filename, "extracted_words": clean_words}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi trích xuất: {str(e)}")

@app.post("/api/v1/generate-story")
async def generate_story(request: StoryRequest):
    try:
        if not GEMINI_API_KEY:
            return {"scenes": [{"text": "Lỗi: Chưa có API Key trên Render.", "image_prompt": ""}]}

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
        
        response = generate_with_fallback(prompt)
        return json.loads(clean_json_response(response.text))

    except Exception as e:
        return {"scenes": [{"text": f"Lỗi Server: {str(e)}", "image_prompt": ""}]}

@app.post("/api/v1/generate-image")
async def generate_image(request: ImageRequest):
    if not GEMINI_API_KEY:
        return {"image_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800"}

    # Nâng cấp lên imagen-3.0 để tương thích ổn định với Google API hiện tại
    url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key={GEMINI_API_KEY}"
    comic_prompt = f"Western comic book graphic novel illustration style, line art, flat bold colors, dynamic composition. Scene: {request.prompt}"
    
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
        Tra cứu từ "{word}" theo tài liệu sau: {full_context[:10000]}
        BẮT BUỘC TRẢ VỀ JSON VỚI CẤU TRÚC (Để trống "" nếu không có):
        {{
            "word": "{word}", "meaning": "", "en_meaning": "", "example": "", "ipa": "", "pos": "", 
            "synonyms": "", "antonyms": "", "word_family": "", "collocations": "", "confusions": ""
        }}
        """
        response = generate_with_fallback(dict_prompt)
        return json.loads(clean_json_response(response.text))
    except Exception:
        return {"word": word, "meaning": "Vốn từ quan trọng trong tài liệu."}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)