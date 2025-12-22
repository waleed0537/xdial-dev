import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import ClientDashboard from './ClientDashboard';
import Login from './login';
import ClientLanding from './ClientLanding';
import ClientRecordings from './Clientrecordings';
import DataExport from './DataExport';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<ClientDashboard />} />
        <Route path="/client-landing" element={<ClientLanding />} />
        <Route path="/recordings" element={<ClientRecordings />} />
        <Route path="/data-export" element={<DataExport />} />
      </Routes>
    </Router>
  );
}

export default App;