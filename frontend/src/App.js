import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import axios from "axios";
import io from "socket.io-client";
import SimplePeer from "simple-peer";

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

// Video Call Component
const VideoCall = ({ consultationId, userType, onEndCall }) => {
  const [socket, setSocket] = useState(null);
  const [peer, setPeer] = useState(null);
  const [callId, setCallId] = useState(null);
  const [callStatus, setCallStatus] = useState('connecting'); // connecting, active, ended
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const localStreamRef = useRef();

  useEffect(() => {
    const socketConnection = io(BACKEND_URL);
    setSocket(socketConnection);

    // Get user media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch(err => console.error('Error accessing media devices:', err));

    // Socket event listeners
    socketConnection.on('incoming_call', (data) => {
      setCallId(data.call_id);
      if (userType === 'patient') {
        // Auto-accept for patient
        socketConnection.emit('accept_call', { call_id: data.call_id });
      }
    });

    socketConnection.on('call_accepted', (data) => {
      setCallStatus('active');
      initializePeerConnection(data.call_id, userType === 'provider');
    });

    socketConnection.on('webrtc_offer', (data) => {
      if (peer) {
        peer.signal(data.offer);
      }
    });

    socketConnection.on('webrtc_answer', (data) => {
      if (peer) {
        peer.signal(data.answer);
      }
    });

    socketConnection.on('webrtc_ice_candidate', (data) => {
      if (peer) {
        peer.signal(data.candidate);
      }
    });

    socketConnection.on('call_ended', () => {
      setCallStatus('ended');
      if (peer) {
        peer.destroy();
      }
      onEndCall();
    });

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peer) {
        peer.destroy();
      }
      socketConnection.disconnect();
    };
  }, []);

  const initializePeerConnection = (callId, isInitiator) => {
    const peerConnection = new SimplePeer({
      initiator: isInitiator,
      trickle: false,
      stream: localStreamRef.current
    });

    peerConnection.on('signal', (data) => {
      if (data.type === 'offer') {
        socket.emit('webrtc_offer', { call_id: callId, offer: data });
      } else if (data.type === 'answer') {
        socket.emit('webrtc_answer', { call_id: callId, answer: data });
      } else {
        socket.emit('webrtc_ice_candidate', { call_id: callId, candidate: data });
      }
    });

    peerConnection.on('stream', (stream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    });

    peerConnection.on('error', (err) => {
      console.error('Peer connection error:', err);
    });

    setPeer(peerConnection);
    setCallId(callId);
  };

  const startCall = () => {
    if (socket && userType === 'provider') {
      socket.emit('start_call', {
        consultation_id: consultationId,
        caller_type: 'provider'
      });
    }
  };

  const endCall = () => {
    if (socket && callId) {
      socket.emit('end_call', { call_id: callId });
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
      }
    }
  };

  const shareScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const videoTrack = screenStream.getVideoTracks()[0];
      
      if (peer && localStreamRef.current) {
        const sender = peer._pc.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }
      
      setIsScreenSharing(true);
      
      videoTrack.onended = () => {
        setIsScreenSharing(false);
        // Switch back to camera
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then(stream => {
            const videoTrack = stream.getVideoTracks()[0];
            if (peer) {
              const sender = peer._pc.getSenders().find(s => 
                s.track && s.track.kind === 'video'
              );
              if (sender) {
                sender.replaceTrack(videoTrack);
              }
            }
          });
      };
    } catch (err) {
      console.error('Error sharing screen:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Video Container */}
      <div className="flex-1 relative">
        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>

        {/* Call Status */}
        <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg">
          Status: {callStatus}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-900 p-4 flex justify-center space-x-4">
        <button
          onClick={toggleAudio}
          className={`p-3 rounded-full ${isAudioEnabled ? 'bg-gray-600' : 'bg-red-600'} text-white`}
        >
          {isAudioEnabled ? '🎤' : '🔇'}
        </button>
        
        <button
          onClick={toggleVideo}
          className={`p-3 rounded-full ${isVideoEnabled ? 'bg-gray-600' : 'bg-red-600'} text-white`}
        >
          {isVideoEnabled ? '📹' : '📷'}
        </button>
        
        <button
          onClick={shareScreen}
          className={`p-3 rounded-full ${isScreenSharing ? 'bg-blue-600' : 'bg-gray-600'} text-white`}
        >
          🖥️
        </button>
        
        {userType === 'provider' && callStatus === 'connecting' && (
          <button
            onClick={startCall}
            className="p-3 rounded-full bg-green-600 text-white"
          >
            📞 Start Call
          </button>
        )}
        
        <button
          onClick={endCall}
          className="p-3 rounded-full bg-red-600 text-white"
        >
          📞 End Call
        </button>
      </div>
    </div>
  );
};

