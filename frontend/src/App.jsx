import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CustomerMenu from './views/CustomerMenu';
import KitchenDashboard from './views/KitchenDashboard';
import AdminPanel from './views/AdminPanel';
import Login from './views/Login';
import AnimatedBackground from './components/AnimatedBackground';

export default function App() {
  return (
    <BrowserRouter>
      {/* Royal Ambient Animated Background with Golden Embers */}
      <AnimatedBackground />

      <Routes>
        {/* Default route goes to Customer Menu */}
        <Route path="/" element={<Navigate to="/menu" replace />} />
        
        {/* 1. Customer Menu (Table QR scan) */}
        <Route path="/menu" element={<CustomerMenu />} />

        {/* 2. Kitchen Live Dashboard */}
        <Route path="/kitchen" element={<KitchenDashboard />} />

        {/* 3. Owner & Admin Management Panel */}
        <Route path="/admin" element={<AdminPanel />} />

        {/* 4. Staff / Admin Authentication Login */}
        <Route path="/login" element={<Login />} />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/menu" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
