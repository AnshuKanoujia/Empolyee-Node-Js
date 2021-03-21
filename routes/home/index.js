var express = require('express');
var session = require('express-session');
var db = require('../../config/db');
var router = express.Router();
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const config = require('config');
const url = config.get('appUrl');
const crypto = require('crypto');

var jwt = require('jsonwebtoken');
const {
	check,
	validationResult
} = require('express-validator');

var session_store;

// Load input validation
const validateLoginInput = require("../../validation/login");
/* GET home page. */
router.get('/', function (req, res, next) {
	res.render('index', {
		title: 'Express',
		layout: 'layout/home-layout.jade'
	});
});

router.get('/terms&conditions', function (req, res, next) {
	res.render('terms&conditions', {
		title: 'Express',
		layout: 'layout/home-layout.jade'
	});
});

router.get('/not-found', function (req, res) {
	res.render('404', {
		title: 'Not Found',
		// layout: 'layout/home-layout.jade'
	});
});

/* POST to Add user. */
router.post('/addUser', [
	check('password').isLength({
        min: 6
      }).withMessage('Password Must be at least 6 chars long').not().isEmpty().withMessage('Current Password is required!')
],function (req, res) {
	let resetCode = crypto.randomBytes(20).toString("hex");
	bcrypt.genSalt(10, (err, salt) => {
		bcrypt.hash(req.body.password, salt, (err, hash) => {
			var data = {
				firstName: req.body.fname,
				lastName: req.body.lname,
				email: req.body.email,
				password: hash,
				resetCode: resetCode,
				//resetCodeExpire: today,
				role: '1',
				createdAt: new Date()
			};
			db.query('SELECT email FROM users where email="' + data.email + '"', function (err, rows) {
				if (rows.length == 0) {
					var q = db.query('INSERT INTO users SET ?', data, function (err, rows, fields) {
						if (err)
							console.error(err.message)
						var id = q._results[0]['insertId'];
						let w = id.toString(16);
						var userCode = 'TECH_' + w;
						db.query(`SELECT id FROM users WHERE role='4'`, function (err, hrId) {

							db.query('INSERT INTO tech_messages (msg_from, msg_to, message, time)VALUES (?, ?, ?, ?)', [hrId[0].id, id, 'For any query please drop a message here only !', new Date()], function (err) {});
						})
						db.query('UPDATE users SET eCode= ? WHERE id =?', [userCode, id], function (err) {
							if (err) {
								console.error(err.message)
								db.query('DELETE FROM users where id= ?', id)

								req.flash('msg_error', "Some Error Occured, Please Try Again!");
								res.redirect('/sign-up');
							}
						});

						// var transporter = nodemailer.createTransport({

						// 	service: 'gmail',
						// 	auth: {
						// 		user: 'test.augurs@gmail.com',
						// 		pass: 'qwerty098!'
						// 	},
						// 	requireTLS: true,
						// 	secure: true,
						// 	tls: {
						// 		rejectUnauthorized: false
						// 	},
						// 	debug: true
						// });

						// // setup e-mail data with unicode symbols
						// var mailOptions = {
						// 	from: "test.augurs@gmail.com", // sender address
						// 	to: req.body.email, // list of receivers
						// 	subject: "Technician Registration", // Subject line
						// 	generateTextFromHTML: true,
						// 	html: "Welcome to the Portal,<br>Please verify your E-mail by clicking on following link <br>" + "http://localhost:4000/verify-email/" + resetCode + "<br/><br/>" + " <br>Please access the portal with these details your email is: <b>" + req.body.email + "</b> and your password: <b>" + req.body.password + "</b><br>Please complete provide the complete details, in edit profile in your dashboard in order to increase your chances for the job, Incomplete profiles won't be entertained.<br>Thank you." // html body
						// }
						// // send mail with defined transport object
						// transporter.sendMail(mailOptions, function (err, info) {
						// 	if (err)
						// 		console.error(err.message)
						// 	else
						// 		console.error(err.message)
						// });
						// redirect to index page
						// req.flash('msg_info', "You have registered Successfully, Please verify your Email by clicking on link sent on Email Provided Now you can access the portal.");
						req.flash('msg_info', "You have registered Successfully,Please Login to Continue.");
						res.redirect('/login');
					});
				} else {
					req.flash('msg_error', "Email already exists!");
					res.redirect('/sign-up');
				}
			})
		});
	});
});

