/**
 *  Ensures the user is logged in to access the following routes
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - Next function
 * @returns {void}
 */
exports.protect = (req, res, next) => {
	if (!req.session.user) {
		return res.redirect('/auth/login');
	}

	res.locals.user = req.session.user;

	next();
};

/**
 *  Ensures the user has access to the following routes
 * @param {...string} roles - List of allowed roles
 * @returns {(req:object,res:object,next:function)=>void} Express callback
 */
exports.restrictTo =
	(...roles) =>
	(req, res, next) => {
		if (!roles.includes(req.session.user.role)) {
			req.flash('error', 'You do not have permission to access this resource');
			return res.redirect('/auth/login');
		}

		next();
	};

/**
 *  Limits the fields in the given object to the specified fields
 * @param {object} data - Data from request body
 * @param  {...string} allowedFields - List of fields allowed
 * @returns {object} scopedObject
 */
exports.limitFields = (data, ...allowedFields) => {
	const obj = {};

	Object.keys(data).forEach((key) => {
		if (allowedFields.includes(key)) obj[key] = data[key];
	});

	return obj;
};

/**
 *  Catches and handles errors thrown by the SQL query
 * @param {function} next - Express next function
 * @param {(results: any[], fields: any[])=>void} fn - Callback
 * @returns {void}
 */
exports.catchSQLErrors = (next, fn) => (err, result, fields) => {
	try {
		if (err) throw err;
		else fn(result, fields);
	} catch (error) {
		next(new Error(error));
	}
};
