import React, { useState } from "react";

const LandingPage = ({ onLogin }) => {
  const [loginType, setLoginType] = useState(null); // 'patient' or 'doctor'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    specialization: '', // for doctors
    licenseNumber: '' // for doctors
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (loginType === 'doctor') {
        const providerData = {
          name: formData.name,
          email: formData.email,
          specialization: formData.specialization,
          license_number: formData.licenseNumber,
          status: "available"
        };
        const response = await window.axios.post(`${window.API}/providers`, providerData);
        onLogin({
          id: response.data.id,
          name: formData.name,
          email: formData.email,
          type: 'doctor',
          specialization: formData.specialization
        });
      } else {
        onLogin({
          id: `patient-${Date.now()}`,
          name: formData.name,
          email: formData.email,
          type: 'patient'
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please try again.');
    }
    setIsLoading(false);
  };

  if (loginType === 'patient') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md">
          <h2 className="text-2xl font-bold mb-6 text-center">Patient Login</h2>
          <input
            type="text"
            placeholder="Name"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
            className="w-full mb-4 px-4 py-2 border rounded-lg"
          />
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            required
            className="w-full mb-4 px-4 py-2 border rounded-lg"
          />
          <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition">
            {isLoading ? 'Logging in...' : 'Continue'}
          </button>
          <button type="button" onClick={() => setLoginType(null)} className="w-full mt-4 text-blue-600 hover:underline">Back</button>
        </form>
      </div>
    );
  }

  if (loginType === 'doctor') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md">
          <h2 className="text-2xl font-bold mb-6 text-center">Provider Login</h2>
          <input
            type="text"
            placeholder="Name"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
            className="w-full mb-4 px-4 py-2 border rounded-lg"
          />
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            required
            className="w-full mb-4 px-4 py-2 border rounded-lg"
          />
          <input
            type="text"
            placeholder="Specialization"
            value={formData.specialization}
            onChange={e => setFormData({ ...formData, specialization: e.target.value })}
            required
            className="w-full mb-4 px-4 py-2 border rounded-lg"
          />
          <input
            type="text"
            placeholder="License Number"
            value={formData.licenseNumber}
            onChange={e => setFormData({ ...formData, licenseNumber: e.target.value })}
            required
            className="w-full mb-4 px-4 py-2 border rounded-lg"
          />
          <button type="submit" disabled={isLoading} className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition">
            {isLoading ? 'Logging in...' : 'Continue'}
          </button>
          <button type="button" onClick={() => setLoginType(null)} className="w-full mt-4 text-green-600 hover:underline">Back</button>
        </form>
      </div>
    );
  }

  // Initial role selection UI
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
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div className="text-center p-6 border border-gray-200 rounded-xl hover:shadow-lg transition-shadow">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">I'm a Patient</h3>
                <p className="text-gray-600 mb-6">Get AI-powered symptom assessment and connect with healthcare providers via video consultation</p>
                <button
                  onClick={() => setLoginType('patient')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition duration-200 w-full"
                >
                  Continue as Patient
                </button>
              </div>
              <div className="text-center p-6 border border-gray-200 rounded-xl hover:shadow-lg transition-shadow">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">I'm a Healthcare Provider</h3>
                <p className="text-gray-600 mb-6">Access your provider dashboard, manage patient queue, and conduct video consultations</p>
                <button
                  onClick={() => setLoginType('doctor')}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition duration-200 w-full"
                >
                  Continue as Provider
                </button>
              </div>
            </div>
            <div className="grid md:grid-cols-4 gap-4 pt-8 border-t border-gray-200">
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">AI Triage</p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">Provider Dashboard</p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">Video Consult</p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">Real-time Updates</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage; 