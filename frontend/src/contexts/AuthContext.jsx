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
      console.error('Failed to load profile:', err);
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
    // Persist the token so api.js can attach it as Bearer on next call
    localStorage.setItem('safeher.token', data.token);
    // User profile will reload via useEffect
  };

  const signup = async (userData) => {
    const data = await api.auth.signup(userData);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('safeher.token', data.token);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('safeher.token');
    localStorage.removeItem('safeher.jwt');
  };

  // Add a Supabase JWT after the user signs in to Firebase / Supabase auth.
  const setSupabaseJwt = (jwt) => {
    if (jwt) localStorage.setItem('safeher.jwt', jwt);
    else localStorage.removeItem('safeher.jwt');
  };

  const addContact = async (contact) => {
    const newContact = await api.auth.addContact(contact);
    setContacts((prev) => [...prev, newContact]);
  };

  const deleteContact = async (id) => {
    await api.auth.deleteContact(id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        contacts,
        isLoading,
        login,
        signup,
        logout,
        addContact,
        deleteContact,
        setSupabaseJwt,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
