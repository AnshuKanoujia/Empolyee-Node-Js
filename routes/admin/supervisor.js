var express = require('express');
var router = express.Router();
var db = require('../../config/db');
var Cart = require('../../config/cart');
const config = require('config');
const url = config.get('appUrl');
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
var moment = require('moment');
var request = require("request");
var jwt = require('jsonwebtoken');
const {
	check,
	validationResult
} = require('express-validator');
var md5 = require('md5');

function chksession(req, res) {
	if (!req.session.uid || req.session.role != "3") {
		res.redirect(url + 'login');
		req.end();
	}
}

function chkSite(req, res) {
	if (req.session.siteId == 0) {
		req.flash('msr_error', "You Don't Have Any Site Assigned !")
		res.redirect('/admin/supervisor/dashboard');
		req.end();
	}
}

function countHours(inTime, outTime) {
	var startTime = moment(inTime, "MM/DD/YYYY HH:mm:ss a");
	var endTime = moment(outTime, "MM/DD/YYYY HH:mm:ss a");

	/* var duration = moment.duration(endTime.diff(startTime));
	var hours = parseInt(duration.asHours());
	var minutes = parseInt(duration.asMinutes()) % 60;
	var days = parseInt(hours / 24);
	hour = hours - (days * 24); 
	return (days + ' days and ' + hour + ' hour and ' + minutes + ' minutes.'); */

	var difference = endTime.diff(startTime)
	var duration = moment.duration(difference).subtract(1800, 'seconds');
	var hours = parseInt(duration.asHours());
	var minutes = parseInt(duration.asMinutes()) % 60;
	return (hours + ' Hrs and ' + minutes + ' Min');
	/*var hours = parseInt(duration.asHours());
	var minutes = parseInt(duration.asMinutes()) % 60;
	var days = parseInt(hours / 24);
	hour = hours - (days * 24);
	return (days + ' days and ' + hour + ' hour and ' + minutes + ' minutes.');*/
}

/* function checkCountHours(inTime, outTime) {
	var startTime = moment(inTime, "HH:mm:ss a");
	var endTime = moment(outTime, "HH:mm:ss a");

	var duration = moment.duration(endTime.diff(startTime));
	var hours = parseInt(duration.asHours());
	var minutes = parseInt(duration.asMinutes()) % 60;
	if (hours <= 0 && minutes <= 0) {
		return 0;
	}

	return 1;
} */

function checkInHours(inTime, outTime, inputTime) {
	var format = 'hh:mm:ss'

	var time = moment(inputTime, format),
		beforeTime = moment(inTime, format),
		afterTime = moment(outTime, format);

	if (time.isBetween(beforeTime, afterTime)) {

		return 1;


	} else {

		return 0;

	}
}

/* GET total number of days between two dates */
/* function checkTotalCountDays(proposedStartDate, proposedEndDate) {
  
	var startTime = new Date(proposedStartDate);
	var endTime = new Date(proposedEndDate);
  
	var Difference_In_Time = endTime.getTime() - startTime.getTime();
	var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24);
	
	return ('Total number of days <br>' + Difference_In_Days);
	
} */

/* GET users listing. */
router.get('/', function (req, res) {
	chksession(req, res);
	res.send('respond with a resource');
});

router.get('/dashboard', function (req, res, err) {
	chksession(req, res);
	if (err)
		console.error(err.message);
	res.render('admin/supervisor/dashboard', {
		title: 'supervisor Dashboard',
		layout: 'layout/supervisor-layout.jade',
		url: url,
		applications: req.session
	});
});

router.get('/user-dashboard', function (req, res) {
	chksession(req, res);
	res.render('admin/supervisor/user-dashboard', {
		title: 'User Dashboard',
		layout: 'layout/supervisor-layout.jade'
	});
});

/* GET to initiate timesheet */
router.get('/reportInTime', function (req, res) {
	chksession(req, res);
	if (req.session.siteId == null) {
		req.flash('msg_error', "You Don't Have Any Site Assigned !")
		res.redirect('/admin/supervisor/dashboard');
		res.end();
	} else {
		// db.query('SELECT site_id as id, js.siteName from user_sites JOIN jobsites js ON (user_sites.site_id=js.id) where user_id = ? and is_current=1', req.session.uid, function (err, row) {
		db.query('SELECT j.id as jobId, j.jobName, j.startDate, j.endDate FROM jobs AS j WHERE j.jobSupervisor=?', req.session.uid, function (err, row) {
			res.render('admin/supervisor/clockIn', {
				title: 'User Dashboard',
				layout: 'layout/supervisor-layout.jade',
				projectList: row,
				applications: req.session
			});
		});
	}
});

/* POST to initiate timesheet */
router.post('/reportInTime', function (req, res) {
	chksession(req, res);
	var supId = req.session.uid;
	var jobId = req.body.jobId;
	var inputTime = req.body.inTime;

	db.query('SELECT id, planner FROM jobsites where id=(select siteId from jobs where id = ?)', jobId, function (err, row) {
		if (jobId) {
			var data = {
				supId: supId,
				siteId: row[0].id,
				jobId: jobId,
				plannerId: row[0].planner,
				inTime: req.body.inTime,
				date: moment(new Date()).format('YYYY-MM-DD'),
				active: 1,
				status: 7
			};
			var h = 0;
			var date = data.date;
			var a = db.query('SELECT id, supId, siteId, inTime, outTime, date FROM supervisor_taskreporting where supId=? AND jobId=? AND date=? AND outTime IS NOT NULL', [supId, jobId, date], function (err, find) {
				console.log(a.sql,'qqqq')
				find.forEach(function (a) {
					var inTime = a.inTime;
					var outTime = a.outTime;
					if (checkInHours(inTime, outTime, inputTime) == 1) {
						h++;
					}


				})
				if (h != 0) {
					req.flash('msg_error', "You Already have An Time Sheet For This Time Slot.");
					res.redirect('/admin/supervisor/view-timeSheet');
				} else {
					db.query('SELECT supId FROM supervisor_taskreporting where supId="' + supId + '" AND outTime IS NULL AND jobId=?', jobId, function (err, rows) {
						if (rows[0]) {
							req.flash('msg_error', "You Already have An Pending Time Sheet");
							res.redirect('/admin/supervisor/view-clockOut');
							res.end();
						} else {
							db.query('INSERT INTO supervisor_taskreporting SET ?', data, function (err, rows, fields) {

								if (err)
									console.error(err.message)
								req.flash('msg_info', "Time Sheet Initiated Successfully");
								res.redirect('/admin/supervisor/view-timeSheet');

							});
						}
					});
				}

			});

		} else {
			req.flash('msg_error', "You don't have any site assign to submit time sheet!");
			res.redirect('/admin/supervisor/dashboard');
		}
	});
});

/* GET to view supervisor timesheet list */
router.get('/view-timeSheet', function (req, res) {
	chksession(req, res);
	if (req.session.siteId == null) {
		req.flash('msg_error', "You Don't Have Any Site Assigned !")
		res.redirect('/admin/supervisor/dashboard');
		res.end();
	} else {

		db.query('SELECT st.*, u.firstName, s.statusName, jt.id AS jobsitesId, j.jobName As siteName FROM supervisor_taskreporting AS st join users AS u join statusname AS s ON(s.id = st.status) JOIN jobsites AS jt ON(st.siteId = jt.id) JOIN jobs AS j ON(st.jobId = j.id) where st.supId = u.id AND active=1 AND st.supId=? ORDER BY st.date DESC', req.session.uid, function (err, rows) {
			if (err)
				console.error(err.message)
			res.render('admin/supervisor/view-timeSheet', {
				title: 'Supervisor Report View',
				layout: 'layout/supervisor-layout.jade',
				reports: rows,
				applications: req.session
			});
		});
	}
});

/* GET to view clockOut sheet based on sites */
router.get('/view-clockOut', function (req, res) {
	chksession(req, res);
	if (req.session.siteId == null) {
		req.flash('msg_error', "You Don't Have Any Site Assigned !")
		res.redirect('/admin/supervisor/dashboard');
		res.end();
	} else {

		db.query('SELECT site_id as id,js.siteName,(SELECT COUNT(id) FROM supervisor_taskreporting where supId=? AND outTime IS NULL and siteId=js.id) as reportCount from user_sites us JOIN jobsites js ON (us.site_id=js.id) where user_id = ? and is_current=1', [req.session.uid, req.session.uid], function (err, row) {
			res.render('admin/supervisor/view-clockOut', {
				title: 'Supervisor Dashboard',
				layout: 'layout/supervisor-layout.jade',
				list: row,
				applications: req.session
			});
		});
	}
});

/* GET to view clockOut to enter clockOut time for supervisor on particular supervisor site */
router.get('/clockOut/:id', function (req, res) {
	chksession(req, res);
	var supId = req.session.uid;
	var jobId = req.params.id;
	if (jobId) {
		var a= db.query('SELECT id, inTime, jobId, date FROM supervisor_taskreporting where supId="' + supId + '" AND outTime IS NULL AND jobId=?', jobId, function (err, rows) {
			console.log(a.sql,'qqqqqqq')
			if (rows.length == 0) {
				if (err)
					console.error(err.message)
				req.flash('msg_error', "You Need To Clock-In First.");
				res.redirect('/admin/supervisor/dashboard');
			} else {
				res.render('admin/supervisor/clockOut', {
					reports: rows[0],
					applications: req.session
				});
			}
		});
	} else {
		req.flash('msg_error', "You don't have this site assigned to submit time sheet!");
		res.redirect('/admin/supervisor/dashboard');
	}
});

/* POST particular user job report */
router.post('/clockOut', function (req, res) {

	chksession(req, res);
	var supId = req.session.uid;
	var jobId = req.body.jobId;
	var countHourTime = countHours(req.body.inTime, req.body.outTime);
	// var checkCountHourTime = checkCountHours(req.body.inTime, req.body.outTime);
	// if (checkCountHourTime == 0) {
	// 	req.flash('msg_error', "Please Enter Valid Time.");
	// 	res.redirect('/admin/supervisor/clockOut');
	// 	req.end();
	// }

	if (!req.files) {
		var data = {
			supId: supId,
			date: moment(new Date()).format('YYYY-MM-DD'),
			outTime: req.body.outTime,
			description: req.body.description,
			hours_count: countHourTime,
			status: 0,
			active: 1
		};
	} else {
		if (req.files.attachment.mimetype == "image/jpeg" || req.files.attachment.mimetype == "image/png" || req.files.attachment.mimetype == "image/gif" || req.files.attachment.mimetype == "image/pdf") {
			let imageFile = req.files.attachment;
			let imageExtension = imageFile.name.split('.');
			let ext = imageExtension[(imageExtension).length - 1];
			var image = supId + '_' + new Date().toISOString();
			new_image = md5(image);
			new_image = new_image + '.' + ext;
			let fileName = new_image;
			let uploadPath = 'uploads';
			var data = {
				supId: supId,
				date: moment(new Date()).format('YYYY-MM-DD'),
				outTime: req.body.outTime,
				attachment: fileName,
				description: req.body.description,
				hours_count: countHourTime,
				status: 0,
				active: 1
			};
			imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {});
		} else {
			req.flash('msg_error', "This format is not allowed , please upload file with '.png','.gif','.jpg','.pdf'");
			res.redirect('/admin/supervisor/clockOut');
			req.end();
		}
	}
	var a = db.query('SELECT id FROM supervisor_taskreporting where supId="' + supId + '" AND outTime IS NULL AND jobId = ?', jobId, function (err, rows) {
		console.log(a.sql,'qqqq')
		var id = rows[0].id;
		if (rows.length == 0) {
			req.flash('msg_error', "Some thing went wrong.");
			res.redirect('/admin/supervisor/view-timeSheet');
		} else {
			db.query('UPDATE supervisor_taskreporting SET ? where id = ?', [data, id], function (err) {
				if (err)
					console.error(err.message)
				req.flash('msg_info', "Time Sheet Submitted Successfully.");
				res.redirect('/admin/supervisor/view-timeSheet');
			});
		}
	});
});

/* GET to view supervisor time report */
router.get('/view-reportDetails/:id', function (req, res, next) {
	chksession(req, res);
	db.query('SELECT st.*, CONCAT(`firstName`, " ", `lastName`) AS name, s.statusName FROM supervisor_taskreporting AS st join users AS u ON (st.supId=u.id) JOIN statusname AS s ON (s.id=st.status) where st.id=?', req.params.id, function (err, rows) {
		if (err)
			console.error(err.message)
		res.render('admin/supervisor/view-reportDetails', {
			title: 'View Report',
			layout: 'layout/supervisor-layout.jade',
			reports: rows,
			applications: req.session
		});
	});
});

/* GET to delete supervisor time report */
router.get('/deleteReport/:id', function (req, res) {
	chksession(req, res);
	db.query('UPDATE supervisor_taskreporting SET active=0 WHERE id=?', req.params.id, function (err, rows) {
		if (err)
			console.error(err.message)
		req.flash('msg_error', "Time Sheet Deleted Successfully");
		res.redirect('/admin/supervisor/view-timeSheet');
	});
});

/* Get to edit supervisor time report */
router.get('/editReport/:id', function (req, res) {
	chksession(req, res);
	db.query('SELECT * FROM supervisor_taskreporting WHERE id = ?', req.params.id, function (err, rows) {
		if (err)
			console.error(err.message)
		res.render('admin/supervisor/editReport', {
			title: 'Edit Supervisor Report',
			layout: 'layout/supervisor-layout.jade',
			reports: rows,
			applications: req.session
		});
	});
});

/* POST to update supervisor time report */
router.post('/editReport/:id', function (req, res) {
	chksession(req, res);
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		const validationErrors = errors.array();
		let errorMessages = [];
		validationErrors.forEach(function (row) {
			errorMessages.push(row.msg);
		})
		req.flash('msg_error', errorMessages);
		res.redirect('/admin/supervisor/editReport/' + req.params.id);
	} else {
		var supId = req.session.uid;
		var countHourTime = countHours(req.body.inTime, req.body.outTime);
		/* var checkCountHourTime = checkCountHours(req.body.inTime, req.body.outTime);
		if (checkCountHourTime == 0) {
			req.flash('msg_error', "Please Enter Valid Time.");
			res.redirect('/admin/supervisor/editReport/' + req.params.id);
			req.end();
		} */
		if (!req.files) {
			var data = {
				date: moment(new Date()).format('YYYY-MM-DD'),
				outTime: req.body.outTime,
				inTime: req.body.inTime,
				description: req.body.description,
				hours_count: countHourTime,
				status: 0,
				active: 1
			};
		} else {
			if (req.files.attachment.mimetype == "image/jpeg" || req.files.attachment.mimetype == "image/png" || req.files.attachment.mimetype == "image/gif" || req.files.attachment.mimetype == "image/pdf") {
				let imageFile = req.files.attachment;
				let imageExtension = imageFile.name.split('.');
				let ext = imageExtension[(imageExtension).length - 1];
				var image = supId + '_' + new Date().toISOString();
				new_image = md5(image);
				new_image = new_image + '.' + ext;
				let fileName = new_image;
				let uploadPath = 'uploads';
				var countHourTime = countHours(req.body.inTime, req.body.outTime);
				var data = {
					date: moment(new Date()).format('YYYY-MM-DD'),
					outTime: req.body.outTime,
					inTime: req.body.inTime,
					attachment: fileName,
					description: req.body.description,
					hours_count: countHourTime,
					status: 0,
					active: 1
				};
				imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {});
			} else {
				req.flash('msg_error', "This format is not allowed , please upload file with '.png','.gif','.jpg','.pdf'");
				res.redirect('/admin/supervisor/editReport/' + req.params.id);
				req.end();
			}
		}
		db.query('SELECT supId, status FROM supervisor_taskreporting WHERE id = ?', req.params.id, function (err, rows) {
			if (rows[0].supId == supId && rows[0].status == 0) {
				db.query('SELECT id FROM supervisor_taskreporting where supId="' + supId + '"', function (err, row) {
					if (row.length != 0) {
						db.query('UPDATE supervisor_taskreporting SET ? WHERE id = ? ', [data, req.params.id],
							function (err) {
								if (err)
									console.error(err.message)
								req.flash('msg_info', "Time Sheet Updated Successfully");
								res.redirect('/admin/supervisor/view-timeSheet');
							});
					} else {
						req.flash('msg_error', "Some thing went wrong!");
						res.redirect('/admin/supervisor/view-timeSheet');
					}
				});
			} else {
				req.flash('msg_error', "You Are Not Authorized To Edit This Time Sheet!");
				res.redirect('/admin/supervisor/dashboard');
			}
		});
	}

});

