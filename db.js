const mysql = require('mysql2');

const connection = mysql.createConnection({
	host: 'localhost',

	user: 'root',
	password: process.env.DB_PASSWORD,

	database: 'amberproject2',
});

module.exports = connection;
