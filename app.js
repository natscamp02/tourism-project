const path = require('path');

const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('express-flash');
const fileUpload = require('express-fileupload');

const baseRouter = require('./routes');
const authRouter = require('./routes/auth');
const bookingsRouter = require('./routes/bookings');
const programsRouter = require('./routes/programs');
const tourCompanyRouter = require('./routes/tourCompanies');
const profileRouter = require('./routes/profile');

const app = express();

// Setting up template engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Serving static files
app.use(express.static(path.join(__dirname, 'public')));

// Handling file uploads
app.use(fileUpload());

// Body and cookie parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Setting up session
app.use(
	session({
		secret: process.env.SESSION_SECRET,

		saveUninitialized: true,
		resave: false,

		cookie: {
			maxAge: 1000 * 60 * 60 * 5,
		},
	})
);

// Showing flash messages
app.use(flash());

// Routes
app.use('/auth', authRouter);
app.use('/bookings', bookingsRouter);
app.use('/programs', programsRouter);
app.use('/tour-companies', tourCompanyRouter);
app.use('/profile', profileRouter);
app.use('/', baseRouter);

// Catch all exceptions
app.all('*', (req, res, next) => {
	res.render('errors/not-found');
});

// Error handling
app.use((err, req, res, next) => {
	console.error(err.message);

	res.render('errors/generic');
});

module.exports = app;
