import os, io, json, base64, requests, pypdf, uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class StoryRequest(BaseModel):
    vocabularies: List[str]
    source_language: str = "Vietnamese"
    target_language: str = "English"

# --- HÀM GỌI API GOOGLE TRỰC TIẾP ---
def call_gemini_api(prompt: str):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"}
    }
    res = requests.post(url, json=payload)
    if res.status_code == 200:
        return json.loads(res.json()['candidates'][0]['content']['parts'][0]['text'])
    raise Exception(res.text)

@app.get("/")
def home(): return {"status": "VocabStory API Live"}

@app.post("/api/v1/extract-vocab")
async def extract(file: UploadFile = File(...)):
    try:
        content = ""
        if file.filename.endswith(".pdf"):
            pdf = pypdf.PdfReader(io.BytesIO(await file.read()))
            content = " ".join([p.extract_text() for p in pdf.pages])
        else:
            # Xử lý ảnh (OCR đơn giản qua Gemini)
            img_data = base64.b64encode(await file.read()).decode('utf-8')
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
            payload = {"contents": [{"parts": [{"text": "Extract English words from this image. Return JSON: {'extracted_words': []}"}, {"inline_data": {"mime_type": "image/jpeg", "data": img_data}}]}]}
            res = requests.post(url, json=payload)
            return res.json()['candidates'][0]['content']['parts'][0]['text']

        prompt = f"Extract key English vocabularies from this text: {content[:10000]}. Return JSON: {{'extracted_words': []}}"
        return call_gemini_api(prompt)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/generate-story")
async def generate(request: StoryRequest):
    try:
        words = ", ".join(request.vocabularies)
        prompt = f"""
        Write a 4-scene comic story using: {words}. 
        Target: {request.target_language}, Meanings: {request.source_language}.
        Return ONLY JSON:
        {{ "scenes": [ {{ "text": "story text with words highlighted", "image_prompt": "visual description" }} ] }}
        """
        return call_gemini_api(prompt)
    except Exception as e: return {"scenes": [{"text": f"Lỗi AI: {str(e)}", "image_prompt": ""}]}

@app.post("/api/v1/generate-image")
async def image(req: dict):
    # Dùng ảnh minh họa nghệ thuật từ Unsplash (nhanh và đẹp hơn AI vẽ trong lúc này)
    return {"image_url": f"https://source.unsplash.com/800x600/?{req['prompt'].replace(' ', '+')}"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)