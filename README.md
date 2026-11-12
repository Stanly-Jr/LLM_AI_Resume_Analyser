# ResumeIQ – AI Resume Analyser

> Powered by **Gemini 3.1 Flash-Lite** · Built with Flask + Vanilla JS

A full-stack web app that takes a resume (PDF / DOCX / TXT), runs it through a structured AI analysis pipeline, and returns a detailed report with scores, ATS tips, keyword gaps, and bullet-point rewrites.

---

## 📁 Project Structure

```
AI_Resume/
├── app.py               # Flask backend + Gemini API calls
├── requirements.txt     # Python dependencies
├── start.bat            # One-click Windows launcher
├── .env.example         # Environment variable template
├── templates/
│   └── index.html       # Single-page web UI
└── static/
    ├── css/style.css    # Dark-theme styling
    └── js/main.js       # Upload, loading animation, results rendering
```

---

## 🚀 Setup

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Set your API key
Create a `.env` file (or set the env var directly):
```
GOOGLE_API_KEY=your_google_api_key_here # Or anything other LLM key of your choice
```

### 3. Run
**Windows (double-click):**
```
start.bat
```

**Or manually:**
```bash
set GOOGLE_API_KEY=your_key_here
python app.py
```

Open **http://localhost:5000** in your browser.

---

## 🔌 API

### `POST /analyse`
- **Content-Type:** `multipart/form-data`
- **Field:** `resume` (file — PDF, DOCX, or TXT)
- **Response:** JSON analysis report (see schema below)

```bash
curl -X POST http://localhost:5000/analyse \
  -F "resume=@/path/to/resume.pdf"
```

---

## 📊 Analysis Report Schema

```json
{
  "candidate_name":            "string",
  "overall_score":             100,
  "grade":                     "A+",
  "summary":                   "string",
  "sections": {
    "contact_info":    { "score": int, "feedback": "...", "issues": [] },
    "work_experience": { "score": int, "feedback": "...", "issues": [], "highlights": [] },
    "education":       { "score": int, "feedback": "...", "issues": [] },
    "skills":          { "score": int, "feedback": "...", "issues": [], "top_skills": [] },
    "formatting":      { "score": int, "feedback": "...", "issues": [] },
    "impact_metrics":  { "score": int, "feedback": "...", "issues": [] }
  },
  "ats_compatibility":         { "score": int, "verdict": "...", "tips": [] },
  "key_strengths":             [],
  "critical_improvements":     [],
  "quick_wins":                [],
  "keywords_found":            [],
  "keywords_missing":          [],
  "estimated_experience_years": 5,
  "career_level":              "Senior",
  "industry_fit":              [],
  "rewritten_bullet_examples": [
    { "original": "...", "improved": "...", "reason": "..." }
  ]
}
```

---

## 🤖 Prompt Design

| Prompt | Purpose |
|--------|---------|
| **System prompt** | Defines ResumeIQ persona, scoring rubric, 6 analysis dimensions, strict JSON-only output contract |
| **User prompt** | Wraps the extracted resume text between `---RESUME START---` delimiters |

The model is instructed to return **raw JSON only** (no markdown fences). The backend strips any accidental fences with a regex before `json.loads()`.

