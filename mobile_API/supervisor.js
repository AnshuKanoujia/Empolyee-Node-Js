var express = require('express');
var session = require('express-session');
var db = require('../config/db');
var defaults = require('../config/default');
var router = express.Router();
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const config = require('config');
const crypto = require('crypto');
var jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
var moment = require('moment');
const auth = require('./middleware/auth');
const planner = require('./middleware/planner');
const createResponse = require("./libraries/response");
const utils = require("./libraries/utils");
// Load input validation
const validateLoginInput = require("../validation/login");
const {
    check,
    validationResult
} = require('express-validator');
var md5 = require('md5');

function countHours(inTime, outTime) {
    var startTime = moment(inTime, "MM/DD/YYYY HH:mm:ss a");
    var endTime = moment(outTime, "MM/DD/YYYY HH:mm:ss a");

    /*   var duration = moment.duration(endTime.diff(startTime));
      var hours = parseInt(duration.asHours());
      var minutes = parseInt(duration.asMinutes()) % 60;
      var days = parseInt(hours / 24);
      hour = hours - (days * 24); */

    var difference = endTime.diff(startTime)
    var duration = moment.duration(difference).subtract(1800, 'seconds');
    var hours = parseInt(duration.asHours());
    var minutes = parseInt(duration.asMinutes()) % 60;
    return (hours + ' Hrs and ' + minutes + ' Min');
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

/* GET to manage sites */
router.get('/manage-sites', auth, function (req, res, next) {

    db.query('SELECT siteName, description, createDate FROM jobsites WHERE planner=?', req.user.uid, function (err, rows) {
        if (err)
            console.error(err.message);
        res.status(200).json({
            siteLists: rows,
        })
    });
});

/* POST phases */
router.post('/phases/', auth, function (req, res, next) {

    var id = req.body.id;
    var status = req.body.status;
    var currentPhases = req.body.currentPhases;
    db.query("UPDATE userapplications SET status=? WHERE  id=?", [status, id], function (err, rows) {
        db.query("UPDATE users SET currentPhases=? WHERE  id=?", [currentPhases, id], function (err, rows) {
            if (err)
                console.error(err.message);
            return res.status(200).json(createResponse('Success', 33))
        });
    });
});

router.get('/create-jobs', auth, function (req, res, next) {
    try {
        var user = req.user;
        var id = user.SiteId;
        if (id === 0 || id == null) {
            res.status(403);
            return res.json(createResponse("FAIL", 30));
        } else {
            db.query('SELECT id,type_name FROM jobtype where active =1', function (err, rows) {
                db.query('SELECT skill_name FROM skills where active =1', function (err, row) {
                    db.query('SELECT id, IFNULL(firstName," ") AS firstName  FROM users where role=2', function (err, userPlanner) {
                        db.query('SELECT id, IFNULL(firstName," ") AS firstName  FROM users where role=3', function (err, userSupervisor) {
                            if (err)
                                console.error(err.message)
                            return res.status(200).json({
                                jobType: rows,
                                planner: userPlanner,
                                supervisor: userSupervisor,
                                id: id,
                            });
                        });
                    });
                });
            });
        }
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

router.post('/submit-create-jobs/', auth, [
        check('description').isLength({
            min: 5
        }).withMessage('Description Must be at least 5 chars long'),
        check('noOfVacancy').isNumeric(),
        check('noOfPhases').isNumeric(),
    ],
    async function (req, res) {
        var id = req.user.SiteId;
        var user = req.user;
        var user_id = user.uid;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                message: utils.createErrorResponse(errors.array())
            });
        }
        try {
            if (req.user.SiteId == null) {
                return res.status(403).json(createResponse('FAIL', 30));
            } else {
                // var sk = req.body.skills;
                // var sks = sk.split(",");
                var phaseName = req.body.phaseName;
                var pName = phaseName.split(",");
                var startDate = req.body.startDate;
                var sDate = startDate.split(",");
                var endDate = req.body.endDate;
                var eDate = endDate.split(",");
                var phaseDescription = req.body.phaseDescription;
                var pDescription = phaseDescription.split(",");
                db.query('SELECT jobCode FROM jobs WHERE jobCode=?', req.body.jobCode, function (err, jobCode) {
                    if (jobCode.length == 0) {
                        db.query('SELECT supervisors FROM jobsites WHERE id=?', req.user.SiteId, function (err, supervisors) {
                            let sup;
                            sup = supervisors[0].supervisors;
                            var data = {
                                siteId: req.user.SiteId,
                                jobName: req.body.jobName,
                                jobCode: req.body.jobCode,
                                jobTypeId: req.body.jobType,
                                description: req.body.description,
                                jobPlanner: user_id,
                                jobSupervisor: sup,
                                startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
                                endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
                                createdBy: user_id,
                                createDate: new Date(),
                                experience: '1.2',
                                noOfVacancy: req.body.noOfVacancy,
                                noOfPhases: req.body.noOfPhases,
                                days_count: req.body.days_count,
                                proposed_budget: req.body.proposed_budget,
                                workingHoursPerDay: req.body.workingHoursPerDay,
                                workingDayPerWeek: req.body.workingDayPerWeek,
                            };
                            db.query('SELECT INTO jobs SET ?', data, function (err, rows) {

                                var q = db.query('INSERT INTO jobs SET ?', data, function (err, rows) {
                                    if (err)
                                        console.error(err.message)
                                    var id = q._results[0]['insertId'];
                                    let w = id.toString(16);
                                    w = w.toUpperCase();
                                    var userCode = 'JOB_' + w;
                                    // if (sks) {
                                    //     sks.forEach(function (c) {
                                    //        db.query('INSERT INTO job_skills(job_id, skill_id)VALUES (?, ?)', [id, c]);
                                    //     });
                                    // }
                                    db.query('UPDATE jobs SET jobCodeCpy= ? WHERE id =?', [userCode, id], function (err) {
                                        if (err) {
                                            db.query('DELETE FROM jobs where id= ?', id);
                                            console.error(err.message);
                                            return res.status(500).json(createResponse('FAIL', 0));
                                        } else {
                                            if (req.body.noOfPhases > 1) {
                                                for (i = 0; i < req.body.noOfPhases; i++) {
                                                    db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT  ?, ?, ?, ?, ?', [id, pName[i], moment(sDate[i]).format('YYYY-MM-DD'), moment(eDate[i]).format('YYYY-MM-DD'), pDescription[i]], function (err) {
                                                        if (err)
                                                            console.error(err.message)
                                                    });
                                                }
                                            } else {
                                                var jobId = id;
                                                var phaseName = req.body.jobName + '_Phase1';
                                                var startDate = new Date();
                                                var endDate = req.body.projectEndDate;
                                                var phaseDescription = req.body.description;
                                                db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT ?, ?, ?, ?, ?', [jobId, phaseName, moment(req.body.startDate).format('YYYY-MM-DD'), moment(req.body.endDate).format('YYYY-MM-DD'), phaseDescription], function (err) {
                                                    if (err)
                                                        console.error(err.message)
                                                });
                                            }

                                            return res.status(200).json(createResponse('Success', 31));
                                        }
                                    });
                                });
                            });
                        });
                    } else {
                        return res.status(403).json(createResponse('FAIL', 69));
                    }
                });
            }
        } catch (err) {
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }

    });