// Provider Dashboard Component
const ProviderDashboard = () => {
  const [queue, setQueue] = useState([]);
  const [activeConsultation, setActiveConsultation] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    fetchQueue();
    
    const socketConnection = io(BACKEND_URL);
    setSocket(socketConnection);
    
    socketConnection.emit('provider_ready', { provider_id: 'provider-1' });
    
    socketConnection.on('queue_updated', () => {
      fetchQueue();
    });

    return () => socketConnection.disconnect();
  }, []);

  const fetchQueue = async () => {
    try {
      const response = await axios.get(`${API}/consultation/queue`);
      setQueue(response.data.queue);
    } catch (error) {
      console.error('Error fetching queue:', error);
    }
  };

  const startConsultation = async (consultationId) => {
    try {
      await axios.post(`${API}/consultation/${consultationId}/start`, {
        provider_id: 'provider-1'
      });
      setActiveConsultation(consultationId);
    } catch (error) {
      console.error('Error starting consultation:', error);
    }
  };

  const endConsultation = () => {
    setActiveConsultation(null);
    fetchQueue();
  };

  if (activeConsultation) {
    return (
      <VideoCall
        consultationId={activeConsultation}
        userType="provider"
        onEndCall={endConsultation}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Provider Dashboard</h1>
        
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-semibold mb-6">Patient Queue</h2>
          
          {queue.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">👨‍⚕️</div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No patients waiting</h3>
              <p className="text-gray-500">New patients will appear here automatically</p>
            </div>
          ) : (
            <div className="space-y-4">
              {queue.map((patient) => (
                <div key={patient.consultation_id} className="border rounded-lg p-4 flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <h3 className="font-semibold text-lg">{patient.patient_name}</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        patient.urgency_level === 'Emergency' ? 'bg-red-100 text-red-800' :
                        patient.urgency_level === 'Urgent' ? 'bg-orange-100 text-orange-800' :
                        patient.urgency_level === 'Routine' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {patient.urgency_level}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-1">
                      Symptoms: {patient.symptoms?.symptoms?.join(', ') || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-500">
                      Waiting: {patient.wait_time} minutes
                    </p>
                  </div>
                  
                  <button
                    onClick={() => startConsultation(patient.consultation_id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                  >
                    Start Consultation
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Waiting Room Component
const WaitingRoom = ({ consultationId, triageData }) => {
  const [estimatedWait, setEstimatedWait] = useState('5-10 minutes');
  const [socket, setSocket] = useState(null);
  const [callStarted, setCallStarted] = useState(false);

  useEffect(() => {
    const socketConnection = io(BACKEND_URL);
    setSocket(socketConnection);
    
    socketConnection.emit('join_waiting_room', {
      consultation_id: consultationId,
      triage_data: triageData
    });

    socketConnection.on('incoming_call', () => {
      setCallStarted(true);
    });

    return () => socketConnection.disconnect();
  }, [consultationId, triageData]);

  if (callStarted) {
    return (
      <VideoCall
        consultationId={consultationId}
        userType="patient"
        onEndCall={() => setCallStarted(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">You're in the Waiting Room</h1>
            <p className="text-xl text-gray-600 mb-8">A healthcare provider will be with you shortly</p>
            
            <div className="bg-blue-50 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-2">Estimated Wait Time</h3>
              <p className="text-2xl font-bold text-blue-600">{estimatedWait}</p>
            </div>
            
            <div className="text-left bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">Your Assessment Summary</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Urgency Level:</strong> <span className={`font-medium ${
                  triageData.urgency_level === 'Emergency' ? 'text-red-600' :
                  triageData.urgency_level === 'Urgent' ? 'text-orange-600' :
                  triageData.urgency_level === 'Routine' ? 'text-blue-600' :
                  'text-green-600'
                }`}>{triageData.urgency_level}</span></p>
                <p><strong>Primary Symptoms:</strong> {triageData.symptoms?.join(', ') || 'N/A'}</p>
                <p><strong>Location:</strong> {triageData.location || 'N/A'}</p>
                <p><strong>Severity:</strong> {triageData.severity || 'N/A'}/10</p>
              </div>
            </div>
            
            <div className="flex justify-center space-x-4">
              <div className="text-center">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">Camera Ready</p>
              </div>
              
              <div className="text-center">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.82L6.72 15H4a1 1 0 01-1-1V6a1 1 0 011-1h2.72l1.663-1.82a1 1 0 011.617.82z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">Audio Ready</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-500 mt-6">
              Please stay on this page. The video call will start automatically when a provider is available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  const [consultationId, setConsultationId] = useState(null);
  const [patientName, setPatientName] = useState('');

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

  const requestConsultation = async () => {
    if (!sessionId || !patientName.trim()) {
      alert('Please enter your name to proceed with consultation');
      return;
    }
    
    try {
      const response = await axios.post(`${API}/consultation/create?triage_session_id=${sessionId}&patient_name=${encodeURIComponent(patientName)}`);
      setConsultationId(response.data.consultation_id);
      setCurrentStep('waiting');
    } catch (error) {
      console.error('Error creating consultation:', error);
    }
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

  // Router-like functionality
  if (currentStep === 'provider-dashboard') {
    return <ProviderDashboard />;
  }

  if (currentStep === 'waiting') {
    return (
      <WaitingRoom
        consultationId={consultationId}
        triageData={{
          urgency_level: triageResult?.urgency_level,
          symptoms: formData.symptoms,
          location: formData.location,
          severity: formData.severity
        }}
      />
    );
  }

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
                <h1 className="text-4xl font-bold text-gray-900 mb-4">SmartMed Connect</h1>
                <p className="text-xl text-gray-600 mb-8">Complete telehealth platform with AI triage and video consultations</p>
              </div>
              
              <div className="grid md:grid-cols-4 gap-6 mb-8">
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">AI Triage</h3>
                  <p className="text-gray-600">Smart symptom assessment</p>
                </div>
                
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Video Consultations</h3>
                  <p className="text-gray-600">HD video calls with doctors</p>
                </div>
                
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Provider Queue</h3>
                  <p className="text-gray-600">Smart patient prioritization</p>
                </div>
                
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Analytics</h3>
                  <p className="text-gray-600">Real-time insights</p>
                </div>
              </div>
              
              <div className="flex justify-center space-x-4">
                <button
                  onClick={startTriage}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-xl transition duration-200 transform hover:scale-105 shadow-lg"
                >
                  Start Patient Assessment
                </button>
                
                <button
                  onClick={() => setCurrentStep('provider-dashboard')}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-8 rounded-xl transition duration-200 transform hover:scale-105 shadow-lg"
                >
                  Provider Dashboard
                </button>
              </div>
              
              <p className="text-sm text-gray-500 mt-4">
                * Complete telehealth platform with AI-powered triage and video consultations
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

                      {/* Video Consultation Request */}
                      <div className="mb-6 bg-blue-50 p-6 rounded-lg">
                        <h4 className="text-lg font-semibold mb-3">Request Video Consultation</h4>
                        <p className="text-gray-600 mb-4">Connect with a healthcare provider via video call for personalized care.</p>
                        
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
                          <input
                            type="text"
                            value={patientName}
                            onChange={(e) => setPatientName(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter your full name"
                          />
                        </div>
                        
                        <button
                          onClick={requestConsultation}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg"
                        >
                          Request Video Consultation
                        </button>
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
                  setConsultationId(null);
                  setPatientName('');
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