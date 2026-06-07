import React, { createContext, useContext, useState } from 'react';

interface AuthContextType {
  token: string | null;
  email: string | null;
  login: (token: string, email: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(localStorage.getItem('is_authenticated') === 'true');
  const [email, setEmail] = useState<string | null>(localStorage.getItem('user_email'));

  const login = (_token: string, newEmail: string) => {
    localStorage.setItem('is_authenticated', 'true');
    localStorage.setItem('user_email', newEmail);
    setIsAuthenticated(true);
    setEmail(newEmail);
  };

  const logout = () => {
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('user_email');
    setIsAuthenticated(false);
    setEmail(null);
  };

  return (
    <AuthContext.Provider value={{ token: null, email, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
