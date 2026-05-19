import os
from dotenv import load_dotenv

# Tải biến môi trường từ file .env
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
import io
import json
import requests
import pypdf
import uvicorn
import google.generativeai as genai
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

# --- 1. KHỞI TẠO BIẾN MÔI TRƯỜNG ---
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("CRITICAL WARNING: Chưa có GEMINI_API_KEY trong file .env")

genai.configure(api_key=GEMINI_API_KEY)

# --- 2. CẤU HÌNH AI HIỆN ĐẠI (NATIVE JSON MODE) ---
# Tách riêng 2 model: Một model chuyên nhả JSON chuẩn 100%, một model xử lý text/ảnh thường
json_config = genai.types.GenerationConfig(response_mime_type="application/json")

try:
    # Ưu tiên bản 2.5 mới nhất
    model_json = genai.GenerativeModel('gemini-2.5-flash', generation_config=json_config)
    model_vision = genai.GenerativeModel('gemini-2.5-flash')
except Exception:
    model_json = genai.GenerativeModel('gemini-1.5-flash', generation_config=json_config)
    model_vision = genai.GenerativeModel('gemini-1.5-flash')

# --- 3. CẤU HÌNH APP & BỘ NHỚ ĐỆM TỐI ƯU ---
app = FastAPI(title="VocabStory Pro API", version="6.0.0")

# Cấu hình CORS để Vercel và Localhost đều truy cập được
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*", 
        "https://vocab-story-app.vercel.app", 
        "http://localhost:3000"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache lưu trữ văn bản theo Session ID hoặc Tên file (Giới hạn 50 file để chống tràn RAM)
from collections import OrderedDict
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

# --- SCHEMAS TỐI ƯU ---
class StoryRequest(BaseModel):
    vocabularies: List[str]
    source_language: str = "Vietnamese"
    target_language: str = "English"

class ImageRequest(BaseModel):
    prompt: str

# --- 4. CÁC API ENDPOINTS ---
@app.get("/")
def read_root():
    return {"status": "Production Ready", "version": "6.0.0", "json_mode": "Enabled"}

@app.post("/api/v1/extract-vocab")
async def extract_vocab(file: UploadFile = File(...)):
    if not GEMINI_API_KEY:
         return {"filename": file.filename, "extracted_words": ["hospital", "patient", "care", "medicine"]}

    try:
        file_bytes = await file.read()
        mime_type = file.content_type or "application/pdf"
        
        # Đọc PDF bằng CPU
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
            # Sử dụng model_json để ép kiểu trả về
            response = model_json.generate_content(prompt)
            result_data = json.loads(response.text)
            
        # Đọc Hình ảnh (Cần model vision thường, ép JSON trong prompt)
        else:
            prompt = """
            Trích xuất toàn bộ từ vựng tiếng Anh và văn bản trong ảnh.
            BẮT BUỘC TRẢ VỀ JSON VỚI CẤU TRÚC:
            {"extracted_words": ["word1"], "raw_text": "văn bản..."}
            """
            response = model_json.generate_content([{"mime_type": mime_type, "data": file_bytes}, prompt])
            result_data = json.loads(response.text)
            document_cache.put(file.filename, result_data.get("raw_text", ""))

        clean_words = list(dict.fromkeys([str(w).lower().strip() for w in result_data.get("extracted_words", []) if len(str(w)) > 1]))
        return {"filename": file.filename, "extracted_words": clean_words}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi trích xuất: {str(e)}")

from pydantic import BaseModel
from typing import List
import google.generativeai as genai
import json
class StoryRequest(BaseModel):
    vocabularies: List[str]
    source_language: str = "Vietnamese"
    target_language: str = "English"
# 1. Định nghĩa cấu trúc khung truyện bắt buộc AI tuân theo
class StorySceneSchema(BaseModel):
    text: str
    image_prompt: str

class StoryResponseSchema(BaseModel):
    scenes: List[StorySceneSchema]

@app.post("/api/v1/generate-story")
async def generate_story(request: StoryRequest):
    import os, json
    import google.generativeai as genai
    try:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return {"scenes": [{"text": "Lỗi: Chưa có API Key trên Render.", "image_prompt": ""}]}

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        vocab_text = ", ".join(request.vocabularies)
        prompt = f"""
        You MUST return ONLY a valid JSON object. Do not use Markdown.
        Write a short 3-scene story using these words: {vocab_text}.
        Strict JSON format:
        {{
            "scenes": [
                {{"text": "Scene text here", "image_prompt": "English description for illustration"}}
            ]
        }}
        """
        
        response = model.generate_content(prompt)
        
        # Dọn sạch 100% rác markdown nếu AI lỡ sinh ra
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        
        return json.loads(clean_text)

    except Exception as e:
        # Nếu có lỗi, in thẳng lỗi ra màn hình truyện thay vì làm sập App
        return {"scenes": [{"text": f"Lỗi Server: {str(e)}", "image_prompt": ""}]}

@app.post("/api/v1/generate-image")
async def generate_image(request: ImageRequest):
    if not GEMINI_API_KEY:
        return {"image_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800"}

    url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key={GEMINI_API_KEY}"
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
        # Tối ưu hóa: Tìm văn bản cuối cùng được đưa vào cache
        full_context = list(document_cache.values())[-1] if document_cache else "Không có"
        
        dict_prompt = f"""
        Tra cứu từ "{word}" theo tài liệu sau: {full_context[:10000]}
        BẮT BUỘC TRẢ VỀ JSON VỚI CẤU TRÚC (Để trống "" nếu tài liệu không có):
        {{
            "word": "{word}", "meaning": "", "en_meaning": "", "example": "", "ipa": "", "pos": "", 
            "synonyms": "", "antonyms": "", "word_family": "", "collocations": "", "confusions": ""
        }}
        """
        response = model_json.generate_content(dict_prompt)
        return json.loads(response.text)
    except Exception:
        return {"word": word, "meaning": "Vốn từ quan trọng trong tài liệu."}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)