const express = require('express');
const bcrypt = require('bcrypt');
const conn = require('../db');
const { limitFields, catchSQLErrors } = require('../utils');

const router = express.Router();

// Redirect to login page
router.get('/', (req, res) => res.redirect(!req.session?.user ? '/auth/login' : '/bookings'));

// Show admin signup form
router.get('/signup', (req, res, next) => {
	res.render('auth/admin-signup');
});

// Sign up as an admin
router.post('/signup', async (req, res, next) => {
	// Getting data from user
	const data = limitFields(req.body, 'first_name', 'last_name', 'username', 'password');

	// Checking if passswords match
	if (data.password !== req.body.confirm) {
		req.flash('error', 'Passwords do not match');
		return res.redirect('/auth/signup');
	}

	// Hashing the password
	data.password = await bcrypt.hash(data.password, 12);

	// Getting the main tour company ID
	conn.query(
		"SELECT id FROM tour_companies WHERE company_type = 'main'",
		catchSQLErrors(next, (companies) => {
			if (!companies.length) throw new Error("No company with type 'main' found");

			// Adding the new user
			conn.query(
				`INSERT INTO users (${Object.keys(data).join(',')},tour_company_id) VALUES (?,?,?,?,${
					companies[0].id
				})`,
				Object.values(data),
				catchSQLErrors(next, (result) => {
					req.session.user = {
						id: result.insertId,
						first_name: data.first_name,
						role: 'admin',
						company_id: companies[0].id,
					};

					res.redirect('/bookings');
				})
			);
		})
	);
});

// Show admin login form
router.get('/login', (req, res, next) => {
	res.render('auth/admin-login');
});

// Log in as an admin
router.post('/login', async (req, res, next) => {
	const data = {
		username: req.body.username,
		password: req.body.password,
	};

	conn.query(
		'SELECT * FROM users WHERE username = ?',
		[data.username],
		catchSQLErrors(next, async (users) => {
			// Check if user exists
			if (!users.length) {
				req.flash('error', 'No user found with that username');
				return res.redirect('/auth/login');
			}

			// Check if password is correct
			if (!(await bcrypt.compare(data.password, users[0].password))) {
				req.flash('error', 'Password is incorrect');
				return res.redirect('/auth/login');
			}

			conn.query(
				`SELECT * FROM tour_companies WHERE id = ${users[0].tour_company_id}`,
				catchSQLErrors(next, ([company]) => {
					if (!company) throw new Error('No company found with that id');

					req.session.user = {
						id: users[0].id,
						first_name: users[0].first_name,
						role: company.company_type === 'main' ? 'admin' : 'sales-agent',
						company_id: company.id,
					};

					res.redirect('/bookings');
				})
			);
		})
	);
});

// Log user out
router.get('/logout', (req, res, next) => {
	req.session.destroy();
	res.redirect('/');
});

module.exports = router;