/* GET planner edit-profile */
router.get('/edit-profile', function (req, res) {
	chksession(req, res);
	// db.query('SELECT GROUP_CONCAT(skill_id) as skills_id, u.profileImg, u.firstName, u.lastName, u.preferredName, u.dob, u.phone_number, u.email, u.experience, u.skills, u.jobType, u.country, u.state, u.city, u.address, us.user_id, us.skill_id FROM users as u JOIN user_skills as us ON (u.id = us.user_id) WHERE u.id = ?', req.session.uid, function (err, rows) {
	db.query('SELECT GROUP_CONCAT(skill_id) as skills_id, u.profileImg, u.firstName, u.lastName,u.preferredName, u.dob, u.phone_number, u.email, u.experience, u.skills, u.jobType, u.newAddress, us.user_id, us.skill_id FROM users as u JOIN user_skills as us ON (u.id = us.user_id) WHERE u.id = ?', req.session.uid, function (err, rows) {
		db.query('SELECT id, type_name FROM jobtype WHERE active=1', function (err, row) {
			db.query('SELECT id, skill_name FROM skills WHERE active=1', function (err, skill) {
				if (err)
					console.error(err.message)
				res.render('admin/supervisor/edit-profile', {
					title: 'Edit Profile',
					layout: 'layout/admin-layout.jade',
					skill: skill,
					jobtype: row,
					url: url,
					apiKey: config.get('apiKey'),
					value: rows[0],
					applications: req.session
				});

			});
		});
	});
});

/* POST planner edit-profile */
router.post('/edit-profile', [
		check('firstName').not().isEmpty().withMessage('Name must have more than 2 characters'),
		check('lastName').not().isEmpty().withMessage('Name must have more than 2 characters'),
		check('dob', 'Date of birth is required').not().isEmpty(),
		check('email', 'Your email is not valid').not().isEmpty(),
	],
	function (req, res) {
		chksession(req, res);
		const errors = validationResult(req);
		var userId = req.session.uid;
		if (!errors.isEmpty()) {
			const validationErrors = errors.array();
			let errorMessages = [];
			validationErrors.forEach(function (row) {
				errorMessages.push(row.msg);
			})
			req.flash('msg_error', errorMessages);
			res.redirect('/admin/supervisor/edit-profile');
		} else {

			var sk = req.body.skills;
			if (!sk)
				sk = 0;
			if (typeof sk != "object")
				sk = [sk];
			var experience;
			if (req.body.year == 'YEAR' && req.body.month == 'Month') {
				experience = 0.0;
			} else {
				experience = req.body.year + '.' + req.body.month;
			}
			if (!req.files) {
				var data = {
					firstName: req.body.firstName,
					lastName: req.body.lastName,
					preferredName: req.body.preferredName,
					dob: moment(req.body.dob).format('YYYY-MM-DD'),
					phone_number: req.body.phone_number,
					experience: experience,
					newAddress: req.body.newAddress,
					latitude: req.body.latitude,
					longitude: req.body.longitude,
					jobtype: req.body.jobType,
					completeProfile: 1
				};
			} else {
				var imageFile = req.files.profileImg;
				let imageExtension = imageFile.name.split('.');

				if (imageExtension[1] == "jpg" || imageExtension[1] == "JPG" || imageExtension[1] == "jpeg" || imageExtension[1] == "JPEG" || imageExtension[1] == "png" || imageExtension[1] == "PNG" || imageExtension[1] == "pdf" || imageExtension[1] == "PDF") {
					let ext = imageExtension[(imageExtension).length - 1];
					var image = userId + '_' + new Date().toISOString();
					new_image = md5(image);
					new_image = new_image + '.' + ext;
					let fileName = new_image;
					var uploadPath = 'uploads/profile_img';
					var data = {
						firstName: req.body.firstName,
						lastName: req.body.lastName,
						preferredName: req.body.preferredName,
						dob: moment(req.body.dob).format('YYYY-MM-DD'),
						phone_number: req.body.phone_number,
						experience: experience,
						longitude: req.body.longitude,
						jobtype: req.body.jobType,
						profileImg: fileName,
						completeProfile: 1
					};
					req.session.profileImg = fileName;
					imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {});
				} else {
					req.flash('msg_error', "This format is not allowed , please upload file with '.png','.gif','.jpg',");
					res.redirect('/admin/supervisor/edit-profile');
					req.end();
				}
			}
			db.query('UPDATE users SET ? WHERE id = ? ', [data, req.session.uid], function (err, rows) {
				db.query('delete from user_skills where user_id=?', userId);
				sk.forEach(function (a) {
					db.query('INSERT INTO user_skills (user_id, skill_id)VALUES (?, ?)', [userId, a],
						function (err) {
							db.query('DELETE FROM user_skills WHERE skill_id =0', function (err) {});
							if (err)
								console.error(err.message)
						});

				});
				req.flash('msg_info', "Profile Updated Successfully");
				res.redirect('/admin/supervisor/edit-profile');
			});
		}
	});

/* GET to manage sites */
router.get('/manage-sitese', function (req, res) {
	chksession(req, res);
	db.query('SELECT jobSites.siteName, jobSites.description, jobSites.createDate, countries.name AS country, cities.name AS city, states.name AS state FROM `jobSites` LEFT JOIN countries ON (jobSites.country = countries.id) LEFT JOIN cities ON (jobSites.`city` = cities.id) LEFT JOIN states ON (jobSites.state = states.id)', function (err, rows) {
		if (err)
			console.error(err.message);
		res.render('admin/supervisor/manage-sites', {
			title: 'View Job',
			layout: 'layout/supervisor-layout.jade',
			siteLists: rows,
			applications: req.session
		});
	});
});

/* POST phases */
router.post('/phases/', function (req, res) {
	chksession(req, res);
	var id = req.body.id;
	var status = req.body.status;
	var currentPhases = req.body.currentPhases;
	db.query("UPDATE userapplications SET status=? WHERE  id=?", [status, id], function (err, rows) {
		db.query("UPDATE users SET currentPhases=? WHERE  id=?", [currentPhases, id], function (err, rows) {

			if (err)
				console.error(err.message);
			req.flash('msg_info', "Update Successfully");
			// res.redirect('/admin/supervisor/viewApplication/'+id);
			res.redirect('/admin/supervisor/manage-application');
		});
	});
});

/* GET create jobs */
/* router.get('/create-jobs', function (req, res) {
	var id = req.session.siteId;
	chksession(req, res);
	if (req.session.siteId == null) {
		req.flash('msg_error', "You Don't Have Any Site Assigned !")
		res.redirect('/admin/supervisor/dashboard');
		res.end();
	} else {
		db.query('SELECT id,type_name FROM jobtype WHERE active=1', function (err, rows) {
			db.query('SELECT skill_name FROM skills WHERE active =1', function (err, row) {
				db.query('SELECT id, firstName FROM users where role=2', function (err, userPlanner) {
					db.query('SELECT id, firstName FROM users where role=3', function (err, userSupervisor) {
						if (err)
							console.error(err.message)
						res.render('admin/supervisor/create-jobs', {
							title: 'Create/Select Jobs',
							layout: 'layout/supervisor-layout.jade',
							jobType: rows,
							planner: userPlanner,
							supervisor: userSupervisor,
							id: id,
							url: url,
							applications: req.session
						});
					});
				});
			});
		});
	}
}); */

/* POST create jobs */
/* router.post('/create-jobs/:id', [
		check('description').isLength({
			min: 5
		}).withMessage('Description Must be at least 5 chars long'),
		check('noOfVacancy').isNumeric(),
		check('noOfPhases').isNumeric(),
	],
	async function (req, res) {
		chksession(req, res);

		var id = req.params.id;
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			const validationErrors = errors.array();
			let errorMessages = [];
			validationErrors.forEach(function (row) {
				errorMessages.push(row.msg);
			})
			req.flash('msg_error', errorMessages);
			res.redirect('/admin/supervisor/create-jobs/' + id);
		} else {
			// var checkCountDays = checkTotalCountDays(req.body.proposedStartDate, req.body.proposedEndDate);
			var sk = req.body.skills;
			if (!sk)
				sk = 0;
			if (typeof sk != "object")
				sk = [sk];
			let sup;
			await db.query('SELECT supervisors FROM jobsites WHERE id=?', req.params.id, function (err, supervisors) {
				sup = supervisors[0].supervisors;
				if (!(req.body.workingHoursPerDay || req.body.workingDayPerWeek)) {

					var data = {
						siteId: req.params.id,
						jobName: req.body.jobName,
						jobCode: req.body.jobCode,
						jobTypeId: req.body.jobType,
						description: req.body.description,
						jobPlanner: req.session.uid,
						jobSupervisor: sup,
						startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
						endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
						createdBy: req.session.uid,
						createDate: moment(new Date()).format('YYYY-MM-DD'),
						experience: '1.2',
						noOfVacancy: req.body.noOfVacancy,
						noOfPhases: req.body.noOfPhases,
						days_count: req.body.days_count,
						proposed_budget: req.body.proposed_budget
					};
				} else {
					var data = {
						siteId: req.params.id,
						jobName: req.body.jobName,
						jobCode: req.body.jobCode,
						jobTypeId: req.body.jobType,
						description: req.body.description,
						jobPlanner: req.session.uid,
						jobSupervisor: sup,
						startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
						endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
						createdBy: req.session.uid,
						createDate: moment(new Date()).format('YYYY-MM-DD'),
						experience: '1.2',
						noOfVacancy: req.body.noOfVacancy,
						noOfPhases: req.body.noOfPhases,
						days_count: req.body.days_count,
						proposed_budget: req.body.proposed_budget,
						workingHoursPerDay: req.body.workingHoursPerDay,
						workingDayPerWeek: req.body.workingDayPerWeek
					};
				}
				var q = db.query('INSERT INTO jobs SET ?', data, function (err, rows) {
					if (err)
						console.error(err.message)
					var id = q._results[0]['insertId'];
					let w = id.toString(16);
					w = w.toUpperCase();
					var userCode = 'JOB_' + w;
					sk.forEach(function (a) {

						db.query('INSERT INTO job_skills (job_id, skill_id)VALUES (?, ?)', [id, a], function (err) {});
						db.query('DELETE FROM job_skills WHERE skill_id = 0', function (err) {});
					});
					db.query('UPDATE jobs SET jobCodeCpy= ? WHERE id =?', [userCode, id], function (err) {
						if (err) {
							db.query('DELETE FROM jobs where id= ?', id)
							req.flash('msg_error', "Some Error Occured, Please Try Again!");
							res.redirect('/admin/supervisor/create-jobs/' + id);

						} else {

							if (req.body.noOfPhases > 1) {

								for (i = 0; i < req.body.noOfPhases; i++) {
									db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT  ?, ?, ?, ?, ?', [id, req.body.phaseName[i], moment(req.body.startDate[i]).format('YYYY-MM-DD'), moment(req.body.endDate[i]).format('YYYY-MM-DD'), req.body.phaseDescription[i]], function (err) {
										if (err)
											console.error(err.message)
									});
								}
							} else {
								var jobId = id;
								var phaseName = req.body.jobName + '_Phase1';
								var startDate = moment(new Date()).format('YYYY-MM-DD');
								var endDate = req.body.projectEndDate;
								var phaseDescription = req.body.description;
								db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT ?, ?, ?, ?, ?', [jobId, phaseName, moment(req.body.startDate).format('YYYY-MM-DD'), moment(req.body.endDate).format('YYYY-MM-DD'), phaseDescription], function (err) {
									if (err)
										console.error(err.message)
								});
							}

							req.flash('msg_info', "Project Created Successfully");
							res.redirect('/admin/supervisor/view-jobs/');
						}
					});
				});
			});
		}
	}); */

/* GET Supervisor edit-job */
router.get('/edit-jobs/:id', function (req, res) {
	chksession(req, res);
	var id = req.params.id;
	db.query('SELECT siteId FROM jobs WHERE id=?', id, function (err, siteID) {
		var id = siteID[0].siteId;
		db.query('SELECT GROUP_CONCAT(skill_id) as skills_id, j.id, j.jobName, j.jobCode, j.jobTypeId, j.startDate, j.endDate, j.jobSupervisor, j.description, j.noOfVacancy, j.noOfPhases, j.workingHoursPerDay, j.workingDayPerWeek, j.days_count, j.proposed_budget, js.job_id, GROUP_CONCAT(s.skill_name) as skills_name, jt.type_name FROM jobs as j JOIN job_skills as js ON (j.id = js.job_id) JOIN jobtype AS jt ON (j.jobTypeId = jt.id) JOIN skills AS s ON (js.skill_id = s.id) WHERE j.id = ? AND jt.active=1 AND  s.active=1', req.params.id, function (err, rows) {
			// db.query('SELECT id, type_name FROM jobtype WHERE active=1', function (err, row) {
			db.query('SELECT id, skill_name FROM skills WHERE active=1', function (err, skill) {
				db.query('SELECT id, jobId, phaseName, phaseDescription, startDate, endDate FROM jobphases WHERE jobId=?', req.params.id, function (err, phases) {
					if (err)
						console.error(err.message)
					res.render('admin/supervisor/edit-jobs', {
						title: 'Edit Jobs',
						layout: 'layout/supervisor-layout.jade',
						jobDetails: rows[0],
						skill: skill,
						// jobtype: row,
						jobPhases: phases,
						id: id,
						url: url,
						applications: req.session
					});
				});

			});
			// });
		});
	});
});