/* GET Login */
router.get('/login', function (req, res, next) {
	res.render('login', {
		title: 'Login',
		layout: 'layout/login-layout.jade'
	});
});
/* POST Login */
router.post('/login', [
	check('password').isLength({
        min: 6
      }).withMessage('Password Must be at least 6 chars long').not().isEmpty().withMessage('Current Password is required!')
], function (req, res) {
	const {
		errors,
		isValid
	} = validateLoginInput(req.body);

	if (!isValid) {
		req.flash('msg_error', errors.email);
		res.redirect('/login');
		req.end();
	}

	let email = req.body.email;
	let currSiteId = 0;
	const password = req.body.password;
	email = email.toLowerCase();
	email = email.trim();
	db.query('select email, password, status, profileImg, id, role, firstName, (SELECT site_id FROM user_sites WHERE user_id=users.id AND is_current=1 GROUP BY user_id) as currSiteId from users where email="' + email + '"', function (err, rows) {
		//Add login details
		var data = {
			email: email,
			deviceType: 'web',
			IpAddress: req.body.ipAddress,
			osName: req.body.osName,
			browserName: req.body.browserName
		};
		console.log(data)
		if (rows.length <= 0) {
			data.status = 'Fail';
			db.query('INSERT INTO login_details SET ?', data, function (err, rows, fields) {
				if (err)
					console.error(err.message)
			});
			req.flash('msg_error', "The email address was not recognized. Please try again.");
			res.redirect('/login');
		} else if (rows[0].status != 1) {
			data.status = 'Fail';
			db.query('INSERT INTO login_details SET ?', data, function (err, rows, fields) {
				if (err)
					console.error(err.message)
			});
			req.flash('msg_error', "The email address is Not Authorized to login. Please Contact Admin.");
			res.redirect('/login');
		} else {
			bcrypt.compare(password, rows[0].password, function (err, isMatch) {
				if (isMatch) {
					data.status = 'Success';
					db.query('INSERT INTO login_details SET ?', data, function (err, rows, fields) {
						if (err)
							console.error(err.message)
					});
					const payload = {
						id: rows[0].id,
						firstName: rows[0].firstName,
						lastName: rows[0].lastName,
						role: rows[0].role,
						profileImg: rows[0].profileImg,
					};
					jwt.sign(
						payload,
						config.get("jwtSecret"), {
							expiresIn: 3155692600 //31556926
						},
						(err, token) => {
							req.session.token = token;
							req.session.uid = rows[0].id;
							req.session.firstName = rows[0].firstName;
							req.session.role = rows[0].role;
							req.session.profileImg = rows[0].profileImg;
							if (rows[0].currSiteId) {
								currSiteId = rows[0].currSiteId;
								req.session.siteId = currSiteId;

							}
							if (rows[0].role == 1)
								res.redirect('/user/technician/dashboard');

							else if (rows[0].role == 2)
								res.redirect('/admin/project-planner/dashboard');
							else if (rows[0].role == 3) {

								res.redirect('/admin/supervisor/dashboard');

							} else if (rows[0].role == 4)
								res.redirect('/admin/hr/dashboard');
						}
					);
				} else {
					data.status = 'Fail';
					db.query('INSERT INTO login_details SET ?', data, function (err, rows, fields) {
						if (err)
							console.error(err.message)
					});
					req.flash('msg_error', "Invalid Password!");
					res.redirect('/login');
				}
			})
		}
	})
});

/* GET Sign-up */
router.get('/sign-up', function (req, res, next) {
	res.render('sign-up', {
		title: 'Sign Up',
		layout: 'layout/login-layout.jade'
	});
});

/* GET forget-password */
router.get('/forget-password', function (req, res, next) {
	res.render('forget-password', {
		title: 'Forget Password',
		layout: 'layout/login-layout.jade'
	});
});

