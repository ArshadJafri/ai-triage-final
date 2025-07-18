import React from "react";

const WaitingRoom = ({ consultationId, triageData, user }) => {
  // ...Waiting room logic and UI goes here...
  return (
    <div>
      <h2>Waiting Room</h2>
      <p>Consultation ID: {consultationId}</p>
      {/* Display triage data, waiting status, etc. */}
    </div>
  );
};

export default WaitingRoom; 