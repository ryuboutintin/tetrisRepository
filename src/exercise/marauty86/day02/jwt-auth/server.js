const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(express.json());

// In-memory data store
const users = [];
let refreshTokens = [];

// Helper: Generate Access Token
function generateAccessToken(user) {
    return jwt.sign({ name: user.name }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15s' });
}

// Helper: Generate Refresh Token
function generateRefreshToken(user) {
    const refreshToken = jwt.sign({ name: user.name }, process.env.REFRESH_TOKEN_SECRET);
    refreshTokens.push(refreshToken);
    return refreshToken;
}

// 1. Signup API
app.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).send('Missing username or password');

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = { name: username, password: hashedPassword };
        users.push(user);
        res.status(201).send('User created');
    } catch {
        res.status(500).send('Error creating user');
    }
});

// 2. Login API
app.post('/login', async (req, res) => {
    const user = users.find(u => u.name === req.body.username);
    if (user == null) return res.status(400).send('Cannot find user');

    try {
        if (await bcrypt.compare(req.body.password, user.password)) {
            const accessToken = generateAccessToken(user);
            const refreshToken = generateRefreshToken(user);
            res.json({ accessToken: accessToken, refreshToken: refreshToken });
        } else {
            res.send('Not Allowed');
        }
    } catch {
        res.status(500).send();
    }
});

// 3. Token Refresh API
app.post('/token', (req, res) => {
    const refreshToken = req.body.token;
    if (refreshToken == null) return res.sendStatus(401);
    if (!refreshTokens.includes(refreshToken)) return res.sendStatus(403);

    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        const accessToken = generateAccessToken({ name: user.name });
        res.json({ accessToken: accessToken });
    });
});

// 4. Logout (to invalidate refresh token)
app.delete('/logout', (req, res) => {
    refreshTokens = refreshTokens.filter(token => token !== req.body.token);
    res.sendStatus(204);
});

// Middleware: Authenticate Token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// 5. Protected Endpoint
app.get('/protected', authenticateToken, (req, res) => {
    res.json({ message: 'Welcome to the protected route!', user: req.user });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
