const express = require('express');
const bcrypt = require('bcrypt');
const conn = require('../db');
const { protect, restrictTo, catchSQLErrors, limitFields } = require('../utils');

const router = express.Router();

router.use(protect);

router.get('/', (req, res, next) => {
	conn.query(
		'SELECT urs.*, tcs.company_name FROM users urs, tour_companies tcs WHERE urs.id = ' + req.session.user.id,
		catchSQLErrors(next, (users) => {
			res.render('profile/view', { account: users[0] });
		})
	);
});

router.post('/update', restrictTo('admin'), async (req, res, next) => {
	const data = limitFields(req.body, 'first_name', 'last_name', 'username', 'password');

	if (data.password !== req.body.confirm) {
		req.flash('error', 'Passwords do not match');
		res.redirect('/profile');
	}

	data.password = await bcrypt.hash(data.password, 12);

	conn.query(
		'UPDATE users SET ? WHERE id = ' + req.session.user.id,
		data,
		catchSQLErrors(next, (users) => {
			req.flash('success', 'Changes saved successfully');
			res.redirect('/profile');
		})
	);
});

router.get('/delete', restrictTo('admin'), (req, res, next) => {
	conn.query(
		'DELETE FROM users WHERE id = ' + req.session.user.id,
		catchSQLErrors(next, (users) => {
			res.redirect('/auth/logout');
		})
	);
});

module.exports = router;
