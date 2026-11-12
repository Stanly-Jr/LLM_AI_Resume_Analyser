import os
import io
import json
import re
import traceback

from dotenv import load_dotenv
load_dotenv()  # Loads GOOGLE_API_KEY from .env automatically

from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from google import genai
from google.genai import types
import PyPDF2
import docx

# ─────────────────────────────────────────────
# App setup
# ─────────────────────────────────────────────
app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
MODEL_NAME = "gemini-3.1-flash-lite"

# ─────────────────────────────────────────────
# Prompts
# ─────────────────────────────────────────────
SYSTEM_PROMPT = """You are ResumeIQ, an expert AI career coach and hiring specialist with 15+ years of experience in talent acquisition across Fortune-500 companies, startups, and technical roles. Your sole job is to analyse resumes and produce structured, actionable feedback.

## Your Expertise
- Deep knowledge of ATS (Applicant Tracking Systems) and how they parse resumes
- Understanding of industry-specific keywords, skills, and formatting standards
- Ability to gauge seniority level, career trajectory, and skill gaps
- Expertise in writing compelling, achievement-oriented bullet points

## Analysis Framework
When given a resume, you MUST evaluate it across these exact dimensions and return a **valid JSON object** – nothing else, no markdown fences, no extra prose:

### JSON Schema
{
  "candidate_name": string,
  "overall_score": integer (0–100),
  "grade": string ("A+"|"A"|"A-"|"B+"|"B"|"B-"|"C+"|"C"|"C-"|"D"|"F"),
  "summary": string (2–3 sentence high-level verdict),
  "sections": {
    "contact_info":    { "score": int, "feedback": string, "issues": [string] },
    "work_experience": { "score": int, "feedback": string, "issues": [string], "highlights": [string] },
    "education":       { "score": int, "feedback": string, "issues": [string] },
    "skills":          { "score": int, "feedback": string, "issues": [string], "top_skills": [string] },
    "formatting":      { "score": int, "feedback": string, "issues": [string] },
    "impact_metrics":  { "score": int, "feedback": string, "issues": [string] }
  },
  "ats_compatibility": {
    "score": int (0–100),
    "verdict": string,
    "tips": [string]
  },
  "key_strengths": [string],
  "critical_improvements": [string],
  "quick_wins": [string],
  "keywords_found": [string],
  "keywords_missing": [string],
  "estimated_experience_years": number,
  "career_level": string ("Entry"|"Junior"|"Mid"|"Senior"|"Lead"|"Principal"|"Executive"),
  "industry_fit": [string],
  "rewritten_bullet_examples": [
    { "original": string, "improved": string, "reason": string }
  ]
}

## Scoring Guide
- 90–100 → A+ / A : Exceptional, ready to send immediately
- 80–89  → A- / B+: Strong with minor polish needed
- 70–79  → B  / B-: Good foundation, several improvements recommended
- 60–69  → C       : Average, significant work needed
- Below 60 → D/F   : Major overhaul required

## Rules
1. ONLY return raw JSON — no backticks, no markdown, no explanations outside JSON
2. Every score must be an integer 0–100
3. Provide at least 3 items in key_strengths, critical_improvements, and quick_wins
4. Provide 2–3 rewritten_bullet_examples from actual bullets in the resume (or note "N/A – no bullets found" if absent)
5. Be honest, specific, and constructive — avoid vague platitudes
6. Do not fabricate details not present in the resume
7. The Current Date is November 2026, keep that in mind when analysing dates"""

USER_PROMPT_TEMPLATE = """Please analyse the following resume and return your structured JSON assessment.

---RESUME START---
{resume_text}
---RESUME END---

Remember: return ONLY the raw JSON object, no markdown, no extra text."""

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes) -> str:
    reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = docx.Document(io.BytesIO(file_bytes))
    return "\n".join(para.text for para in doc.paragraphs)


def extract_text(file_bytes: bytes, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "pdf":
        return extract_text_from_pdf(file_bytes)
    elif ext in ("docx", "doc"):
        return extract_text_from_docx(file_bytes)
    elif ext == "txt":
        return file_bytes.decode("utf-8", errors="ignore")
    raise ValueError(f"Unsupported file type: .{ext}")


def call_gemini(resume_text: str) -> dict:
    client = genai.Client(api_key=GOOGLE_API_KEY)
    user_prompt = USER_PROMPT_TEMPLATE.format(resume_text=resume_text)
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.2,
        ),
    )
    raw = response.text.strip()

    # Strip any accidental markdown fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    return json.loads(raw)


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyse", methods=["POST"])
def analyse():
    if not GOOGLE_API_KEY:
        return jsonify({"error": "GOOGLE_API_KEY not set on the server."}), 500

    if "resume" not in request.files:
        return jsonify({"error": "No file uploaded. Send a file under the key 'resume'."}), 400

    file = request.files["resume"]
    if not file.filename:
        return jsonify({"error": "Empty filename."}), 400

    try:
        file_bytes = file.read()
        resume_text = extract_text(file_bytes, file.filename)

        if len(resume_text.strip()) < 50:
            return jsonify({"error": "Could not extract meaningful text from the resume. Try a different format."}), 422

        result = call_gemini(resume_text)
        return jsonify(result)

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except json.JSONDecodeError as je:
        return jsonify({"error": f"Model returned invalid JSON: {je}"}), 500
    except Exception:
        return jsonify({"error": traceback.format_exc()}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
