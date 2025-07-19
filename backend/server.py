from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect
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
import json
import socketio
from socketio import AsyncServer
import asyncio
import openai

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url,tls=True)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ai-triage-final-h9wk172is-arshad-jafris-projects.vercel.app","https://ai-triage-final.vercel.app"],  # or ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# Create Socket.IO server for WebRTC signaling
sio = AsyncServer(cors_allowed_origins="http://localhost:3000", async_mode="asgi")
socket_app = socketio.ASGIApp(socketio_server=sio, other_asgi_app=app)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")
app.include_router(api_router)

# WebRTC connection management
active_calls = {}  # call_id -> {patient_socket, provider_socket, status}
waiting_room = {}  # patient_id -> {socket_id, triage_data, wait_time}

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
    patient_name: Optional[str] = None
    symptoms: Optional[SymptomInput] = None
    urgency_level: Optional[str] = None  # Emergency, Urgent, Routine, Self-Care
    ai_analysis: Optional[str] = None
    recommended_actions: Optional[List[str]] = None
    confidence_score: Optional[float] = None
    status: str = "pending"  # pending, in_consultation, completed
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

class VideoConsultation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    triage_session_id: str
    patient_id: str
    provider_id: Optional[str] = None
    status: str = "waiting"  # waiting, in_progress, completed, cancelled
    scheduled_time: Optional[datetime] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    recording_url: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Provider(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    specialization: str
    license_number: str
    status: str = "available"  # available, busy, offline
    rating: float = 5.0
    consultations_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Patient(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    emergency_contact: Optional[str] = None
    insurance_info: Optional[Dict] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Helper function to call OpenAI Chat API
async def call_openai_chat(session_id: str, user_message: str, system_message: str = None):
    openai.api_key = os.environ["OPENAI_API_KEY"]
    messages = []
    if system_message:
        messages.append({"role": "system", "content": system_message})
    messages.append({"role": "user", "content": user_message})
    response = await openai.AsyncOpenAI().chat.completions.create(
        model="gpt-4o",
        messages=messages,
        max_tokens=512,
        temperature=0.2,
        user=session_id
    )
    return response.choices[0].message.content

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
        system_message = """You are an AI medical triage assistant. Your role is to:\n1. Analyze patient symptoms and provide accurate medical assessments\n2. Classify urgency levels: Emergency (immediate care), Urgent (same day), Routine (within days), Self-Care\n3. Ask clarifying questions to better understand symptoms\n4. Provide clear, helpful recommendations while emphasizing that this is not a substitute for professional medical advice\n5. Be empathetic and reassuring while maintaining medical accuracy\n\nAlways respond in JSON format with the following structure:\n{\n    \"analysis\": \"Your medical analysis\",\n    \"urgency_level\": \"Emergency|Urgent|Routine|Self-Care\",\n    \"confidence_score\": 0.0-1.0,\n    \"recommended_actions\": [\"action1\", \"action2\"],\n    \"follow_up_questions\": [\"question1\", \"question2\"] (optional)\n}\n\nFor emergency situations (severe chest pain, difficulty breathing, severe bleeding, etc.), always classify as \"Emergency\" and recommend immediate medical attention."""
        ai_response = await call_openai_chat(session_id, symptom_data, system_message)
        try:
            ai_data = json.loads(ai_response)
        except:
            ai_data = {
                "analysis": ai_response,
                "urgency_level": "Routine",
                "confidence_score": 0.7,
                "recommended_actions": ["Consult with a healthcare provider"],
                "follow_up_questions": []
            }
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
        
        # Use the same system message as above for context
        system_message = """You are an AI medical triage assistant. Your role is to:\n1. Analyze patient symptoms and provide accurate medical assessments\n2. Classify urgency levels: Emergency (immediate care), Urgent (same day), Routine (within days), Self-Care\n3. Ask clarifying questions to better understand symptoms\n4. Provide clear, helpful recommendations while emphasizing that this is not a substitute for professional medical advice\n5. Be empathetic and reassuring while maintaining medical accuracy\n\nAlways respond in JSON format with the following structure:\n{\n    \"analysis\": \"Your medical analysis\",\n    \"urgency_level\": \"Emergency|Urgent|Routine|Self-Care\",\n    \"confidence_score\": 0.0-1.0,\n    \"recommended_actions\": [\"action1\", \"action2\"],\n    \"follow_up_questions\": [\"question1\", \"question2\"] (optional)\n}\n\nFor emergency situations (severe chest pain, difficulty breathing, severe bleeding, etc.), always classify as \"Emergency\" and recommend immediate medical attention."""
        ai_response = await call_openai_chat(session_id, message, system_message)
        
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
        
        # Remove MongoDB _id field
        if "_id" in session:
            del session["_id"]
        
        # Get chat history
        chat_messages = await db.chat_messages.find({"session_id": session_id}).to_list(100)
        for msg in chat_messages:
            if "_id" in msg:
                del msg["_id"]
        
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

# Video Consultation Routes
@api_router.post("/consultation/create")
async def create_consultation(triage_session_id: str, patient_name: str):
    """Create a video consultation from triage session"""
    # Get triage session
    triage_session = await db.triage_sessions.find_one({"id": triage_session_id})
    if not triage_session:
        raise HTTPException(status_code=404, detail="Triage session not found")
    
    # Create patient if not exists
    patient_id = str(uuid.uuid4())
    patient = Patient(id=patient_id, name=patient_name, email=f"{patient_name.lower().replace(' ', '')}@temp.com")
    await db.patients.insert_one(patient.dict())
    
    # Create consultation
    consultation = VideoConsultation(
        triage_session_id=triage_session_id,
        patient_id=patient_id,
        status="waiting"
    )
    await db.consultations.insert_one(consultation.dict())
    
    # Update triage session
    await db.triage_sessions.update_one(
        {"id": triage_session_id},
        {"$set": {"patient_id": patient_id, "patient_name": patient_name, "status": "waiting_consultation"}}
    )
    
    return {
        "consultation_id": consultation.id,
        "patient_id": patient_id,
        "status": "waiting",
        "estimated_wait": "5-10 minutes"
    }

@api_router.get("/consultation/queue")
async def get_consultation_queue():
    """Get patient queue for providers"""
    pipeline = [
        {
            "$lookup": {
                "from": "triage_sessions",
                "localField": "triage_session_id",
                "foreignField": "id",
                "as": "triage"
            }
        },
        {
            "$lookup": {
                "from": "patients",
                "localField": "patient_id",
                "foreignField": "id",
                "as": "patient"
            }
        },
        {"$match": {"status": {"$in": ["waiting", "in_progress"]}}},
        {"$sort": {"created_at": 1}}
    ]
    
    queue = await db.consultations.aggregate(pipeline).to_list(50)
    
    # Process queue data
    processed_queue = []
    for item in queue:
        triage_data = item.get("triage", [{}])[0]
        patient_data = item.get("patient", [{}])[0]
        
        processed_queue.append({
            "consultation_id": item["id"],
            "patient_name": patient_data.get("name", "Unknown"),
            "urgency_level": triage_data.get("urgency_level", "Routine"),
            "symptoms": triage_data.get("symptoms", {}),
            "wait_time": (datetime.utcnow() - item["created_at"]).seconds // 60,
            "status": item["status"]
        })
    
    return {"queue": processed_queue}

@api_router.post("/consultation/{consultation_id}/start")
async def start_consultation(consultation_id: str, provider_id: str):
    """Start a video consultation"""
    consultation = await db.consultations.find_one({"id": consultation_id})
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    # Update consultation status
    await db.consultations.update_one(
        {"id": consultation_id},
        {
            "$set": {
                "provider_id": provider_id,
                "status": "in_progress",
                "started_at": datetime.utcnow()
            }
        }
    )
    
    return {"message": "Consultation started", "consultation_id": consultation_id}

@api_router.post("/consultation/{consultation_id}/end")
async def end_consultation(consultation_id: str, notes: str = ""):
    """End a video consultation"""
    await db.consultations.update_one(
        {"id": consultation_id},
        {
            "$set": {
                "status": "completed",
                "ended_at": datetime.utcnow(),
                "notes": notes
            }
        }
    )
    
    return {"message": "Consultation ended", "consultation_id": consultation_id}

@api_router.get("/consultation/{consultation_id}")
async def get_consultation(consultation_id: str):
    """Get consultation details"""
    consultation = await db.consultations.find_one({"id": consultation_id})
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    # Remove MongoDB _id field
    if "_id" in consultation:
        del consultation["_id"]
    
    return consultation

# Provider Routes
@api_router.post("/providers")
async def create_provider(provider: Provider):
    """Create a new provider"""
    await db.providers.insert_one(provider.dict())
    return provider

@api_router.get("/providers")
async def get_providers():
    """Get all providers"""
    providers = await db.providers.find().to_list(100)
    for provider in providers:
        if "_id" in provider:
            del provider["_id"]
    return providers

@api_router.get("/providers/available")
async def get_available_providers():
    """Get available providers"""
    providers = await db.providers.find({"status": "available"}).to_list(100)
    return providers

# Socket.IO Events for WebRTC
@sio.event
async def connect(sid, environ):
    print(f"Client {sid} connected")

@sio.event
async def disconnect(sid):
    print(f"Client {sid} disconnected")
    # Clean up any active calls
    for call_id, call_data in list(active_calls.items()):
        if call_data.get("patient_socket") == sid or call_data.get("provider_socket") == sid:
            # Notify other party of disconnection
            other_sid = call_data.get("provider_socket") if call_data.get("patient_socket") == sid else call_data.get("patient_socket")
            if other_sid:
                await sio.emit("call_ended", {"reason": "peer_disconnected"}, room=other_sid)
            del active_calls[call_id]

@sio.event
async def join_waiting_room(sid, data):
    """Patient joins waiting room"""
    consultation_id = data.get("consultation_id")
    triage_data = data.get("triage_data", {})
    
    waiting_room[consultation_id] = {
        "socket_id": sid,
        "triage_data": triage_data,
        "joined_at": datetime.utcnow()
    }
    
    await sio.emit("waiting_room_joined", {"consultation_id": consultation_id}, room=sid)
    
    # Notify providers of new patient in queue
    await sio.emit("queue_updated", {"action": "patient_joined", "consultation_id": consultation_id})

@sio.event
async def provider_ready(sid, data):
    """Provider indicates they're ready to take calls"""
    provider_id = data.get("provider_id")
    await sio.emit("provider_online", {"provider_id": provider_id})

@sio.event
async def start_call(sid, data):
    """Initiate video call between patient and provider"""
    consultation_id = data.get("consultation_id")
    caller_type = data.get("caller_type")  # "patient" or "provider"
    
    call_id = str(uuid.uuid4())
    
    if caller_type == "provider":
        # Provider starting call with patient
        patient_data = waiting_room.get(consultation_id)
        if patient_data:
            patient_sid = patient_data["socket_id"]
            active_calls[call_id] = {
                "patient_socket": patient_sid,
                "provider_socket": sid,
                "consultation_id": consultation_id,
                "status": "connecting"
            }
            
            # Notify patient of incoming call
            await sio.emit("incoming_call", {
                "call_id": call_id,
                "consultation_id": consultation_id,
                "from": "provider"
            }, room=patient_sid)
            
            # Remove from waiting room
            del waiting_room[consultation_id]

@sio.event
async def accept_call(sid, data):
    """Accept incoming video call"""
    call_id = data.get("call_id")
    if call_id in active_calls:
        active_calls[call_id]["status"] = "active"
        
        # Notify both parties
        await sio.emit("call_accepted", {"call_id": call_id}, room=active_calls[call_id]["patient_socket"])
        await sio.emit("call_accepted", {"call_id": call_id}, room=active_calls[call_id]["provider_socket"])

@sio.event
async def webrtc_offer(sid, data):
    """Forward WebRTC offer"""
    call_id = data.get("call_id")
    offer = data.get("offer")
    
    if call_id in active_calls:
        call_data = active_calls[call_id]
        target_sid = call_data["provider_socket"] if call_data["patient_socket"] == sid else call_data["patient_socket"]
        
        await sio.emit("webrtc_offer", {
            "call_id": call_id,
            "offer": offer,
            "from": sid
        }, room=target_sid)

@sio.event
async def webrtc_answer(sid, data):
    """Forward WebRTC answer"""
    call_id = data.get("call_id")
    answer = data.get("answer")
    
    if call_id in active_calls:
        call_data = active_calls[call_id]
        target_sid = call_data["provider_socket"] if call_data["patient_socket"] == sid else call_data["patient_socket"]
        
        await sio.emit("webrtc_answer", {
            "call_id": call_id,
            "answer": answer,
            "from": sid
        }, room=target_sid)

@sio.event
async def webrtc_ice_candidate(sid, data):
    """Forward ICE candidates"""
    call_id = data.get("call_id")
    candidate = data.get("candidate")
    
    if call_id in active_calls:
        call_data = active_calls[call_id]
        target_sid = call_data["provider_socket"] if call_data["patient_socket"] == sid else call_data["patient_socket"]
        
        await sio.emit("webrtc_ice_candidate", {
            "call_id": call_id,
            "candidate": candidate,
            "from": sid
        }, room=target_sid)

@sio.event
async def end_call(sid, data):
    """End video call"""
    call_id = data.get("call_id")
    
    if call_id in active_calls:
        call_data = active_calls[call_id]
        
        # Notify both parties
        await sio.emit("call_ended", {"call_id": call_id}, room=call_data["patient_socket"])
        await sio.emit("call_ended", {"call_id": call_id}, room=call_data["provider_socket"])
        
        # Clean up
        del active_calls[call_id]

# Include the router in the main app
app.include_router(api_router)

# Mount Socket.IO
app.mount("/socket.io", socket_app)



# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()