/* POST forget-password */
router.post('/forget-password', function (req, res) {
	let {
		email
	} = req.body;
	let resetCode = crypto.randomBytes(20).toString('hex');
	email = email.toLowerCase();
	email = email.trim();
	db.query('select email from users where email="' + email + '"', function (err, rows) {
		if (rows.length == 0) {
			req.flash('msg_error', "The email address was not recognized. Please try again");
			res.redirect('/forget-password');
		} else {
			var today = new Date();
			today.setHours(today.getHours() + 1);
			var data = {
				resetCode: resetCode,
				resetCodeExpire: today

			};
			db.query('UPDATE users SET ? WHERE email = ? ', [data, email], function (err, rows, fields) {

				if (err)
					console.error(err.message)
				var transporter = nodemailer.createTransport({
					// ssl: false,
					// port: 465,
					service: 'gmail',
					// host: 'mail.easeyatra.com ',
					auth: {
						user: 'info@useplm.com',
						pass: 'lingo2598'
					},
					requireTLS: true,
					secure: true,
					tls: {
						rejectUnauthorized: false
					},
					debug: true
				});
				// setup e-mail data with unicode symbols
				var mailOptions = {
					from: "augurs.comp123@gmail.com", // sender address
					to: email, // list of receivers
					subject: "Forget Password", // Subject line
					generateTextFromHTML: true,
					html: "Dear User,<br/>You are receiving this because you (or someone else) have requested the reset of the password for your account<br/><br/>" +
						"Please click on the following link to complete the process within one hour of receiving it:<br/><br/>" + url +
						"reset-password/" + resetCode + "<br/><br/>" +
						"If you didn't request this, please ignore this email and your password will remain unchanged." // html body
				}
				// send mail with defined transport object
				transporter.sendMail(mailOptions, function (err, info) {
					if (err)
						console.error(err.message)
					else
						console.error(err.message)
				});
				req.flash('msg_info', "Password recovery email successfully sent.");
				res.redirect('/forget-password');

			});
		}
	})
})

/* GET Reset-password */
router.get('/reset-password/:resetCode', function (req, res, next) {

	let resetCode = req.params.resetCode;
	db.query('select * from users where resetCode="' + resetCode + '"', function (err, rows) {

		if (rows.length <= 0) {
			req.flash('msg_error', "Problem resetting password, this link has been expired. Please send another reset link.");
		}
		res.render('reset-password', {
			title: 'Reset Password',
			layout: 'layout/login-layout.jade',
			resetCode: rows[0].resetCode
		});
	})
});

/* POST Reset-password */
router.post('/reset-password/:resetCode', function (req, res, next) {
	let resetCode = req.params.resetCode;
	let newPassword = req.body.newPassword;
	let confirmPassword = req.body.confirmPassword;
	if (newPassword == confirmPassword) {
		db.query('select * from users where resetCode="' + resetCode + '"', function (err, rows) {
			if (rows.length <= 0) {
				req.flash('msg_error', "Problem resetting password, this link has been expired. Please send another reset link.");
			}
			bcrypt.genSalt(10, (err, salt) => {
				bcrypt.hash(newPassword, salt, (err, hash) => {
					var data = {
						password: hash,
						resetCode: null,
						resetCodeExpire: null,
					};
					db.query('UPDATE users SET ? WHERE resetCode = ? ', [data, resetCode], function (err, rows, fields) {
						if (err)
							console.error(err.message)
						req.flash('msg_info', "Password Updated Successfully.");
						res.redirect('/login');
					})
				})
			})
		})
	} else {
		req.flash('msg_error', "Password did not match.");
		res.redirect(`/reset-password/${resetCode}`);
	}
})

/* GET Skill */
router.get('/getSkill/:jobType_id', function (req, res, next) {
	/*Enabling CORS domain requests */
	res.header("Access-Control-Allow-Origin", "*");
	var id = req.params.jobType_id;
	db.query('SELECT id,skill_name as name FROM skills where job_type_id= ? AND active=1', id, function (err, skill) {

		if (err)
			res.json({
				success: false,
				msg: err.message
			});
		res.json({
			success: true,
			data: skill
		});

	});
});

