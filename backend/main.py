from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import google.generativeai as genai
import json
import re
import requests
import io
import pypdf  # Thư viện đọc PDF siêu tốc vừa cài

# --- CẤU HÌNH API KEY GEMINI ---
GEMINI_API_KEY = "AIzaSyD84Bd6aCJsQ7uT0q2Z1QgFC1vJhQUUJLc"

genai.configure(api_key=GEMINI_API_KEY)

try:
    model = genai.GenerativeModel('gemini-2.5-flash')
except Exception as e:
    model = genai.GenerativeModel('gemini-1.5-flash')

last_uploaded_doc_text = ""

app = FastAPI(title="VocabStory API", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class StoryRequest(BaseModel):
    vocabularies: List[str]
    source_language: str = "Vietnamese"
    target_language: str = "English"

class ImageRequest(BaseModel):
    prompt: str

@app.get("/")
def read_root():
    return {"status": "online", "message": "Backend v4.0 - Đọc PDF siêu tốc, hỗ trợ Mobile!"}

@app.post("/api/v1/extract-vocab")
async def extract_vocab(file: UploadFile = File(...)):
    global last_uploaded_doc_text
    if not GEMINI_API_KEY or GEMINI_API_KEY == "PASTE_YOUR_API_KEY_HERE":
        return {"filename": file.filename, "extracted_words": ["master's degree", "talented", "career"]}

    try:
        file_bytes = await file.read()
        mime_type = file.content_type or "application/pdf"
        
        extracted_text = ""

        # Nếu là file PDF -> Dùng máy tính đọc siêu tốc trong 0.1s
        if "pdf" in mime_type:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n"
            
            last_uploaded_doc_text = extracted_text

            # Nhờ AI nhặt từ vựng (Không bắt gõ lại văn bản nữa)
            ocr_prompt = f"""
            Dưới đây là nội dung tài liệu học từ vựng:
            ---
            {extracted_text[:40000]}
            ---
            Hãy trích xuất danh sách tất cả các từ vựng tiếng Anh (từ chính cần học) được định nghĩa trong tài liệu trên.
            TRẢ VỀ CHỈ MỘT CHUỖI JSON HỢP LỆ:
            {{
              "extracted_words": ["word 1", "word 2"]
            }}
            """
            response = model.generate_content(ocr_prompt)
        
        # Nếu là Hình ảnh -> Vẫn dùng AI đọc ảnh đa phương thức
        else:
            ocr_prompt = """
            Trích xuất tất cả từ vựng tiếng Anh quan trọng và toàn bộ văn bản trong ảnh này.
            TRẢ VỀ JSON:
            {
              "extracted_words": ["word 1", "word 2"],
              "raw_text": "toàn bộ văn bản..."
            }
            """
            response = model.generate_content([{"mime_type": mime_type, "data": file_bytes}, ocr_prompt])
        
        text_response = response.text
        match = re.search(r'\{.*\}', text_response, re.DOTALL)
        json_str = match.group(0) if match else text_response
            
        result_data = json.loads(json_str)
        
        if "pdf" not in mime_type:
            last_uploaded_doc_text = result_data.get("raw_text", "")

        clean_words = [str(w).lower().strip() for w in result_data.get("extracted_words", []) if len(str(w)) > 1]
        return {"filename": file.filename, "extracted_words": clean_words}
        
    except Exception as e:
        print(f"Lỗi hệ thống: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi: {str(e)}")

@app.post("/api/v1/generate-story")
async def generate_story(request: StoryRequest):
    if not GEMINI_API_KEY or GEMINI_API_KEY == "PASTE_YOUR_API_KEY_HERE":
        raise HTTPException(status_code=500, detail="Thiếu API Key")

    try:
        vocab_str = ", ".join(request.vocabularies)
        prompt = f"""
        Bạn là nhà văn. Hãy viết một câu chuyện bằng tiếng {request.source_language}, chêm các từ {request.target_language} sau: {vocab_str}.
        QUY TẮC NGHIÊM NGẶT:
        1. SỬ DỤNG 100% TỪ VỰNG: Bắt buộc dùng không sót từ nào.
        2. KHÔNG DÙNG DẤU NHÁY: TUYỆT ĐỐI KHÔNG bọc từ tiếng {request.target_language} trong dấu nháy đơn hay nháy kép.
        3. Mở ngoặc đơn ghi nghĩa tiếng {request.source_language} ngay sau từ.
        4. CHIA CẢNH (SCENES): Chia câu chuyện thành 2 đến 4 đoạn. Viết 1 câu miêu tả cảnh bằng tiếng Anh cho mỗi đoạn.
        TRẢ VỀ JSON:
        {{
            "scenes": [
                {{"text": "Nội dung...", "image_prompt": "Mô tả bằng tiếng Anh..."}}
            ]
        }}
        """
        response = model.generate_content(prompt)
        text_response = response.text
        match = re.search(r'\{.*\}', text_response, re.DOTALL)
        json_str = match.group(0) if match else text_response
        story_data = json.loads(json_str)
        return {"status": "success", "scenes": story_data.get("scenes", [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/generate-image")
async def generate_image(request: ImageRequest):
    if not GEMINI_API_KEY or GEMINI_API_KEY == "PASTE_YOUR_API_KEY_HERE":
        return {"image_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800"}

    url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key={GEMINI_API_KEY}"
    comic_prompt = f"Western comic book graphic novel illustration style, line art, flat bold colors, dynamic composition. Scene: {request.prompt}"
    
    payload = {
        "instances": [{"prompt": comic_prompt}],
        "parameters": {"sampleCount": 1, "aspectRatio": "4:3"}
    }

    try:
        response = requests.post(url, json=payload, timeout=30)
        if response.status_code == 200:
            result = response.json()
            base64_data = result["predictions"][0]["bytesBase64Encoded"]
            return {"image_url": f"data:image/jpeg;base64,{base64_data}"}
        else:
            return {"image_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800"}
    except Exception:
        return {"image_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800"}

@app.get("/api/v1/dictionary/{word}")
async def get_dictionary(word: str):
    global last_uploaded_doc_text
    if not GEMINI_API_KEY or GEMINI_API_KEY == "PASTE_YOUR_API_KEY_HERE":
        return {"word": word, "meaning": "Định nghĩa mẫu"}

    try:
        dict_prompt = f"""
        Nhiệm vụ: Tra cứu từ "{word}" dựa trên tài liệu sau:
        {last_uploaded_doc_text if last_uploaded_doc_text else "Không có"}
        
        TRẢ VỀ JSON:
        {{
          "word": "{word}",
          "meaning": "Nghĩa tiếng Việt (Nếu tài liệu không có, ĐỂ TRỐNG '')",
          "en_meaning": "Nghĩa tiếng Anh (Nếu tài liệu không có, ĐỂ TRỐNG '')",
          "example": "Câu ví dụ (Nếu tài liệu không có, ĐỂ TRỐNG '')",
          "ipa": "Phiên âm (Nếu tài liệu không có, ĐỂ TRỐNG '')",
          "pos": "Từ loại (Nếu tài liệu không có, ĐỂ TRỐNG '')",
          "synonyms": "Từ đồng nghĩa (Nếu tài liệu không có, ĐỂ TRỐNG '')",
          "antonyms": "Từ trái nghĩa (Nếu tài liệu không có, ĐỂ TRỐNG '')",
          "word_family": "Họ từ (Nếu tài liệu không có, ĐỂ TRỐNG '')",
          "collocations": "Cụm từ thường gặp (Nếu tài liệu không có, ĐỂ TRỐNG '')",
          "confusions": "Dễ nhầm lẫn (Nếu tài liệu không có, ĐỂ TRỐNG '')"
        }}
        """
        response = model.generate_content(dict_prompt)
        text_response = response.text
        match = re.search(r'\{.*\}', text_response, re.DOTALL)
        json_str = match.group(0) if match else text_response
        return json.loads(json_str)
    except Exception:
        return {"word": word}

if __name__ == "__main__":
    # ĐỔI THÀNH 0.0.0.0 ĐỂ CHO PHÉP ĐIỆN THOẠI KẾT NỐI VÀO LAPTOP CỦA BẠN!
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)