router.get('/view-jobs', auth, function (req, res) {
    try {
        var user = req.user;
        var id = user.SiteId;
        if (id === 0 || id == null) {
            return res.status(403).json(createResponse("FAIL", 30));
        }
        if (id != 0) {
            //req.session.cart = '';

            db.query('SELECT js.id, js.siteName, js.sitesCode, j.id As jobid, j.status As jobStatus,j.jobCode, j.jobName, j.noOfPhases, j.endDate, j.startDate,j.noOfVacancy, j.predicated_budget, j.days_count, j.workingHoursPerDay, j.workingDayPerWeek, (SELECT GROUP_CONCAT(id) FROM designation WHERE job_type=j.jobTypeId) AS des_id, (SELECT GROUP_CONCAT(designation_name) FROM designation WHERE job_type=j.jobTypeId) AS des_name, (select count(user_id) from users_job WHERE job_id = j.id and isCurrentJob =1) as empCount FROM jobs AS j LEFT JOIN jobsites AS js ON(js.id=j.siteId) WHERE js.id=? AND j.status != 3', id, function (err, list) {
                if (err)
                    console.error(err.message)
                if (list.length == 0)
                    return res.status(404).json(createResponse('FAIL', 48));
                return res.status(200).json({
                    jobList: list,
                });
            });
        } else {
            return res.status(403).json(createResponse('FAIL', 32));
        }

    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* POST to add user designation */
router.post('/add-userDesignation', auth, function (req, res) {

    var jobId = req.body.job_id;
    var designation_name = req.body.designation_name;
    return res.status(200).json({
        jonId: jobId,
        designation_name: designation_name
    });

});
// Get view-technician List
router.get('/view-technician', auth, function (req, res, next) {
    try {
        var user = req.user;
        var siteId = user.SiteId;
        if (siteId == 0 || siteId == null) {
            return res.status(403).json(createResponse('FAIL', 30));
        } else {
            db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, jobType FROM users WHERE id=?', req.user.uid, function (err, jobType) {
                var jobType = jobType[0].jobType;
                var a = db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, (SELECT count(id) FROM taskreporting WHERE status=0 AND userId=users.id AND jobId=j.id) as pending_reports, users.id, users.eCode, users.experience, users.status, jobtype.type_name AS jobtype,CONCAT(j.jobName, " (", js.siteName,")") as jobName, users.ratings,IF(ud.designation_id >= 11 , (ud.designation_id-10), ud.designation_id) AS skillLevel FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) JOIN users_job AS uj ON(users.id=uj.user_id) JOIN jobs AS j ON(uj.job_id=j.id) JOIN jobsites js ON (j.siteId=js.id) JOIN user_designation AS ud ON(ud.user_id = users.id) where users.role=1 AND uj.siteId IN (SELECT site_id from user_sites where user_id = ? and is_current=1) AND uj.isCurrentJob=1 AND users.jobType=?', [req.user.uid, jobType], function (err, rows) {
                    if (err)
                        console.error(err.message)
                    if (rows.length == 0)
                        return res.status(404).json(createResponse('NOT Found', 48));
                    return res.status(200).json({
                        users: rows
                    });
                });
            });
        }
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* GET Search Jobs */
router.get('/viewUsers/:id', auth, function (req, res) {
    var jobId = req.params.id;
    //  req.session.jobId = jobId;


    //if (req.session.cart)
    //{
    //  var cartCount = req.session.cart.totalUsers;
    //}else {
    //cartCount = 0;
    //req.session.cart = new Cart(req.session.cart ? req.session.cart : {});
    //}

    // var sk = req.body.skills;
    // var sks = sk.split(",");
    // _skFilter = '';
    //if (sk) {
    //if (typeof sk == 'object') {
    // _skFilter = ` AND u.id IN (SELECT user_id from user_skills WHERE skill_id IN (`
    // sks.forEach(function (a) {
    //     _skFilter += a + ','
    // })
    // _skFilter += `0 ) )`
    //} else {
    //_skFilter = ` AND u.id IN (SELECT user_id from user_skills WHERE skill_id IN (${sk}) )`
    //}
    //}
    // var cart_User = req.body.user_id;
    // var cartUser = cart_User.split(',');
    // _skcartUserFilter = ' ';
    // if (cartUser) {
    //     //if (typeof cartUser == 'object') {
    //     _skcartUserFilter = ` AND u.id NOT IN (`
    //     cartUser.forEach(function (a) {
    //         _skcartUserFilter += a + ','
    //     })
    //     _skcartUserFilter += `0 ) `
    //     //} else {
    //     //_skcartUserFilter = ` AND u.id NOT IN ((${cartUser}) `
    //     //}
    //     // var _skcartUserFilter = ' ';
    // }

    db.query('SELECT jobTypeId FROM jobs where id=?', jobId, function (err, rows) {
        var jobtype = rows[0].jobTypeId;

        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg, u.newAddress, u.latitude, u.longitude, count(u.id) as rank, (SELECT CONCAT(hourly_rate,'/',max_pertime_rate) FROM user_rates AS ur WHERE ur.userId =u.id GROUP by ur.userId) AS rates FROM users u JOIN user_rates AS ur ON (u.id = ur.userId) WHERE firstName LIKE '%${req.params.search ? req.params.search : '%'}%' AND u.jobType=(SELECT jobTypeId FROM jobs WHERE id ='${jobId}') AND u.role=1 AND u.latitude IS NOT NULL AND u.latitude != '' AND u.id NOT IN (select user_id from users_job where job_id=? ) AND u.id NOT IN (select userId from joboffers where jobId=? ) AND u.search=1 GROUP BY u.id order by rank desc`, [jobId, jobId], function (err, users) {
            var cart = req.params.id;
            if (err)
                console.error(err.message)
            return res.status(200).json({
                users: users,
                jobtype: jobtype,
                jobId: jobId,
                cart: cart,
            });
        });
    });
});

/* GET Filter users */
router.post('/searchUsers', auth, function (req, res) {
    var jobId = req.body.jobId;
    var ratings = req.body.ratings;
    if (req.session.cart)
        var cartCount = req.body.user_id;

    /* var sk = req.body.skills;
    _skFilter = '';
    if (sk) {
        if (typeof sk == 'object') {
            _skFilter = ` AND u.id IN (SELECT user_id from user_skills WHERE skill_id IN (`
            sk.forEach(function (a) {
                _skFilter += a + ','
            })
            _skFilter += `0 ) )`
        } else {
            _skFilter = ` AND u.id IN (SELECT user_id from user_skills WHERE skill_id IN (${sk}) )`
        }
    } */

    _ratingFilter = '';
    if (ratings) {
        _ratingFilter = ` AND u.ratings >= (${ratings})`
    }

    db.query('SELECT jobTypeId FROM jobs where id=?', jobId, function (err, rows) {
        var jobtype = rows[0].jobTypeId;
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg,u.newAddress, u.latitude, u.longitude, u.ratings, u.latitude, u.longitude, count(u.id) as rank, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation, (SELECT CONCAT(hourly_rate,'/',max_pertime_rate) FROM user_rates AS ur WHERE ur.userId =u.id GROUP by ur.userId) AS rates FROM users u JOIN user_rates AS ur ON (u.id = ur.userId) WHERE firstName LIKE '%${req.body.search ? req.body.search : '%'}%' ${_ratingFilter} AND u.jobType=(SELECT jobTypeId FROM jobs WHERE id ='${jobId}') AND u.role=1 AND u.latitude IS NOT NULL AND u.latitude != '' AND u.search=1 GROUP BY u.id order by rank desc`, [jobId, jobId], function (err, users) {
            var cart = req.params.id;
            if (err)
                console.error(err.message)
            return res.status(200).json({
                users: users,
                jobtype: jobtype,
                jobId: jobId,
                cartCount: cartCount,
                cart: cart,
                search: req.body.search
            });
        });
    });
});






/* POST to offered users */
router.post('/jobOfferedUsers', auth, async function (req, res) {

    var users = req.body.user_id;
    var users_cart = users.split(",");
    var user = req.user;
    var user_id = user.uid;
    var store = [];
    users_cart.forEach(async function (a) {
        var data = {
            userId: a,
            jobId: req.body.jobId,
            designation: req.body.designation_name,
            offeredBy: user_id
        };
        db.query('INSERT INTO joboffers SET ?', data, async function (err, rows) {
            await db.query('SELECT email FROM users where id=?', a, function (err, row) {
                store.push(row[0].email)
                if (err)
                    console.error(err.message)

            });
        });
    });
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
    // // setup e-mail data with unicode symbols
    var mailOptions = {
        from: "test.augurs@gmail.com", // sender address
        to: store, // list of receivers
        subject: "Job Offer", // Subject line
        generateTextFromHTML: true,
        html: "Congratulations on job offer We are delighted to offer you job,<br>Please visit our portal on  <br>" + "http://localhost:4000" + "<br>Thank you." // html body
    }
    // // send mail with defined transport object
    transporter.sendMail(mailOptions, function (err, info) {
        if (err)
            console.error(err.message)
        return res.status(200).json(createResponse('Success', 43));
    });

});

/* POST to delete cart */
router.get('/remove/:id', function (req, res) {
    try {

    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))

    }
    var id = req.params.id;
    var cart = new Cart(req.session.cart ? req.session.cart : {});
    cart.remove(id);
    req.session.cart = cart;
    res.redirect('/admin/supervisor/userCart');
});