/* GET Site Name to match with database wither it's already exist or not */
/* router.get('/getSiteName/:siteName', function (req, res) {
	res.header("Access-Control-Allow-Origin", "*");
	var siteName = req.params.siteName;
	db.query('SELECT id, siteName FROM jobsites where siteName= ?', siteName, function (err, site) {
		if (!site[0]) {
			res.json({
				data: 0
			});
		} else {
			res.json({
				data: 1
			});
		}

	});
}); */

/* GET Site Code to match with database wither it's already exist or not */
router.get('/getSiteCode/:siteCode', function (req, res) {
	/*Enabling CORS domain requests */
	res.header("Access-Control-Allow-Origin", "*");
	var siteCode = req.params.siteCode;
	db.query('SELECT id, sitesCode FROM jobsites where sitesCode= ?', siteCode, function (err, site) {
		if (!site[0]) {
			res.json({
				data: 0
			});
		} else {
			res.json({
				data: 1
			});
		}

	});
});

/* GET Subject name to match with database wither it's already exist or not */
router.get('/getsubjectName/:sub_name', function (req, res) {
	/*Enabling CORS domain requests */
	res.header("Access-Control-Allow-Origin", "*");
	var sub_name = req.params.sub_name;
	db.query('SELECT sub_id, sub_name FROM subjects where sub_name= ?', sub_name, function (err, site) {
		if (!site[0]) {
			res.json({
				data: 0
			});
		} else {
			res.json({
				data: 1
			});
		}

	});
});

/* GET Job Code to match with database wither it's already exist or not */
router.get('/getjobCode/:jobCode', function (req, res) {
	/*Enabling CORS domain requests */
	res.header("Access-Control-Allow-Origin", "*");
	var jobCode = req.params.jobCode;
	db.query('SELECT id, jobCode FROM jobs where jobCode= ?', jobCode, function (err, site) {
		if (!site[0]) {
			res.json({
				data: 0
			});
		} else {
			res.json({
				data: 1
			});
		}

	});
});

/* Autocomplete to get certification name */
router.post('/getCertificationName', function (req, res) {
	res.header("Access-Control-Allow-Origin", "*");
	db.query('SELECT certification_name from certification where certification_name like "%' + req.body.certify + '%" GROUP BY "certification_name"',
		function (err, rows) {
			if (err) throw err;
			var data = [];
			for (i = 0; i < rows.length; i++) {
				data.push(rows[i].certification_name);
			}
			res.end(JSON.stringify(data));

		});
});

/* Autocomplete to get authority name */
router.post('/getAuthorityName', function (req, res) {
	res.header("Access-Control-Allow-Origin", "*");
	db.query('SELECT authority from certification where authority like "%' + req.body.auth + '%" GROUP BY "authority"',
		function (err, rows) {
			if (err) throw err;
			var data = [];
			for (i = 0; i < rows.length; i++) {
				data.push(rows[i].authority);
			}
			res.end(JSON.stringify(data));

		});
});

/* POST Time sheet based on limit & offset based on next  */
router.post('/timeSheet', function (req, res) {
	res.header("Access-Control-Allow-Origin", "*");
	var limit = parseInt(req.body.limit);
	var off = parseInt(req.body.off);
	var user = req.body.userId;
	db.query('SELECT t.id AS taskreportingId, t.userId, t.jobId, t.date, t.inTime, t.outTime, t. hours_count, t.description, t.active, CONCAT(`firstName`, " ", `lastName`) AS supervisors_name, j.id AS jobId, j.jobName FROM taskreporting AS t JOIN users AS u ON (t.sup_id=u.id) LEFT JOIN jobs AS j ON(t.jobId=j.id) where t.userId=? AND t.active=1 ORDER BY t.date DESC LIMIT ? OFFSET ?', [user, limit, off],
		function (err, rows) {
			if (limit == 7) {
				off += 7;
			}
			if (limit == 31) {
				off += 31;
			}
			if (limit == 100) {
				off += 100;
			}
			var row = rows;
			var data = JSON.stringify(row);
			res.json({
				data: data,
				off: off
			});
		});
});

