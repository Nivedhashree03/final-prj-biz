import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

const API_URL = 'http://localhost:5000/api';

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for persisted user in localStorage
        const storedUser = localStorage.getItem('finance_user');
        const token = localStorage.getItem('finance_token');
        if (storedUser && token) {
            setCurrentUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const signup = async (email, password, name) => {
        try {
            const response = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, displayName: name })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Signup failed');
            }

            localStorage.setItem('finance_token', data.token);
            localStorage.setItem('finance_user', JSON.stringify(data.user));
            setCurrentUser(data.user);
            return data.user;
        } catch (err) {
            throw err;
        }
    };

    const login = async (email, password) => {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            localStorage.setItem('finance_token', data.token);
            localStorage.setItem('finance_user', JSON.stringify(data.user));
            setCurrentUser(data.user);
            return data.user;
        } catch (err) {
            throw err;
        }
    };

    const logout = () => {
        localStorage.removeItem('finance_user');
        localStorage.removeItem('finance_token');
        setCurrentUser(null);
    };

    const value = {
        currentUser,
        signup,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
