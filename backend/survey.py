# survey.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import csv
import os

app = FastAPI()

# Allow requests from your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # replace "*" with your frontend origin in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the survey model
class SurveyEntry(BaseModel):
    name: str
    email: str
    interest: str  # e.g., "programming", "design", "marketing"
    notes: str = ""  # optional

# CSV file path
CSV_FILE = "survey_responses.csv"

@app.post("/submit_survey/")
async def submit_survey(entry: SurveyEntry):
    # Ensure CSV file exists and write header if needed
    file_exists = os.path.isfile(CSV_FILE)
    try:
        with open(CSV_FILE, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(["Name", "Email", "Interest", "Notes"])
            writer.writerow([entry.name, entry.email, entry.interest, entry.notes])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save survey: {str(e)}")

    return {"status": "success", "message": "Survey submitted successfully!"}