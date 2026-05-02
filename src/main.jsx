import React from 'react';
import { createRoot } from 'react-dom/client';
import AuthGate from './AuthGate.jsx';
import App from './App.jsx';
import StudentPortal from './StudentPortal.jsx';

createRoot(document.getElementById('root')).render(
  <AuthGate>
    {(user, role, studioData) => {
      if (role === 'student') return <StudentPortal user={user} studioData={studioData} />;
      return <App user={user} />;
    }}
  </AuthGate>
);
