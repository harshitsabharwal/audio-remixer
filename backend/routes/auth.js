const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// POST: /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // 1. Check if user already exists
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: 'User already exists' });

        // 2. Hash the password for security
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Save the new user to the database
        user = new User({ username, email, password: hashedPassword });
        await user.save();

        // 4. Generate a JWT Token so they are instantly logged in
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.status(201).json({ 
            token, 
            user: { id: user._id, username: user.username, email: user.email } 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// POST: /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Find the user by email
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        // 2. Compare the provided password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        // 3. Generate a JWT Token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.json({ 
            token, 
            user: { id: user._id, username: user.username, email: user.email } 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error during login' });
    }
});

module.exports = router;