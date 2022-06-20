const express = require('express');
const conn = require('../db');
const { protect, restrictTo, limitFields, catchSQLErrors } = require('../utils');

function createInvoiceAndBooking(data, req, _res, next, onSuccess) {
	// Format values into appropriate types
	const queryObj = {
		guest_first_name: data.first_name,
		guest_last_name: data.last_name,
		program_id: Number.parseInt(data.program_id),
		booked_by_user: req.session.user.id,
		location_id: Number.parseInt(data.location),
		group_size: Number.parseInt(data.group_size),
		excursion_date: data.excursion_date || new Date(data.start_date + 'T' + data.start_time + ':00'),
	};

	const invoiceData = {
		// Generate a random invoice number
		voucher_num: Date.now().toString().slice(-8).padStart(8, '0'),

		// Calculate total amount
		total_amount: (Number.parseFloat(data.price) / 2) * queryObj.group_size,

		// Set due date for invoice based on type of guest
		// (On start date for walk-in guests, 2 weeks after start for companies)
		due_date: new Date(
			req.session.user.role === 'admin'
				? queryObj.excursion_date.getTime()
				: queryObj.excursion_date.getTime() + 1000 * 60 * 60 * 24 * 14
		)
			.toISOString()
			.slice(0, 19)
			.replace('T', ' '),
	};

	// Create invoice
	conn.query(
		`INSERT INTO invoices (voucher_num, total_amount, due_date) VALUES (?,?,?)`,
		Object.values(invoiceData),
		catchSQLErrors(next, (result) => {
			// Create booking
			conn.query(
				`INSERT INTO bookings (voucher_num, program_id, booked_by_user, location_id, guest_first_name, guest_last_name, group_size, excursion_date)
                VALUES (?,?,?,?,?,?,?,?)`,
				[
					invoiceData.voucher_num,
					queryObj.program_id,
					queryObj.booked_by_user,
					queryObj.location_id,
					queryObj.guest_first_name,
					queryObj.guest_last_name,
					queryObj.group_size,
					queryObj.excursion_date,
				],
				catchSQLErrors(next, onSuccess)
			);
		})
	);
}

const router = express.Router();

router.use(protect);

////////////////////////////////////////////////////////////////
// ?? BOOKING ROUTES ??
////////////////////////////////////////////////////////////////

// Display bookings based on role
router.get('/', (req, res, next) => {
	let queryStr = `SELECT bks.*, pgs.title, tcs.company_name 
        FROM bookings bks, programs pgs, users urs, tour_companies tcs 
        WHERE bks.program_id = pgs.id AND bks.booked_by_user = urs.id AND urs.tour_company_id = tcs.id`;

	if (req.session.user.role !== 'admin') queryStr += ' AND urs.tour_company_id = ' + req.session.user.company_id;

	if (req.query.search) {
		if (!parseInt(req.query.search)) {
			const [f_name, l_name] = req.query.search.split(' ');
			queryStr +=
				" AND bks.guest_first_name LIKE '%" +
				(f_name || '') +
				"%' AND bks.guest_last_name LIKE '%" +
				(l_name || '') +
				"%'";
		} else {
			queryStr += ' AND bks.voucher_num = ' + req.query.search;
		}
	}

	queryStr += ' ORDER BY bks.date_booked';

	conn.query(
		queryStr,
		catchSQLErrors(next, (results) => {
			res.render('bookings/list', { results });
		})
	);
});

// View Invoice
router.get('/:id/invoice', (req, res, next) => {
	conn.query(
		`SELECT invs.*, bks.group_size, pgs.*, tcs.* 
        FROM bookings bks, invoices invs, programs pgs, users urs, tour_companies tcs
        WHERE bks.voucher_num = invs.voucher_num AND bks.booked_by_user = urs.id AND urs.tour_company_id = tcs.id AND bks.id = ${req.params.id}`,
		catchSQLErrors(next, (results) => {
			res.render('bookings/invoice', { data: results[0] });
		})
	);
});

// Confirm payment and type
router.post('/invoice/confirm-payment', restrictTo('admin'), (req, res, next) => {
	conn.query(
		`UPDATE invoices SET payment_type = ?, confirmed = 1 WHERE voucher_num = ${req.body.voucher_num}`,
		[req.body.payment_type],
		catchSQLErrors(next, (results) => {
			res.redirect('back');
		})
	);
});

// Add a new booking
router.get('/add', (req, res, next) => {
	conn.query(
		'SELECT * FROM programs',
		catchSQLErrors(next, (programs) => {
			conn.query(
				'SELECT * FROM locations',
				catchSQLErrors(next, (locations) => {
					res.render('bookings/add', { programs, locations });
				})
			);
		})
	);
});
router.post('/add', (req, res, next) => {
	// Get data from form
	const data = limitFields(
		req.body,
		'first_name',
		'last_name',
		'program',
		'location',
		'group_size',
		'start_date',
		'start_time'
	);
	const [program_id, price] = data.program.split('-');
	data.program_id = program_id;
	data.price = price;

	createInvoiceAndBooking(data, req, res, next, (result) => {
		// Show success message and send user to bookings list
		req.flash('success', 'Booking made successfully');
		res.redirect('/bookings');
	});
});

