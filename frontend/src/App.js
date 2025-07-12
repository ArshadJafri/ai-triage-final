import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Body diagram data for symptom locations
const bodyParts = [
  { id: 'head', name: 'Head & Neck', x: 50, y: 15 },
  { id: 'chest', name: 'Chest', x: 50, y: 35 },
  { id: 'abdomen', name: 'Abdomen', x: 50, y: 50 },
  { id: 'back', name: 'Back', x: 75, y: 40 },
  { id: 'left-arm', name: 'Left Arm', x: 25, y: 35 },
  { id: 'right-arm', name: 'Right Arm', x: 75, y: 35 },
  { id: 'left-leg', name: 'Left Leg', x: 40, y: 75 },
  { id: 'right-leg', name: 'Right Leg', x: 60, y: 75 }
];

const commonSymptoms = [
  'Pain', 'Swelling', 'Numbness', 'Tingling', 'Burning', 'Stiffness',
  'Weakness', 'Cramping', 'Throbbing', 'Sharp pain', 'Dull ache', 'Itching'
];

const durationOptions = [
  'Less than 1 hour', '1-6 hours', '6-24 hours', '1-3 days',
  '3-7 days', '1-2 weeks', '2-4 weeks', 'More than 1 month'
];

const associatedSymptoms = [
  'Fever', 'Nausea', 'Vomiting', 'Dizziness', 'Headache', 'Fatigue',
  'Shortness of breath', 'Rapid heartbeat', 'Sweating', 'Chills'
];

const medicalHistory = [
  'Diabetes', 'High blood pressure', 'Heart disease', 'Asthma',
  'Allergies', 'Previous surgery', 'Current medications', 'Pregnancy'
];

