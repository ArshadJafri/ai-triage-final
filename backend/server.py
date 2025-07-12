from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
from emergentintegrations.llm.chat import LlmChat, UserMessage
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class SymptomInput(BaseModel):
    location: str
    symptoms: List[str]
    severity: int  # 1-10
    duration: str
    associated_symptoms: List[str]
    medical_history: List[str]
    age: Optional[int] = None
    gender: Optional[str] = None

class TriageSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: Optional[str] = None
    symptoms: Optional[SymptomInput] = None
    urgency_level: Optional[str] = None  # Emergency, Urgent, Routine, Self-Care
    ai_analysis: Optional[str] = None
    recommended_actions: Optional[List[str]] = None
    confidence_score: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ChatMessage(BaseModel):
    session_id: str
    message: str
    sender: str  # 'user' or 'ai'
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ChatResponse(BaseModel):
    response: str
    follow_up_questions: Optional[List[str]] = None

# Initialize OpenAI chat
def get_ai_chat(session_id: str):
    return LlmChat(
        api_key=os.environ['OPENAI_API_KEY'],
        session_id=session_id,
        system_message="""You are an AI medical triage assistant. Your role is to:
1. Analyze patient symptoms and provide accurate medical assessments
2. Classify urgency levels: Emergency (immediate care), Urgent (same day), Routine (within days), Self-Care
3. Ask clarifying questions to better understand symptoms
4. Provide clear, helpful recommendations while emphasizing that this is not a substitute for professional medical advice
5. Be empathetic and reassuring while maintaining medical accuracy

Always respond in JSON format with the following structure:
{
    "analysis": "Your medical analysis",
    "urgency_level": "Emergency|Urgent|Routine|Self-Care",
    "confidence_score": 0.0-1.0,
    "recommended_actions": ["action1", "action2"],
    "follow_up_questions": ["question1", "question2"] (optional)
}

For emergency situations (severe chest pain, difficulty breathing, severe bleeding, etc.), always classify as "Emergency" and recommend immediate medical attention."""
    ).with_model("openai", "gpt-4o")