/* Add Create-job */
router.post('/edit-jobs/:id', [
		check('description').isLength({
			min: 5
		}).withMessage('Description Must be at least 5 chars long'),
		check('noOfVacancy').isNumeric(),
		// check('noOfPhases').isNumeric(),
	],
	function (req, res) {


		var id = req.body.id;
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			const validationErrors = errors.array();
			let errorMessages = [];
			validationErrors.forEach(function (row) {
				errorMessages.push(row.msg);
			})
			req.flash('msg_error', errorMessages);
			res.redirect('/admin/supervisor/edit-jobs/' + id);
		} else {

			let sup;
			db.query('SELECT siteId FROM jobs WHERE id=?', id, function (err, siteID) {
				var siteId = siteID[0].siteId;
				sup = req.session.uid;

				var hours = req.body.workingHoursPerDay;
				days = req.body.workingDayPerWeek;
				var Difference_In_Hours = hours * days;

				if (!(req.body.workingHoursPerDay || req.body.workingDayPerWeek)) {
					var data = {
						siteId: siteId,
						jobName: req.body.jobName,
						jobCode: req.body.jobCode,
						// jobTypeId: req.body.jobType,
						description: req.body.description,
						jobSupervisor: sup,
						startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
						endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
						createdBy: req.session.uid,
						createDate: new Date(),
						experience: req.body.year + '.' + req.body.month,
						noOfVacancy: req.body.noOfVacancy,
						// noOfPhases: req.body.noOfPhases,
						days_count: req.body.days_count,
						proposed_budget: req.body.proposed_budget,
						// Difference_In_Hours: Difference_In_Hours,
					};
				} else {
					var data = {
						siteId: siteId,
						jobName: req.body.jobName,
						jobCode: req.body.jobCode,
						// jobTypeId: req.body.jobType,
						description: req.body.description,
						jobSupervisor: sup,
						startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
						endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
						createdBy: req.session.uid,
						createDate: new Date(),
						experience: req.body.year + '.' + req.body.month,
						noOfVacancy: req.body.noOfVacancy,
						// noOfPhases: req.body.noOfPhases,
						days_count: req.body.days_count,
						proposed_budget: req.body.proposed_budget,
						workingHoursPerDay: req.body.workingHoursPerDay,
						workingDayPerWeek: req.body.workingDayPerWeek,
						// Difference_In_Hours: Difference_In_Hours,
					};
				}



				db.query('UPDATE jobs SET ? WHERE id=?', [data, id], function (err, rows) {
					if (err)
						console.error(err.message)
					// let w = id.toString(16);
					// w = w.toUpperCase();
					// db.query('DELETE FROM job_skills WHERE job_id = ?', id, function (err) {});

					// db.query('DELETE FROM jobphases WHERE jobId = ?', id, function (err) {
					// 	if (err) {
					// 		req.flash('msg_error', "Some Error Occured, Please Try Again!");
					// 		res.redirect('/admin/supervisor/edit-jobs/' + id);

					// 	} else {

					// 		if (req.body.noOfPhases > 1) {

					// 			for (i = 0; i < req.body.noOfPhases; i++) {
					// 				db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT  ?, ?, ?, ?, ?', [id, req.body.phaseName[i], moment(req.body.startDate[i]).format('YYYY-MM-DD'), moment(req.body.endDate[i]).format('YYYY-MM-DD'), req.body.phaseDescription[i]], function (err) {
					// 					if (err)
					// 						console.error(err.message)
					// 				});
					// 			}
					// 		} else {
					// 			var jobId = id;
					// 			var phaseName = req.body.jobName + '_Phase1';
					// 			var startDate = new Date();
					// 			var endDate = req.body.projectEndDate;
					// 			var phaseDescription = req.body.description;
					// 			db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT ?, ?, ?, ?, ?', [jobId, phaseName, moment(req.body.startDate).format('YYYY-MM-DD'), moment(req.body.endDate).format('YYYY-MM-DD'), phaseDescription], function (err) {
					// 				if (err)
					// 					console.error(err.message)
					// 			});
					// 		}
							req.flash('msg_info', "Project Updated Successfully");
							res.redirect('/admin/supervisor/view-jobs');
					// 	}
					// });
				});
			});
		}
	});

/* GET ALL JOBS */
router.get('/view-jobs', function (req, res) {
	chksession(req, res);
	if (req.session.siteId == null) {
		req.flash('msg_error', "You Don't Have Any Site Assigned !")
		res.redirect('/admin/supervisor/dashboard');
		res.end();
	}
	// chkSite(req, res);
	if (req.session.siteId != 0) {
		req.session.cart = '';

		// db.query('SELECT js.id, js.siteName, js.sitesCode, j.id, j.jobCode, j.jobName, j.noOfPhases, j.endDate,j.startDate,j.noOfVacancy,(select count(user_id) from users_job WHERE job_id = j.id and isCurrentJob =1) as empCount FROM jobs AS j LEFT JOIN jobsites AS js ON(js.id=j.siteId) WHERE js.id=?', req.session.siteId, function (err, list) {

		db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, jobType FROM users WHERE id=?', req.session.uid, function (err, jobType) {
			var jobType = jobType[0].jobType;
			db.query('SELECT js.id, js.siteName, js.sitesCode, j.id As jobid, j.jobCode, j.jobName, j.noOfPhases, j.endDate, j.startDate, j.noOfVacancy, j.predicated_budget, j.days_count, (SELECT GROUP_CONCAT(id) FROM designation WHERE job_type=j.jobTypeId) AS des_id, (SELECT GROUP_CONCAT(designation_name) FROM designation WHERE job_type=j.jobTypeId) AS des_name, (select count(user_id) from users_job WHERE job_id = j.id and isCurrentJob =1) as empCount FROM jobs AS j LEFT JOIN jobsites AS js ON(js.id=j.siteId) WHERE js.id IN (SELECT site_id from user_sites where user_id = ? and is_current=1) AND j.status=1 AND j.jobTypeId=?', [req.session.uid, jobType], function (err, list) {
				res.render('admin/supervisor/view-jobs', {
					title: 'Supervisor View Profile',
					layout: 'layout/supervisor-layout.jade',
					jobList: list,
					applications: req.session
				});
			});
		});
	} else {
		req.flash('msg_error', "Sorry you don't have any site assigned to manage yet.");
		res.redirect('/admin/supervisor/dashboard');
	}
});

/* POST to add user designation */
router.post('/add-userDesignation', function (req, res) {
	chksession(req, res);
	var jobId = req.body.jobid;
	req.session.designation_name = req.body.designation_name;
	res.redirect('/admin/supervisor/viewUsers/' + jobId);
});

