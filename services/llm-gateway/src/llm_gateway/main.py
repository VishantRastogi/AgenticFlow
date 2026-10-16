from fastapi import FastAPI
from pydantic import BaseModel, Field

class ChatRequest(BaseModel):
	prompt: str = Field(description="The prompt to send to the LLM", min_length=3, max_length=1000)

app = FastAPI()

@app.get("/health")
def health_check():
	return { "status": "ok" }

@app.post("/chat")
def chat(request: ChatRequest):
	return { "message": request.prompt }