import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { CONFIG } from "../utils/config";
import { setAuthToken } from "../utils/api";

const userPool = new CognitoUserPool({
  UserPoolId: CONFIG.COGNITO_USER_POOL_ID,
  ClientId: CONFIG.COGNITO_CLIENT_ID,
});

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: { email: string; groups: string[] } | null;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  loginDemo: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    error: null,
  });

  const setSession = useCallback((session: CognitoUserSession) => {
    const idToken = session.getIdToken();
    const token = idToken.getJwtToken();
    setAuthToken(token);

    const payload = idToken.decodePayload();
    setState({
      isLoading: false,
      isAuthenticated: true,
      user: {
        email: payload.email,
        groups: Array.isArray(payload["cognito:groups"]) ? payload["cognito:groups"] : payload["cognito:groups"] ? [payload["cognito:groups"]] : [],
      },
      error: null,
    });
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const currentUser = userPool.getCurrentUser();
    if (currentUser) {
      currentUser.getSession(
        (err: Error | null, session: CognitoUserSession | null) => {
          if (err || !session || !session.isValid()) {
            setState((s) => ({ ...s, isLoading: false }));
          } else {
            setSession(session);
          }
        }
      );
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, [setSession]);

  const login = async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));

    return new Promise<void>((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session) => {
          setSession(session);
          resolve();
        },
        onFailure: (err) => {
          setState((s) => ({
            ...s,
            isLoading: false,
            error: err.message || "Login failed",
          }));
          reject(err);
        },
        newPasswordRequired: () => {
          setState((s) => ({
            ...s,
            isLoading: false,
            error: "Password change required. Please contact admin.",
          }));
          reject(new Error("Password change required"));
        },
      });
    });
  };

  const loginDemo = () => {
    setState({
      isLoading: false,
      isAuthenticated: true,
      user: { email: "demo@foodwise.io", groups: ["owner"] },
      error: null,
    });
  };

  const logout = () => {
    const currentUser = userPool.getCurrentUser();
    if (currentUser) {
      currentUser.signOut();
    }
    setAuthToken(null);
    setState({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      error: null,
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, loginDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