/* POST Time sheet based on limit & offset based on previous  */
router.post('/timeSheet-previous', function (req, res) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Origin", "*");
	var limit = parseInt(req.body.limit);
	var off = parseInt(req.body.off);
	var user = req.body.userId;

	db.query('SELECT t.id AS taskreportingId, t.userId, t.jobId, t.date, t.inTime, t.outTime, t.hours_count, t.description, t.active, CONCAT(`firstName`, " ", `lastName`) AS supervisors_name, j.id AS jobId, j.jobName FROM taskreporting AS t JOIN users AS u ON (t.sup_id=u.id) LEFT JOIN jobs AS j ON(t.jobId=j.id) where t.userId=? AND t.active=1 ORDER BY t.date DESC LIMIT ? OFFSET ?', [user, limit, off],
		function (err, rows) {
			if (limit == 7) {
				off -= 7;
			}
			if (limit == 31) {
				off -= 31;
			}
			if (limit == 100) {
				off -= 100;
			}
			var row = rows;
			var data = JSON.stringify(row);
			res.json({
				data: data,
				off: off
			});
		});
});

/* GET exam rules */
router.post('/getNumberOfQuestion', function (req, res) {
	/*Enabling CORS domain requests */
	res.header("Access-Control-Allow-Origin", "*");
	var count = req.body.count;
	var level = req.body.level;

	db.query('SELECT q.count, q.sub_id, s.sub_name, ql.ques_level from view_questions_count as q JOIN subjects AS s ON (q.sub_id=s.sub_id) join questions_level AS ql ON (q.exam_level=ql.id) where exam_level = ?and count < ? order by count asc LIMIT 0,1', [level, count], function (err, rule) {

		if (!rule[0]) {
			res.json({
				data: 0
			});
		} else {
			var msg = rule[0].sub_name + ' Only have ' + rule[0].count + ' ' + rule[0].ques_level + ' Questions';
			res.json({
				data: msg
			});
		}

	});
});

/* GET Verify Email */
router.get('/verify-email/:verificationCode', function (req, res, next) {
	let verificationCode = req.params.verificationCode;
	db.query('select * from users where resetCode="' + verificationCode + '"', function (err, rows) {

		if (rows.length <= 0) {
			req.flash('msg_error', "Problem verifing E-mail.");
			res.redirect('/');
		}
		let email = rows[0].email;
		db.query('update users SET emailVerified = 1 where resetCode="' + verificationCode + '"', function (err, rows) {
			if (err) {
				req.flash('msg_error', "Problem verifing E-mail.");
			}
			req.flash("Verified E-mail " + email + " Successfully, please login to continue");
			res.redirect('/login');
		});
	});
});

/* POST Email-verification*/
router.post('/send-verification', function (req, res) {
	let {
		uid
	} = req.body;
	let resetCode = crypto.randomBytes(20).toString('hex');

	db.query('select email from users where id="' + uid + '"', function (err, rows) {
		if (rows.length == 0) {
			req.flash('msg_error', "The email address was not recognized. Please try again or contact admin");
			res.redirect('/forget-password');
		} else {
			var today = new Date();
			today.setHours(today.getHours() + 1);
			let email = rows[0].email;
			var data = {
				resetCode: resetCode,
				resetCodeExpire: today

			};
			db.query('UPDATE users SET ? WHERE id = ? ', [data, uid], function (err, rows, fields) {
				if (err)
					console.error(err.message)
				var transporter = nodemailer.createTransport({
					// ssl: false,
					// port: 465,
					service: 'gmail',
					// host: 'mail.easeyatra.com ',
					auth: {
						user: 'test.augurs@gmail.com',
						pass: 'qwerty098!'
					},
					requireTLS: true,
					secure: true,
					tls: {
						rejectUnauthorized: false
					},
					debug: true
				});

				var mailOptions = {
					from: "test.augurs@gmail.com", // sender address
					to: email, // list of receivers
					subject: "Email Verification", // Subject line
					generateTextFromHTML: true,
					html: "Welcome to the Portal,<br>Please verify your E-mail by clicking on following link <br>" + url + "/verify-email/" + resetCode + "<br/><br/>" + " <br>Please access the portal with these details your email is: <b>" + req.body.email + "</b> and your password: <b>" + req.body.password + "</b><br>Please complete provide the complete details, in edit profile in your dashboard in order to increase your chances for the job, Incomplete profiles won't be entertained.<br>Thank you." // html body

				}
				transporter.sendMail(mailOptions, function (err, info) {
					if (err)
						console.error(err.message)
					else
						console.error(err.message)
				});
				req.flash('msg_info', "Verification email successfully sent, check your Email");
				res.redirect('/login');

			});
		}
	});
});

