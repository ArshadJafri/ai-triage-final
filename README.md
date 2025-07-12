# SmartMed Connect - Telehealth Platform

## Overview
SmartMed Connect is a comprehensive telehealth platform featuring AI-powered patient triage, real-time video consultations, and user management for both patients and healthcare providers.

## Features
- **AI-Powered Triage System**: Interactive symptom input with body diagram, AI chat for clarification, and urgency classification
- **Video Consultation System**: WebRTC-based HD video/audio, screen sharing, and real-time signaling
- **Dual Authentication**: Separate login paths for patients and healthcare providers
- **User-Specific Dashboards**: Personalized interfaces with role-based functionality
- **Real-time Communication**: Socket.IO for signaling and chat functionality

## Tech Stack
- **Frontend**: React, Tailwind CSS, WebRTC (SimplePeer), Socket.IO Client
- **Backend**: FastAPI, MongoDB (Motor), Socket.IO, OpenAI API integration
- **Database**: MongoDB with UUID primary keys
- **Real-time**: Socket.IO for WebRTC signaling

## Installation & Setup

### Prerequisites
- Node.js 18+ and yarn
- Python 3.8+
- MongoDB

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment variables in `.env`:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your actual values:
   ```
   MONGO_URL=mongodb://localhost:27017/smartmed_connect
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Start the backend server:
   ```bash
   uvicorn server:app --host 0.0.0.0 --port 8001 --reload
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Configure environment variables in `.env`:
   ```
   REACT_APP_BACKEND_URL=http://localhost:8001
   ```

4. Start the frontend development server:
   ```bash
   yarn start
   ```

### Database Setup
Ensure MongoDB is running on your system. The application will automatically create the necessary collections.

## Usage
1. Access the application at `http://localhost:3000`
2. Choose between Patient or Healthcare Provider login
3. For AI triage, patients can input symptoms and receive AI-powered recommendations
4. Video consultations can be initiated through the provider dashboard

## API Endpoints
- `/api/triage/symptoms` - Submit symptoms for AI analysis
- `/api/triage/questions` - Get follow-up questions
- `/api/triage/responses` - Submit responses to questions
- `/api/triage/results` - Get triage results and recommendations
- `/api/consultation/start` - Start video consultation
- `/api/consultation/join` - Join existing consultation

## Security Notes
- Replace the placeholder API keys with actual values
- Configure proper CORS settings for production
- Use HTTPS in production environments
- Implement proper authentication and authorization

## Development
The project follows a modular architecture with clear separation between frontend and backend. All API endpoints are prefixed with `/api` for proper routing.

## Support
For technical issues or questions, refer to the test_result.md file for testing protocols and known issues.
