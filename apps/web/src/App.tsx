import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { Navbar } from "./components/Navbar";
import { ScrollProgressBar } from "./components/ScrollProgressBar";
import { CustomCursor } from "./components/CustomCursor";
import { Footer } from "./components/Footer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthenticatedDashboard } from "./components/dashboard/AuthenticatedDashboard";
import { Home } from "./pages/Home";
import { TeamsPreview } from "./pages/TeamsPreview";
import { TeamDetails } from "./pages/TeamDetails";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Profile } from "./pages/Profile";
import { GoogleAuth } from "./pages/GoogleAuth";
import { AuthCallback } from "./pages/AuthCallback";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <AuthProvider>
            <SocketProvider>
              <div className="min-h-screen flex flex-col bg-ground text-ink-primary selection:bg-accent-tint selection:text-accent">
                <Navbar />
                <ScrollProgressBar />
                <CustomCursor />
                <main className="flex-1">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <AuthenticatedDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/teams" element={<TeamsPreview />} />
                    <Route path="/teams-preview" element={<TeamsPreview />} />
                    <Route path="/teams/:teamId" element={<TeamDetails />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/login/google" element={<GoogleAuth />} />
                    <Route path="/auth/google" element={<GoogleAuth />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/register" element={<Register />} />
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="*"
                      element={
                        <div className="py-24 text-center space-y-4 max-w-md mx-auto">
                          <h1 className="text-3xl font-serif text-ink-primary">
                            404 — Page Not Found
                          </h1>
                          <p className="text-sm text-ink-secondary">
                            The requested squad or view does not exist in this hackathon.
                          </p>
                          <div className="pt-2">
                            <a href="/" className="btn btn-secondary text-xs">
                              Return to platform
                            </a>
                          </div>
                        </div>
                      }
                    />
                  </Routes>
                </main>
                <Footer />
              </div>
            </SocketProvider>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
};
