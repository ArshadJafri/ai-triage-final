import React from "react";

const VideoCall = ({ consultationId, userType, onEndCall, user }) => {
  // ...Video call logic and UI goes here...
  return (
    <div>
      {/* Video call UI placeholder */}
      <h2>Video Call Component</h2>
      <p>Consultation ID: {consultationId}</p>
      <button onClick={onEndCall}>End Call</button>
    </div>
  );
};

export default VideoCall; 