// Edit a booking
router.get('/:id/edit', (req, res, next) => {
	conn.query(
		'SELECT bks.* FROM bookings bks WHERE bks.id = ' + req.params.id,
		catchSQLErrors(next, (bookings) => {
			conn.query(
				'SELECT * FROM programs',
				catchSQLErrors(next, (programs) => {
					conn.query(
						'SELECT * FROM locations',
						catchSQLErrors(next, (locations) => {
							res.render('bookings/edit', { programs, locations, booking: bookings[0] });
						})
					);
				})
			);
		})
	);
});
router.post('/update', (req, res, next) => {
	const data = limitFields(
		req.body,
		'first_name',
		'last_name',
		'program',
		'location',
		'group_size',
		'start_date',
		'start_time'
	);
	const [program_id, price] = data.program.split('-');

	const bookingData = {
		program_id: Number.parseInt(program_id),
		location_id: Number.parseInt(data.location),
		guest_first_name: data.first_name,
		guest_last_name: data.last_name,
		group_size: Number.parseInt(data.group_size),
		excursion_date: new Date(data.start_date + 'T' + data.start_time + ':00'),
	};

	conn.query(
		`SELECT tcs.company_type FROM bookings bks, users urs, tour_companies tcs WHERE bks.booked_by_user = urs.id AND urs.tour_company_id = tcs.id AND bks.id = ${req.body.booking_id}`,
		catchSQLErrors(next, (types) => {
			const invoiceData = {
				// Calculate total amount
				total_amount: (Number.parseFloat(price) / 2) * bookingData.group_size,

				// Set due date for invoice based on type of guest
				// (On start date for walk-in guests, 2 weeks after start for companies)
				due_date: new Date(
					types[0] === 'main'
						? bookingData.excursion_date.getTime()
						: bookingData.excursion_date.getTime() + 1000 * 60 * 60 * 24 * 14
				)
					.toISOString()
					.slice(0, 19)
					.replace('T', ' '),
			};

			conn.query(
				'UPDATE invoices SET ? WHERE voucher_num = ' + req.body.voucher_num,
				invoiceData,
				catchSQLErrors(next, (results) => {
					conn.query(
						'UPDATE bookings SET ? WHERE id = ' + req.body.booking_id,
						bookingData,
						catchSQLErrors(next, (results) => {
							// Show success message and send user to bookings list
							req.flash('success', 'Changes saved');
							res.redirect('/bookings');
						})
					);
				})
			);
		})
	);
});

// Delete a booking
router.get('/:id/delete', (req, res, next) => {
	conn.query(
		'DELETE FROM bookings WHERE id = ' + req.params.id,
		catchSQLErrors(next, (result) => {
			// Show success message and send user to bookings list
			req.flash('success', 'Booking deleted');
			res.redirect('/bookings');
		})
	);
});

////////////////////////////////////////////////////////////////
// ?? RESERVATION ROUTES ??
////////////////////////////////////////////////////////////////

router.use(restrictTo('admin'));

router.get('/reservations', (req, res, next) => {
	let sqlStr = `SELECT rvs.*, pgs.title FROM reservations rvs, programs pgs WHERE rvs.program_id = pgs.id`;

	if (req.query.search) {
		const [f_name, l_name] = req.query.search.split(' ');

		sqlStr +=
			" AND rvs.guest_f_name LIKE '%" +
			(f_name || '') +
			"%' AND rvs.guest_l_name LIKE '%" +
			(l_name || '') +
			"%'";
	}

	conn.query(
		sqlStr,
		catchSQLErrors(next, (results) => {
			res.render('bookings/reservations', { results });
		})
	);
});

router.get('/reservations/:id/approve', (req, res, next) => {
	// Get all revervation records
	conn.query(
		'SELECT * FROM reservations WHERE id = ' + req.params.id,
		catchSQLErrors(next, (results) => {
			const data = results[0];

			// Get the ID of the 'Walk-in' location
			conn.query(
				"SELECT id AS location_id FROM locations WHERE location = 'Walk-in'",
				catchSQLErrors(next, ([{ location_id }]) => {
					// Get the price of the selected program
					conn.query(
						'SELECT price FROM programs WHERE id = ' + data.program_id,
						catchSQLErrors(next, ([{ price }]) => {
							const bookingData = {
								first_name: data.guest_f_name,
								last_name: data.guest_l_name,
								program_id: data.program_id,
								location: location_id,
								group_size: data.group_size,
								excursion_date: data.excursion_date,
								price: price,
							};

							// Create booking
							createInvoiceAndBooking(bookingData, req, res, next, (result) => {
								// Show success message and send user to bookings list
								req.flash('success', 'Reservation approved');
								res.redirect('/bookings/reservations');

								// Delete revervation afterwards
								conn.query('DELETE FROM reservations WHERE id = ' + req.params.id);
							});
						})
					);
				})
			);
		})
	);
});

router.get('/reservations/:id/deny', (req, res, next) => {
	conn.query(
		'DELETE FROM reservations WHERE id = ' + req.params.id,
		catchSQLErrors(next, (results) => {
			// Show success message and send user to bookings list
			req.flash('success', 'Reservation Denied');
			res.redirect('/bookings/reservations');
		})
	);
});

module.exports = router;
