const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// @route   POST api/auth/signup
// @desc    Register user
router.post('/signup', async (req, res) => {
    const { email, password, displayName } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ error: 'User already exists' });
        }

        user = new User({ email, password, displayName });
        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '7d' });

        res.json({
            token,
            user: {
                uid: user._id, // Mapping to frontend uid field
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            }
        });
    } catch (err) {
        console.error("Signup Error:", err);
        res.status(500).json({ error: err.message || 'Server Error' });
    }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '7d' });

        res.json({
            token,
            user: {
                uid: user._id,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            }
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: err.message || 'Server Error' });
    }
});

module.exports = router;
