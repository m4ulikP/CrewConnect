import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoadingSkeleton } from "./LoadingSkeleton";

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <div className="bg-surface border border-border-subtle rounded-lg p-6">
          <div className="text-center mb-6">
            <div className="inline-block animate-spin rounded-full h-7 w-7 border-2 border-accent border-t-transparent mb-3" />
            <h2 className="text-base font-medium text-ink-primary">Verifying session...</h2>
          </div>
          <LoadingSkeleton rows={2} />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};
