const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
require('dotenv').config();

// ==============================
// POST /api/auth/login
// ==============================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email dan password wajib diisi'
            });
        }

        const [users] = await db.query(
            'SELECT user_id, full_name, email, role, password_hash FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Email atau password salah'
            });
        }

        const user = users[0];

        if (!user.password_hash) {
            return res.status(401).json({
                success: false,
                error: 'Password belum di-set untuk user ini'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Email atau password salah'
            });
        }

        const token = jwt.sign(
            { user_id: user.user_id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES || '24h' }
        );

        res.status(200).json({
            success: true,
            data: {
                token,
                expires_in: 86400,
                user: {
                    user_id: user.user_id,
                    full_name: user.full_name,
                    email: user.email,
                    role: user.role
                }
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ==============================
// GET /api/auth/me
// ==============================
router.get('/me', authenticate, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT user_id, full_name, email, role, created_at FROM users WHERE user_id = ?',
            [req.user.user_id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User tidak ditemukan'
            });
        }

        res.status(200).json({ success: true, data: users[0] });
    } catch (err) {
        console.error('Me error:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ==============================
// POST /api/auth/logout
// ==============================
router.post('/logout', authenticate, (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Logout berhasil. Hapus token di client.'
    });
});

// ==============================
// POST /api/auth/change-password
// ==============================
router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { old_password, new_password } = req.body;

        if (!old_password || !new_password) {
            return res.status(400).json({
                success: false,
                error: 'Password lama dan baru wajib diisi'
            });
        }

        if (new_password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password baru minimal 6 karakter'
            });
        }

        const [users] = await db.query(
            'SELECT user_id, password_hash FROM users WHERE user_id = ?',
            [req.user.user_id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User tidak ditemukan'
            });
        }

        const isValid = await bcrypt.compare(old_password, users[0].password_hash);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                error: 'Password lama salah'
            });
        }

        const newHash = await bcrypt.hash(new_password, 10);

        await db.query(
            'UPDATE users SET password_hash = ? WHERE user_id = ?',
            [newHash, req.user.user_id]
        );

        res.status(200).json({
            success: true,
            message: 'Password berhasil diubah'
        });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