/* GET Search Jobs */
router.get('/viewUsers/:id', function (req, res) {
	chksession(req, res);
	var jobId = req.params.id;
	req.session.jobId = jobId;

	if (req.session.cart)
		var cartCount = req.session.cart.totalUsers;
	else {
		cartCount = 0;
		req.session.cart = new Cart(req.session.cart ? req.session.cart : {});
	}

	// var sk = req.params.skills;
	// _skFilter = '';
	// if (sk) {
	// 	if (typeof sk == 'object') {
	// 		_skFilter = ` AND u.id IN (SELECT user_id from user_skills WHERE skill_id IN (`
	// 		sk.forEach(function (a) {
	// 			_skFilter += a + ','
	// 		})
	// 		_skFilter += `0 ) )`
	// 	} else {
	// 		_skFilter = ` AND u.id IN (SELECT user_id from user_skills WHERE skill_id IN (${sk}) )`
	// 	}
	// }

	var cartUser = req.session.cart.users;
	_skcartUserFilter = ' ';
	if (cartUser) {

		if (typeof cartUser == 'object') {
			_skcartUserFilter = ` AND u.id NOT IN (`
			cartUser.forEach(function (a) {
				_skcartUserFilter += a + ','
			})
			_skcartUserFilter += `0 ) `
		} else {
			_skcartUserFilter = ` AND u.id NOT IN ((${cartUser}) `
		}
		// var _skcartUserFilter = ' ';
	}

	var designation = req.body.designation;
	_designationFilter = '';
	if (designation) {
		if (typeof designation == 'object') {
			_designationFilter = ` AND u.id IN (SELECT user_id from user_designation WHERE designation_id IN (`
			designation.forEach(function (a) {

				_designationFilter += a + ','
			})
			_designationFilter += `0 ) )`
		} else {
			_designationFilter = ` AND u.id IN (SELECT user_id from user_designation WHERE designation_id IN (${designation}) )`
		}
	}

	db.query('SELECT jobTypeId, latitude as site_latitude, longitude as site_longitude FROM jobs AS j JOIN jobsites AS js ON (js.id = j.siteId) where j.id=?', jobId, function (err, rows) {
		var jobtype = rows[0].jobTypeId;
		db.query('SELECT id, designation_name FROM designation WHERE job_type=?', jobtype, function (err, designation) {
			// db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg, ci.name as city , s.name as state, C.name as country, count(user_id) as rank, (select GROUP_CONCAT(skill_name) from skills s join user_skills us2 on us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) as skills FROM user_skills us JOIN job_skills js on us.skill_id = js.skill_id JOIN users u on u.id = us.user_id LEFT JOIN cities ci ON (u.city = ci.id) LEFT JOIN states s ON (u.state = s.id) LEFT JOIN countries C ON (u.country = C.id) WHERE js.job_id = ? ${_skFilter}  ${_skcartUserFilter} AND firstName LIKE '%${req.params.search ? req.params.search : '%'}%' AND u.role=1 AND u.id IN (SELECT user_id FROM user_designation WHERE designation_id = ?)  AND u.id NOT IN (select user_id from users_job where job_id=? ) AND u.id NOT IN (select userId from joboffers where jobId=? ) AND u.search=1 GROUP BY us.user_id order by rank desc`, [jobId, req.session.designation_name, jobId, jobId], function (err, users) {
			db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg, u.newAddress, u.latitude, u.longitude, count(u.id) as rank, u.ratings, (SELECT CONCAT(hourly_rate,'/',max_pertime_rate) FROM user_rates AS ur WHERE ur.userId =u.id GROUP by ur.userId) AS rates, (SELECT jobsites.latitude FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_lat,(SELECT jobsites.longitude as jobsite_long FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_long FROM users u JOIN user_rates AS ur ON (u.id = ur.userId) WHERE firstName LIKE '%${req.params.search ? req.params.search : '%'}%' ${_designationFilter} ${_skcartUserFilter} AND u.jobType=(SELECT jobTypeId FROM jobs WHERE id ='${jobId}') AND u.role=1 AND u.latitude IS NOT NULL AND u.latitude != '' AND u.id NOT IN (select user_id from users_job where job_id=? ) AND u.id NOT IN (select userId from joboffers where jobId=? ) AND u.search=1 GROUP BY u.id order by rank desc`, [jobId, jobId], function (err, users) {

				var cart = req.params.id;
				var site_latitude = parseFloat(rows[0].site_latitude);
				var site_longitude = parseFloat(rows[0].site_longitude);
				distDiffer = [];
				parameters = '';
				var d = '';
				distDiffer1 = [];
				parameters1 = '';
				var d1 = '';
				users.forEach(function (a) {
					lat = a.latitude;
					long = a.longitude;

					/************************/
					jobsitelat = a.jobsite_lat;
					jobsitelong = a.jobsite_long;
					/************************/

					parameters += `${parameters ? '|' : ''}${a.latitude},${a.longitude}`

					/************************/

					parameters1 += `${parameters1 ? '|' : ''}${a.jobsite_lat ? a.jobsite_lat : 0},${a.jobsite_long ? a.jobsite_long : 0}`
					/************************/
				});
				options = {
					uri: 'https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=' + parameters + '&destinations=' + site_latitude + '%2C' + site_longitude + '&key='+config.apiKey,
					timeout: 200000000,
					followAllRedirects: true
				};

				/************************/
				options1 = {
					uri: 'https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=' + parameters1 + '&destinations=' + site_latitude + '%2C' + site_longitude + '&key='+config.apiKey,
					timeout: 200000000,
					followAllRedirects: true
				};

				/************************/
				request(options, function (err, response, body) {
					if (err)
						console.error(err.message)
					var jsonData = JSON.parse(body);
					var row = jsonData.rows;
					var arr = [];
					row.forEach(function (a) {
						var element = a.elements;
						element.forEach(function (b) {
							// var s = b.distance.value;
							// d = distDiffer.push(s);
							if (b.status == 'OK') {
								var s = b.distance.text;
								d = distDiffer.push(s);
							} else {
								var s = 0;
								d = distDiffer.push(s);
							}
						});
					});
					/* for (i = 0; i < d; i++) {
						users[i].distance = distDiffer[i] / 1000;
					} */
					var arrDistance = [];
					var aa = [];
					for (i = 0; i < d; i++) {
						arrDistance[i] = distDiffer[i];
						// if (arrDistance[i] != 0) {
							// var dis = arrDistance[i].replace(/,/g, '');
							// aa[i] = dis.split(" ", 1);
							var dis = arrDistance[i];
							aa[i] = dis;

							users[i].distance = aa[i];
							// if (aa[i] != 0) {
								arr.push(users[i]);
							// }
						// }
					}
					request(options1, function (err, response, body1) {
						if (err)
							console.error(err.message)
						var jsonData1 = JSON.parse(body1);
						var row1 = jsonData1.rows;

						row1.forEach(function (a) {
							var element1 = a.elements;
							element1.forEach(function (b) {
								if (b.status == 'OK') {
									var s = b.distance.text;
									d1 = distDiffer1.push(s);
								} else {
									var s = 0;
									d1 = distDiffer1.push(s);
								}
							});
						});

						for (i = 0; i < arr.length; i++) {

							if (distDiffer1[i] != 0) {
								distDiffer1[i] = distDiffer1[i].replace(',', '');
								var fitFinder = distDiffer1[i];
								if (fitFinder.includes('ft')) {
									distDiffer1[i] = 1;
								}
								if (fitFinder.includes('mi')) {
									distDiffer1[i] = parseInt(distDiffer1[i]);
								}
								arr[i].siteDistance = distDiffer1[i];
							} else {
								arr[i].siteDistance = 0;
							}
						}

						res.render('admin/supervisor/viewUsers', {
							title: 'Supervisor Dashboard',
							layout: 'layout/supervisor-layout.jade',
							users: arr,
							designation: designation,
							jobtype: jobtype,
							jobId: jobId,
							url: url,
							applications: req.session,
							cartCount: cartCount,
							cart: cart
						});
					});
				});
			});
		});
	});
});

/* GET Filter users */
router.post('/searchUsers', function (req, res) {
	chksession(req, res);
	// var jobId = req.query.jobId;
	var jobId = req.body.jobId;
	var ratings = req.body.ratings;
	if (req.session.cart)
		var cartCount = req.session.cart.totalUsers;

	var cartUser = req.session.cart.users;
	_skcartUserFilter = ' ';
	if (cartUser) {

		if (typeof cartUser == 'object') {
			_skcartUserFilter = ` AND u.id NOT IN (`
			cartUser.forEach(function (a) {
				_skcartUserFilter += a + ','
			})
			_skcartUserFilter += `0 ) `
		} else {
			_skcartUserFilter = ` AND u.id NOT IN ((${cartUser}) `
		}
	}

	var designation = req.body.designation;
	_designationFilter = '';
	if (designation) {
		if (typeof designation == 'object') {
			_designationFilter = ` AND u.id IN (SELECT user_id from user_designation WHERE designation_id IN (`
			designation.forEach(function (a) {

				_designationFilter += a + ','
			})
			_designationFilter += `0 ) )`
		} else {
			_designationFilter = ` AND u.id IN (SELECT user_id from user_designation WHERE designation_id IN (${designation}) )`
		}
	}

	_ratingFilter = '';
	if (ratings) {
		_ratingFilter = ` AND u.ratings >= (${ratings})`
	}

	db.query('SELECT jobTypeId, latitude as site_latitude, longitude as site_longitude FROM jobs AS j JOIN jobsites AS js ON (js.id = j.siteId) where j.id=?', jobId, function (err, rows) {
		var jobtype = rows[0].jobTypeId;
		// db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg, u.ratings, ci.name as city , s.name as state, C.name as country, count(user_id) as rank, (select GROUP_CONCAT(skill_name) from skills s join user_skills us2 on us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) as skills FROM user_skills us JOIN job_skills js on us.skill_id = js.skill_id JOIN users u on u.id = us.user_id LEFT JOIN cities ci ON (u.city = ci.id) LEFT JOIN states s ON (u.state = s.id) LEFT JOIN countries C ON (u.country = C.id) WHERE js.job_id = ? ${_skFilter} ${_ratingFilter} AND firstName LIKE '%${req.body.search ? req.body.search : '%'}%' AND u.role=1 AND u.id IN (SELECT user_id FROM user_designation WHERE designation_id = ?) AND u.search=1 GROUP BY us.user_id order by rank desc`, [jobId, jobId], function (err, users) {
		db.query('SELECT id AS designationId, designation_name FROM designation WHERE job_type=?', jobtype, function (err, designation) {
			db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg,u.newAddress, u.latitude, u.longitude, u.ratings, u.latitude, u.longitude, count(u.id) as rank, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation, (SELECT CONCAT(hourly_rate,'/',max_pertime_rate) FROM user_rates AS ur WHERE ur.userId =u.id GROUP by ur.userId) AS rates, (SELECT jobsites.latitude FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_lat,(SELECT jobsites.longitude as jobsite_long FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_long FROM users u JOIN user_rates AS ur ON (u.id = ur.userId) WHERE firstName LIKE '%${req.body.search ? req.body.search : '%'}%' ${_designationFilter} ${_skcartUserFilter} ${_ratingFilter} AND u.jobType=(SELECT jobTypeId FROM jobs WHERE id ='${jobId}') AND u.role=1 AND u.latitude IS NOT NULL AND u.latitude != '' AND u.search=1 GROUP BY u.id order by rank desc`, [jobId], function (err, users) {
				var cart = req.params.id;
				var site_latitude = parseFloat(rows[0].site_latitude);
				var site_longitude = parseFloat(rows[0].site_longitude);
				distDiffer = [];
				parameters = '';
				var d = '';
				distDiffer1 = [];
				parameters1 = '';
				var d1 = '';

				users.forEach(function (a) {
					lat = a.latitude;
					long = a.longitude;
					/************************/
					jobsitelat = a.jobsite_lat;
					jobsitelong = a.jobsite_long;
					/************************/

					parameters += `${parameters ? '|' : ''}${a.latitude},${a.longitude}`

					/************************/

					parameters1 += `${parameters1 ? '|' : ''}${a.jobsite_lat ? a.jobsite_lat : 0},${a.jobsite_long ? a.jobsite_long : 0}`
					/************************/
				});
				options = {
					uri: 'https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=' + parameters + '&destinations=' + site_latitude + '%2C' + site_longitude + '&key='+config.apiKey,
					timeout: 200000000,
					followAllRedirects: true
				};

				/************************/
				options1 = {
					uri: 'https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=' + parameters1 + '&destinations=' + site_latitude + '%2C' + site_longitude + '&key='+config.apiKey,
					timeout: 200000000,
					followAllRedirects: true
				};

				/************************/

				request(options, function (err, response, body) {
					if (err)
						console.error(err.message)
					var jsonData = JSON.parse(body);
					var row = jsonData.rows;
					var arr = [];
					row.forEach(function (a) {
						var element = a.elements;
						element.forEach(function (b) {
							// var s = b.distance.value;
							// d = distDiffer.push(s);
							if (b.status == 'OK') {
								var s = b.distance.text;
								d = distDiffer.push(s);
							} else {
								var s = 0;
								d = distDiffer.push(s);
							}

						});
					});

					for (i = 0; i < d; i++) {
						users[i].distance = distDiffer[i];
						// if (distDiffer[i] != 0) {
							arr.push(users[i]);
						// }
					}
					request(options1, function (err, response, body1) {
						if (err)
							console.error(err.message)
						var jsonData1 = JSON.parse(body1);
						var row1 = jsonData1.rows;

						row1.forEach(function (a) {
							var element1 = a.elements;
							element1.forEach(function (b) {
								if (b.status == 'OK') {
									var s = b.distance.text;
									d1 = distDiffer1.push(s);
								} else {
									var s = 0;
									d1 = distDiffer1.push(s);
								}
							});
						});

						for (i = 0; i < arr.length; i++) {

							if (distDiffer1[i] != 0) {
								distDiffer1[i] = distDiffer1[i].replace(',', '');
								distDiffer1[i] = parseInt(distDiffer1[i]);

								arr[i].siteDistance = distDiffer1[i];
							} else {
								arr[i].siteDistance = 0;
							}
						}

						res.render('admin/supervisor/viewUsers', {
							title: 'Supervisor Dashboard',
							layout: 'layout/supervisor-layout.jade',
							users: arr,
							jobtype: jobtype,
							designation: designation,
							url: url,
							jobId: jobId,
							applications: req.session,
							cartCount: cartCount,
							cart: cart,
							search: req.body.search
						});
					});
				});

			});
		});
	});
});

/* GET to add cart */
// router.get('/add/:id', function (req, res) {
router.get('/add', function (req, res) {
	chksession(req, res);
	var id = req.query.id;
	var distance = req.query.siteDistance;
	var rates = req.query.rates;

	var jobId = req.session.jobId;
	var cart = new Cart(req.session.cart ? req.session.cart : {});

	db.query('SELECT id, firstName, experience, skills, profileImg, newAddress from users where id=?', id, function (err, users) {
		var data = {
			id: users[0].id,
			firstName: users[0].firstName,
			experience: users[0].experience,
			skills: users[0].skills,
			profileImg: users[0].profileImg,
			newAddress: users[0].newAddress,

		};
		cart.add(data, id, distance, rates);
		req.session.cart = cart;
		res.redirect('/admin/supervisor/viewUsers/' + jobId);

	});
});

/* GET user cart to see added all user list */
router.get('/userCart', function (req, res) {
	let jobId = req.session.jobId;
	chksession(req, res);
	var userdis = [];
	var cartCount = req.session.cart.totalUsers;
	if (cartCount == 0) {
		res.redirect('/admin/supervisor/userMap-view/' + jobId);
	} else {
		var userList = req.session.cart.users;
		var userDistance = req.session.cart.usersDistance;
		var userRates = req.session.cart.usersRates;
		for (i = 0; i < userList.length; i++) {
			userdis[userList[i]] = userDistance[i];

		}

		var total_days = 0;
		var total_weeks = 0;
		var per_diem = 0;

		/*************************************/
		var extraHours = 0;
		var weekHours = 0;
		var totalHours = 0;
		var totalExtraHours = 0;


		var dis = [];
		var r = [];
		var totalRates = '';
		var list = '( 0';
		userList.forEach(function (user) {
			list = list + ',' + user;
		});

		userDistance.forEach(function (distance) {
			totalDis = dis.push(distance);
		});

		userRates.forEach(function (rates) {
			totalRates = r.push(rates);
		});

		list = list + ')';


		db.query(`SELECT users.id, users.profileImg, CONCAT(firstName,' ',lastName) AS firstName, users.experience, users.newAddress from users  where users.id IN ` + list + 'ORDER BY users.id DESC ', function (err, users) {
			for (i = 0; i < dis.length; i++) {
				users[i].distance = dis[i];
			}
			for (i = 0; i < totalRates; i++) {
				users[i].rates = r[i];
			}


			db.query('SELECT ur.userId, ur.hourly_rate, ur.max_pertime_rate, d.designation_name, d.id AS designationID FROM user_rates AS ur LEFT JOIN user_designation AS ud ON (ur.userId=ud.user_id) LEFT JOIN designation AS d ON (ud.designation_id=d.id) WHERE ur.userId IN' + list + 'GROUP BY ur.userId ORDER BY ur.userId DESC ', function (err, rates) {
				for (let index = 0; index < users.length; index++) {
					users[index].rates = rates[index].hourly_rate + '/' + rates[index].max_pertime_rate;

				}
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
					hours = total_days * hours[0].workingHoursPerDay;


					for (let i = 0; i < rates.length; i++) {
						users[i].distance = userdis[users[i].id];

						if (result < 40) {
							per_diem = ((rates[i].max_pertime_rate / 40) * result);
						} else {
							per_diem = rates[i].max_pertime_rate;
						}

						// var budget = ((per_diem * total_weeks) + (hours * rates[i].hourly_rate) + (userDistance[i] * 0.58));

						/*******************************************/
						var budget = ((per_diem * total_weeks) + ((totalHours * rates[i].hourly_rate) + (totalExtraHours * (rates[i].hourly_rate * 1.5))) + (userdis[users[i].id] * 0.58));

						/*******************************************/
						if ((rates[i].designationID >= 1 && rates[i].designationID <= 4) || ((rates[i].designationID >= 11 && rates[i].designationID <= 14))) {
							var predicated_budget = budget * 20 / 100;
							var total_predicated_budget = budget + predicated_budget;

						} else if ((rates[i].designationID >= 5 && rates[i].designationID <= 8) || ((rates[i].designationID >= 15 && rates[i].designationID <= 18))) {
							var predicated_budget = budget * 25 / 100;
							var total_predicated_budget = budget + predicated_budget;

						} else if ((rates[i].designationID >= 9 && rates[i].designationID <= 10) || ((rates[i].designationID >= 19 && rates[i].designationID <= 20))) {
							var predicated_budget = budget * 30 / 100;
							var total_predicated_budget = budget + predicated_budget;

						}
						users[i].total_predicated_budget = parseFloat(total_predicated_budget).toFixed(2);
					}
					res.render('admin/supervisor/userCart', {
						title: 'Supervisor Dashboard',
						layout: 'layout/supervisor-layout.jade',
						cart: users,
						cartCount: cartCount,
						applications: req.session,
						id: jobId
					});
				});
			});
		});
	}
});

/* POST to offered users */
router.post('/jobOfferedUsers', async function (req, res) {
	chksession(req, res);

	var users = req.session.cart.users;
	var userDistance = req.body.distance;
	var userRates = req.body.rates;
	var rate = '';
	var store = [];
	var total_predicated_budget = '';
	var total_days = 0;
	var total_weeks = 0;
	var per_diem = 0;
	var extraHours = 0;
	var weekHours = 0;
	var totalHours = 0;
	var totalExtraHours = 0;

	users.forEach(async function (user, index) {
		db.query('SELECT ur.hourly_rate, ur.max_pertime_rate, d.designation_name, d.id AS designationID FROM user_rates AS ur LEFT JOIN user_designation AS ud ON (ur.userId=ud.user_id) LEFT JOIN designation AS d ON (ud.designation_id=d.id) WHERE ur.userId = ?', user, function (err, rates) {

			db.query('SELECT workingHoursPerDay, workingDayPerWeek, days_count FROM jobs WHERE id= ?', req.session.jobId, function (err, hours) {

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


				distance = userDistance[index];

				hours = total_days * hours[0].workingHoursPerDay;

				// var budget = ((per_diem * total_weeks) + (hours * rates[0].hourly_rate) + (distance * 0.58));

				/*******************************************/
				var budget = ((per_diem * total_weeks) + ((totalHours * rates[0].hourly_rate) + (totalExtraHours * (rates[0].hourly_rate * 1.5))) + (distance * 0.58));
				/*******************************************/


				rates.forEach(function (id) {

					var d_id = id.designationID;

					if ((d_id >= 1 && d_id >= 4) || ((d_id >= 11 && d_id <= 14))) {

						var predicated_budget = budget * 20 / 100;
						total_predicated_budget = budget + predicated_budget;

					} else if ((id >= 5 && id >= 8) || ((d_id >= 15 && d_id <= 18))) {

						var predicated_budget = budget * 25 / 100;
						total_predicated_budget = budget + predicated_budget;

					} else if ((id >= 9 && id >= 10) || ((id >= 19 && id <= 20))) {

						var predicated_budget = budget * 30 / 100;
						total_predicated_budget = budget + predicated_budget;
					}
				});
				var data = {
					userId: user,
					jobId: req.session.jobId,
					offeredBy: req.session.uid,
					distance_covered: distance,
					// rates: rate,
					predicated_budget: total_predicated_budget,
				};
				db.query('INSERT INTO joboffers SET ?', data, async function (err, rows) {
					await db.query('SELECT email FROM users where id=?', user, function (err, row) {
						store.push(row[0].email)
						if (err)
							console.error(err.message)

					});
				});

				db.query('SELECT predicated_budget FROM jobs WHERE id =?', req.session.jobId, function (err, rows) {
					var sum = parseFloat(rows[0].predicated_budget);
					sum += parseFloat(total_predicated_budget);
					db.query('UPDATE jobs SET predicated_budget = ? WHERE id = ?', [sum, req.session.jobId], function (err) {
						if (err)
							console.error(err.message)
					});
				});
			});
		});
	});
	// var transporter = nodemailer.createTransport({
	// 	service: 'gmail',
	// 	auth: {
	// 		user: 'testing.augurs@gmail.com',
	// 		pass: 'Augurs@9848'
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
	// 	to: store, // list of receivers
	// 	subject: "Job Offer", // Subject line
	// 	generateTextFromHTML: true,
	// 	html: "Congratulations on job offer We are delighted to offer you job,<br>Please visit our portal on  <br>" + "http://localhost:4000" + "<br>Thank you." // html body
	// }
	// // send mail with defined transport object
	// transporter.sendMail(mailOptions, function (err, info) {
	// 	if (err)
	// 		console.error(err.message)
	req.flash('msg_info', "Selected users have been sent job notifications.");
	res.redirect('/admin/supervisor/view-jobs');
	// });


});

/* POST to delete cart */
router.get('/remove/:id', function (req, res) {
	chksession(req, res);
	var id = req.params.id;
	var cart = new Cart(req.session.cart ? req.session.cart : {});
	cart.remove(id);
	req.session.cart = cart;
	res.redirect('/admin/supervisor/userCart');
});

/* GET to manage sites */
router.get('/manage-sitese', function (req, res) {
	chksession(req, res);
	db.query('SELECT jobSites.siteName, jobSites.description, jobSites.createDate, countries.name AS country, cities.name AS city, states.name AS state FROM `jobSites` LEFT JOIN countries ON (jobSites.country = countries.id) LEFT JOIN cities ON (jobSites.`city` = cities.id) LEFT JOIN states ON (jobSites.state = states.id)', function (err, rows) {
		if (err)
			console.error(err.message);
		res.render('admin/supervisor/manage-sites', {
			title: 'View Job',
			layout: 'layout/supervisor-layout.jade',
			siteLists: rows,
			applications: req.session
		});
	});
});

/* GET To Add Certification */
router.get('/add-certificate', function (req, res) {
	chksession(req, res);
	res.render('admin/supervisor/add-certificate', {
		title: 'add Certificate',
		layout: 'layout/user-layout.jade',
		url: url,
		applications: req.session
	});
});

/* POST to add certification */
router.post('/add-certificate', function (req, res) {

	chksession(req, res);
	var userId = req.session.uid;
	let imageFile = req.files.certificate_attachment;
	let imageExtension = imageFile.name.split('.');

	if (imageExtension[1] == "jpg" || imageExtension[1] == "JPG" || imageExtension[1] == "jpeg" || imageExtension[1] == "JPEG" || imageExtension[1] == "png" || imageExtension[1] == "PNG" || imageExtension[1] == "pdf" || imageExtension[1] == "PDF") {

		let ext = imageExtension[(imageExtension).length - 1];
		var image = userId + '_' + new Date().toISOString();
		new_image = md5(image);
		new_image = new_image + '.' + ext;
		let fileName = new_image;
		let uploadPath = 'uploads/certificate_attachment';
		var data = {
			userId: userId,
			certification_name: req.body.certification_name,
			authority: req.body.authority,
			certificate_attachment: fileName,
			description: req.body.description,
			exp_date: moment(req.body.exp_date).format('YYYY-MM-DD'),
			active: 1


		};
		imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {
			db.query('INSERT INTO certification SET ?', data, function (err) {
				if (err)
					console.error(err.message)
				req.flash('msg_info', "certification Added Successfully.");
				res.redirect('/admin/supervisor/view-certificate');
			});
		});
	} else {
		req.flash('msg_error', "This format is not allowed , please upload file with '.png','.gif','.jpg','.pdf'");
		res.redirect('/admin/supervisor/add-certificate');
	}

});

/* GET To View Job Site Wise */
router.get('/view-certificate', function (req, res) {
	chksession(req, res);

	db.query('SELECT id, certification_name, certificate_attachment, authority, exp_date FROM certification where userId=? AND active=1', req.session.uid, function (err, rows) {
		if (err)
			console.error(err.message)
		res.render('admin/supervisor/view-certificate', {
			title: 'Certificate View',
			layout: 'layout/user-layout.jade',
			certificateList: rows,
			applications: req.session
		});
	});
});

/* GET Edit-Roles */
router.get('/edit-certificate/:id', function (req, res) {
	chksession(req, res);
	db.query('SELECT id, certification_name, certificate_attachment, authority, exp_date, description FROM certification WHERE id = ?', req.params.id, function (err, rows) {
		if (err)
			console.error(err.message)
		res.render('admin/supervisor/edit-certificate', {
			title: 'Edit Certificate',
			layout: 'layout/user-layout.jade',
			certificate: rows,
			applications: req.session,
			id: req.params.id
		});
	});
});

/* POST Edit-Roles */
router.post('/edit-certificate/:id', [
		// check('certification_name').isAlpha().withMessage('Certification Name Must be only alphabetical chars'),
	],
	function (req, res) {
		chksession(req, res);
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			const validationErrors = errors.array();
			let errorMessages = [];
			validationErrors.forEach(function (row) {
				errorMessages.push(row.msg);
			})
			req.flash('msg_error', errorMessages);
			res.redirect('/admin/supervisor/view-certificate');
		} else {
			var userId = req.session.uid;
			if (!req.files) {
				var data = {
					userId: userId,
					certification_name: req.body.certification_name,
					authority: req.body.authority,
					description: req.body.description,
					exp_date: moment(req.body.exp_date).format('YYYY-MM-DD'),
					active: 1
				};
			} else {
				let imageFile = req.files.certificate_attachment;
				let imageExtension = imageFile.name.split('.');
				if (imageExtension[1] == "jpg" || imageExtension[1] == "JPG" || imageExtension[1] == "jpeg" || imageExtension[1] == "JPEG" || imageExtension[1] == "png" || imageExtension[1] == "PNG" || imageExtension[1] == "pdf" || imageExtension[1] == "PDF") {

					let ext = imageExtension[(imageExtension).length - 1];
					var image = userId + '_' + new Date().toISOString();
					new_image = md5(image);
					new_image = new_image + '.' + ext;
					let fileName = new_image;
					let uploadPath = 'uploads/certificate_attachment';
					var data = {
						userId: userId,
						certification_name: req.body.certification_name,
						authority: req.body.authority,
						certificate_attachment: fileName,
						description: req.body.description,
						exp_date: moment(req.body.exp_date).format('YYYY-MM-DD'),
						active: 1

					};
					imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {});
				} else {
					req.flash('msg_error', "This format is not allowed , please upload file with '.png','.gif','.jpg','.pdf'");
					res.redirect('/admin/supervisor/edit-certificate/' + req.params.id);
					req.end();
				}
			}
			db.query('UPDATE certification SET ? WHERE id = ? ', [data, req.params.id], function (err, rows, fields) {
				if (err) {
					console.error(err.message)
					req.flash('msg_error', "Some error occured!");
					res.redirect('/admin/supervisor/add-certificate');
				} else {
					req.flash('msg_info', "Certificate Updated Successfully");
					res.redirect('/admin/supervisor/view-certificate');
				}
			});
		}
	});

/* GET Single Job */
router.get('/viewSingelJobs/:id', function (req, res) {
	chksession(req, res);

	var id = req.params.id;

	// db.query('SELECT jobs.jobName, jobs.siteId, jobs.createDate AS startDate, jobs.noOfPhases, jobs.jobCode, jobs.description, jobs.experience, jobsites.siteName, jobsites.sitesCode, countries.name AS country, cities.name AS city, states.name AS state, (SELECT firstName from users WHERE id=jobs.jobSupervisor) AS SupervisorName, (SELECT statusName from statusname WHERE id=jobs.status) AS jobStatus FROM `jobs` LEFT JOIN jobsites ON (jobsites.id = jobs.siteId) LEFT JOIN countries ON (jobsites.country = countries.id) LEFT JOIN cities ON (jobsites.`city` = cities.id) LEFT JOIN states ON (jobsites.state = states.id) WHERE jobs.id=?', req.params.id, function (err, rows) {
	db.query(`SELECT jobs.jobName, jobs.siteId, jobs.startDate, jobs.endDate, jobs.noOfPhases, jobs.jobCode, jobs.description, jobs.experience, jobs.days_count, jobsites.siteName, jobsites.sitesCode, jobsites.newAddress, jobtype.type_name, (SELECT CONCAT(firstName,' ',lastName) AS name from users WHERE id=jobs.jobPlanner) AS plannerName, (SELECT CONCAT(firstName, " ", lastName) from users JOIN user_sites ON (users.id = user_sites.user_id) WHERE user_sites.user_role=3 AND user_sites.is_current=1 AND user_sites.jobType=jobtype.id AND user_sites.site_id=jobsites.id) AS SupervisorName, (SELECT statusName from statusname WHERE id=jobs.status) AS jobStatus FROM jobs LEFT JOIN jobsites ON (jobsites.id = jobs.siteId) LEFT JOIN jobtype ON (jobs.jobTypeId = jobtype.id) LEFT JOIN users_job ON (jobsites.id=users_job.siteId) WHERE jobs.id=?`, id, function (err, rows) {

		if (err)
			console.error(err.message)
		res.render('admin/supervisor/viewSingelJobs', {
			title: 'Job Description',
			layout: 'layout/supervisor-layout.jade',
			viewReportList: rows,
			id: id,
			applications: req.session
		});
	});

});

/* Delete Certificate */
router.get('/deleteCertificate/:id', function (req, res) {
	chksession(req, res);
	db.query('UPDATE certification SET active=0 WHERE id=?', req.params.id, function (err) {
		if (err)
			console.error(err.message)
		req.flash('msg_error', "Certificate Deleted Successfully");
		res.redirect('/admin/supervisor/view-certificate');
	});
});

/* Get view-technician List */
router.get('/view-technician', function (req, res) {
	chksession(req, res);
	if (req.session.siteId == null) {
		req.flash('msg_error', "You Don't Have Any Site Assigned !")
		res.redirect('/admin/supervisor/dashboard');
		res.end();
	} else {
		db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, jobType FROM users WHERE id=?', req.session.uid, function (err, jobType) {
			var jobType = jobType[0].jobType;
			db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, (SELECT count(id) FROM taskreporting WHERE status=0 AND userId=users.id AND jobId=j.id) as pending_reports, users.id, users.eCode, users.experience, users.status, jobtype.type_name AS jobtype,CONCAT(j.jobName, " (", js.siteName,")") as jobName FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) JOIN users_job AS uj ON(users.id=uj.user_id) JOIN jobs AS j ON(uj.job_id=j.id) JOIN jobsites js ON (j.siteId=js.id) where users.role=1 AND uj.siteId IN (SELECT site_id from user_sites where user_id = ? and is_current=1) AND uj.isCurrentJob=1 AND users.jobType=?', [req.session.uid, jobType], function (err, rows) {
				if (err)
					console.error(err.message)
				res.render('admin/supervisor/view-technician', {
					title: 'supervisor Dashboard',
					layout: 'layout/supervisor-layout.jade',
					users: rows,
					applications: req.session
				});
			});
		});
	}
});

/* POST to find users based on jobType */
router.post('/search_userSkills', function (req, res) {
	chksession(req, res);
	var siteId = req.session.siteId;
	if (req.body.id) {
		db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, (SELECT count(id) FROM taskreporting WHERE status=0 AND userId=users.id) as pending_reports, users.id, users.eCode, users.experience, users.status, jobtype.type_name AS jobtype, j.jobName FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) JOIN users_job AS uj ON(users.id=uj.user_id) JOIN jobs AS j ON(uj.job_id=j.id) where users.role=1 AND uj.siteId=? AND users.jobType=? AND uj.isCurrentJob=1', [siteId, req.body.id], function (err, rows) {
			// db.query('SELECT designation.id as designation_id,designation.designation_name,designation.job_type,jobtype.type_name, jobtype.id  FROM designation LEFT JOIN jobtype ON(designation.job_type=jobtype.id)', function (err, Designation) {
			// db.query('SELECT jobtype.id jobTypeId, jobtype.type_name AS jobtype FROM jobtype Where active=1', function (err, jobType) {
			if (err)
				console.error(err.message)
			res.render('admin/supervisor/view-technician', {
				title: 'Manage Skills',
				layout: 'layout/hr-layout.jade',
				users: rows,
				// Designation: Designation,
				// jobTypeList: jobType,
				applications: req.session,
				id: req.params.id
			});

			// });
			// });
		});
	} else {
		res.redirect('/admin/supervisor/view-technician');
	}
});

/* GET to edit job */
router.get('/editJob/:id', function (req, res) {
	chksession(req, res);
	db.query('SELECT uj.job_id AS jobId, uj.enroll_Indate, uj.enroll_Outdate FROM users_job AS uj WHERE uj.user_id = ? AND uj.sup_id= ? AND uj.siteId=(SELECT siteId from jobs where id= uj.job_id ) and uj.isCurrentJob=1', [req.params.id, req.session.uid], function (err, rows) {
		if (err)
			console.error(err.message)
		res.render('admin/supervisor/edit-job', {
			title: 'Edit job',
			user_id: req.params.id,
			layout: 'layout/admin-layout.jade',
			url: url,
			rows: rows[0],
			job_id: rows[0].jobId,
			applications: req.session
		});
	});
});

/* POST to update jobs */
router.post('/updateJob',
	function (req, res) {
		chksession(req, res);
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			const validationErrors = errors.array();
			let errorMessages = [];
			validationErrors.forEach(function (row) {
				errorMessages.push(row.msg);
			})
			req.flash('msg_error', errorMessages);
			res.redirect('/admin/supervisor/view-technician');
		} else {
			if (req.body.suspend) {
				var isCurrentJob = req.body.suspend;
			} else {
				var isCurrentJob = req.body.finish;
			}
			var data = {
				user_id: req.body.user_id,
				job_id: req.body.job_id,
				isCurrentJob: isCurrentJob,
				finishDate: new Date()
			};
			db.query('UPDATE users_job SET isCurrentJob=? WHERE user_id=? AND job_id=?', [isCurrentJob, data.user_id, data.job_id], function (err) {
				db.query('UPDATE user_sites SET is_current=0 WHERE user_id=? AND site_id=(SELECT siteId from jobs where id=?)', [data.user_id, data.job_id], function (err) {
					// db.query('UPDATE user_sites SET is_current=0 WHERE user_id=? AND site_id=?', [data.user_id, req.session.siteId], function (err) {
					if (err)
						console.error(err.message)
					req.flash('msg_info', " Job update Successfully");
					res.redirect('/admin/supervisor/job-reports/' + data.user_id);
				});
			});

		}
	});

router.post('/updateJobTime', function (req, res) {
	chksession(req, res);
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		const validationErrors = errors.array();
		let errorMessages = [];
		validationErrors.forEach(function (row) {
			errorMessages.push(row.msg);
		})
		req.flash('msg_error', errorMessages);
		res.redirect('/admin/supervisor/view-technician');
	} else {
		var data = {
			user_id: req.body.user_id,
			job_id: req.body.job_id,
			enroll_Indate: moment(req.body.enroll_Indate).format('YYYY-MM-DD'),
			enroll_Outdate: moment(req.body.enroll_Outdate).format('YYYY-MM-DD'),
			// isCurrentJob: isCurrentJob
		};
		db.query('UPDATE users_job SET enroll_Indate= ?,enroll_Outdate=? WHERE user_id=? AND job_id=?', [data.enroll_Indate, data.enroll_Outdate, data.user_id, data.job_id], function (err) {
			if (err)
				console.error(err.message)
			req.flash('msg_info', " Job time updated successfully");
			res.redirect('/admin/supervisor/editJob/' + data.user_id);
		});
	}
});

/* Get job submitted reports */
router.get('/job-reports/:id', function (req, res) {
	chksession(req, res);
	let id = req.params.id;
	// let user_id = req.body.user_id;

	db.query('SELECT job_id FROM users_job WHERE user_id = ? AND sup_id =? AND isCurrentJob !=1 ORDER by finishDate DESC LIMIT 1', [id, req.session.uid], function (err, rows) {

		if (err)
			console.error(err.message)
		res.render('admin/supervisor/job-report-view', {
			title: 'Technician Report View',
			layout: 'layout/supervisor-layout.jade',
			applications: req.session,
			job_id: rows[0].job_id,
			id: id
		});
	});
});

/* GET Technician profile */
router.get('/viewTechProfile/:id', function (req, res) {
	chksession(req, res);
	// db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, users.id, users.eCode, users.experience, users.status, jobtype.type_name AS jobtype, jobtype.description FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) where users.id=? AND role=1', req.params.id, function (err, rows) {
	// db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, users.id, users.email, users.eCode, users.experience, users.status, city,ci.name as city , s.name as state, C.name as country, jobtype.type_name AS jobtype, jobtype.description, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = ?)) as designation, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = users.id GROUP BY us2.user_id) AS skills FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) LEFT JOIN cities ci ON (users.city = ci.id) LEFT JOIN states s ON (users.state = s.id) LEFT JOIN countries C ON (users.country = C.id) where users.id=? AND role=1 ', [req.params.id, req.params.id], function (err, rows) {
	db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, users.id, users.email, users.eCode, users.experience, users.status, users.newAddress, jobtype.type_name AS jobtype, jobtype.description, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = ?)) as designation, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = users.id GROUP BY us2.user_id) AS skills FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) where users.id=? AND role=1 ', [req.params.id, req.params.id], function (err, rows) {
		db.query('SELECT id, certification_name, certificate_attachment, authority FROM certification where userId=? AND active=1', req.params.id, function (err, list) {
			db.query('SELECT AVG(rating) as total_rating, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=1) AS Workmanship_Quality, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=2) AS Attendance_Punctuality, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=3) AS Organization_Cleanliness, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=4) AS Communication_Updates, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=5) AS Worked_Safe, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=6) AS Followed_Instructions_Schedule, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=7) AS Team_Player FROM `user_ratings` WHERE userId=?', [req.params.id, req.params.id, req.params.id, req.params.id, req.params.id, req.params.id, req.params.id, req.params.id], function (err, rating) {
				if (err)
					console.error(err.message)
				res.render('admin/supervisor/viewTechProfile', {
					title: 'Supervisor',
					layout: 'layout/supervisor-layout.jade',
					users: rows,
					rating: rating[0],
					certificatonList: list,
					applications: req.session
				});
			});

		});
	});
});

//Get technician submitted reports
router.get('/submitted-reports/:id', function (req, res) {
	chksession(req, res);
	let id = req.params.id;
	db.query('SELECT t.*, u.firstName, s.statusName FROM taskreporting AS t join users AS u JOIN statusname AS s ON(s.id=t.status) where t.sup_id=? AND t.userId=u.id AND active=1 AND t.status=0 AND t.userId=? ORDER BY t.date DESC', [req.session.uid, id], function (err, rows) {
		if (err)
			console.error(err.message)
		res.render('admin/supervisor/report-view', {
			title: 'Technician Report View',
			layout: 'layout/supervisor-layout.jade',
			reports: rows,
			applications: req.session,
			id: id
		});
	});
});

/* GET to edit intime & outtime on taskreporting table*/
router.post('/InTime-OutTime', function (req, res) {
	chksession(req, res);
	var taskreportingId = req.body.id;
	var userId = req.body.userId;
	var countHourTime = countHours(req.body.inTime, req.body.outTime);
	/* var checkCountHourTime = checkCountHours(req.body.inTime, req.body.outTime);
	if (checkCountHourTime == 0) {
		req.flash('msg_error', "Please Enter Valid Time.");
		res.redirect('/admin/supervisor/submitted-reports/' + userId);
		req.end();
	} */
	var data = {
		inTime: req.body.inTime,
		outTime: req.body.outTime,
		hours_count: countHourTime

	};

	db.query('UPDATE taskreporting SET ? WHERE id = ?', [data, taskreportingId], function (err, rows, fields) {
		if (err)
			console.error(err.message)
		req.flash('msg_info', "Time Updated Successfully");
		res.redirect('/admin/supervisor/submitted-reports/' + userId);
	});

});

/* GET to see reviews */
router.get('/view-reviews/:id', function (req, res) {
	chksession(req, res);
	var id = req.params.body;
	db.query('SELECT ur.id, ur.reviews, ur.reviewDate, ur.isJobreview, CONCAT(`firstName`, " ", `lastName`) AS name FROM user_reviews AS ur JOIN users AS u ON (ur.review_by=u.id) WHERE active=1 AND userId=? ORDER BY reviewDate DESC', req.params.id, function (err, reviews) {
		if (err)
			console.error(err.message)
		res.render('admin/supervisor/view-reviews', {
			title: 'supervisor Dashboard',
			layout: 'layout/supervisor-layout.jade',
			reviewsList: reviews,
			applications: req.session
		});
	});
});

/* POST Add rating */
router.post('/addRating/:id', [],
	function (req, res) {
		chksession(req, res);
		review = req.body.review;
		status = req.body.status;
		ratingDate = moment(new Date()).format('YYYY-MM-DD');
		if (req.body.job_id) {
			var job_id = req.body.job_id;
			var isJobreview = 1;
		} else {
			var job_id = 0;
			var isJobreview = 0;
		}
		let query = 'INSERT INTO user_ratings(`userId`,`rating_by`,`rating`,`rating_type`,`job_id`,`ratingDate`) VALUES ',
			parameters = '';
		for (let i in req.body) {
			if (i.includes('rating') && req.body[i] && !isNaN(req.body[i]) && req.body[i] <= 5) {
				parameters += `${parameters ? ', ' : ''}(${req.params.id},${req.session.uid},${req.body[i]},${i.replace('rating', '')},${job_id},'${ratingDate}')`
			}
		}

		if (parameters) {
			query = query + parameters;
			db.query(query, data, function (err) {
				if (err)
					console.error(err.message)
				db.query('UPDATE users SET ratings=ROUND((SELECT AVG(rating) FROM user_ratings WHERE userId=?), 2) WHERE id=?', [req.params.id, req.params.id], function (err, rows, fields) {
					if (err)
						console.error(err.message)
				})
			})
		}

		if (review) {
			var data = {
				userId: req.params.id,
				review_by: req.session.uid,
				reviews: review,
				job_id: job_id,
				reviewDate: moment(new Date()).format('YYYY-MM-DD'),
				isJobreview: isJobreview

			};
			db.query('INSERT INTO user_reviews SET ?', data, function (err, rows, fields) {
				if (err)
					console.error(err.message)
			})
		}
		db.query('UPDATE taskreporting SET status=? WHERE userId=?', [status, req.params.id], function (err) {
			if (err)
				console.error(err.message)
			req.flash('msg_info', "Report Submitted successfully");
			res.redirect('/admin/supervisor/view-technician');
		});
	})

/* GET to mark job finish */
router.get('/job-finish/:id', function (req, res) {
	chksession(req, res);

	var jobId = req.params.id;
	db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, uj.user_id, uj.sup_id, uj.siteId FROM users_job AS uj JOIN users AS u ON (uj.user_id = u.id) WHERE job_id=?', jobId, function (err, users) {
		if (err)
			console.error(err.message)
		res.render('admin/supervisor/job-finish', {
			title: 'Job Finish',
			layout: 'layout/supervisor-layout.jade',
			userDetail: users,
			jobId: jobId,
			url: url,
			applications: req.session
		});

	});
});

/* POST to mark job finish */
router.post('/job-finish', function (req, res) {
	chksession(req, res);
	var job_id = req.body.jobId;
	var arr = JSON.parse(req.body.postData);
	var currDate = new Date();
	db.query('SELECT endDate FROM `jobs` WHERE id=?', job_id, function (err, jobDate) {
		if (jobDate[0].endDate < currDate) {

			var parameters = '';

			var ratingDate = moment(new Date()).format('YYYY-MM-DD');
			let query = 'INSERT INTO user_ratings(`userId`,`rating_by`,`rating`,`rating_type`,`job_id`,`ratingDate`) VALUES ';

			arr.forEach(function (a) {
				var json_data = a;
				var ratings = [];
				var record = '(';
				for (var i in json_data)
					ratings.push([i, json_data[i]]);

				var ratingArr = ratings[0][1];
				for (var k = 1; k <= 7; k++) {
					parameters += `${parameters ? ', ' : ''}(${ratingArr[0]},${req.session.uid},${ratingArr[k]},${k},${job_id},'${ratingDate}')`
				}
			});

			if (parameters) {
				query = query + parameters;
				db.query(query, function (err) {
					if (err)
						console.error(err.message)
				})
			}

			reviewDate = moment(new Date()).format('YYYY-MM-DD');
			let reviewQuery = 'INSERT INTO user_reviews(`userId`,`review_by`,`reviews`,`job_id`,`reviewDate`,`isJobreview`) VALUES ';

			var reviewParameters = [];
			arr.forEach(function (a) {
				var json_data = a;
				var reviewResult = [];
				for (var i in json_data)
					reviewResult.push([i, json_data[i]]);

				var userId = reviewResult[0][1];
				var reviews = reviewResult[0][1][8];
				var arrayString = [reviews];
				if (reviews) {
					arrayString.forEach(function (b) {
						let queryBlock = `(${userId[0]},${req.session.uid},'${reviews}',${job_id},'${reviewDate}',${1})`;
						reviewParameters.push(queryBlock);
					});
				}
			});

			if (reviewParameters.length) {
				reviewQuery += reviewParameters.join(', ');
				db.query(reviewQuery, function (err) {
					if (err)
						console.error(err.message)
				});
			}
			data = {
				finishDate: new Date(),
				status: 3
			};
			db.query('UPDATE jobs SET ? WHERE id=?', [data, job_id], function (err) {
				if (err)
					console.error(err.message)
				req.flash('msg_info', "Job Mark As Finised Successfully");
				res.redirect('/admin/supervisor/view-jobs');
			});
		} else {
			req.flash('msg_error', "You Are Not Authorized To Finish The Job Yet !");
			res.redirect('/admin/supervisor/job-finish/' + job_id);
		}

	});


});

/* GET to view finised Job list */
router.get('/view-finishJob', function (req, res) {
	chksession(req, res);
	db.query('SELECT js.id, js.siteName, js.sitesCode, j.id As jobid, j.jobCode, j.jobName, j.noOfPhases, j.endDate, j.startDate, j.finishDate, j.noOfVacancy, (SELECT GROUP_CONCAT(id) FROM designation WHERE job_type=j.jobTypeId) AS des_id, (SELECT GROUP_CONCAT(designation_name) FROM designation WHERE job_type=j.jobTypeId) AS des_name, (select count(user_id) from users_job WHERE job_id = j.id and isCurrentJob =1) as empCount FROM jobs AS j LEFT JOIN jobsites AS js ON(js.id=j.siteId) WHERE js.id IN (SELECT site_id from user_sites where user_id = ?) AND j.status=3', req.session.uid, function (err, list) {
		res.render('admin/supervisor/view-finishJob', {
			title: 'Supervisor View Profile',
			layout: 'layout/supervisor-layout.jade',
			jobList: list,
			applications: req.session
		});
	});
});

/* GET mail notification */
router.get('/send-notification', function (req, res) {
	chksession(req, res);
	db.query('SELECT email FROM users ORDER BY id DESC', function (err, rows) {
		if (err)
			console.error(err.message)
		res.render('admin/supervisor/send-notification', {
			title: 'Notification',
			layout: 'layout/supervisor-layout.jade',
			url: url,
			users: rows,
			applications: req.session
		});
	});
});

/* POST drop mail notification */
router.post('/sendMessage', [],
	function (req, res) {
		chksession(req, res);
		subject = req.body.subject;
		body = req.body.body;
		usersEmail = req.body.usersEmail;

		if (req.files) {
			var imageFile = req.files.Img;
			let imageExtension = imageFile.name.split('.');
			if (imageExtension[1] == "jpg" || imageExtension[1] == "jpeg" || imageExtension[1] == "png" || imageExtension[1] == "pdf" || imageExtension[1] == "doc" || imageExtension[1] == "docs" || imageExtension[1] == "xls" || imageExtension[1] == "xlsx") {
				let ext = imageExtension[(imageExtension).length - 1];
				var image = image + '_' + new Date().toISOString();
				new_image = md5(image);
				new_image = new_image + '.' + ext;
				let fileName = new_image;
				var uploadPath = 'uploads/profile_img';

				req.session.Img = fileName;
				imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {});
				var path = `public/${uploadPath}/${fileName}`;
			} else {
				req.flash('msg_error', "This format is not allowed , please upload file with '.png','.pdf','.jpg'");
				res.redirect('/admin/supervisor/send-notification');
				req.end();
			}
		}
		// var transporter = nodemailer.createTransport({
		// 	service: 'gmail',
		// 	auth: {
		// 		user: 'testing.augurs@gmail.com',
		// 		pass: 'Augurs@9848'
		// 	},
		// 	requireTLS: true,
		// 	secure: true,
		// 	tls: {
		// 		rejectUnauthorized: false
		// 	},
		// 	debug: true
		// });
		// var maillist = usersEmail;
		// if (path) {
		// 	var mailOptions = {
		// 		from: "test.augurs@gmail.com", // sender address
		// 		to: maillist, // list of receivers
		// 		subject: subject, // Subject line
		// 		generateTextFromHTML: true,
		// 		html: body, // html body
		// 		attachments: [{
		// 			path: path
		// 		}]
		// 	}
		// } else {
		// 	var mailOptions = {
		// 		from: "test.augurs@gmail.com", // sender address
		// 		to: maillist, // list of receivers
		// 		subject: subject, // Subject line
		// 		generateTextFromHTML: true,
		// 		html: body, // html body
		// 	}
		// }
		// // send mail with defined transport object
		// transporter.sendMail(mailOptions, function (err, info) {
		// 	if (err)
		// 		console.error(err.message)
		req.flash('msg_info', "Notification Send Successfully");
		res.redirect('/admin/supervisor/send-notification');

		// });
	});

/* POST to change password*/
router.post('/changePassword', [
	check('currentPassword').isLength({
        min: 6
      }).withMessage('Current Password Must be at least 6 chars long').not().isEmpty().withMessage('Current Password is required!'),
	check('newPassword').isLength({
        min: 6
      }).withMessage('New Password Must be at least 6 chars long').not().isEmpty().withMessage('New Password is required!'),
	check('confirmNewPassword').isLength({
        min: 6
      }).withMessage('Confirm Password Must be at least 6 chars long').not().isEmpty().withMessage('Confirm Password is required!')
], function (req, res) {
	chksession(req, res);
	const {
		currentPassword,
		newPassword,
		confirmNewPassword
	} = req.body;
	db.query('SELECT password FROM users WHERE id = ?', req.session.uid, function (err, rows) {
		bcrypt.compare(currentPassword, rows[0].password, function (err, isMatch) {
			if (isMatch) {
				if (currentPassword != newPassword) {
					if (newPassword == confirmNewPassword) {
						bcrypt.genSalt(10, (err, salt) => {
							bcrypt.hash(newPassword, salt, (err, hash) => {
								db.query('UPDATE users SET password= ? WHERE id =?', [hash, req.session.uid], function (err) {
									if (err)
										console.error(err.message)
									req.flash('msg_info', "Your Password Successfully Changed,Please Login to Continue.");
									res.redirect('/login');
								});
							});
						});
					} else {
						req.flash('msg_error', "New Password and Confirrm New Password not matched!");
						res.redirect('/admin/supervisor/edit-profile');
					}
				} else {
					req.flash('msg_error', "Current Password and New Password can not be same!");
					res.redirect('/admin/supervisor/edit-profile');
				}
			} else {
				req.flash('msg_error', "Current Password is Invalid!");
				res.redirect('/admin/supervisor/edit-profile');
			}
		});

	});


});

/* GET to Map View */
router.get('/technicianMap-view', function (req, res) {
	chksession(req, res);
	db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.phone_number, u.role, u.latitude, u.longitude, j.type_name, GROUP_CONCAT(jobName) as jobName, GROUP_CONCAT(jobCode) as jobCode, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation, s.total_score, s.neg_mark, s.wrong_answer_count From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) LEFT JOIN results AS s ON(u.id = s.userId) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.siteId IN (SELECT site_id from user_sites where user_id = ? and is_current=1) AND uj.isCurrentJob=1 GROUP by u.id`, req.session.uid, function (err, usersList) {
		res.render('admin/supervisor/technicianMap-view', {
			title: 'Technician Map View',
			layout: 'layout/supervisor-layout.jade',
			usersList: usersList,
			url: url,
			apiKey: config.get('apiKey'),
			applications: req.session
		});
	});
});


/* GET to Map View */
router.get('/userMap-view/:id', function (req, res) {
	chksession(req, res);

	var jobId = req.params.id;
	req.session.jobId = jobId;

	if (req.session.cart)
		var cartCount = req.session.cart.totalUsers;
	else {
		cartCount = 0;
		req.session.cart = new Cart(req.session.cart ? req.session.cart : {});
	}

	var cartUser = req.session.cart.users;
	_skcartUserFilter = ' ';
	if (cartUser) {

		if (typeof cartUser == 'object') {
			_skcartUserFilter = ` AND u.id NOT IN (`
			cartUser.forEach(function (a) {
				_skcartUserFilter += a + ','
			})
			_skcartUserFilter += `0 ) `
		} else {
			_skcartUserFilter = ` AND u.id NOT IN ((${cartUser}) `
		}
	}

	var ratings = req.body.ratings;
	var designation = req.body.designation;
	_designationFilter = '';
	if (designation) {
		if (typeof designation == 'object') {
			_designationFilter = ` AND u.id IN (SELECT user_id from user_designation WHERE designation_id IN (`
			designation.forEach(function (a) {

				_designationFilter += a + ','
			})
			_designationFilter += `0 ) )`
		} else {
			_designationFilter = ` AND u.id IN (SELECT user_id from user_designation WHERE designation_id IN (${designation}) )`
		}
	}
	_ratingFilter = '';
	if (ratings) {
		_ratingFilter = ` AND u.ratings >= (${ratings})`
	}
	db.query('SELECT jobTypeId, latitude as site_latitude, longitude as site_longitude FROM jobs AS j JOIN jobsites AS js ON (js.id = j.siteId) where j.id=?', jobId, function (err, rows) {

		var jobtype = rows[0].jobTypeId;
		db.query('SELECT id AS designationId, designation_name FROM designation WHERE job_type=?', jobtype, function (err, designation) {
			db.query('SELECT predicated_budget, proposed_budget FROM jobs WHERE id=?', jobId, function (err, budget) {

				db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg, u.phone_number, u.email, u.ratings, u.newAddress, u.role, u.latitude, u.longitude, j.type_name, count(u.id) as rank, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation, (select (total_score-(wrong_answer_count*neg_mark)) as totalS from results where userId=u.id ORDER by exam_date+end_time desc limit 1) as total_score,  (SELECT CONCAT(hourly_rate,'/',max_pertime_rate) FROM user_rates AS ur WHERE ur.userId =u.id GROUP by ur.userId) AS rates, (SELECT jobsites.latitude FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_lat,(SELECT jobsites.longitude as jobsite_long FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_long FROM users u JOIN user_rates AS ur ON (u.id = ur.userId) LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE firstName LIKE '%${req.params.search ? req.params.search : '%'}%' ${_designationFilter} ${_skcartUserFilter} AND u.jobType=(SELECT jobTypeId FROM jobs WHERE id ='${jobId}') AND u.role=1 AND u.id NOT IN (select user_id from users_job where job_id=? ) AND u.id NOT IN (select userId from joboffers where jobId=? ) AND u.search=1 GROUP BY u.id order by rank desc`, [jobId, jobId], function (err, users) {
					var cart = req.params.id;
					var site_latitude = parseFloat(rows[0].site_latitude);
					var site_longitude = parseFloat(rows[0].site_longitude);
					distDiffer = [];
					parameters = '';
					var d = '';
					distDiffer1 = [];
					parameters1 = '';
					var d1 = '';
					users.forEach(function (a) {
						lat = a.latitude;
						long = a.longitude;
						/************************/
						jobsitelat = a.jobsite_lat;
						jobsitelong = a.jobsite_long;
						/************************/

						parameters += `${parameters ? '|' : ''}${a.latitude},${a.longitude}`

						/************************/

						parameters1 += `${parameters1 ? '|' : ''}${a.jobsite_lat ? a.jobsite_lat : 0},${a.jobsite_long ? a.jobsite_long : 0}`
						/************************/
					});
					options = {
						uri: 'https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=' + parameters + '&destinations=' + site_latitude + '%2C' + site_longitude + '&key='+config.apiKey,
						timeout: 200000000,
						followAllRedirects: true
					};

					/************************/
					options1 = {
						uri: 'https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=' + parameters1 + '&destinations=' + site_latitude + '%2C' + site_longitude + '&key='+config.apiKey,
						timeout: 200000000,
						followAllRedirects: true
					};
					/************************/

					request(options, function (err, response, body) {
						if (err)
							console.error(err.message)
						var jsonData = JSON.parse(body);
						var row = jsonData.rows;
						var arr = [];
						row.forEach(function (a) {
							var element = a.elements;
							element.forEach(function (b) {
								/* var s = b.distance.value;
								d = distDiffer.push(s); */
								if (b.status == 'OK') {
									var s = b.distance.text;
									d = distDiffer.push(s);
								} else {
									var s = b.distance;
									d = distDiffer.push(s);
								}

							});
						});
						/* for (i = 0; i < d; i++) {
							users[i].distance = distDiffer[i] / 1000;
						} */

						/* var arrDistance = [];
						var aa = [];
						for (i = 0; i < d; i++) {
							arrDistance[i] = distDiffer[i];
							var dis = arrDistance[i].replace(/,/g, '');
							aa[i] = dis.split(" ", 1);

							users[i].distance = aa[i];
							if (aa[i] != 0) {
								arr.push(users[i]);
							}
						} */


						for (i = 0; i < d; i++) {
							users[i].distance = distDiffer[i];
							if (distDiffer[i] != 0) {
								arr.push(users[i]);
							}
						}

						request(options1, function (err, response, body1) {
							if (err)
								console.error(err.message)
							var jsonData1 = JSON.parse(body1);
							var row1 = jsonData1.rows;

							row1.forEach(function (a) {
								var element1 = a.elements;
								element1.forEach(function (b) {
									if (b.status == 'OK') {
										var s = b.distance.text;
										d1 = distDiffer1.push(s);
									} else {
										var s = 0;
										d1 = distDiffer1.push(s);
									}
								});
							});

							for (i = 0; i < arr.length; i++) {
								if (distDiffer1[i] != 0) {
									distDiffer1[i] = distDiffer1[i].replace(',', '');
									distDiffer1[i] = parseInt(distDiffer1[i]);

									arr[i].siteDistance = distDiffer1[i];
								} else {
									arr[i].siteDistance = 0;
								}
							}
							res.render('admin/supervisor/userMap-view', {
								title: 'Supervisor Map View',
								layout: 'layout/supervisor-layout.jade',
								users: arr,
								designation: designation,
								job_budget: budget,
								jobtype: jobtype,
								jobId: jobId,
								cartCount: cartCount,
								cart: cart,
								url: url,
								apiKey: config.get('apiKey'),
								applications: req.session
							});
						});
					});
				});
			});
		});
	});
});

/* POST to send job notification */
router.post('/addUsersToCart', function (req, res) {
	chksession(req, res);
	var id = req.body.id;
	var dist = req.body.distance;
	var distance = dist[0];
	var rates = req.body.rates;
	var jobId = req.body.jobId;
	var cart = new Cart(req.session.cart ? req.session.cart : {});

	db.query('SELECT id, firstName, experience, profileImg from users where id=?', id, function (err, users) {
		var data = {
			id: users[0].id,
			firstName: users[0].firstName,
			experience: users[0].experience,
			profileImg: users[0].profileImg
		};
		cart.addUsersToCart(data, id, distance, rates);
		req.session.cart = cart;
		req.flash('msg_info', "Selected user have been added into cart!");
		res.send('success');
	});
});

/* POST to send job notification */
/* router.post('/jobNotification', async function (req, res) {
	chksession(req, res);
	var id = req.body.id;
	var jobId = req.body.jobId;
	var distance = req.body.distance;
	db.query('SELECT ur.hourly_rate, ur.max_pertime_rate, d.designation_name, d.id AS designationID FROM user_rates AS ur LEFT JOIN user_designation AS ud ON (ur.userId=ud.user_id) LEFT JOIN designation AS d ON (ud.designation_id=d.id) WHERE ur.userId = ?', id, function (err, rates) {
		db.query('SELECT workingHoursPerDay, workingDayPerWeek, days_count FROM jobs WHERE id= ?', jobId, function (err, hours) {
			if (err)
				console.error(err.message)
			// var hours = hours[0].workingHoursPerDay;
			// var budget = (rates[0].max_pertime_rate + rates[0].hourly_rate + (distance * 0.58));

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

			hours = total_days * hours[0].workingHoursPerDay;
			var budget = ((per_diem * total_weeks) + (total_days * rates[0].hourly_rate) + (distance * 0.58));

			if ((rates[0].designationID >= 1 && rates[0].designationID >= 4) || ((rates[0].designationID >= 11 && rates[0].designationID <= 14))) {

				var predicated_budget = budget * 20 / 100;
				var total_predicated_budget = budget + predicated_budget;
			} else if ((rates[0].designationID >= 5 && rates[0].designationID >= 8) || ((rates[0].designationID >= 15 && rates[0].designationID <= 18))) {

				var predicated_budget = budget * 25 / 100;
				var total_predicated_budget = budget + predicated_budget;
			} else if ((rates[0].designationID >= 9 && rates[0].designationID <= 10) || ((rates[0].designationID >= 19 && rates[0].designationID <= 20))) {

				var predicated_budget = budget * 30 / 100;
				var total_predicated_budget = budget + predicated_budget;
			}

			var data = {
				userId: id,
				jobId: jobId,
				offeredBy: req.session.uid,
				distance_covered: req.body.distance,
				rates: req.body.rates,
				predicated_budget: total_predicated_budget,
			};

			db.query('INSERT INTO joboffers SET ?', data, function (err) {
				db.query('SELECT predicated_budget FROM jobs WHERE id =?', jobId, function (err, rows) {
					var sum = parseFloat(rows[0].predicated_budget);
					sum += parseFloat(total_predicated_budget);
					db.query('UPDATE jobs SET predicated_budget = ? WHERE id = ?', [sum, jobId], function (err) {
						if (err)
							console.error(err.message)



						var transporter = nodemailer.createTransport({
							service: 'gmail',
							auth: {
								user: 'testing.augurs@gmail.com',
								pass: 'Augurs@9848'
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
							from: "test.augurs@gmail.com", // sender address
							to: req.body.email, // list of receivers
							subject: "Job Offer", // Subject line
							generateTextFromHTML: true,
							html: "Congratulations on job offer We are delighted to offer you job,<br>Please visit our portal on  <br>" + "http://localhost:4000" + "<br>Thank you." // html body
						}
						// send mail with defined transport object
						transporter.sendMail(mailOptions, function (err, info) {
							if (err)
								console.error(err.message)
								
						});


						req.flash('msg_info', "Selected users have been sent job notifications !!");
						res.send('success');

					});
				});
			});
		});
	});
}); */

/* GET Filter users on map */
router.post('/searchUsersOnMap', function (req, res) {
	chksession(req, res);
	var jobId = req.body.jobId;
	var ratings = req.body.ratings;

	if (req.session.cart)
		var cartCount = req.session.cart.totalUsers;

	var cartUser = req.session.cart.users;
	_skcartUserFilter = ' ';
	if (cartUser) {

		if (typeof cartUser == 'object') {
			_skcartUserFilter = ` AND u.id NOT IN (`
			cartUser.forEach(function (a) {
				_skcartUserFilter += a + ','
			})
			_skcartUserFilter += `0 ) `
		} else {
			_skcartUserFilter = ` AND u.id NOT IN ((${cartUser}) `
		}
	}

	var designation = req.body.designation;
	_designationFilter = '';
	if (designation) {
		if (typeof designation == 'object') {
			_designationFilter = ` AND u.id IN (SELECT user_id from user_designation WHERE designation_id IN (`
			designation.forEach(function (a) {

				_designationFilter += a + ','
			})
			_designationFilter += `0 ) )`
		} else {
			_designationFilter = ` AND u.id IN (SELECT user_id from user_designation WHERE designation_id IN (${designation}) )`
		}
	}


	var designation = req.body.designation;
	_designationFilter = '';
	if (designation) {
		if (typeof designation == 'object') {
			_designationFilter = ` AND u.id IN (SELECT user_id from user_designation WHERE designation_id IN (`
			designation.forEach(function (a) {

				_designationFilter += a + ','
			})
			_designationFilter += `0 ) )`
		} else {
			_designationFilter = ` AND u.id IN (SELECT user_id from user_designation WHERE designation_id IN (${designation}) )`
		}
	}

	_ratingFilter = '';
	if (ratings) {
		_ratingFilter = ` AND u.ratings >= (${ratings})`
	}

	db.query('SELECT jobTypeId, latitude as site_latitude,longitude as site_longitude FROM jobs AS j JOIN jobsites AS js ON (js.id = j.siteId) where j.id=?', jobId, function (err, rows) {
		var jobtype = rows[0].jobTypeId;
		db.query('SELECT id AS designationId, designation_name FROM designation WHERE job_type=?', jobtype, function (err, designation) {
			db.query('SELECT predicated_budget FROM jobs WHERE id=?', jobId, function (err, budget) {
				// db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg,u.newAddress, u.latitude, u.longitude, u.ratings, u.latitude, u.longitude, count(user_id) as rank, (select GROUP_CONCAT(skill_name) from skills s join user_skills us2 on us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) as skills FROM user_skills us JOIN job_skills js on us.skill_id = js.skill_id JOIN users u on u.id = us.user_id WHERE js.job_id = ? ${_designationFilter} ${_ratingFilter} AND firstName LIKE '%${req.body.search ? req.body.search : '%'}%' AND u.role=1 AND u.latitude IS NOT NULL AND u.latitude != '' AND u.search=1 GROUP BY us.user_id order by rank desc`, [jobId, jobId], function (err, users) {

				db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg, u.phone_number, u.email, u.ratings, u.newAddress, u.role, u.latitude, u.longitude, j.type_name, count(u.id) as rank, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation, (select (total_score-(wrong_answer_count*neg_mark) ) as totalS from results where userId=u.id ORDER by exam_date+end_time desc limit 1) as total_score, (SELECT CONCAT(hourly_rate,'/',max_pertime_rate) FROM user_rates AS ur WHERE ur.userId =u.id GROUP by ur.userId) AS rates, (SELECT jobsites.latitude FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_lat,(SELECT jobsites.longitude as jobsite_long FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_long FROM users u JOIN user_rates AS ur ON (u.id = ur.userId) LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE firstName LIKE '%${req.body.search ? req.body.search : '%'}%' ${_designationFilter} ${_skcartUserFilter} ${_ratingFilter} AND u.jobType=(SELECT jobTypeId FROM jobs WHERE id ='${jobId}') AND u.role=1 AND u.id NOT IN (select user_id from users_job where job_id=? ) AND u.id NOT IN (select userId from joboffers where jobId=? ) AND u.search=1 GROUP BY u.id order by rank desc`, [jobId, jobId], function (err, users) {
					var cart = req.params.id;
					var site_latitude = parseFloat(rows[0].site_latitude);
					var site_longitude = parseFloat(rows[0].site_longitude);
					distDiffer = [];
					parameters = '';
					var d = '';
					distDiffer1 = [];
					parameters1 = '';
					var d1 = '';
					users.forEach(function (a) {
						lat = a.latitude;
						long = a.longitude;
						/************************/
						jobsitelat = a.jobsite_lat;
						jobsitelong = a.jobsite_long;
						/************************/

						parameters += `${parameters ? '|' : ''}${a.latitude},${a.longitude}`

						/************************/

						parameters1 += `${parameters1 ? '|' : ''}${a.jobsite_lat ? a.jobsite_lat : 0},${a.jobsite_long ? a.jobsite_long : 0}`
						/************************/
					});
					options = {
						uri: 'https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=' + parameters + '&destinations=' + site_latitude + '%2C' + site_longitude + '&key='+config.apiKey,
						timeout: 200000000,
						followAllRedirects: true
					};

					options1 = {
						uri: 'https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=' + parameters1 + '&destinations=' + site_latitude + '%2C' + site_longitude + '&key='+config.apiKey,
						timeout: 200000000,
						followAllRedirects: true
					};
					request(options, function (error, response, body) {
						if (err)
							console.error(err.message)
						var jsonData = JSON.parse(body);
						var row = jsonData.rows;
						var arr = [];
						row.forEach(function (a) {
							var element = a.elements;
							element.forEach(function (b) {
								/* var s = b.distance.value;
								d = distDiffer.push(s); */
								if (b.status == 'OK') {
									var s = b.distance.text;
									d = distDiffer.push(s);
								} else {
									var s = b.distance;
									d = distDiffer.push(s);
								}

							});
						});
						/* for (i = 0; i < d; i++) {
							users[i].distance = distDiffer[i] / 1000;
						} */
						for (i = 0; i < d; i++) {
							users[i].distance = distDiffer[i];
							if (distDiffer[i] != 0) {
								arr.push(users[i]);
							}
						}
						/************************/
						request(options1, function (err, response, body1) {
							if (err)
								console.error(err.message)
							var jsonData1 = JSON.parse(body1);
							var row1 = jsonData1.rows;

							row1.forEach(function (a) {
								var element1 = a.elements;
								element1.forEach(function (b) {
									if (b.status == 'OK') {
										var s = b.distance.text;
										d1 = distDiffer1.push(s);
									} else {
										var s = 0;
										d1 = distDiffer1.push(s);
									}
								});
							});

							for (i = 0; i < arr.length; i++) {

								if (distDiffer1[i] != 0) {
									distDiffer1[i] = distDiffer1[i].replace(',', '');

									distDiffer1[i] = parseInt(distDiffer1[i]);

									arr[i].siteDistance = distDiffer1[i];
								} else {
									arr[i].siteDistance = 0;
								}
							}

							/************************/
							res.render('admin/supervisor/userMap-view', {
								title: 'Supervisor Map View',
								layout: 'layout/supervisor-layout.jade',
								users: arr,
								jobtype: jobtype,
								designation: designation,
								job_budget: budget,
								url: url,
								jobId: jobId,
								cartCount: cartCount,
								cart: cart,
								applications: req.session,
								search: req.body.search
							});
						});
					});
				});
			});
		});
	});

});

/* GET chat */
router.get('/chat', function (req, res) {
	chksession(req, res);
	var uid = req.session.uid;
	var token = req.session.token;
	var decoded = jwt.decode(token);
	var tokenId = decoded.id;


	db.query(`SELECT msg_from FROM tech_messages WHERE msg_to=?`, uid, function (err, id) {
		var hrId = id[0].msg_from;
		db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.profileImg, tm.id, tm.msg_from, tm.msg_to, tm.message, tm.time FROM tech_messages AS tm JOIN users AS u ON(tm.msg_from=u.id) WHERE msg_from IN (?,?) AND msg_to IN (?,?) AND tm.active=1 ORDER BY tm.time LIMIT 1`, [uid, hrId, uid, hrId], function (err, message) {

			db.query(`SELECT id, msg_to, msg_from FROM tech_messages ORDER BY id DESC LIMIT 1`, function (err, lastId) {

				var msg_to = lastId[0].msg_to;
				var msg_from = lastId[0].msg_from;
				db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.profileImg, tm.msg_from, tm.msg_to, tm.message, tm.time FROM tech_messages AS tm JOIN users AS u ON(tm.msg_to=u.id) WHERE tm.msg_from IN (?,?) AND tm.msg_to IN (?,?) AND tm.active=1 GROUP BY tm.id ORDER BY tm.time `, [msg_from, msg_to, msg_from, msg_to], function (err, msgDetail) {

					res.render('admin/supervisor/chat', {
						title: 'Supervisor & HR Chat View',
						layout: 'layout/supervisor-layout.jade',
						uid: uid,
						msg: message,
						msg_to: msg_to,
						msgDetails: msgDetail,
						token: token,
						url: url,
						applications: req.session

					})
				});
			});
		});

	});
});

/***********************Allow for multiple sites****************************/
/* GET Manage-sites */
router.get('/manage-sites', function (req, res) {
	chksession(req, res);
	// db.query('SELECT id, siteName, sitesCode, description, newAddress, createDate FROM jobsites WHERE planner=?', 248, function (err, rows) {
	db.query('SELECT id, siteName, sitesCode, description, newAddress, createDate,us.user_id FROM jobsites js join user_sites us ON (js.id=us.site_id) WHERE us.is_current=1 and us.user_role=3 and us.user_id=?  ', req.session.uid, function (err, rows) {
		if (err)
			console.error(err.message)
		res.render('admin/supervisor/manage-sites', {
			title: 'Supervisor Dashboard',
			layout: 'layout/supervisor-layout.jade',
			siteLists: rows,
			applications: req.session
		});

	});
});

/* GET View Manage-site */
router.get('/view-sites/:id', function (req, res) {
	var id = req.params.id;
	chksession(req, res);
	// db.query('SELECT jobsites.id, jobsites.siteName, jobsites.sitesCode, jobsites.description, jobsites.newAddress, jobsites.createDate,  jobsites.description, jobsites.supervisors, CONCAT(`firstName`, " ", `lastName`) AS name FROM `jobsites` LEFT JOIN users ON (jobsites.supervisors = users.id)  WHERE jobsites.id=?', id, function (err, rows) {
	db.query(`SELECT jobsites.id, jobsites.siteName, jobsites.sitesCode, jobsites.description, jobsites.newAddress, jobsites.createDate, (SELECT CONCAT(firstName, " ", lastName) from users JOIN user_sites ON (users.id = user_sites.user_id) WHERE user_sites.user_role=3 AND user_sites.is_current=1 AND user_sites.jobType=1 AND user_sites.site_id=jobsites.id) AS mname,(SELECT CONCAT(firstName, " ", lastName) from users JOIN user_sites ON (users.id = user_sites.user_id) WHERE user_sites.user_role=3 AND user_sites.is_current=1 AND user_sites.jobType=2 AND user_sites.site_id=jobsites.id) AS ename, CONCAT(firstName, " ", lastName) AS plannerName FROM jobsites join users ON(jobsites.planner=users.id) WHERE jobsites.id=?`, id, function (err, rows) {
		for (var i = 0; i < rows.length; i++) {
			if (rows[i].mname)
				rows[i].name = rows[i].mname;
			if (rows[i].ename)
				rows[i].name = rows[i].ename;
			if (rows[i].ename && rows[i].mname)
				rows[i].name = rows[i].ename + '/' + rows[i].mname;
		};
		db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, jobType FROM users WHERE id=?', req.session.uid, function (err, jobType) {
			var jobType = jobType[0].jobType;
			db.query('SELECT id, jobCode, jobName, noOfPhases, endDate FROM jobs WHERE siteId=? AND jobTypeId=? ORDER BY createDate DESC limit 5', [id, jobType], function (err, list) {
				if (err)
					console.error(err.message)
				res.render('admin/supervisor/view-sites', {
					title: 'Supervisor View Profile',
					layout: 'layout/supervisor-layout.jade',
					siteLists: rows,
					jobList: list,
					applications: req.session
				});
			});
		});
	});

});

/* GET Create-jobs page */
router.get('/create-jobs/:id', function (req, res) {
	var id = req.params.id;
	chksession(req, res);

	db.query('SELECT id,type_name FROM jobtype WHERE active=1', function (err, rows) {
		db.query('SELECT skill_name FROM skills WHERE active=1', function (err, row) {
			db.query('SELECT id, firstName FROM users where role=3', function (err, userSupervisor) {
				if (err)
					console.error(err.message)
				res.render('admin/supervisor/create-jobs', {
					title: 'Create / Select Jobs',
					layout: 'layout/admin-layout.jade',
					jobType: rows,
					supervisor: userSupervisor,
					id: id,
					url: url,
					applications: req.session
				});
			});
		});
	});
});

/* Add Create-job */
router.post('/create-jobs/:id', [
		check('description').isLength({
			min: 5
		}).withMessage('Description Must be at least 5 chars long'),
		check('noOfVacancy').isNumeric(),
	],
	function (req, res) {
		chksession(req, res);

		var id = req.params.id;
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			const validationErrors = errors.array();
			let errorMessages = [];
			validationErrors.forEach(function (row) {
				errorMessages.push(row.msg);
			})
			req.flash('msg_error', errorMessages);
			res.redirect('/admin/supervisor/create-jobs/' + id);
		} else {

			/* var sk = req.body.skills;
			if (!sk)
			  sk = 0;
			if (typeof sk != "object")
			  sk = [sk]; */
			let sup;

			sup = req.session.uid;

			db.query('SELECT planner FROM jobsites WHERE id=?', id, function (err, jobSites) {
				db.query('SELECT jobType FROM users WHERE id = ?', req.session.uid, function (err, jobType) {
					var jobType = jobType[0].jobType;
					if (!(req.body.workingHoursPerDay || req.body.workingDayPerWeek)) {
						var data = {
							siteId: req.params.id,
							jobName: req.body.jobName,
							jobCode: req.body.jobCode,
							// jobTypeId: req.body.jobType,
							jobTypeId: jobType,
							description: req.body.description,
							jobPlanner: jobSites[0].planner,
							jobSupervisor: sup,
							startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
							endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
							createdBy: req.session.uid,
							createDate: new Date(),
							experience: req.body.year + '.' + req.body.month,
							noOfVacancy: req.body.noOfVacancy,
							// noOfPhases: req.body.noOfPhases,
							days_count: req.body.days_count,
							proposed_budget: req.body.proposed_budget,
						};
					} else {
						var data = {
							siteId: req.params.id,
							jobName: req.body.jobName,
							jobCode: req.body.jobCode,
							// jobTypeId: req.body.jobType,
							jobTypeId: jobType,
							description: req.body.description,
							jobPlanner: jobSites[0].planner,
							jobSupervisor: sup,
							startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
							endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
							createdBy: req.session.uid,
							createDate: new Date(),
							experience: req.body.year + '.' + req.body.month,
							noOfVacancy: req.body.noOfVacancy,
							// noOfPhases: req.body.noOfPhases,
							days_count: req.body.days_count,
							proposed_budget: req.body.proposed_budget,
							workingHoursPerDay: req.body.workingHoursPerDay,
							workingDayPerWeek: req.body.workingDayPerWeek,
						};
					}
					var q = db.query('INSERT INTO jobs SET ?', data, function (err, rows) {
						if (err)
							console.error(err.message)
						var id = q._results[0]['insertId'];
						let w = id.toString(16);
						w = w.toUpperCase();
						var userCode = 'JOB_' + w;
						db.query('UPDATE jobs SET jobCodeCpy= ? WHERE id =?', [userCode, id], function (err) {
							if (err) {

								db.query('DELETE FROM jobs where id= ?', id)
								req.flash('msg_error', "Some Error Occured, Please Try Again!");
								res.redirect('/admin/supervisor/create-jobs/' + id);

							} else {

								// if (req.body.noOfPhases > 1) {

								// 	for (i = 0; i < req.body.noOfPhases; i++) {
								// 		db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT  ?, ?, ?, ?, ?', [id, req.body.phaseName[i], moment(req.body.startDate[i]).format('YYYY-MM-DD'), moment(req.body.endDate[i]).format('YYYY-MM-DD'), req.body.phaseDescription[i]], function (err) {
								// 			if (err)
								// 				console.error(err.message)
								// 		});
								// 	}
								// } else {
								// 	var jobId = id;
								// 	var phaseName = req.body.jobName + '_Phase1';
								// 	var startDate = new Date();
								// 	var endDate = req.body.projectEndDate;
								// 	var phaseDescription = req.body.description;
								// 	db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT ?, ?, ?, ?, ?', [jobId, phaseName, moment(req.body.startDate).format('YYYY-MM-DD'), moment(req.body.endDate).format('YYYY-MM-DD'), phaseDescription], function (err) {
								// 		if (err)
								// 			console.error(err.message)
								// 	});
								// }
								req.flash('msg_info', "Project Created Successfully");
								req.session.cart = '';
								res.redirect('/admin/supervisor/view-jobs/' + req.params.id);
							}
						});
					});
				});
			});
		}
	});

/* GET ALL JOBS ON VIEW SITES PAGE*/
router.get('/view-jobs/:id', function (req, res) {
	var id = req.params.id;
	chksession(req, res);

	db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, jobType FROM users WHERE id=?', req.session.uid, function (err, jobType) {
		var jobType = jobType[0].jobType;
		db.query('SELECT js.id as jobSiteId, js.siteName, js.sitesCode, j.id AS jobid, j.jobCode, j.jobName, j.noOfVacancy, j.noOfPhases, j.startDate, j.endDate, j.createdBy, j.days_count, j.predicated_budget, (SELECT GROUP_CONCAT(id) FROM designation WHERE job_type=j.jobTypeId) AS des_id, (SELECT GROUP_CONCAT(designation_name) FROM designation WHERE job_type=j.jobTypeId) AS des_name, (SELECT COUNT(user_id) FROM `users_job` WHERE job_id=jobid AND isCurrentJob=1) AS empCount FROM jobs AS j LEFT JOIN jobsites AS js ON(js.id=j.siteId) WHERE js.id=? AND j.status=1 AND j.jobTypeId=?', [id, jobType], function (err, list) {
			var suid = req.session.uid;
			req.session.cart = '';
			res.render('admin/supervisor/view-jobs', {
				title: 'Supervisor View Profile',
				layout: 'layout/supervisor-layout.jade',
				jobList: list,
				suid: suid,
				applications: req.session
			});
		});
	});
});
/***************************************************/

/*GET to upload attachment */
router.get('/upload-attachment/:id', function (req, res) {
	chksession(req, res);
	var id = req.params.id;
	res.render('admin/supervisor/upload-attachment', {
		title: 'add project attachment',
		layout: 'layout/supervisor-layout.jade',
		id: id,
		url: url,
		applications: req.session
	});
});

/* POST to upload attachment */
router.post('/upload-attachment/:id', function (req, res) {
	chksession(req, res);
	var id = req.params.id;
	var projectId = req.body.projectId;
	let imageFile = req.files.attachment;
	let imageExtension = imageFile.name.split('.');
	if (imageExtension[1] == "jpg" || imageExtension[1] == "JPG" || imageExtension[1] == "jpeg" || imageExtension[1] == "JPEG" || imageExtension[1] == "png" || imageExtension[1] == "PNG" || imageExtension[1] == "pdf" || imageExtension[1] == "PDF") {

		let ext = imageExtension[(imageExtension).length - 1];
		var image = projectId + '_' + new Date().toISOString();
		new_image = md5(image);
		new_image = new_image + '.' + ext;
		let fileName = new_image;
		let uploadPath = 'uploads/project_attachment';
		var data = {
			projectId: id,
			attachment: fileName,
			description: req.body.description,
			uploadedBy: req.session.uid,
			active: 1
		};

		imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {
			db.query('INSERT INTO upload SET ?', data, function (err) {
				if (err)
					console.error(err.message)
				req.flash('msg_info', "Project attachment uploaded successfully");
				res.redirect('/admin/supervisor/view-attachmentList/' + id);
			});
		});
	} else {
		req.flash('msg_info', "This format is not allowed , please upload file with '.png','.gif','.jpg','.pdf'");
		res.redirect('/admin/supervisor/upload-attachment/' + id);
	}


});

/* GET to view uploaded attcahment list based on projectId */
router.get('/view-attachmentList/:id', function (req, res) {
	chksession(req, res);
	var projectId = req.params.id;
	db.query('SELECT id, attachment, description, date FROM upload where projectId=? AND active=1', projectId, function (err, rows) {
		if (err)
			console.error(err.message)
		res.render('admin/supervisor/view-attachmentList', {
			title: 'Project Attachment View',
			layout: 'layout/supervisor-layout.jade',
			projectAttachList: rows,
			applications: req.session
		});
	});
});

/* Delete Uploads */
router.get('/deleteUploadAttachment/:id', function (req, res) {
	chksession(req, res);
	var id = req.params.id;
	db.query('SELECT projectId FROM upload WHERE id=?', id, function (err, projectId) {
		var projectId = projectId[0].projectId;
		db.query('UPDATE upload SET active=0 WHERE id=?', id, function (err) {
			if (err)
				console.error(err.message)
			req.flash('msg_error', "Attachment Deleted Successfully.");
			res.redirect('/admin/supervisor/view-attachmentList/' + projectId);
		});
	});
});
/***************************************************/
module.exports = router;