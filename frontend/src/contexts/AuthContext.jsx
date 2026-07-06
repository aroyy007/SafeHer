import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('safeher.token') || null);
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      localStorage.setItem('safeher.token', token);
      loadUserProfile(token);
    } else {
      localStorage.removeItem('safeher.token');
      setUser(null);
      setContacts([]);
      setIsLoading(false);
    }
  }, [token]);

  const loadUserProfile = async (authToken) => {
    try {
      const data = await api.auth.getMe(authToken);
      setUser(data.user);
      setContacts(data.contacts);
    } catch (err) {
      console.error("Failed to load profile:", err);
      if (err.status === 401) {
        logout(); // Token expired or invalid
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    const data = await api.auth.login({ email, password });
    setToken(data.token);
    setUser(data.user);
    // User profile will reload via useEffect
  };

  const signup = async (userData) => {
    const data = await api.auth.signup(userData);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    setToken(null);
  };

  const addContact = async (contact) => {
    const newContact = await api.auth.addContact(token, contact);
    setContacts(prev => [...prev, newContact]);
  };

  const deleteContact = async (id) => {
    await api.auth.deleteContact(token, id);
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  return (
    <AuthContext.Provider value={{ user, token, contacts, isLoading, login, signup, logout, addContact, deleteContact }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
