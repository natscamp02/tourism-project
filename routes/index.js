const express = require('express');
const conn = require('../db');
const { catchSQLErrors, limitFields } = require('../utils');

const router = express.Router();

// Show cart
router.use((req, res, next) => {
	res.locals.cart = req.session?.cart || [];
	next();
});

router.get('/', (req, res, next) => {
	res.render('home');
});
router.get('/browse', (req, res, next) => {
	conn.query(
		'SELECT * FROM programs',
		catchSQLErrors(next, (programs) => {
			res.render('browse', { programs });
		})
	);
});

router.get('/cart', (req, res, next) => {
	conn.query(
		`SELECT * FROM programs WHERE id IN (${req.session.cart?.join(',') || null})`,
		catchSQLErrors(next, (programs) => {
			res.render('cart', { programs });
		})
	);
});
router.get('/cart/add/:program_id', (req, res, next) => {
	if (req.session.cart) {
		if (!req.session.cart.includes(req.params.program_id)) req.session.cart?.push(req.params.program_id);
	} else req.session.cart = [req.params.program_id];

	res.redirect('/browse');
});
router.get('/cart/remove/:program_id', (req, res, next) => {
	req.session.cart = req.session.cart?.filter((p) => p !== req.params.program_id);
	res.redirect('back');
});

router.get('/make-reservation/:program_id', (req, res, next) => {
	res.render('make-reservation', { program_id: req.params.program_id });
});
router.post('/make-reservation', (req, res, next) => {
	const data = limitFields(
		req.body,
		'program_id',
		'first_name',
		'last_name',
		'group_size',
		'start_date',
		'start_time'
	);

	// Formatt values
	data.program_id = Number.parseInt(data.program_id);
	data.group_size = Number.parseInt(data.group_size);
	data.excursion_date = new Date(data.start_date + 'T' + data.start_time + ':00');

	conn.query(
		'INSERT INTO reservations (program_id, guest_f_name, guest_l_name, group_size, excursion_date) VALUES (?,?,?,?,?)',
		[data.program_id, data.first_name, data.last_name, data.group_size, data.excursion_date],
		catchSQLErrors(next, (result) => {
			req.flash('success', 'Reservation created successfully');
			req.session.cart = req.session.cart?.filter((i) => i !== req.body.program_id);

			res.redirect('/browse');
		})
	);
});

module.exports = router;
