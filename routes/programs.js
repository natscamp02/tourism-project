const path = require('path');
const express = require('express');
const conn = require('../db');
const { protect, restrictTo, catchSQLErrors, limitFields } = require('../utils');

const router = express.Router();

router.use(protect, restrictTo('admin'));

// Showing all programs
router.get('/', (req, res, next) => {
	conn.query(
		'SELECT * FROM programs',
		catchSQLErrors(next, (programs) => {
			res.render('programs/list', { programs });
		})
	);
});

// Adding a new program
router.get('/add', (req, res, next) => {
	res.render('programs/add');
});
router.post('/add', (req, res, next) => {
	const data = limitFields(req.body, 'title', 'description', 'duration', 'price');
	data.price = Number.parseFloat(data.price);

	// Handle image uploads
	if (req.files?.image) {
		let photo = req.files.image;
		photo.mv(path.join(__dirname, '../public/images/gallery', photo.name));
		data.image = photo.name;
	}

	conn.query(
		`INSERT INTO programs (title, description, duration, price, image) VALUES (?,?,?,?,?)`,
		[...Object.values(data), data.image || ''],
		catchSQLErrors(next, (result) => {
			req.flash('success', 'Record added successfully');
			res.redirect('/programs');
		})
	);
});

// Edit an existing program
router.get('/:id/edit', (req, res, next) => {
	conn.query(
		'SELECT * FROM programs WHERE id = ' + req.params.id,
		catchSQLErrors(next, (programs) => {
			res.render('programs/edit', { program: programs[0] });
		})
	);
});
router.post('/update', (req, res, next) => {
	const data = limitFields(req.body, 'title', 'description', 'duration', 'price');
	data.price = Number.parseFloat(data.price);

	conn.query(
		`UPDATE programs SET ? WHERE id = ` + req.body.program_id,
		data,
		catchSQLErrors(next, (result) => {
			req.flash('success', 'Record updated successfully');
			res.redirect('/programs');
		})
	);
});

// Remove a program
router.get('/:id/delete', (req, res, next) => {
	conn.query(
		'DELETE FROM programs WHERE id = ' + req.params.id,
		catchSQLErrors(next, (result) => {
			req.flash('success', 'Record deleted successfully');
			res.redirect('/programs');
		})
	);
});

module.exports = router;
