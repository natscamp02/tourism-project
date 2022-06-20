const express = require('express');
const bcrypt = require('bcrypt');
const conn = require('../db');
const { protect, restrictTo, limitFields, catchSQLErrors } = require('../utils');

const router = express.Router();

// Ensure user is logged in as an admin
router.use(protect, restrictTo('admin'));

////////////////////////////////////////////////////////////////
// COMPANY INFO ROUTES
////////////////////////////////////////////////////////////////

// Get all tour companies' information
router.get('/', (req, res, next) => {
	conn.query(
		'SELECT * FROM tour_companies',
		catchSQLErrors(next, (companies) => {
			res.render('tour-companies/list', { companies });
		})
	);
});

// Add a new company
router.get('/add', (req, res, next) => {
	res.render('tour-companies/add');
});
router.post('/add', (req, res, next) => {
	const data = limitFields(req.body, 'company_name', 'street_address', 'city', 'parish');

	conn.query(
		'INSERT INTO tour_companies (company_name, street_address, city, parish) VALUES (?,?,?,?)',
		Object.values(data),
		catchSQLErrors(next, (result) => {
			req.flash('success', 'Record successfully added');
			res.redirect('/tour-companies');
		})
	);
});

// Edit a company's information
router.get('/:id/edit', (req, res, next) => {
	conn.query(
		'SELECT * FROM tour_companies WHERE id = ' + req.params.id,
		catchSQLErrors(next, (companies) => {
			if (!companies.length) throw new Error('No company found with that id');

			res.render('tour-companies/edit', { company: companies[0] });
		})
	);
});
router.post('/update', (req, res, next) => {
	const data = limitFields(req.body, 'company_name', 'street_address', 'city', 'parish');

	conn.query(
		'UPDATE tour_companies SET ? WHERE id = ' + req.body.company_id,
		data,
		catchSQLErrors(next, (result) => {
			req.flash('success', 'Changes saved successfully');
			res.redirect('/tour-companies');
		})
	);
});

// Delete a company
router.get('/:id/delete', (req, res, next) => {
	conn.query(
		'DELETE FROM tour_companies WHERE id = ' + req.params.id,
		catchSQLErrors(next, (result) => {
			req.flash('success', 'Record successfully deleted');
			res.redirect('/tour-companies');
		})
	);
});

////////////////////////////////////////////////////////////////
// ACCOUNT ROUTES
////////////////////////////////////////////////////////////////
// Get all accounts for a particular company
router.get('/:id/accounts', (req, res, next) => {
	conn.query(
		'SELECT * FROM tour_companies WHERE id = ' + req.params.id,
		catchSQLErrors(next, (companies) => {
			if (!companies.length) return res.render('errors/not-found');

			conn.query(
				'SELECT * FROM users WHERE tour_company_id = ' + req.params.id,
				catchSQLErrors(next, (users) => {
					res.render('tour-companies/accounts/list', {
						company_id: companies[0].id,
						company_name: companies[0].company_name,
						users,
					});
				})
			);
		})
	);
});

// Add a new account to the specified company
router.get('/:id/accounts/add', (req, res, next) => {
	res.render('tour-companies/accounts/add', { company_id: req.params.id });
});
router.post('/accounts/add', async (req, res, next) => {
	// Get data from user
	const data = limitFields(req.body, 'first_name', 'last_name', 'username', 'password');

	// Ensure passwords match
	if (data.password !== req.body.confirm) {
		req.flash('error', 'Passwords do not match');
		return res.redirect(`/tour-companies/${req.body.company_id}/accounts/add`);
	}

	// Hash password for storage
	data.password = await bcrypt.hash(data.password, 12);

	// Create entry in the database
	conn.query(
		`INSERT INTO users (${Object.keys(data).join(',')}, tour_company_id) VALUES (?,?,?,?,${req.body.company_id})`,
		Object.values(data),
		catchSQLErrors(next, (result) => {
			req.flash('success', 'Profile successfully created');
			res.redirect(`/tour-companies/${req.body.company_id}/accounts`);
		})
	);
});

// Edit an account for the specified company
router.get('/:id/accounts/:user_id/edit', (req, res, next) => {
	conn.query(
		'SELECT * FROM users WHERE id = ' + req.params.user_id,
		catchSQLErrors(next, (users) => {
			res.render('tour-companies/accounts/edit', { account: users[0], company_id: req.params.id });
		})
	);
});
router.post('/accounts/update', (req, res, next) => {
	const data = limitFields(req.body, 'first_name', 'last_name', 'username');

	conn.query(
		'UPDATE users SET ? WHERE id = ' + req.body.user_id,
		data,
		catchSQLErrors(next, (result) => {
			req.flash('success', 'Profile updated successfully');
			res.redirect('/tour-companies/' + req.body.company_id + '/accounts');
		})
	);
});

// Delete an account for the specified company
router.get('/:id/accounts/:user_id/delete', (req, res, next) => {
	conn.query(
		'DELETE FROM users WHERE id = ' + req.params.user_id,
		catchSQLErrors(next, (result) => {
			req.flash('success', 'Profile successfully deleted');
			res.redirect('/tour-companies/' + req.params.id + '/accounts');
		})
	);
});

module.exports = router;