/* GET Logout */
router.get('/logout', function (req, res) {
	if (req.session) {
		req.session.destroy();
		res.redirect('/');
	} else {
		req.session = null;
		res.redirect('/');
	}
});

/* Wither Verified Email */
router.get('/notificationVerifiedEmail', function (req, res) {

	// db.query('SELECT emailVerified FROM users where id=?', req.session.uid, function(err, email){
	db.query('SELECT emailVerified FROM users where id=1', function (err, email) {
		if (err)
			res.json({
				success: false,
				msg: err.message
			});
		res.json({
			success: true,
			data: email[0]
		});
	});
});

router.get('/manage-designation/:jobType', function (req, res) {
	res.header("Access-Control-Allow-Origin", "*");
	db.query('SELECT j.id, j.type_name, d.id as designationId, d.designation_name, d.skill_level, d.hourly_rate,d.max_pertime_rate FROM jobtype AS j JOIN designation AS d ON (j.id = d.job_type) WHERE j.active=1 AND d.job_type=?', req.params.jobType, function (err, designationData) {
		if (err)
			console.error(err.message)
		res.json({
			success: true,
			data: designationData
		});
	});

});

router.get('/manage-designationRate/:jobType/:designationId', function (req, res) {
	res.header("Access-Control-Allow-Origin", "*");
	db.query('SELECT j.id, j.type_name, d.id as designationId, d.designation_name, d.hourly_rate,d.max_pertime_rate FROM jobtype AS j JOIN designation AS d ON (j.id = d.job_type) WHERE j.active=1 AND d.job_type=? AND d.id=?', [req.params.jobType, req.params.designationId], function (err, designationData) {
		if (err)
			console.error(err.message)
		res.json({
			success: true,
			data: designationData
		});
	});

});