# Basic routes
@api_router.get("/")
async def root():
    return {"message": "Telehealth AI Triage Platform"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# AI Triage Routes
@api_router.post("/triage/start")
async def start_triage():
    """Start a new triage session"""
    session = TriageSession()
    await db.triage_sessions.insert_one(session.dict())
    return {"session_id": session.id, "message": "Triage session started"}

@api_router.post("/triage/symptoms/{session_id}")
async def submit_symptoms(session_id: str, symptoms: SymptomInput):
    """Submit symptoms for AI analysis"""
    try:
        # Get AI chat instance
        ai_chat = get_ai_chat(session_id)
        
        # Prepare symptom data for AI analysis
        symptom_data = f"""
Patient presents with:
- Location: {symptoms.location}
- Primary symptoms: {', '.join(symptoms.symptoms)}
- Severity: {symptoms.severity}/10
- Duration: {symptoms.duration}
- Associated symptoms: {', '.join(symptoms.associated_symptoms)}
- Medical history: {', '.join(symptoms.medical_history)}
- Age: {symptoms.age or 'Not provided'}
- Gender: {symptoms.gender or 'Not provided'}

Please provide your medical triage assessment.
"""
        
        # Get AI analysis
        user_message = UserMessage(text=symptom_data)
        ai_response = await ai_chat.send_message(user_message)
        
        # Parse AI response
        try:
            ai_data = json.loads(ai_response)
        except:
            # Fallback if JSON parsing fails
            ai_data = {
                "analysis": ai_response,
                "urgency_level": "Routine",
                "confidence_score": 0.7,
                "recommended_actions": ["Consult with a healthcare provider"],
                "follow_up_questions": []
            }
        
        # Update session in database
        update_data = {
            "symptoms": symptoms.dict(),
            "urgency_level": ai_data.get("urgency_level", "Routine"),
            "ai_analysis": ai_data.get("analysis", ""),
            "recommended_actions": ai_data.get("recommended_actions", []),
            "confidence_score": ai_data.get("confidence_score", 0.7),
            "updated_at": datetime.utcnow()
        }
        
        await db.triage_sessions.update_one(
            {"id": session_id},
            {"$set": update_data}
        )
        
        return {
            "session_id": session_id,
            "urgency_level": ai_data.get("urgency_level"),
            "analysis": ai_data.get("analysis"),
            "recommended_actions": ai_data.get("recommended_actions"),
            "confidence_score": ai_data.get("confidence_score"),
            "follow_up_questions": ai_data.get("follow_up_questions", [])
        }
        
    except Exception as e:
        # Handle OpenAI quota exceeded gracefully
        if "quota" in str(e).lower() or "rate" in str(e).lower():
            # Provide fallback response based on symptom severity
            fallback_urgency = "Routine"
            fallback_analysis = "Our AI system is currently experiencing high demand. Based on your symptoms, please consider consulting with a healthcare provider."
            fallback_actions = ["Schedule an appointment with your healthcare provider", "Monitor your symptoms", "Seek immediate care if symptoms worsen"]
            
            # Adjust urgency based on severity and symptoms
            if symptoms.severity >= 8 or any(emergency_symptom in [s.lower() for s in symptoms.symptoms] for emergency_symptom in ['chest pain', 'difficulty breathing', 'severe bleeding']):
                fallback_urgency = "Urgent"
                fallback_analysis = "Based on your high severity symptoms, you should seek medical attention promptly."
                fallback_actions = ["Seek immediate medical attention", "Call emergency services if symptoms are severe", "Do not delay medical care"]
            elif symptoms.severity >= 6:
                fallback_urgency = "Urgent"
                fallback_actions = ["Schedule same-day appointment if possible", "Monitor symptoms closely", "Seek immediate care if symptoms worsen"]
            
            # Update session with fallback data
            update_data = {
                "symptoms": symptoms.dict(),
                "urgency_level": fallback_urgency,
                "ai_analysis": fallback_analysis,
                "recommended_actions": fallback_actions,
                "confidence_score": 0.6,
                "updated_at": datetime.utcnow()
            }
            
            await db.triage_sessions.update_one(
                {"id": session_id},
                {"$set": update_data}
            )
            
            return {
                "session_id": session_id,
                "urgency_level": fallback_urgency,
                "analysis": fallback_analysis,
                "recommended_actions": fallback_actions,
                "confidence_score": 0.6,
                "follow_up_questions": []
            }
        
        raise HTTPException(status_code=500, detail=f"Error processing symptoms: {str(e)}")

@api_router.post("/triage/chat/{session_id}")
async def chat_with_ai(session_id: str, request: dict):
    """Continue conversation with AI for symptom clarification"""
    try:
        message = request.get("message", "")
        if not message:
            raise HTTPException(status_code=400, detail="Message is required")
            
        # Save user message
        user_msg = ChatMessage(
            session_id=session_id,
            message=message,
            sender="user"
        )
        await db.chat_messages.insert_one(user_msg.dict())
        
        # Get AI response
        ai_chat = get_ai_chat(session_id)
        user_message = UserMessage(text=message)
        ai_response = await ai_chat.send_message(user_message)
        
        # Save AI response
        ai_msg = ChatMessage(
            session_id=session_id,
            message=ai_response,
            sender="ai"
        )
        await db.chat_messages.insert_one(ai_msg.dict())
        
        return {"response": ai_response}
        
    except Exception as e:
        if "quota" in str(e).lower():
            return {"response": "I'm currently experiencing high demand. Please try again in a few moments, or consult with a healthcare professional if this is urgent."}
        raise HTTPException(status_code=500, detail=f"Error in chat: {str(e)}")

@api_router.get("/triage/session/{session_id}")
async def get_triage_session(session_id: str):
    """Get triage session details"""
    try:
        session = await db.triage_sessions.find_one({"id": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Get chat history
        chat_messages = await db.chat_messages.find({"session_id": session_id}).to_list(100)
        
        return {
            "session": session,
            "chat_history": chat_messages
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving session: {str(e)}")

@api_router.get("/triage/urgency-stats")
async def get_urgency_stats():
    """Get urgency level statistics"""
    pipeline = [
        {"$group": {
            "_id": "$urgency_level",
            "count": {"$sum": 1}
        }}
    ]
    
    stats = await db.triage_sessions.aggregate(pipeline).to_list(10)
    return {"urgency_stats": stats}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()