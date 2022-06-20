const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./views/**/*.{ejs,html}'],
	theme: {
		container: {
			center: true,

			padding: '3rem',
		},

		extend: {
			fontFamily: {
				heading: ['"Lato"', 'sans-serif'],
				body: ['"Nunito Sans"', ...defaultTheme.fontFamily.sans],
			},

			colors: {
				primary: '#03A0BF',
				secondary: '#61C3FE',
				accent: '#FFCB02',
			},
		},
	},
	plugins: [require('@tailwindcss/forms')],
};