/* POST to get user rates */
router.post('/getUserRates/:id/:jobId/:distance', function (req, res) {
	res.header("Access-Control-Allow-Origin", "*");
	var userId = req.params.id;
	var jobId = req.params.jobId;
	var distance = req.params.distance;
	var total_days = 0;
	var total_weeks = 0;
	var per_diem = 0;
	var extraHours = 0;
	var weekHours = 0;
	var totalHours = 0;
	var totalExtraHours = 0;

	db.query('SELECT ur.hourly_rate, ur.max_pertime_rate, d.designation_name, d.id AS designationID FROM user_rates AS ur LEFT JOIN user_designation AS ud ON (ur.userId=ud.user_id) LEFT JOIN designation AS d ON (ud.designation_id=d.id) WHERE ur.userId = ?', userId, function (err, rates) {
		db.query('SELECT workingHoursPerDay, workingDayPerWeek, days_count FROM jobs WHERE id= ?', jobId, function (err, hours) {
			if (err)
				console.error(err.message)

			/*********************/
			var weekCount = parseInt(hours[0].days_count / 7);

			if (weekCount < 1) {
				weekCount = 1;
			}
			var totalWeekHours = hours[0].workingHoursPerDay * hours[0].workingDayPerWeek;
			if (totalWeekHours > 40) {
				weekHours = 40;
				extraHours = totalWeekHours - 40;
			} else {
				weekHours = totalWeekHours;
			}
			totalHours = weekHours * weekCount;
			totalExtraHours = extraHours * weekCount;
			/*********************/



			total_weeks = hours[0].days_count / 7;
			if (hours[0].workingDayPerWeek < 7) {
				total_days = hours[0].days_count - ((hours[0].days_count / 7) * (7 - hours[0].workingDayPerWeek))
			} else {
				total_days = hours[0].days_count;
			}

			var result = hours[0].workingHoursPerDay * hours[0].workingDayPerWeek;
			if (result < 40) {
				per_diem = ((rates[0].max_pertime_rate / 40) * result);
			} else {
				per_diem = rates[0].max_pertime_rate;
			}

			// var hours = hours[0].workingHoursPerDay;
			// var budget = (420 / 7 + 14.00 * hours + (distance * 0.58));

			hours = total_days * hours[0].workingHoursPerDay;

			/*******************************************/
			var budget = ((per_diem * total_weeks) + ((totalHours * rates[0].hourly_rate) + (totalExtraHours * (rates[0].hourly_rate * 1.5))) + (distance * 0.58));
			/*******************************************/


			if (rates != 'null') {

				if ((rates[0].designationID >= 1 && rates[0].designationID <= 4) || ((rates[0].designationID >= 11 && rates[0].designationID <= 14))) {
					var predicated_budget = budget * 20 / 100;
					var total_predicated_budget = budget + predicated_budget;

				} else if ((rates[0].designationID >= 5 && rates[0].designationID <= 8) || ((rates[0].designationID >= 15 && rates[0].designationID <= 18))) {
					var predicated_budget = budget * 25 / 100;
					var total_predicated_budget = budget + predicated_budget;

				} else if ((rates[0].designationID >= 9 && rates[0].designationID <= 10) || ((rates[0].designationID >= 19 && rates[0].designationID <= 20))) {
					var predicated_budget = budget * 30 / 100;
					var total_predicated_budget = budget + predicated_budget;

				}
				/* else {
	
					var predicated_budget = budget * 30 / 100;
					var total_predicated_budget = budget + predicated_budget;
				} */
			} else {
				var predicated_budget = budget * 20 / 100;
				var total_predicated_budget = budget + predicated_budget;
			}

			res.json({
				success: true,
				data: '$ ' + parseFloat(total_predicated_budget).toFixed(2)
			});
		});
	});
});

/* POST to add sender messages */
router.post('/senderMsg', function (req, res) {
	res.header("Access-Control-Allow-Origin", "*");
	var senderId = req.body.id;
	var reciverId = req.body.userId;
	var message = req.body.message;
	var token = req.body.token;
	var decoded = jwt.decode(token);
	var tokenId = decoded.id;
	if ((tokenId == senderId) || (tokenId == reciverId)) {
		var data = {
			msg_from: senderId,
			msg_to: reciverId,
			message: message,
			time: new Date(),
		};
		db.query('INSERT INTO tech_messages SET ?', data, function (err) {
			// db.query(`SELECT msg_from, msg_to, time, message FROM tech_messages WHERE active=1 AND msg_from IN (?,?) AND msg_to IN (?,?) ORDER BY time DESC LIMIT 1 OFFSET 1`, [reciverId, senderId, reciverId, senderId], function (err, show_messages) {
			if (err)
				console.error(err.message)
			res.json({
				success: true
			});
			// });
		});
	} else {
		res.json({
			success: false
		});
	}

});