function App() {
  const [currentStep, setCurrentStep] = useState('welcome');
  const [sessionId, setSessionId] = useState(null);
  const [formData, setFormData] = useState({
    location: '',
    symptoms: [],
    severity: 5,
    duration: '',
    associated_symptoms: [],
    medical_history: [],
    age: '',
    gender: ''
  });
  const [triageResult, setTriageResult] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const startTriage = async () => {
    try {
      const response = await axios.post(`${API}/triage/start`);
      setSessionId(response.data.session_id);
      setCurrentStep('symptoms');
    } catch (error) {
      console.error('Error starting triage:', error);
    }
  };

  const submitSymptoms = async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/triage/symptoms/${sessionId}`, formData);
      setTriageResult(response.data);
      setCurrentStep('results');
    } catch (error) {
      console.error('Error submitting symptoms:', error);
    }
    setIsLoading(false);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !sessionId) return;
    
    const userMessage = { sender: 'user', message: chatInput, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);
    
    try {
      const response = await axios.post(`${API}/triage/chat/${sessionId}`, {
        message: chatInput
      });
      const aiMessage = { sender: 'ai', message: response.data.response, timestamp: new Date() };
      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending chat message:', error);
      // Add error message to chat
      const errorMessage = { 
        sender: 'ai', 
        message: 'I apologize, but I\'m having trouble responding right now. Please try again or consult with a healthcare professional if this is urgent.', 
        timestamp: new Date() 
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
    
    setChatInput('');
  };

  const getUrgencyColor = (level) => {
    switch(level) {
      case 'Emergency': return 'bg-red-100 border-red-500 text-red-800';
      case 'Urgent': return 'bg-orange-100 border-orange-500 text-orange-800';
      case 'Routine': return 'bg-blue-100 border-blue-500 text-blue-800';
      case 'Self-Care': return 'bg-green-100 border-green-500 text-green-800';
      default: return 'bg-gray-100 border-gray-500 text-gray-800';
    }
  };

  const toggleArrayItem = (array, item, setArray) => {
    if (array.includes(item)) {
      setArray(array.filter(i => i !== item));
    } else {
      setArray([...array, item]);
    }
  };

  if (currentStep === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
              <div className="mb-8">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">AI-Powered Medical Triage</h1>
                <p className="text-xl text-gray-600 mb-8">Get instant, intelligent assessment of your symptoms with our advanced AI system</p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Instant Analysis</h3>
                  <p className="text-gray-600">AI-powered symptom assessment in seconds</p>
                </div>
                
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Smart Urgency Classification</h3>
                  <p className="text-gray-600">Emergency, Urgent, Routine, or Self-Care</p>
                </div>
                
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Interactive AI Chat</h3>
                  <p className="text-gray-600">Ask questions and get clarifications</p>
                </div>
              </div>
              
              <button
                onClick={startTriage}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-xl transition duration-200 transform hover:scale-105 shadow-lg"
              >
                Start Symptom Assessment
              </button>
              
              <p className="text-sm text-gray-500 mt-4">
                * This AI assessment is not a substitute for professional medical advice
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'symptoms') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Symptom Assessment</h2>
              
              {/* Body Diagram */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Where are you experiencing symptoms?</h3>
                <div className="relative bg-gray-100 rounded-lg p-6 h-96">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    {/* Simple body outline */}
                    <ellipse cx="50" cy="12" rx="8" ry="10" fill="#e5e7eb" stroke="#6b7280" strokeWidth="0.5"/>
                    <rect x="42" y="22" width="16" height="25" rx="2" fill="#e5e7eb" stroke="#6b7280" strokeWidth="0.5"/>
                    <rect x="42" y="47" width="16" height="20" rx="2" fill="#e5e7eb" stroke="#6b7280" strokeWidth="0.5"/>
                    <rect x="25" y="25" width="12" height="20" rx="2" fill="#e5e7eb" stroke="#6b7280" strokeWidth="0.5"/>
                    <rect x="63" y="25" width="12" height="20" rx="2" fill="#e5e7eb" stroke="#6b7280" strokeWidth="0.5"/>
                    <rect x="38" y="67" width="8" height="25" rx="2" fill="#e5e7eb" stroke="#6b7280" strokeWidth="0.5"/>
                    <rect x="54" y="67" width="8" height="25" rx="2" fill="#e5e7eb" stroke="#6b7280" strokeWidth="0.5"/>
                    
                    {/* Interactive body parts */}
                    {bodyParts.map(part => (
                      <circle
                        key={part.id}
                        cx={part.x}
                        cy={part.y}
                        r="4"
                        fill={formData.location === part.id ? "#3b82f6" : "#6b7280"}
                        stroke="#fff"
                        strokeWidth="1"
                        className="cursor-pointer hover:fill-blue-500 transition-colors"
                        onClick={() => setFormData({...formData, location: part.id})}
                      />
                    ))}
                  </svg>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                  {bodyParts.map(part => (
                    <button
                      key={part.id}
                      onClick={() => setFormData({...formData, location: part.id})}
                      className={`p-2 rounded-lg border text-sm ${
                        formData.location === part.id 
                          ? 'bg-blue-100 border-blue-500 text-blue-800' 
                          : 'bg-white border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      {part.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Symptoms */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-4">What symptoms are you experiencing?</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {commonSymptoms.map(symptom => (
                    <button
                      key={symptom}
                      onClick={() => toggleArrayItem(formData.symptoms, symptom, (newSymptoms) => 
                        setFormData({...formData, symptoms: newSymptoms}))}
                      className={`p-3 rounded-lg border text-sm ${
                        formData.symptoms.includes(symptom)
                          ? 'bg-blue-100 border-blue-500 text-blue-800'
                          : 'bg-white border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      {symptom}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-4">Rate your pain/discomfort (1-10)</h3>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">Mild</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={formData.severity}
                    onChange={(e) => setFormData({...formData, severity: parseInt(e.target.value)})}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm text-gray-600">Severe</span>
                  <span className="text-lg font-semibold text-blue-600 min-w-[2rem]">{formData.severity}</span>
                </div>
              </div>

              {/* Duration */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-4">How long have you had these symptoms?</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {durationOptions.map(duration => (
                    <button
                      key={duration}
                      onClick={() => setFormData({...formData, duration})}
                      className={`p-3 rounded-lg border text-sm ${
                        formData.duration === duration
                          ? 'bg-blue-100 border-blue-500 text-blue-800'
                          : 'bg-white border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      {duration}
                    </button>
                  ))}
                </div>
              </div>

              {/* Associated Symptoms */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-4">Any associated symptoms?</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {associatedSymptoms.map(symptom => (
                    <button
                      key={symptom}
                      onClick={() => toggleArrayItem(formData.associated_symptoms, symptom, (newSymptoms) => 
                        setFormData({...formData, associated_symptoms: newSymptoms}))}
                      className={`p-3 rounded-lg border text-sm ${
                        formData.associated_symptoms.includes(symptom)
                          ? 'bg-orange-100 border-orange-500 text-orange-800'
                          : 'bg-white border-gray-300 hover:border-orange-300'
                      }`}
                    >
                      {symptom}
                    </button>
                  ))}
                </div>
              </div>

              {/* Medical History */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Relevant medical history</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {medicalHistory.map(condition => (
                    <button
                      key={condition}
                      onClick={() => toggleArrayItem(formData.medical_history, condition, (newHistory) => 
                        setFormData({...formData, medical_history: newHistory}))}
                      className={`p-3 rounded-lg border text-sm ${
                        formData.medical_history.includes(condition)
                          ? 'bg-purple-100 border-purple-500 text-purple-800'
                          : 'bg-white border-gray-300 hover:border-purple-300'
                      }`}
                    >
                      {condition}
                    </button>
                  ))}
                </div>
              </div>

              {/* Age & Gender */}
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({...formData, age: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your age"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <button
                onClick={submitSymptoms}
                disabled={!formData.location || formData.symptoms.length === 0 || !formData.duration || isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-4 px-8 rounded-xl transition duration-200"
              >
                {isLoading ? 'Analyzing Symptoms...' : 'Get AI Assessment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'results') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Results Panel */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">AI Triage Assessment</h2>
                  
                  {triageResult && (
                    <>
                      {/* Urgency Level */}
                      <div className={`p-6 rounded-xl border-2 mb-6 ${getUrgencyColor(triageResult.urgency_level)}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-xl font-bold">Urgency Level: {triageResult.urgency_level}</h3>
                            <p className="text-sm opacity-75">Confidence: {Math.round(triageResult.confidence_score * 100)}%</p>
                          </div>
                          <div className="text-3xl">
                            {triageResult.urgency_level === 'Emergency' && '🚨'}
                            {triageResult.urgency_level === 'Urgent' && '⚠️'}
                            {triageResult.urgency_level === 'Routine' && '📅'}
                            {triageResult.urgency_level === 'Self-Care' && '🏠'}
                          </div>
                        </div>
                      </div>

                      {/* AI Analysis */}
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold mb-3">AI Analysis</h4>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-gray-700">{triageResult.analysis}</p>
                        </div>
                      </div>

                      {/* Recommended Actions */}
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold mb-3">Recommended Actions</h4>
                        <ul className="space-y-2">
                          {triageResult.recommended_actions?.map((action, index) => (
                            <li key={index} className="flex items-start">
                              <span className="text-blue-600 mr-2">•</span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Follow-up Questions */}
                      {triageResult.follow_up_questions && triageResult.follow_up_questions.length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-lg font-semibold mb-3">Additional Questions for Clarification</h4>
                          <div className="space-y-2">
                            {triageResult.follow_up_questions.map((question, index) => (
                              <div key={index} className="bg-blue-50 p-3 rounded-lg">
                                <p className="text-blue-800">{question}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Chat Panel */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-xl p-6 h-[600px] flex flex-col">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Ask AI Questions</h3>
                  
                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                    {chatMessages.map((msg, index) => (
                      <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-lg ${
                          msg.sender === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          <p className="text-sm">{msg.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Chat Input */}
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                      placeholder="Ask about your symptoms..."
                      className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={sendChatMessage}
                      className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="mt-8 text-center">
              <button
                onClick={() => {
                  setCurrentStep('welcome');
                  setSessionId(null);
                  setTriageResult(null);
                  setChatMessages([]);
                  setFormData({
                    location: '',
                    symptoms: [],
                    severity: 5,
                    duration: '',
                    associated_symptoms: [],
                    medical_history: [],
                    age: '',
                    gender: ''
                  });
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg"
              >
                Start New Assessment
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default App;