/* GET to edit job */
router.get('/editJob/:id', auth, function (req, res) {
    try {
        var user = req.user;
        var user_id = user.uid;
        var Site_id = user.SiteId;

        db.query('SELECT uj.job_id AS jobId, uj.enroll_Indate, uj.enroll_Outdate FROM users_job AS uj WHERE uj.user_id = ? AND uj.sup_id= ? AND uj.siteId=(SELECT siteId from jobs where id= uj.job_id ) and uj.isCurrentJob=1', [req.params.id, user_id], function (err, rows) {

            if (rows.length != 0) {
                jobId = rows[0].jobId;
            } else {
                jobId = '';
            }

            if (err)
                console.error(err.message)
            return res.status(200).json({
                rows: rows[0],
                user_id: req.params.id,
                job_id: jobId,
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* POST to update jobs */
router.post('/updateJob', auth,
    function (req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(403).json({
                    request: 'FAIL',
                    errors: utils.createErrorResponse(errors.array())
                });
            } else {
                console.log(req.body, 'wholebodyyyyyyy')
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
                var a = db.query('UPDATE users_job SET isCurrentJob=? WHERE user_id=? AND job_id=?', [isCurrentJob, data.user_id, data.job_id], function (err) {
                    console.log(a.sql, 'UPDATE users_jobUPDATE users_job')
                    var b = db.query('UPDATE user_sites SET is_current=0 WHERE user_id=? AND site_id=(SELECT siteId from jobs where id=?)', [data.user_id, data.job_id], function (err) {
                        console.log(b.sql, 'UPDATE user_sitesUPDATE user_sites')
                        if (err)
                            console.error(err.message)
                        return res.status(200).json(createResponse('Success', 34));
                    });
                });
            }
        } catch (err) {
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }
    });

router.post('/updateJobTime', auth, function (req, res) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                errors: utils.createErrorResponse(errors.array())
            });
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
                return res.status(200).json(createResponse('Success', 35));
            });
        }
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* Get job submitted reports */
router.get('/job-reports/:id', auth, function (req, res, next) {
    try {
        var user = req.user;
        var user_id = user.uid;
        let id = req.params.id;
        db.query('SELECT job_id FROM users_job WHERE user_id = ? AND sup_id =? AND isCurrentJob=0 ORDER by finishDate DESC LIMIT 1', [user_id, id], function (err, rows) {
            if (rows.length != 0) {
                jobId = rows[0].jobId;
            } else {
                jobId = '';
            }
            if (err)
                console.error(err.message)
            return res.status(200).json({
                job_id: jobId,
                id: id
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* GET Technician profile */
router.get('/viewTechProfile/:id', auth, function (req, res) {
    // var user = req.user;
    // var user_id = user.uid;
    db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, users.id, users.email,IFNULL(users.dob,"") AS dob, users.eCode, users.experience, users.status, users.newAddress, jobtype.type_name AS jobtype, jobtype.description, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = ?)) as designation, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = users.id GROUP BY us2.user_id) AS skills FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) where users.id=? AND role=1 ', [req.params.id, req.params.id], function (err, rows) {
        db.query('SELECT id, certification_name, certificate_attachment, authority, exp_date FROM certification where userId=? AND active=1', req.params.id, function (err, list) {
            db.query('SELECT AVG(IFNULL(rating, "")) as total_rating, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=1) AS Workmanship_Quality, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=2) AS Attendance_Punctuality, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=3) AS Organization_Cleanliness, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=4) AS Communication_Updates, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=5) AS Worked_Safe, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=6) AS Followed_Instructions_Schedule, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=7) AS Team_Player FROM `user_ratings` WHERE userId=?', [req.params.id, req.params.id, req.params.id, req.params.id, req.params.id, req.params.id, req.params.id, req.params.id], function (err, rating) {
                db.query('SELECT userId, hourly_rate, max_pertime_rate FROM user_rates WHERE userId=?', req.params.id, function (err, rate) {
                    if (err)
                        console.error(err.message)
                    return res.status(200).json({
                        users: rows,
                        // rating: rating[0],
                        rating: {
                            'total_rating': (rating[0].total_rating != null) ? rating[0].total_rating.toFixed(2) : '',
                            'Workmanship_Quality': (rating[0].Workmanship_Quality != null) ? rating[0].Workmanship_Quality : '',
                            'Attendance_Punctuality': (rating[0].Attendance_Punctuality != null) ? rating[0].Attendance_Punctuality : '',
                            'Organization_Cleanliness': (rating[0].Organization_Cleanliness != null) ? rating[0].Organization_Cleanliness : '',
                            'Communication_Updates': (rating[0].Communication_Updates != null) ? rating[0].Communication_Updates : '',
                            'Worked_Safe': (rating[0].Worked_Safe != null) ? rating[0].Worked_Safe : '',
                            'Followed_Instructions_Schedule': (rating[0].Followed_Instructions_Schedule != null) ? rating[0].Followed_Instructions_Schedule : '',
                            'Team_Player': (rating[0].Team_Player != null) ? rating[0].Team_Player : '',
                        },
                        rate: rate,
                        certificatonList: list
                    });
                });
            });
        });
    });
});

//Get technician submitted reports
router.get('/submitted-reports/:id', auth, function (req, res, next) {
    try {
        var user = req.user;
        var user_id = user.uid;
        let id = req.params.id;
        var a = db.query('SELECT t.*, u.firstName, s.statusName FROM taskreporting AS t join users AS u JOIN statusname AS s ON(s.id=t.status) where t.sup_id=? AND t.userId=u.id AND active=1 AND t.status=0 AND t.userId=? ORDER BY t.date DESC', [user_id, id], function (err, rows) {
            console.log(a.sql, 'querry', rows, 'rows');
            if (rows.length == 0) {

                if (err)
                    res.json({
                        success: false,
                        msg: err.message
                    });
                return res.status(404).json(createResponse('FAIL', 73));
            } else {
                res.status(200).json({
                    reports: rows,

                });
            }

        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }

});

/* POST Add rating */
router.post('/addRating/:id', auth, [],
    function (req, res) {
        try {
            var user = req.user;
            var user_id = user.uid;

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
                    parameters += `${parameters ? ', ' : ''}(${req.params.id},${user_id},${req.body[i]},${i.replace('rating', '')},${job_id},'${ratingDate}')`
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
                    review_by: user_id,
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
                return res.status(200).json(createResponse('Success', 36));
            });

        } catch (err) {
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }
    })

/* GET mail notification */
router.get('/send-notification', auth, function (req, res, next) {

    db.query('SELECT email FROM users ORDER BY id DESC', function (err, rows) {
        if (err)
            console.error(err.message)
        return res.status(200).json({
            users: rows
        });
    });
});

/* POST drop mail notification */
router.post('/sendMessage', auth, [],
    function (req, res) {
        subject = req.body.subject;
        body = req.body.body;
        usersEmail = req.body.usersEmail;

        if (req.files) {
            var imageFile = req.files.Img;
            let imageExtension = imageFile.name.split('.');
            if (imageExtension[1] == "jpg" || imageExtension[1] == "JPG" || imageExtension[1] == "jpeg" || imageExtension[1] == "JPEG" || imageExtension[1] == "png" || imageExtension[1] == "PNG" ||  imageExtension[1] == "pdf" || imageExtension[1] == "PDF" ||  imageExtension[1] == "doc" || imageExtension[1] == "DOC" || imageExtension[1] == "docs" || imageExtension[1] == "DOCS" || imageExtension[1] == "xls" || imageExtension[1] == "XLS" || imageExtension[1] == "xlsx" || imageExtension[1] == "XLSX") {
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
                return res.status(200).json(createResponse('FAIL', 9));
            }
        }
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
        var maillist = usersEmail;
        if (path) {
            var mailOptions = {
                from: "test.augurs@gmail.com", // sender address
                to: maillist, // list of receivers
                subject: subject, // Subject line
                generateTextFromHTML: true,
                html: body, // html body
                attachments: [{
                    path: path
                }]
            }
        } else {
            var mailOptions = {
                from: "test.augurs@gmail.com", // sender address
                to: maillist, // list of receivers
                subject: subject, // Subject line
                generateTextFromHTML: true,
                html: body, // html body
            }
        }
        // send mail with defined transport object
        transporter.sendMail(mailOptions, function (err, info) {
            if (err)
                console.error(err.message)
            return res.status(200).json(createResponse('Success', 37));
        });

    });
//Sarita
/*Get Job Details */
router.get('/view-getJobDetails/:id', auth, function (req, res, next) {
    try {
        db.query('SELECT jobs.jobName, jobs.jobTypeId AS project_trade , jobs.siteId, jobs.startDate, jobs.endDate, jobs.noOfPhases, jobs.noOfVacancy, jobs.jobCode, jobs.description, jobs.experience, jobs.workingHoursPerDay, jobs.workingDayPerWeek, jobs.days_count, jobs.proposed_budget, jobsites.siteName, jobsites.sitesCode, jobsites.newAddress, (SELECT firstName from users WHERE id=jobs.jobSupervisor) AS SupervisorName, (SELECT statusName from statusname WHERE id=jobs.status) AS jobStatus FROM `jobs` LEFT JOIN jobsites ON (jobsites.id = jobs.siteId) WHERE jobs.id=?', req.params.id, function (err, rows) {
            db.query('SELECT j.phaseName, IFNULL(j.phaseDescription, "") AS phaseDescription, j.startDate, j.endDate FROM  jobphases AS j WHERE jobId = ? ', req.params.id, function (err, jobPhases) {
                db.query('SELECT * FROM  job_skills AS j WHERE job_id = ? ', req.params.id, function (err, skills) {
                    if (err)
                        res.json({
                            success: false,
                            msg: err.message
                        });
                    return res.status(200).json({
                        jobDetails: rows,
                        skills: skills,
                        jobPhases: jobPhases
                    });
                });
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/*Edit Jobs */
router.post('/edit-jobs/:id', auth, [
        check('description').isLength({
            min: 5
        }).withMessage('Description Must be at least 5 chars long'),
        check('noOfVacancy').isNumeric(),
        check('noOfPhases').isNumeric(),
    ],
    async function (req, res) {
        try {
            var id = req.params.id;
            var user_id = req.user.uid;
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(403).json({
                    request: 'FAIL',
                    errors: utils.createErrorResponse(errors.array())
                });
            }
            // var sk = req.body.skills;
            // var sks = sk.split(",");
            var phaseName = req.body.phaseName;
            var pName = phaseName.split(",");
            var startDate = req.body.startDate;
            var sDate = startDate.split(",");
            var endDate = req.body.endDate;
            var eDate = endDate.split(",");
            var phaseDescription = req.body.phaseDescription;
            var pDescription = phaseDescription.split(",");
            db.query('SELECT jobCode FROM jobs WHERE jobCode=? AND id != ?', [req.body.jobCode, req.params.id], function (err, jobCode) {
                if (jobCode.length == 0) {
                    db.query('SELECT supervisors FROM jobsites WHERE id=?', req.user.SiteId, function (err, supervisors) {
                        sup = supervisors[0].supervisors;
                        var data = {
                            siteId: req.user.SiteId,
                            jobName: req.body.jobName,
                            jobCode: req.body.jobCode,
                            jobTypeId: req.body.jobType,
                            description: req.body.description,
                            jobPlanner: user_id,
                            jobSupervisor: sup,
                            startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
                            endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
                            createdBy: user_id,
                            createDate: new Date(),
                            experience: '1.2',
                            noOfVacancy: req.body.noOfVacancy,
                            noOfPhases: req.body.noOfPhases,
                            days_count: req.body.days_count,
                            proposed_budget: req.body.proposed_budget,
                            workingHoursPerDay: req.body.workingHoursPerDay,
                            workingDayPerWeek: req.body.workingDayPerWeek,
                        };
                        db.query('UPDATE jobs SET ? WHERE id=?', [data, id], function (err, rows) {
                            if (err)
                                res.json({
                                    success: false,
                                    msg: err.message
                                });
                            let w = id.toString(16);
                            w = w.toUpperCase();
                            db.query('DELETE FROM job_skills WHERE job_id = ?', id, function (err) {});
                            // if (sks) {
                            //     sks.forEach(function (a) {
                            //         db.query('INSERT INTO job_skills (job_id, skill_id)VALUES (?, ?)', [id, a], function (err) {});
                            //     });
                            // }
                            db.query('DELETE FROM jobphases WHERE jobId = ?', id, function (err) {
                                if (err) {
                                    res.json({
                                        success: false,
                                        msg: err.message
                                    });
                                } else {
                                    if (req.body.noOfPhases > 1) {
                                        for (i = 0; i < req.body.noOfPhases; i++) {
                                            db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT  ?, ?, ?, ?, ?', [id, pName[i], moment(sDate[i]).format('YYYY-MM-DD'), moment(eDate[i]).format('YYYY-MM-DD'), pDescription[i]], function (err) {
                                                if (err)
                                                    res.json({
                                                        success: false,
                                                        msg: err.message
                                                    });
                                            });
                                        }
                                    } else {
                                        var jobId = id;
                                        var phaseName = req.body.jobName + '_Phase1';
                                        var startDate = new Date();
                                        var endDate = req.body.projectEndDate;
                                        var phaseDescription = req.body.description;
                                        db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT ?, ?, ?, ?, ?', [jobId, phaseName, moment(req.body.startDate).format('YYYY-MM-DD'), moment(req.body.endDate).format('YYYY-MM-DD'), phaseDescription], function (err) {
                                            if (err)
                                                res.json({
                                                    success: false,
                                                    msg: err.message
                                                });
                                        });
                                    }
                                    return res.status(200).json(createResponse('Success', 68));
                                }
                            });
                        });
                    });
                } else {
                    return res.status(403).json(createResponse('FAIL', 69));
                }
            });
        } catch (err) {
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }
    });
/*End */

/* Finish Job API */
router.get('/job-finishUsers/:id', auth, function (req, res) {
    try {
        db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, uj.user_id, uj.sup_id, uj.siteId FROM users_job AS uj JOIN users AS u ON (uj.user_id = u.id) WHERE job_id=?', req.params.id, function (err, users) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json({
                userDetail: users,
                jobId: req.params.id,
            });

        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/* Finish Job API */
router.post('/job-finish', auth, function (req, res) {
    try {

        var job_id = req.body.jobId;
        var s = req.body.postData;
        var arr = JSON.parse(req.body.postData);
        var currDate = new Date();
        db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, uj.user_id, uj.sup_id, uj.siteId FROM users_job AS uj JOIN users AS u ON (uj.user_id = u.id) WHERE job_id=?', job_id, function (err, users) {

            if ((arr.length) == (users.length)) {
                db.query('SELECT endDate FROM `jobs` WHERE id=?', job_id, function (err, jobDate) {
                    if (jobDate[0].endDate < currDate) {
                        var parameters = '';
                        var ratingDate = moment(new Date()).format('YYYY-MM-DD');
                        let query = 'INSERT INTO user_ratings(`userId`,`rating_by`,`rating`,`rating_type`,`job_id`,`ratingDate`) VALUES ';
                        arr.forEach(function (a) {
                            var json_data = a;
                            var ratings = [];
                            var record = '(';
                            var ratingArr = json_data;
                            for (var k = 1; k <= 7; k++) {
                                parameters += `${parameters ? ', ' : ''}(${ratingArr[0]},${req.user.uid},${ratingArr[k]},${k},${job_id},'${ratingDate}')`
                            }
                        });
                        if (parameters) {
                            query = query + parameters;
                            db.query(query, function (err) {
                                if (err)
                                    res.json({
                                        success: false,
                                        msg: err.message
                                    });
                            });
                        }

                        reviewDate = moment(new Date()).format('YYYY-MM-DD');
                        let reviewQuery = 'INSERT INTO user_reviews(`userId`,`review_by`,`reviews`,`job_id`,`reviewDate`,`isJobreview`) VALUES ';
                        var reviewParameters = [];
                        arr.forEach(function (b) {
                            var json_data = b;
                            var reviewResult = [];
                            var userId = json_data[1];
                            var reviews = json_data[8];
                            var arrayString = [reviews];
                            if (reviews) {
                                arrayString.forEach(function (b) {
                                    let queryBlock = `(${userId[0]},${req.user.uid},'${reviews}',${job_id},'${reviewDate}',${1})`;
                                    reviewParameters.push(queryBlock);
                                });
                            }
                        });
                        if (reviewParameters.length) {
                            reviewQuery += reviewParameters.join(', ');
                            db.query(reviewQuery, function (err) {
                                if (err)
                                    res.json({
                                        success: false,
                                        msg: err.message
                                    });
                            });
                        }
                        data = {
                            finishDate: new Date(),
                            status: 3
                        };
                        db.query('UPDATE jobs SET ? WHERE id=?', [data, job_id], function (err) {
                            if (err)
                                res.json({
                                    success: false,
                                    msg: err.message
                                });
                            return res.status(200).json(createResponse('Success', 82));
                        });
                    } else {
                        return res.status(500).json(createResponse('FAIL', 76));
                    }
                });
            } else {
                return res.status(403).json(createResponse('FAIL', 83));
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }


});
/*End */

router.get('/view-finishJob', auth, function (req, res, next) {
    try {
        db.query('SELECT js.id, js.siteName, js.sitesCode, j.id As jobid, j.jobCode, j.jobName, j.noOfPhases, j.endDate, j.startDate, j.finishDate, j.noOfVacancy, (SELECT GROUP_CONCAT(id) FROM designation WHERE job_type=j.jobTypeId) AS des_id, (SELECT GROUP_CONCAT(designation_name) FROM designation WHERE job_type=j.jobTypeId) AS des_name, (select count(user_id) from users_job WHERE job_id = j.id and isCurrentJob =1) as empCount FROM jobs AS j LEFT JOIN jobsites AS js ON(js.id=j.siteId) WHERE js.id=? AND j.status=3', req.user.SiteId, function (err, list) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (list.length == 0)
                return res.status(404).json(createResponse('FAIL', 48));
            res.status(200).json({
                data: list
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* ------------------------------------------------------------------------------------------ */
/* GET To view certificate */
router.get('/view-certificate/:id', auth, function (req, res) {
    try {
        var user = req.user;
        var userId = user.uid;
        db.query('SELECT id, certification_name, certificate_attachment, authority, exp_date FROM certification where userId=? AND active=1', req.params.id, function (err, rows) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            res.status(200).json({
                data: rows
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/*18/11/19 */
/* post supervisor new create jobs based on enhancement */
router.post('/supervisor-createJobs/', auth, [
        check('description').isLength({
            min: 5
        }).withMessage('Description Must be at least 5 chars long'),
        check('noOfVacancy').isNumeric(),
        check('noOfPhases').isNumeric(),
    ],
    async function (req, res) {
        var id = req.user.SiteId;
        var user = req.user;
        var user_id = user.uid;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                message: utils.createErrorResponse(errors.array())
            });
        }
        try {
            // var sk = req.body.skills;
            // var sks = sk.split(",");
            var phaseName = req.body.phaseName;
            var pName = phaseName.split(",");
            var startDate = req.body.startDate;
            var sDate = startDate.split(",");
            var endDate = req.body.endDate;
            var eDate = endDate.split(",");
            var phaseDescription = req.body.phaseDescription;
            var pDescription = phaseDescription.split(",");
            db.query('SELECT jobCode FROM jobs WHERE jobCode=?', req.body.jobCode, function (err, jobCode) {
                if (jobCode.length == 0) {
                    db.query('SELECT supervisors FROM jobsites WHERE id=?', req.user.SiteId, function (err, supervisors) {
                        let sup;
                        sup = supervisors[0].supervisors;
                        if (!(req.body.workingHoursPerDay || req.body.workingDayPerWeek)) {

                            var data = {
                                siteId: req.user.SiteId,
                                jobName: req.body.jobName,
                                jobCode: req.body.jobCode,
                                jobTypeId: req.body.jobType,
                                description: req.body.description,
                                jobPlanner: user_id,
                                jobSupervisor: sup,
                                startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
                                endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
                                createdBy: user_id,
                                createDate: new Date(),
                                // experience: req.body.year + '.' + req.body.month,
                                experience: '1.2',
                                noOfVacancy: req.body.noOfVacancy,
                                noOfPhases: req.body.noOfPhases,
                            };
                        } else {
                            var data = {
                                siteId: req.user.SiteId,
                                jobName: req.body.jobName,
                                jobCode: req.body.jobCode,
                                jobTypeId: req.body.jobType,
                                description: req.body.description,
                                jobPlanner: user_id,
                                jobSupervisor: sup,
                                startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
                                endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
                                createdBy: user_id,
                                createDate: new Date(),
                                // experience: req.body.year + '.' + req.body.month,
                                experience: '1.2',
                                noOfVacancy: req.body.noOfVacancy,
                                noOfPhases: req.body.noOfPhases,
                                workingHoursPerDay: req.body.workingHoursPerDay,
                                workingDayPerWeek: req.body.workingDayPerWeek,
                            };
                        }
                        db.query('SELECT INTO jobs SET ?', data, function (err, rows) {

                            var q = db.query('INSERT INTO jobs SET ?', data, function (err, rows) {
                                if (err)
                                    console.error(err.message)
                                var id = q._results[0]['insertId'];
                                let w = id.toString(16);
                                w = w.toUpperCase();
                                var userCode = 'JOB_' + w;
                                // if (sks) {
                                //     sks.forEach(function (c) {

                                //         db.query('INSERT INTO job_skills(job_id, skill_id)VALUES (?, ?)', [id, c]);
                                //     });
                                // }
                                db.query('UPDATE jobs SET jobCodeCpy= ? WHERE id =?', [userCode, id], function (err) {
                                    if (err) {
                                        db.query('DELETE FROM jobs where id= ?', id);
                                        console.error(err.message);
                                        return res.status(500).json(createResponse('FAIL', 0));
                                    } else {
                                        if (req.body.noOfPhases > 1) {
                                            for (i = 0; i < req.body.noOfPhases; i++) {
                                                db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT  ?, ?, ?, ?, ?', [id, pName[i], moment(sDate[i]).format('YYYY-MM-DD'), moment(eDate[i]).format('YYYY-MM-DD'), pDescription[i]], function (err) {
                                                    if (err)
                                                        console.error(err.message)
                                                });
                                            }
                                        } else {
                                            var jobId = id;
                                            var phaseName = req.body.jobName + '_Phase1';
                                            var startDate = new Date();
                                            var endDate = req.body.projectEndDate;
                                            var phaseDescription = req.body.description;
                                            db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT ?, ?, ?, ?, ?', [jobId, phaseName, moment(req.body.startDate).format('YYYY-MM-DD'), moment(req.body.endDate).format('YYYY-MM-DD'), phaseDescription], function (err) {
                                                if (err)
                                                    console.error(err.message)
                                            });
                                        }

                                        return res.status(200).json(createResponse('Success', 31));
                                    }
                                });
                            });
                        });
                    });
                } else {
                    return res.status(403).json(createResponse('FAIL', 69));
                }
            });
        } catch (err) {
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }

    });

/* Update Supervisor Jobs with new enhancement  */
router.post('/supervisor-editJobs/:id', auth, [
        check('description').isLength({
            min: 5
        }).withMessage('Description Must be at least 5 chars long'),
        check('noOfVacancy').isNumeric(),
        check('noOfPhases').isNumeric(),
    ],
    async function (req, res) {
        try {
            var id = req.params.id;
            var user_id = req.user.uid;
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(403).json({
                    request: 'FAIL',
                    errors: utils.createErrorResponse(errors.array())
                });
            }
            // var sk = req.body.skills;
            // var sks = sk.split(",");
            var phaseName = req.body.phaseName;
            var pName = phaseName.split(",");
            var startDate = req.body.startDate;
            var sDate = startDate.split(",");
            var endDate = req.body.endDate;
            var eDate = endDate.split(",");
            var phaseDescription = req.body.phaseDescription;
            var pDescription = phaseDescription.split(",");
            db.query('SELECT jobCode FROM jobs WHERE jobCode=? AND id != ?', [req.body.jobCode, req.params.id], function (err, jobCode) {
                if (jobCode.length == 0) {
                    db.query('SELECT supervisors FROM jobsites WHERE id=?', req.user.SiteId, function (err, supervisors) {
                        sup = supervisors[0].supervisors;
                        if (!(req.body.workingHoursPerDay || req.body.workingDayPerWeek)) {
                            var data = {
                                siteId: req.user.SiteId,
                                jobName: req.body.jobName,
                                jobCode: req.body.jobCode,
                                jobTypeId: req.body.jobType,
                                description: req.body.description,
                                jobPlanner: user_id,
                                jobSupervisor: sup,
                                startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
                                endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
                                createdBy: user_id,
                                createDate: new Date(),
                                experience: '1.2',
                                noOfVacancy: req.body.noOfVacancy,
                                noOfPhases: req.body.noOfPhases,
                            };
                        } else {
                            var data = {
                                siteId: req.user.SiteId,
                                jobName: req.body.jobName,
                                jobCode: req.body.jobCode,
                                jobTypeId: req.body.jobType,
                                description: req.body.description,
                                jobPlanner: user_id,
                                jobSupervisor: sup,
                                startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
                                endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
                                createdBy: user_id,
                                createDate: new Date(),
                                experience: '1.2',
                                noOfVacancy: req.body.noOfVacancy,
                                noOfPhases: req.body.noOfPhases,
                                workingHoursPerDay: req.body.workingHoursPerDay,
                                workingDayPerWeek: req.body.workingDayPerWeek,
                            };
                        }
                        db.query('UPDATE jobs SET ? WHERE id=?', [data, id], function (err, rows) {
                            if (err)
                                res.json({
                                    success: false,
                                    msg: err.message
                                });
                            let w = id.toString(16);
                            w = w.toUpperCase();
                            db.query('DELETE FROM job_skills WHERE job_id = ?', id, function (err) {});
                            /*  if (sks) {
                                 sks.forEach(function (a) {
                                     db.query('INSERT INTO job_skills (job_id, skill_id)VALUES (?, ?)', [id, a], function (err) {});
                                 });
                             } */
                            db.query('DELETE FROM jobphases WHERE jobId = ?', id, function (err) {
                                if (err) {
                                    res.json({
                                        success: false,
                                        msg: err.message
                                    });
                                } else {
                                    if (req.body.noOfPhases > 1) {
                                        for (i = 0; i < req.body.noOfPhases; i++) {
                                            db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT  ?, ?, ?, ?, ?', [id, pName[i], moment(sDate[i]).format('YYYY-MM-DD'), moment(eDate[i]).format('YYYY-MM-DD'), pDescription[i]], function (err) {
                                                if (err)
                                                    res.json({
                                                        success: false,
                                                        msg: err.message
                                                    });
                                            });
                                        }
                                    } else {
                                        var jobId = id;
                                        var phaseName = req.body.jobName + '_Phase1';
                                        var startDate = new Date();
                                        var endDate = req.body.projectEndDate;
                                        var phaseDescription = req.body.description;
                                        db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT ?, ?, ?, ?, ?', [jobId, phaseName, moment(req.body.startDate).format('YYYY-MM-DD'), moment(req.body.endDate).format('YYYY-MM-DD'), phaseDescription], function (err) {
                                            if (err)
                                                res.json({
                                                    success: false,
                                                    msg: err.message
                                                });
                                        });
                                    }
                                    return res.status(200).json(createResponse('Success', 68));
                                }
                            });
                        });
                    });
                } else {
                    return res.status(403).json(createResponse('FAIL', 69));
                }
            });
        } catch (err) {
            console.error(err.message);
            return res.status(500).json(createResponse('Success', 0));
        }
    });

/* GET user list to view on Map View */
router.get('/supervisor-techMapView', auth, function (req, res) {
    try {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.phone_number, u.latitude, u.longitude, j.type_name, GROUP_CONCAT(jobName) as jobName, GROUP_CONCAT(jobCode) as jobCode, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.siteId=? AND uj.isCurrentJob=1 GROUP by u.id`, req.user.SiteId, function (err, usersList) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (usersList.length == 0)
                return res.status(404).json(createResponse('NOT FOUND', 48));
            res.status(200).json({
                data: usersList
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }

});

/* GET to initiate timesheet */
router.get('/supSiteList', auth, function (req, res) {
    try {
        db.query('SELECT site_id as id, js.siteName from user_sites JOIN jobsites js ON (user_sites.site_id=js.id) where user_id = ? and is_current=1', req.user.uid, function (err, row) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            res.status(200).json({
                supervisorList: row,
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* POST to initiate timesheet */
router.post('/supReportInTime', auth, function (req, res) {
    try {
        var supId = req.user.uid;
        var jobId = req.body.jobId;
        var inputTime = req.body.inTime;

        db.query('SELECT id, planner FROM jobsites where id=(select siteId from jobs where id = ?)', jobId, function (err, row) {
            if (jobId) {
                var data = {
                    supId: supId,
                    siteId: row[0].id,
                    jobId: jobId,
                    plannerId: row[0].planner,
                    inTime: inputTime,
                    date: moment(new Date()).format('YYYY-MM-DD'),
                    active: 1,
                    status: 7
                };
                var h = 0;
                var date = data.date;
                db.query('SELECT id, supId, siteId, inTime, outTime, date FROM supervisor_taskreporting where supId=? AND jobId=? AND date=? AND outTime IS NOT NULL', [supId, jobId, date], function (err, find) {
                    find.forEach(function (a) {
                        var inTime = a.inTime;
                        var outTime = a.outTime;
                        if (checkInHours(inTime, outTime, inputTime) == 1) {
                            h++;
                        }


                    })
                    if (h != 0) {
                        return res.status(403).json(createResponse('FAIL', 96));
                    } else {
                        db.query('SELECT supId FROM supervisor_taskreporting where supId="' + supId + '" AND outTime IS NULL AND jobId=?', jobId, function (err, rows) {
                            if (rows[0]) {
                                return res.status(403).json(createResponse('FAIL', 15));
                            } else {
                                db.query('INSERT INTO supervisor_taskreporting SET ?', data, function (err, rows, fields) {

                                    if (err)
                                        console.error(err.message)
                                    return res.status(200).json(createResponse('Success', 18));
                                });
                            }
                        });
                    }

                });

            } else {
                return res.status(403).json(createResponse('FAIL', 97));
            }
        });

    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }
});

/* GET to view supervisor timesheet list */
router.get('/view-timeSheet', auth, function (req, res) {
    try {
        var q= db.query('SELECT st.id, st.supId, st.siteId, st.plannerId,  st.date, st.inTime, IFNULL(st.outTime, "") AS outTime, IFNULL(st.description, "") AS description, IFNULL(st.hours_count, "") AS hours_count, st.status, IFNULL(st.attachment, "") AS attachment, st.active, u.firstName, s.statusName, IF(st.status = "5", CONCAT(p.firstName, " ", p.lastName),"") AS approvedBy, j.jobName As siteName FROM supervisor_taskreporting AS st join users AS u join users AS p join statusname AS s ON(s.id = st.status) JOIN jobs AS j ON(st.siteId = j.id) where st.supId = u.id AND st.plannerId=p.id AND active=1 AND st.supId=? ORDER BY st.date DESC', req.user.uid, function (err, rows) {
            console.log(q.sql)
            if (err)
                console.error(err.message)
            return res.status(200).json({
                data: rows,
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }

});

/* GET to view clockOut sheet based on sites */
router.get('/view-clockOut', auth, function (req, res) {
    try {

        db.query('SELECT site_id as id,js.siteName,(SELECT COUNT(id) FROM supervisor_taskreporting where supId=? AND outTime IS NULL and siteId=js.id) as reportCount from user_sites us JOIN jobsites js ON (us.site_id=js.id) where user_id = ? and is_current=1', [req.user.uid, req.user.uid], function (err, row) {
            if (err)
                console.error(err.message)
            return res.status(200).json({
                list: row,
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }
});

/* GET to view clockOut to enter clockOut time for supervisor on particular supervisor site */
router.get('/clockOut/:id', auth, function (req, res) {
    try {
        var supId = req.user.uid;
        var jobId = req.params.id;
        if (jobId) {
            db.query('SELECT id, inTime, jobId, date FROM supervisor_taskreporting where supId="' + supId + '" AND outTime IS NULL AND jobId=?', jobId, function (err, rows) {
                if (rows.length == 0) {
                    if (err)
                        console.error(err.message)
                    return res.status(403).json(createResponse('FAIL', 94));
                } else {
                    return res.status(200).json({
                        reports: rows[0],
                    });
                }
            });
        } else {
            return res.status(403).json(createResponse('FAIL', 97));
        }
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }
});

/* POST particular user job report */
router.post('/clockOut', auth, function (req, res) {
    try {
        var supId = req.user.uid;
        var jobId = req.body.jobId;

        if (!req.files) {
            var data = {
                supId: supId,
                date: moment(new Date()).format('YYYY-MM-DD'),
                outTime: req.body.outTime,
                description: req.body.description,
                status: 0,
                active: 1
            };
        } else {
            if (req.files.attachment.mimetype == "image/jpeg" || req.files.attachment.mimetype == "image/JPEG" || req.files.attachment.mimetype == "image/png" || req.files.attachment.mimetype == "image/PNG" || req.files.attachment.mimetype == "image/gif" || req.files.attachment.mimetype == "image/GIF" || req.files.attachment.mimetype == "image/pdf" || req.files.attachment.mimetype == "image/PDF" || req.files.attachment.mimetype == "image/jpg" || req.files.attachment.mimetype == "image/JPG") {
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
                    status: 0,
                    active: 1
                };
                imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {});
            } else {
                return res.status(403).json(createResponse('FAIL', 9));
            }
        }
        db.query('SELECT id, inTime FROM supervisor_taskreporting where supId="' + supId + '" AND outTime IS NULL AND jobId = ?', jobId, function (err, rows) {
            if (rows.length == 0) {
                var id = rows[0].id;
                return res.status(403).json(createResponse('FAIL', 98));
            } else {
                var id = rows[0].id;
                var countHourTime = countHours(rows[0].inTime, req.body.outTime);
                // var checkCountHourTime = checkCountHours(rows[0].inTime, req.body.outTime);
                data.hours_count = countHourTime;
                /* if (checkCountHourTime == 0) {
                    return res.status(403).json(createResponse('FAIL', 88));
                } */
                db.query('UPDATE supervisor_taskreporting SET ? where id = ?', [data, id], function (err) {
                    if (err)
                        console.error(err.message)
                    return res.status(200).json(createResponse('Success', 18));
                });
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }
});

/* GET to delete supervisor time report */
router.get('/supDeleteReport/:id', auth, function (req, res) {
    try {
        db.query('UPDATE supervisor_taskreporting SET active=0 WHERE id=?', req.params.id, function (err, rows) {
            if (err)
                console.error(err.message)
            return res.status(200).json(createResponse('Success', 99));
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))

    }
});

/* Get to edit supervisor time report */
router.get('/supEditReport/:id', auth, function (req, res) {
    try {
        db.query('SELECT id, supId, siteId, jobId, plannerId, IFNULL(approvedBy, "") AS approvedBy, date, inTime, outTime, IFNULL(description, "") AS description, hours_count, status, IFNULL(attachment, "") AS attachment, active FROM supervisor_taskreporting WHERE id = ?', req.params.id, function (err, rows) {
            if (err)
                console.error(err.message)
            return res.status(200).json({
                data: rows
            });
        });

    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))

    }
});

/* POST to update supervisor time report */
router.post('/supEditReport/:id', auth, function (req, res) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const validationErrors = errors.array();
            let errorMessages = [];
            validationErrors.forEach(function (row) {
                errorMessages.push(row.msg);
            })
            req.flash('msg_error', errorMessages);
        } else {
            var supId = req.user.uid;
            var countHourTime = countHours(req.body.inTime, req.body.outTime);
            /* var checkCountHourTime = checkCountHours(req.body.inTime, req.body.outTime);
            if (checkCountHourTime == 0) {
                return res.status(403).json(createResponse('FAIL', 88))
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
                    return res.status(403).json(createResponse('FAIL', 9))
                }
            }
            var a = db.query('SELECT supId, status FROM supervisor_taskreporting WHERE id = ?', req.params.id, function (err, rows) {
                console.log(a.sql, 'qqqq')
                if (rows[0].supId == supId && rows[0].status == 0) {
                    db.query('SELECT id FROM supervisor_taskreporting where supId="' + supId + '"', function (err, row) {
                        if (row.length != 0) {
                            db.query('UPDATE supervisor_taskreporting SET ? WHERE id = ? ', [data, req.params.id],
                                function (err) {
                                    if (err)
                                        console.error(err.message)
                                    return res.status(200).json(createResponse('Success', 100))
                                });
                        } else {
                            return res.status(403).json(createResponse('FAIL', 98))
                        }
                    });
                } else {
                    return res.status(403).json(createResponse('FAIL', 22))
                }
            });
        }
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))

    }

});

/***********************Allow for multiple sites****************************/
/* GET Manage-sites */
router.get('/newManageSites', auth, function (req, res) {
    try {
        db.query('SELECT id, siteName, sitesCode, description, newAddress, createDate,us.user_id FROM jobsites js join user_sites us ON (js.id=us.site_id) WHERE us.is_current=1 and us.user_role=3 and us.user_id=?  ', req.user.uid, function (err, rows) {
            if (err)
                console.error(err.message)
            if (rows.length != 0) {
                res.status(200).json({
                    data: rows
                });

            } else {
                return res.status(403).json(createResponse('FAIL', 105))
            }
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))

    }
});

/* GET View Manage-site */
router.get('/view-sites/:id', auth, function (req, res) {
    var id = req.params.id;
    try {
        db.query(`SELECT jobsites.id, jobsites.siteName, jobsites.sitesCode, jobsites.description, jobsites.newAddress, jobsites.createDate, (SELECT CONCAT(firstName, " ", lastName) from users JOIN user_sites ON (users.id = user_sites.user_id) WHERE user_sites.user_role=3 AND user_sites.is_current=1 AND user_sites.jobType=1 AND user_sites.site_id=jobsites.id) AS mname,(SELECT CONCAT(firstName, " ", lastName) from users JOIN user_sites ON (users.id = user_sites.user_id) WHERE user_sites.user_role=3 AND user_sites.is_current=1 AND user_sites.jobType=2 AND user_sites.site_id=jobsites.id) AS ename FROM jobsites WHERE jobsites.id=?`, id, function (err, rows) {
            for (var i = 0; i < rows.length; i++) {
                if (rows[i].mname)
                    rows[i].name = rows[i].mname;
                if (rows[i].ename)
                    rows[i].name = rows[i].ename;
                if (rows[i].ename && rows[i].mname)
                    rows[i].name = rows[i].ename + '/' + rows[i].mname;
            };
            db.query('SELECT id, jobCode, jobName, noOfPhases, endDate FROM jobs WHERE siteId=? ORDER BY createDate DESC limit 5', id, function (err, list) {
                if (err)
                    console.error(err.message)
                res.status(200).json({
                    location_profile: {
                        "id": rows[0].id,
                        "siteName": rows[0].siteName,
                        "sitesCode": rows[0].sitesCode,
                        "description": rows[0].description,
                        "createDate": rows[0].createDate,
                        "supervisors": rows[0].supervisors,
                        "name": rows[0].name,
                        "NewAddress": rows[0].newAddress,
                        "latitude": rows[0].latitude,
                        "longitude": rows[0].longitude
                    },
                    list: list
                });
            });
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))

    }
});

/* router.post('/newCreateProject/:id', auth, [
        check('description').isLength({
            min: 5
        }).withMessage('Description Must be at least 5 chars long'),
        check('noOfVacancy').isNumeric(),
        check('noOfPhases').isNumeric(),
    ],
    async function (req, res) {
        console.log(req.body,'bodyyyyyy')
        var id = req.params.id;
        var user = req.user;
        var user_id = user.uid;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                message: utils.createErrorResponse(errors.array())
            });
        }
        try {
            if (req.user.SiteId == null) {
                return res.status(403).json(createResponse('FAIL', 30));
            } else {
                // var sk = req.body.skills;
                // var sks = sk.split(",");
                var phaseName = req.body.phaseName;
                var pName = phaseName.split(",");
                var startDate = req.body.startDate;
                var sDate = startDate.split(",");
                var endDate = req.body.endDate;
                var eDate = endDate.split(",");
                var phaseDescription = req.body.phaseDescription;
                var pDescription = phaseDescription.split(",");
                var a = db.query('SELECT jobCode FROM jobs WHERE jobCode=?', req.body.jobCode, function (err, jobCode) {
                    console.log(a.sql,'aaaaaa')
                    if (jobCode.length == 0) {
                        var b = db.query('SELECT planner FROM jobsites WHERE id=?', id, function (err, supervisors) {
                            console.log(b.sql,'bbbbbbb')
                            var c = db.query('SELECT jobType FROM users WHERE id = ?', req.user.uid, function (err, jobType) {
                                console.log(c.sql,'aaaaaa')
                                let sup;
                                sup = req.user.uid;
                                var jobType = jobType[0].jobType;
                                var data = {
                                    siteId: req.user.SiteId,
                                    jobName: req.body.jobName,
                                    jobCode: req.body.jobCode,
                                    // jobTypeId: req.body.jobType,
                                    jobTypeId: jobType,
                                    description: req.body.description,
                                    jobPlanner: user_id,
                                    jobSupervisor: sup,
                                    startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
                                    endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
                                    createdBy: user_id,
                                    createDate: new Date(),
                                    experience: '1.2',
                                    noOfVacancy: req.body.noOfVacancy,
                                    noOfPhases: req.body.noOfPhases,
                                    days_count: req.body.days_count,
                                    proposed_budget: req.body.proposed_budget,
                                    workingHoursPerDay: req.body.workingHoursPerDay,
                                    workingDayPerWeek: req.body.workingDayPerWeek,
                                };
                                console.log(data,'data')
                                var d = db.query('SELECT INTO jobs SET ?', data, function (err, rows) {
                                    console.log(d.sql,'dddddddddd')
                                    var q = db.query('INSERT INTO jobs SET ?', data, function (err, rows) {
                                        console.log(q.sql,'qqqqqqqqqqqqq')
                                        if (err)
                                            console.error(err.message)
                                        var id = q._results[0]['insertId'];
                                        let w = id.toString(16);
                                        w = w.toUpperCase();
                                        var userCode = 'JOB_' + w;
                                        // if (sks) {
                                        //     sks.forEach(function (c) {
                                        //         db.query('INSERT INTO job_skills(job_id, skill_id)VALUES (?, ?)', [id, c]);
                                        //     });
                                        // }
                                        var i = db.query('UPDATE jobs SET jobCodeCpy= ? WHERE id =?', [userCode, id], function (err) {
                                            console.log(i.sql,'wwwwwwwww')
                                            if (err) {
                                                db.query('DELETE FROM jobs where id= ?', id);
                                                console.error(err.message);
                                                return res.status(500).json(createResponse('FAIL', 0));
                                            } else {
                                                if (req.body.noOfPhases > 1) {
                                                    for (i = 0; i < req.body.noOfPhases; i++) {
                                                        var e = db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT  ?, ?, ?, ?, ?', [id, pName[i], moment(sDate[i]).format('YYYY-MM-DD'), moment(eDate[i]).format('YYYY-MM-DD'), pDescription[i]], function (err) {
                                                            console.log(e.sql,'eeeeeeeee')
                                                            if (err)
                                                                console.error(err.message)
                                                        });
                                                    }
                                                } else {
                                                    var jobId = id;
                                                    var phaseName = req.body.jobName + '_Phase1';
                                                    var startDate = new Date();
                                                    var endDate = req.body.projectEndDate;
                                                    var phaseDescription = req.body.description;
                                                    var r = db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT ?, ?, ?, ?, ?', [jobId, phaseName, moment(req.body.startDate).format('YYYY-MM-DD'), moment(req.body.endDate).format('YYYY-MM-DD'), phaseDescription], function (err) {
                                                        console.log(r.sql,'rrrrrrrrr')
                                                        if (err)
                                                            console.error(err.message)
                                                    });
                                                }

                                                return res.status(200).json(createResponse('Success', 31));
                                            }
                                        });
                                    });
                                });
                            });
                        });
                    } else {
                        return res.status(403).json(createResponse('FAIL', 69));
                    }
                });

            }
        } catch (err) {
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }

    }); */

router.post('/newCreateProject/:id', auth, [
        check('description').isLength({
            min: 5
        }).withMessage('Description Must be at least 5 chars long'),
        check('noOfVacancy').isNumeric(),
        check('noOfPhases').isNumeric(),
    ],
    async function (req, res) {
        console.log(req.body, 'bodyyyyyy')
        var id = req.params.id;
        var user = req.user;
        var user_id = user.uid;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                message: utils.createErrorResponse(errors.array())
            });
        }
        try {
            var phaseName = req.body.phaseName;
            var pName = phaseName.split(",");
            var startDate = req.body.startDate;
            var sDate = startDate.split(",");
            var endDate = req.body.endDate;
            var eDate = endDate.split(",");
            var phaseDescription = req.body.phaseDescription;
            var pDescription = phaseDescription.split(",");
            var a = db.query('SELECT jobCode FROM jobs WHERE jobCode=?', req.body.jobCode, function (err, jobCode) {
                console.log(a.sql, 'aaaaaa')
                if (jobCode.length == 0) {
                    var b = db.query('SELECT planner FROM jobsites WHERE id=?', id, function (err, supervisors) {
                        console.log(b.sql, 'bbbbbbb')
                        var c = db.query('SELECT jobType FROM users WHERE id = ?', req.user.uid, function (err, jobType) {
                            console.log(c.sql, 'aaaaaa')
                            let sup;
                            sup = req.user.uid;
                            var jobType = jobType[0].jobType;
                            if (!(req.body.workingHoursPerDay || req.body.workingDayPerWeek)) {
                                var data = {
                                    siteId: id,
                                    jobName: req.body.jobName,
                                    jobCode: req.body.jobCode,
                                    // jobTypeId: req.body.jobType,
                                    jobTypeId: jobType,
                                    description: req.body.description,
                                    jobPlanner: supervisors[0].planner,
                                    jobSupervisor: sup,
                                    startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
                                    endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
                                    createdBy: user_id,
                                    createDate: new Date(),
                                    experience: '1.2',
                                    noOfVacancy: req.body.noOfVacancy,
                                    noOfPhases: req.body.noOfPhases,
                                    days_count: req.body.days_count,
                                    proposed_budget: req.body.proposed_budget,
                                };
                                console.log(data, 'ifffffff')
                            } else{

                                var data = {
                                    siteId: id,
                                    jobName: req.body.jobName,
                                    jobCode: req.body.jobCode,
                                    // jobTypeId: req.body.jobType,
                                    jobTypeId: jobType,
                                    description: req.body.description,
                                    jobPlanner: supervisors[0].planner,
                                    jobSupervisor: sup,
                                    startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
                                    endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
                                    createdBy: user_id,
                                    createDate: new Date(),
                                    experience: '1.2',
                                    noOfVacancy: req.body.noOfVacancy,
                                    noOfPhases: req.body.noOfPhases,
                                    days_count: req.body.days_count,
                                    proposed_budget: req.body.proposed_budget,
                                    workingHoursPerDay: req.body.workingHoursPerDay,
                                    workingDayPerWeek: req.body.workingDayPerWeek,
                                };
                                console.log(data, 'else')
                            }
                            var d = db.query('SELECT INTO jobs SET ?', data, function (err, rows) {
                                console.log(d.sql, 'dddddddddd')
                                var q = db.query('INSERT INTO jobs SET ?', data, function (err, rows) {
                                    console.log(q.sql, 'qqqqqqqqqqqqq')
                                    if (err)
                                        console.error(err.message)
                                    var id = q._results[0]['insertId'];
                                    let w = id.toString(16);
                                    w = w.toUpperCase();
                                    var userCode = 'JOB_' + w;
                                    // if (sks) {
                                    //     sks.forEach(function (c) {
                                    //         db.query('INSERT INTO job_skills(job_id, skill_id)VALUES (?, ?)', [id, c]);
                                    //     });
                                    // }
                                    var i = db.query('UPDATE jobs SET jobCodeCpy= ? WHERE id =?', [userCode, id], function (err) {
                                        console.log(i.sql, 'wwwwwwwww')
                                        if (err) {
                                            db.query('DELETE FROM jobs where id= ?', id);
                                            console.error(err.message);
                                            return res.status(500).json(createResponse('FAIL', 0));
                                        } else {
                                            if (req.body.noOfPhases > 1) {
                                                for (i = 0; i < req.body.noOfPhases; i++) {
                                                    var e = db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT  ?, ?, ?, ?, ?', [id, pName[i], moment(sDate[i]).format('YYYY-MM-DD'), moment(eDate[i]).format('YYYY-MM-DD'), pDescription[i]], function (err) {
                                                        console.log(e.sql, 'eeeeeeeee')
                                                        if (err)
                                                            console.error(err.message)
                                                    });
                                                }
                                            } else {
                                                var jobId = id;
                                                var phaseName = req.body.jobName + '_Phase1';
                                                var startDate = new Date();
                                                var endDate = req.body.projectEndDate;
                                                var phaseDescription = req.body.description;
                                                var r = db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT ?, ?, ?, ?, ?', [jobId, phaseName, moment(req.body.startDate).format('YYYY-MM-DD'), moment(req.body.endDate).format('YYYY-MM-DD'), phaseDescription], function (err) {
                                                    console.log(r.sql, 'rrrrrrrrr')
                                                    if (err)
                                                        console.error(err.message)
                                                });
                                            }

                                            return res.status(200).json(createResponse('Success', 31));
                                        }
                                    });
                                });
                            });
                        });
                    });
                } else {
                    return res.status(403).json(createResponse('FAIL', 69));
                }
            });


        } catch (err) {
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }

    });

/* GET ALL JOBS ON VIEW SITES PAGE*/
router.get('/newViewJobs/:id', auth, function (req, res) {
    var id = req.params.id;
    var suid = req.user.uid;
    try {
        db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, jobType FROM users WHERE id=?', suid, function (err, jobType) {
            var jobType = jobType[0].jobType;
            db.query('SELECT js.id as jobSiteId, js.siteName, js.sitesCode, j.id AS jobId, j.status As jobStatus, j.jobCode, j.jobName, j.noOfVacancy, j.predicated_budget, j.noOfPhases, j.startDate, j.endDate, j.createdBy, j.days_count, j.workingHoursPerDay, j.workingDayPerWeek, (SELECT GROUP_CONCAT(id) FROM designation WHERE job_type=j.jobTypeId) AS des_id, (SELECT GROUP_CONCAT(designation_name) FROM designation WHERE job_type=j.jobTypeId) AS des_name, (SELECT COUNT(user_id) FROM `users_job` WHERE job_id=jobid AND isCurrentJob=1) AS emp_count FROM jobs AS j LEFT JOIN jobsites AS js ON(js.id=j.siteId) WHERE js.id=? AND j.status=1 AND j.jobTypeId=?', [id, jobType], function (err, list) {
                if (err)
                    console.error(err.message)

                return res.status(200).json({
                    jobList: list,
                    suid: suid
                });
            });
        });

    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }

});

/*Edit Jobs */
router.post('/newEditJobs/:id', auth, [
        check('description').isLength({
            min: 5
        }).withMessage('Description Must be at least 5 chars long'),
        check('noOfVacancy').isNumeric(),
        check('noOfPhases').isNumeric(),
    ],
    async function (req, res) {
        try {
            var id = req.params.id;
            var user_id = req.user.uid;
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(403).json({
                    request: 'FAIL',
                    errors: utils.createErrorResponse(errors.array())
                });
            }
            // var sk = req.body.skills;
            // var sks = sk.split(",");
            var phaseName = req.body.phaseName;
            var pName = phaseName.split(",");
            var startDate = req.body.startDate;
            var sDate = startDate.split(",");
            var endDate = req.body.endDate;
            var eDate = endDate.split(",");
            var phaseDescription = req.body.phaseDescription;
            var pDescription = phaseDescription.split(",");
            console.log(req.body.endDate, 'startingDatesendDate');
            console.log(req.body.startDate, 'startingDatesstartDate');
            var y = db.query('SELECT siteId FROM jobs WHERE id = ?', req.params.id, function (err, siteID) {
                console.log(y.sql, 'selecttttttttttttt')
                var SiteId = siteID[0].siteId;
                sup = req.user.uid;
                var data = {
                    siteId: SiteId,
                    jobName: req.body.jobName,
                    jobCode: req.body.jobCode,
                    // jobTypeId: req.body.jobType,
                    // jobTypeId: jobType,
                    description: req.body.description,
                    jobSupervisor: sup,
                    startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
                    endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
                    createdBy: user_id,
                    createDate: new Date(),
                    experience: '1.2',
                    noOfVacancy: req.body.noOfVacancy,
                    noOfPhases: req.body.noOfPhases,
                    days_count: req.body.days_count,
                    proposed_budget: req.body.proposed_budget,
                    workingHoursPerDay: req.body.workingHoursPerDay,
                    workingDayPerWeek: req.body.workingDayPerWeek,
                };
                console.log(data, 'data');
                var a = db.query('UPDATE jobs SET ? WHERE id=?', [data, id], function (err, rows) {
                    if (err)
                        res.json({
                            success: false,
                            msg: err.message
                        });
                    console.log(a.sql, 'UPDATEjobsSET');
                    let w = id.toString(16);
                    w = w.toUpperCase();
                    db.query('DELETE FROM job_skills WHERE job_id = ?', id, function (err) {});

                    db.query('DELETE FROM jobphases WHERE jobId = ?', id, function (err) {
                        if (err) {
                            res.json({
                                success: false,
                                msg: err.message
                            });
                        } else {
                            if (req.body.noOfPhases > 1) {
                                for (i = 0; i < req.body.noOfPhases; i++) {
                                    var a1 = db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT  ?, ?, ?, ?, ?', [id, pName[i], moment(sDate[i]).format('YYYY-MM-DD'), moment(eDate[i]).format('YYYY-MM-DD'), pDescription[i]], function (err) {
                                        console.log(a1.sql, 'INSERTINTOjobphasesIFF');
                                        if (err)
                                            console.error(err.message)
                                    });
                                }
                            } else {
                                var jobId = id;
                                var phaseName = req.body.jobName + '_Phase1';
                                var startDate = new Date();
                                var endDate = req.body.projectEndDate;
                                var phaseDescription = req.body.description;
                                console.log(req.body.proposedEndDate, 'endDate');
                                console.log(req.body.proposedStartDate, 'startDate');
                                var b = db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT ?, ?, ?, ?, ?', [jobId, phaseName, moment(req.body.proposedStartDate).format('YYYY-MM-DD'), moment(req.body.proposedEndDate).format('YYYY-MM-DD'), phaseDescription], function (err) {
                                    console.log(b.sql, 'INSERTINTOjobphasesELSE');
                                    if (err)
                                        console.error(err.message)
                                });
                            }
                            console.log(2);
                            return res.status(200).json(createResponse('Success', 68));
                        }
                    });
                });

            });
        } catch (err) {
            console.log(3);
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }
    });

/* GET to view supervisor projects list */
router.get('/supProjectList', auth, function (req, res) {
    try {
        var userId = req.user.uid;
        db.query('SELECT j.id as jobId, j.jobName, j.startDate, j.endDate FROM jobs AS j WHERE j.jobSupervisor=?', userId, function (err, rows) {
            if (rows.length != 0) {
                return res.status(200).json({
                    data: rows,
                });
            } else {
                return res.status(403).json(createResponse('FAIL', 14));
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

module.exports = router;