router.post('/getMsgDetail', function (req, res) {
	res.header("Access-Control-Allow-Origin", "*");
	var token = req.body.token;
	var decoded = jwt.decode(token);
	var tokenId = decoded.id;
	var role = decoded.role;

	// if (role == 1) {
	// 	if (req.body.msg_to != 4) {
	// 		return res.json(FALSE, 'you are not authorized to send message to this user');
	// 	}
	// }
	if ((tokenId == req.body.msg_from) || (tokenId == req.body.msg_to)) {
		// if (tokenId == req.body.msg_to) {
		// db.query(`UPDATE tech_messages SET reciver_status=1 WHERE msg_from IN (?,?) AND msg_to IN (?,?)`, [req.body.msg_from, req.body.msg_to, req.body.msg_from, req.body.msg_to], function (err) {

		// 		if (err)
		// 			console.error(err.message)
		// 	});
		// }
		if ((tokenId == req.body.msg_from) || (tokenId == req.body.msg_to)) {
			db.query(`UPDATE tech_messages SET status=1 WHERE msg_from IN (?,?) AND msg_to IN (?,?)`, [req.body.msg_from, req.body.msg_to, req.body.msg_from, req.body.msg_to], function (err) {

				if (err)
					console.error(err.message)
			});
		}

		db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.profileImg, tm.msg_from, tm.msg_to, tm.message, tm.time FROM tech_messages AS tm JOIN users AS u ON(tm.msg_to=u.id) WHERE tm.msg_from IN (?,?) AND tm.msg_to IN (?,?) ORDER BY tm.time `, [req.body.msg_from, req.body.msg_to, req.body.msg_from, req.body.msg_to], function (err, msgDetail) {
			if (err)
				console.error(err.message)
			// var uid = req.session.uid;
			res.json({
				success: true,
				// uid: uid,
				msgDetails: msgDetail
			});
		});

	} else {
		res.json({
			success: false,
		});
	}
});

router.get('/getUpadtedUserList', function (req, res) {
	res.header("Access-Control-Allow-Origin", "*");

	db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.profileImg, tm.* FROM tech_messages AS tm JOIN users AS u ON(tm.msg_to=u.id) JOIN ( SELECT msg_to, MAX(time) AS time FROM tech_messages GROUP BY msg_to ) AS tm2 ON tm.msg_to = tm2.msg_to AND tm.time = tm2.time WHERE tm.active=1 GROUP BY name ORDER BY tm.time DESC`, function (err, message) {
		if (err)
			console.error(err.message)
		res.json({
			success: true,
			msg: message,
		});
	});
});

/* GET to progect List based on siteId */
router.get('/projectList/:id', function (req, res) {
	res.header("Access-Control-Allow-Origin", "*");
	var siteId = req.params.id;
	db.query('SELECT id AS jobId, jobName, startDate, endDate, predicated_budget, proposed_budget, status AS finsihed FROM jobs WHERE siteId=?', siteId, function (err, projectList) {
		if (err)
			console.error(err.message)

		for (let i = 0; i < projectList.length; i++) {
			if (projectList[i].finsihed != 3) {

				/* In progress Over Budget */
				if ((projectList[i].predicated_budget > projectList[i].proposed_budget) && (new Date() > projectList[i].startDate) && (new Date() < projectList[i].endDate))
					projectList[i].status = 8;

				/* In progress ON Budget */
				if ((projectList[i].predicated_budget <= projectList[i].proposed_budget) && (new Date() > projectList[i].startDate) && (new Date() < projectList[i].endDate))
					projectList[i].status = 9;

				/* Delayed Over Budget */
				if ((projectList[i].predicated_budget > projectList[i].proposed_budget) && (new Date() > projectList[i].endDate))
					projectList[i].status = 10;

				/* Delayed On Budget */
				if ((projectList[i].predicated_budget <= projectList[i].proposed_budget) && (new Date() > projectList[i].endDate))
					projectList[i].status = 11;


				/* Yet to start */
				if (projectList[i].startDate < new Date())
					projectList[i].status = 12;

				projectList[i].budget = parseFloat(projectList[i].predicated_budget).toFixed(2) + '/' + projectList[i].proposed_budget;
			} else {
				projectList[i].status = 3;
			}

		}

		if (projectList.length == 0)
			res.status(403).json(createResponse("FAIL", 106));
		else
			return res.status(200).json({
				success: true,
				projectList: projectList,
			});
	})

});

/* GET to userList */
router.get('/userList/:id', function (req, res) {
	res.header("Access-Control-Allow-Origin", "*");
	var jobId = req.params.id;
	db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, id FROM users LEFT JOIN users_job AS uj ON(users.id=uj.user_id) WHERE uj.isCurrentJob=1 AND uj.job_id=?`, jobId, function (err, userList) {
		if (err)
			console.error(err.message)

		if (userList.length == 0)
			res.status(403).json(createResponse("FAIL", 70));
		else
			return res.status(200).json({
				success: true,
				userList: userList,
			});
	});

});
module.exports = router;