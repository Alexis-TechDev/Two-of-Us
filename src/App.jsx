import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import MobileOnly from "./components/MobileOnly";
import AppContainer from "./components/AppContainer";

import Welcome from "./pages/Welcome";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Chat from "./pages/Chat";
import ProtectedRoute from "./components/ProtectedRoute";
import Partner from "./pages/Partner";
import Conversations from "./pages/Conversations";

function App() {
  return (
    <BrowserRouter>
      <MobileOnly>
        <AppContainer>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />}/>
            <Route path="/partner" element={<ProtectedRoute><Partner /></ProtectedRoute>} />
            <Route path="/chat/:conversationId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/conversations" element={<ProtectedRoute><Conversations /></ProtectedRoute>} />
            <Route path="/conversations" element={<ProtectedRoute><Conversations /></ProtectedRoute>}/>
          </Routes>
        </AppContainer>
      </MobileOnly>
    </BrowserRouter>
  );
}

export default App;