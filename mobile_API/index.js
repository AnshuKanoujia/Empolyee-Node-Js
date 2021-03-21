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
// const URL = require('url').Url;
var request = require("request");
const auth = require('./middleware/auth');
const planner = require('./middleware/planner');
const createResponse = require("./libraries/response");
const utils = require("./libraries/utils");
// Load input validation
const validateLoginInput = require("../validation/login");
// var distance = require('google-distance');
// distance.apiKey = 'AIzaSyCgUP8KQ_skTDXdPTWbDo1IEG2BhkKzk2I';
const {
    check,
    validationResult
} = require('express-validator');
var md5 = require('md5');

function countHours(inTime, outTime) {
    var startTime = moment(inTime, "MM/DD/YYYY HH:mm:ss a");
    var endTime = moment(outTime, "MM/DD/YYYY HH:mm:ss a");

    /*  var duration = moment.duration(endTime.diff(startTime));
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

    // var time = moment() gives you current time. no format required.
    var time = moment(inputTime, format),
        // beforeTime = moment('08:34:00', format),
        // afterTime = moment('10:34:00', format);
        beforeTime = moment(inTime, format),
        afterTime = moment(outTime, format);

    if (time.isBetween(beforeTime, afterTime)) {

        return 1;


    } else {

        return 0;

    }
}


/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', {
        title: 'Express',
        layout: 'layout/home-layout.jade'
    });
});

/* API SignIn */
router.post('/signup', function (req, res) {
    let resetCode = crypto.randomBytes(20).toString("hex");
    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(req.body.password, salt, (err, hash) => {
            var data = {
                firstName: req.body.fname,
                lastName: req.body.lname,
                email: req.body.email,
                password: hash,
                resetCode: resetCode,
                role: '1',
                createdAt: new Date()
            };
            db.query('select email from users where email="' + data.email + '"', function (err, rows) {
                if (rows.length == 0) {
                    var q = db.query('INSERT INTO users SET ?', data, function (err, rows, fields) {
                        if (err)
                            console.error(err.message)
                        var id = q._results[0]['insertId'];
                        let w = id.toString(16);
                        var userCode = 'TECH_' + w;
                        db.query('UPDATE users SET eCode= ? WHERE id =?', [userCode, id], function (err) {
                            if (err) {
                                db.query('DELETE FROM users where id= ?', id)
                                res.status(403);
                                return res.json(createResponse("FAIL", 5));
                            }
                        });

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

                        // setup e-mail data with unicode symbols
                        var mailOptions = {
                            from: "test.augurs@gmail.com", // sender address
                            to: req.body.email, // list of receivers
                            subject: "Technician Registration", // Subject line
                            generateTextFromHTML: true,
                            html: "Welcome to the Portal,<br>Please verify your E-mail by clicking on following link <br>" + "http://localhost:4000/verify-email/" + resetCode + "<br/><br/>" + " <br>Please access the portal with these details your email is: <b>" + req.body.email + "</b> and your password: <b>" + req.body.password + "</b><br>Please complete provide the complete details, in edit profile in your dashboard in order to increase your chances for the job, Incomplete profiles won't be entertained.<br>Thank you." // html body
                        }
                        // send mail with defined transport object
                        transporter.sendMail(mailOptions, function (err, info) {
                            if (err)
                                console.error(err.message)
                            else
                                console.error(err.message)
                        });

                        res.status(200);
                        return res.json(createResponse("SUCCESS", 4));
                    });
                } else {
                    res.status(403);
                    return res.json(createResponse("FAIL", 6));
                }
            })
        });
    });
});

/* API Login */
router.post('/signin', function (req, res) {
    res.header("Access-Control-Allow-Origin", "*");
    const {
        errors,
        isValid
    } = validateLoginInput(req.body);

    if (!isValid) {
        return res.status(403).json({
            request: 'FAIL',
            errors
        });
    }

    var email = req.body.email;
    // let currSiteId = 0;
    const password = req.body.password;

    email = email.toLowerCase();
    email = email.trim();
    console.log(req.body)
    db.query('select email, password, status, profileImg, id, role, firstName,(SELECT site_id FROM user_sites WHERE user_id=users.id AND is_current=1 GROUP BY user_id) as currSiteId from users where email="' + email + '"', function (err, rows) {
        //Add login details
		var data = {
			email: email,
            deviceType: req.body.deviceType,
            IpAddress: req.body.IpAddress,
			osName: 'App',
            uniqueId: req.body.uniqueId
		};
        if (err)
            res.json({
                success: false,
                msg: err.message
            });
        if (rows.length <= 0) {
            data.status = 'Fail';
			db.query('INSERT INTO login_details SET ?', data, function (err, rows, fields) {
				if (err)
					console.error(err.message)
			});
            res.status(403);
            return res.json(createResponse("FAIL", 1));
        } else if (rows[0].status != 1) {
            data.status = 'Fail';
			db.query('INSERT INTO login_details SET ?', data, function (err, rows, fields) {
				if (err)
					console.error(err.message)
			});
            res.status(403)
            return res.json(createResponse("FAIL", 20));
        } else {
            bcrypt.compare(password, rows[0].password, function (err, isMatch) {
                if (isMatch) {
                    data.status = 'Success';
					var q = db.query('INSERT INTO login_details SET ?', data, function (err, rows, fields) {
                        console.log(q.sql)
						if (err)
							console.error(err.message)
					});
                    // Sign token
                    const payload = {
                        uid: rows[0].id,
                        firstName: rows[0].firstName,
                        lastName: rows[0].lastName,
                        role: rows[0].role,
                        profileImg: rows[0].profileImg,
                        SiteId: rows[0].currSiteId,

                    };
                    db.query('SELECT IFNULL(GROUP_CONCAT(skill_id),"") as skills_id,IFNULL(u.phone_number,"") AS phone_number, u.profileImg, IFNULL(u.firstName,"") AS firstName , IFNULL(u.lastName,"") AS lastName, u.dob,IFNULL(u.email,"") AS email,IFNULL(u.experience,"") AS experience, u.skills, IFNULL(u.jobType,"") AS jobType,IFNULL(u.country,"") AS country ,IFNULL(u.state,"") AS state , IFNULL(u.city,"") AS city , IFNULL(u.address,"") AS address , us.user_id, IFNULL(us.skill_id,"") AS skill_id FROM users as u JOIN user_skills as us ON (u.id = us.user_id) WHERE u.id=?', rows[0].id, function (err, rows_data) {
                        // Sign token
                        jwt.sign(
                            payload,
                            config.get("jwtSecret"), {
                                expiresIn: 3155692600 //31556926
                            },
                            (err, token) => {
                                return res.status(200).json({
                                    profile: {
                                        uid: rows[0].id,
                                        firstName: rows[0].firstName,
                                        lastName: rows[0].lastName,
                                        role: rows[0].role,
                                        profileImg: rows[0].profileImg,
                                        SiteId: rows[0].currSiteId,
                                    },

                                    get_profile: {
                                        "basicProfile": {
                                            'firstName': rows_data[0].firstName,
                                            'lastName': rows_data[0].lastName,
                                            'phone number': rows_data[0].phone_number ? rows_data[0].phone_number : "",
                                            'email': rows_data[0].email,
                                            'birthday': rows_data[0].dob ? moment(new Date(rows_data[0].dob)).format("YYYY-MM-DD") : "",
                                            'experience': rows_data[0].experience,
                                            'imageUrl': rows_data[0].profileImg ? config.get("appUrl") + 'uploads/profile_img' + '/' + rows_data[0].profileImg.trim() : "",
                                            'skills': rows_data[0].skills_id,
                                            'country': rows_data[0].country,
                                            'state': rows_data[0].state,
                                            'city': rows_data[0].city,
                                            'Address': rows_data[0].address,
                                            'jobType': rows_data[0].jobType
                                        }
                                    },

                                    accessToken: token
                                });
                            }

                        );
                    });

                } else {
                    data.status = 'Fail';
					db.query('INSERT INTO login_details SET ?', data, function (err, rows, fields) {
						if (err)
							console.error(err.message)
					});
                    res.status(403);
                    return res.json(createResponse("FAIL", 2));
                }
            })

        }
    })

});

/* API forget-password */
router.post('/forgot-password', function (req, res) {
    let {
        email
    } = req.body;
    let resetCode = crypto.randomBytes(20).toString('hex');
    email = email.toLowerCase();
    email = email.trim();
    db.query('select email from users where email="' + email + '"', function (err, rows) {
        if (rows.length == 0) {
            // req.flash('msg_error', "The email address was not recognized. Please try again");
            return res.json({
                message: `User ${email} Not Found`
            });
            // res.redirect('/forget-password');
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
                        "Please click on the following link to complete the process within one hour of receiving it:<br/><br/>" + config.appUrl +
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
                res.status(200);
                return res.json(createResponse("SUCCESS", 3));
            });
        }
    })
})

/* API Send verification mail to user*/
router.post('/send-verification', function (req, res) {
    let {
        uid
    } = req.body;
    let resetCode = crypto.randomBytes(20).toString('hex');

    db.query('select email from users where id="' + uid + '"', function (err, rows) {
        if (rows.length == 0) {
            res.status(403);
            return res.json(createResponse("FAIL", 8));
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
                res.status(403);
                return res.json(createResponse("FAIL", 7));

            });
        }
    });
});

/* GET Logout */
router.get('/logout', function (req, res) {
    res.status(200);
    return res.json({});
});
//.........start Api 05-09-2019..............................................

/* GET get country */
router.get('/get-country', function (req, res, next) {
    try {
        db.query('SELECT id, name FROM countries', function (err, country) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            res.status(200).json({
                data: country
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/* GET get state */
router.get('/get-state/:country_id', function (req, res, next) {
    try {
        var country = req.params.country_id;
        db.query('SELECT id, name FROM states where country_id = ?', country, function (err, states) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            res.status(200).json({
                data: states
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/* GET get city */
router.get('/get-city/:state_id/:country_id', function (req, res, next) {
    try {
        var state = req.params.state_id;
        var country_id = req.params.country_id;

        db.query('SELECT id, name FROM cities where state_id = ? AND country_id =?', [state, country_id], function (err, city) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            res.status(200).json({
                data: city
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* GET get skill */
// router.get('/get-skill', function (req, res, next) {
//  try {
//      db.query('SELECT id, skill_name FROM skills', function (err, skill) {
//          if (err)
//              res.json({
//                  success: false,
//                  msg: err.message
//              });
//          res.status(200).json({
//              data: skill
//          });
//      });
//  } catch (err) {
//      console.error(err.message);
//      return res.status(500).json(createResponse('FAIL', 0));
//  }
// });

/* GET get skill */
router.get('/get-skill/:jobType_id', function (req, res, next) {
    /*Enabling CORS domain requests */
    res.header("Access-Control-Allow-Origin", "*");
    try {
        var id = req.params.jobType_id;
        db.query('SELECT id,skill_name as name FROM skills where job_type_id= ?', id, function (err, skill) {

            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            res.status(200).json({
                data: skill
            });

        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* GET get job type */
router.get('/get-jobType', function (req, res, next) {
    try {
        db.query('SELECT id, type_name FROM jobtype WHERE active=1', function (err, jobtype) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            res.status(200).json({
                data: jobtype
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* GET get user profile */
router.get('/get-userProfile', auth, function (req, res) {
    try {
        var user = req.user;
        var userId = user.uid;
        db.query('SELECT IFNULL(GROUP_CONCAT(skill_id),"") as skills_id, IFNULL(u.phone_number,"") AS phone_number, IFNULL(u.preferredName,"") AS preferredName, u.profileImg, IFNULL(u.firstName,"") AS firstName , IFNULL(u.lastName,"") AS lastName, u.dob,IFNULL(u.email,"") AS email,IFNULL(u.experience,"") AS experience, u.skills, IFNULL(u.jobType,"") AS jobType,IFNULL(u.country,"") AS country ,IFNULL(u.state,"") AS state , IFNULL(u.city,"") AS city , IFNULL(u.address,"") AS address ,IFNULL(u.newAddress,"") AS newAddress ,IFNULL(u.latitude,"") AS latitude ,IFNULL(u.longitude,"") AS longitude , us.user_id, IFNULL(us.skill_id,"") AS skill_id FROM users as u JOIN user_skills as us ON (u.id = us.user_id) WHERE u.id = ?', userId, function (err, rows) {

            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            res.status(200).json({
                "userId": user.uid,
                "profile": {
                    "basicProfile": {
                        'firstName': rows[0].firstName,
                        'lastName': rows[0].lastName,
                        'phone number': rows[0].phone_number,
                        'preferredName': rows[0].preferredName,
                        'email': rows[0].email,
                        'birthday': rows[0].dob ? moment(new Date(rows[0].dob)).format("YYYY-MM-DD") : "",
                        'experience': rows[0].experience,
                        'imageUrl': rows[0].profileImg ? config.get("appUrl") + 'uploads/profile_img' + '/' + rows[0].profileImg.trim() : "",
                        'skills': rows[0].skills_id,
                        'country': rows[0].country,
                        'state': rows[0].state,
                        'city': rows[0].city,
                        'Address': rows[0].address,
                        'NewAddress': rows[0].newAddress,
                        'Latitude': rows[0].latitude,
                        'Longitude': rows[0].longitude,
                        'jobType': rows[0].jobType
                    }
                }

            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* API update user profile */
router.post('/update-userProfile', auth, [
        check('firstName').not().isEmpty().withMessage('Name must have more than 2 characters'),
        check('lastName').not().isEmpty().withMessage('Name must have more than 2 characters'),
        // check('Date of birth is required').not().isEmpty()
    ],
    function (req, res) {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                errors: utils.createErrorResponse(errors.array())
            });
        }
        try {
            var user = req.user;
            var userId = user.uid;
            var sk = req.body.skills;

            var sks = sk.split(",");
            if (!req.files) {
                var data = {
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    dob: moment(req.body.dob).format('MM/DD/YYYY'),
                    address: req.body.address,
                    phone_number: req.body.phone_number,
                    preferredName: req.body.preferredName,
                    jobType: req.body.jobType,
                    experience: parseFloat(req.body.year + '.' + req.body.month),
                    country: req.body.country,
                    state: req.body.state,
                    city: req.body.city
                };
            } else {
                var imageFile = req.files.Img;
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
                        dob: moment(req.body.dob).format('MM/DD/YYYY'),
                        address: req.body.address,
                        phone_number: req.body.phone_number,
                        preferredName: req.body.preferredName,
                        jobType: req.body.jobType,
                        experience: req.body.year + '.' + req.body.month,
                        country: req.body.country,
                        state: req.body.state,
                        city: req.body.city,
                        profileImg: fileName
                    };
                    req.session.profileImg = fileName;
                    imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {});
                } else {
                    res.status(403);
                    return res.json(createResponse("FAIL", 9));
                    req.end();
                }
            }
            db.query('UPDATE users SET ? WHERE id = ? ', [data, userId], function (err, rows) {

                db.query('delete from user_skills where user_id=?', userId);
                // sk.forEach(function (a) {
                sks.forEach(function (a) {
                    db.query('INSERT INTO user_skills (user_id, skill_id)VALUES (?, ?)', [userId, a], function (err) {
                        if (err)
                            res.json({
                                success: false,
                                msg: err.message
                            });
                    });
                })
                res.status(200);
                return res.json(createResponse("Success", 10));
            });
        } catch (err) {
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }
    });

/* add-certificate */
router.post('/add-certificate', auth, [
    check('certification_name').not().isEmpty().withMessage('Certification Name must have required'),
    check('authority').not().isEmpty().withMessage('Authority must have more required'),
    //  check('certificate_attachment', 'Certificate Attachment file is required').not().isEmpty(),
    check('expire_date', 'Your Expire date is required').not().isEmpty(),
], function (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(403).json({
            request: 'FAIL',
            errors: utils.createErrorResponse(errors.array())
        });
    }
    try {
        var user = req.user;
        var userId = user.uid;
        if (!req.files) {
            var data = {
                userId: userId,
                certification_name: req.body.certification_name,
                authority: req.body.authority,
                description: req.body.description,
                exp_date: moment(req.body.expire_date).format('YYYY-MM-DD'),
                active: 1

            };
        } else {
            var imageFile = req.files.certificate_attachment;

            let imageExtension = imageFile.name.split('.');
            if (imageExtension[1] == "jpg" || imageExtension[1] == "JPG" || imageExtension[1] == "jpeg" || imageExtension[1] == "JPEG" || imageExtension[1] == "png" || imageExtension[1] == "PNG" || imageExtension[1] == "pdf" || imageExtension[1] == "PDF") {
                let ext = imageExtension[(imageExtension).length - 1];
                var image = userId + '_' + new Date().toISOString();
                new_image = md5(image);
                new_image = new_image + '.' + ext;
                let fileName = new_image;
                var uploadPath = 'uploads/certificate_attachment';

                var data = {
                    userId: userId,
                    certification_name: req.body.certification_name,
                    authority: req.body.authority,
                    certificate_attachment: fileName,
                    description: req.body.description,
                    exp_date: moment(req.body.expire_date).format('YYYY-MM-DD'),
                    active: 1

                };
                imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {});
            } else {
                res.status(403);
                return res.json(createResponse("FAIL", 9));
                req.end();
            }
        }

        db.query('INSERT INTO certification SET ?', data, function (err, rows, fields) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json(createResponse("Success", 11));
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* GET To view certificate */
router.get('/view-certificate', auth, function (req, res) {
    try {
        var user = req.user;
        var userId = user.uid;
        db.query('SELECT id, certification_name, certificate_attachment, authority, exp_date,description FROM certification where userId=? AND active=1', userId, function (err, rows) {
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

/* edit certificate */
router.post('/edit-certificate/:id', auth, function (req, res) {
    try {

        var user = req.user;
        var userId = user.uid;

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
            var imageFile = req.files.certificate_attachment;
            let imageExtension = imageFile.name.split('.');
            if (imageExtension[1] == "jpg" || imageExtension[1] == "JPG" || imageExtension[1] == "jpeg" || imageExtension[1] == "JPEG" || imageExtension[1] == "png" || imageExtension[1] == "PNG" || imageExtension[1] == "pdf" || imageExtension[1] == "PDF") {
                let ext = imageExtension[(imageExtension).length - 1];
                var image = userId + '_' + new Date().toISOString();
                new_image = md5(image);
                new_image = new_image + '.' + ext;
                let fileName = new_image;
                var uploadPath = 'uploads/certificate_attachment';
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
                res.status(403);
                return res.json(createResponse("FAIL", 9));
                req.end();
            }
        }
        var d = req.body.exp_date;

        db.query('UPDATE certification SET ? WHERE id = ? ', [data, req.params.id], function (err, rows, fields) {
            if (err) {
                console.error(err.message);
                return res.status(500).json(createResponse('FAIL', 0));
            } else {
                return res.status(200).json(createResponse("Success", 12));
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }

});

/* GET To view single certificate */
router.get('/view-singlecertificate/:id', auth, function (req, res, next) {
    try {
        db.query('SELECT id, certification_name, certificate_attachment, authority,exp_date FROM certification where id=? AND active=1', req.params.id, function (err, rows) {
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


/* Delete Certificate */
router.get('/deleteCertificate/:id', auth, function (req, res) {
    try {
        db.query('UPDATE certification SET active=0 WHERE id=?', req.params.id, function (err) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                })
            return res.status(200).json(createResponse('Success', 13));
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});



/* GET to view users job */
router.get('/userJobs', auth, function (req, res) {
    try {
        var user = req.user;
        var userId = user.uid;
        db.query('SELECT j.id as jobId , j.jobName, j.startDate, j.endDate FROM jobs AS j  JOIN users_job AS uj ON(j.id=uj.job_id) WHERE uj.user_id=? AND uj.isCurrentJob=1', userId, function (err, rows) {
            if (rows.length != 0) {
                res.status(200).json({
                    data: rows
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

/*GET to view particular job */
router.get('/view-jobDetails/:id', auth, function (req, res, next) {
    try {
        var id = req.params.id;
        var user = req.user;
        var userId = user.uid;
        // db.query('SELECT jobs.id as jobId, jobs.jobName, jobs.siteId, jobs.startDate, jobs.endDate, jobs.noOfPhases, jobs.jobCode, jobs.description, jobsites.siteName, jobsites.sitesCode,jobsites.newAddress AS address, (SELECT firstName from users WHERE id=jobs.jobSupervisor) AS SupervisorName, (SELECT statusName from statusname WHERE id=jobs.status) AS jobStatus FROM jobs LEFT JOIN jobsites ON (jobsites.id = jobs.siteId) WHERE jobs.id=?', id, function (err, rows) {

        db.query(`SELECT jobs.jobName, jobs.siteId, jobs.startDate, jobs.endDate, jobs.noOfPhases, jobs.jobCode, jobs.description, jobs.experience, jobs.days_count, jobsites.siteName, jobsites.sitesCode, jobsites.newAddress, jobtype.type_name, (SELECT CONCAT(firstName, " ", lastName) from users JOIN user_sites ON (users.id = user_sites.user_id) WHERE user_sites.user_role=3 AND user_sites.is_current=1 AND user_sites.jobType=1 AND user_sites.site_id=jobsites.id) AS mname, (SELECT CONCAT(firstName, " ", lastName) from users JOIN user_sites ON (users.id = user_sites.user_id) WHERE user_sites.user_role=3 AND user_sites.is_current=1 AND user_sites.jobType=2 AND user_sites.site_id=jobsites.id) AS ename, (SELECT statusName from statusname WHERE id=jobs.status) AS jobStatus FROM jobs LEFT JOIN jobsites ON (jobsites.id = jobs.siteId) LEFT JOIN jobtype ON (jobs.jobTypeId = jobtype.id) LEFT JOIN users_job ON (jobsites.id=users_job.siteId) WHERE jobs.id=?`, id, function (err, rows) {

            for (var i = 0; i < rows.length; i++) {
                if (rows[i].mname)
                    rows[i].SupervisorName = rows[i].mname;
                if (rows[i].ename)
                    rows[i].SupervisorName = rows[i].ename;
                if (rows[i].ename && rows[i].mname)
                    rows[i].SupervisorName = rows[i].ename + '/' + rows[i].mname;
            };

            db.query('SELECT id, date, inTime, outTime, (SELECT statusName from statusname WHERE id=taskreporting.status) AS jobStatus FROM taskreporting WHERE userId=? AND active=1 AND status!=7 ORDER BY date DESC limit 5', userId, function (err, list) {
                if (err)
                    res.json({
                        success: false,
                        msg: err.message
                    });
                res.status(200).json({
                    reportList: list,
                    viewReportList: rows
                });
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

// add report in time
router.post('/reportInTime', auth, function (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(403).json({
            request: 'FAIL',
            errors: utils.createErrorResponse(errors.array())
        });
    }
    try {
        var user = req.user;
        var userId = user.uid;
        var jobId = req.body.jobId;
        var inputTime = req.body.inTime;

        db.query('SELECT job_id, sup_id FROM users_job where user_id=? AND job_id=?', [userId, jobId], function (err, row) {
            if (row[0].job_id) {
                var data = {
                    userId: userId,
                    jobId: jobId,
                    sup_id: row[0].sup_id,
                    inTime: req.body.inTime,
                    date: moment(new Date()).format('YYYY-MM-DD'),
                    active: 1,
                    status: 7
                };
                var h = 0;
                var date = data.date;
                db.query('SELECT id, userId, inTime, outTime, jobId, date FROM taskreporting where active=1 AND  userId=? AND jobId=? AND date=? AND outTime IS NOT NULL', [userId, jobId, date], function (err, find) {
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

                        db.query('SELECT userId FROM taskreporting where userId="' + userId + '" AND active=1 AND outTime IS NULL AND jobId=?', jobId, function (err, rows) {
                            if (rows[0]) {
                                if (err)
                                    console.error(err.message);
                                return res.status(403).json(createResponse('FAIL', 15));
                            } else {
                                db.query('INSERT INTO taskreporting SET ?', data, function (err, rows, fields) {
                                    if (err)
                                        console.error(err.message);
                                    return res.status(200).json(createResponse('Success', 16));
                                });
                            }
                        });
                    }
                });
            } else {
                if (err)
                    console.error(err.message);
                return res.status(403).json(createResponse('FAIL', 17));
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});


// report view user
router.get('/report-view', auth, function (req, res, next) {
    try {
        var user = req.user;
        var userId = user.uid;
        /* db.query('SELECT t.*, u.firstName, s.statusName,jt.type_name FROM taskreporting AS t join users AS u join jobtype as jt on(t.jobId =jt.id) join statusname AS s ON(s.id=t.status) where t.userId=u.id  AND t.active=1 AND t.userId=?  ORDER BY t.date DESC', userId, function(err, rows) {*/
        db.query('SELECT t.id,t.userId,t.jobId,t.sup_id,t.date,t.inTime,IFNULL(t.outTime, "") AS outTime, IFNULL(t.hours_count, "") AS hours_count, IFNULL(t.description, "") AS description, t.status, IFNULL(t.SupervisorComment, "") AS SupervisorComment, IFNULL(t.attachment, "") AS attachment,t.active,u.firstName, s.statusName, IF(t.status = "5", CONCAT(sup.firstName, " ", sup.lastName),"") AS approvedBy, j.jobName FROM taskreporting AS t join users AS u  join statusname AS s join users AS sup ON(s.id=t.status) JOIN jobs AS j ON(t.jobId=j.id) where t.userId=u.id AND t.sup_id=sup.id AND active=1 AND t.userId=? ORDER BY t.date DESC', userId, function (err, rows) {
            //db.query('SELECT * FROM jobtype WHERE id = ?', rows[0].jobId, function (err,Job_type) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            res.status(200).json({
                data: rows,
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});


/* POST particular user job report */
router.post('/reportOutTime', auth, [
    check('outTime', 'Your Out Time is required').not().isEmpty(),
], function (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(403).json({
            request: 'FAIL',
            errors: utils.createErrorResponse(errors.array())
        });
    }
    try {

        var user = req.user;
        var userId = user.uid;
        var jobId = req.body.jobId;
        if (!req.files) {
            var data = {
                userId: userId,
                date: moment(new Date()).format('YYYY-MM-DD'),
                outTime: req.body.outTime,
                description: req.body.description,
                // hours_count: countHourTime,
                status: 0,
                active: 1
            };
        } else {
            var imageFile = req.files.attachment;
            let imageExtension = imageFile.name.split('.');
            if (imageExtension[1] == "jpg" || imageExtension[1] == "JPG" || imageExtension[1] == "jpeg" || imageExtension[1] == "JPEG" || imageExtension[1] == "png" || imageExtension[1] == "PNG" || imageExtension[1] == "pdf" || imageExtension[1] == "PDF") {
                let ext = imageExtension[(imageExtension).length - 1];
                var image = userId + '_' + new Date().toISOString();
                new_image = md5(image);
                new_image = new_image + '.' + ext;
                let fileName = new_image;
                let uploadPath = 'uploads';
                var data = {
                    userId: userId,
                    date: moment(new Date()).format('YYYY-MM-DD'),
                    outTime: req.body.outTime,
                    attachment: fileName,
                    description: req.body.description,
                    // hours_count: countHourTime,
                    status: 0,
                    active: 1
                };
                imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {});
            } else {
                return res.status(404).json(createResponse('FAIL', 9));
            }
        }
        db.query('SELECT id,inTime FROM taskreporting where userId="' + userId + '" AND outTime IS NULL AND jobId = ?', jobId, function (err, rows) {
            if (rows.length == 0) {
                if (err)
                    res.json({
                        success: false,
                        msg: err.message
                    });
                return res.status(404).json(createResponse('FAIL', 0));
            } else {
                var id = rows[0].id;
                var countHourTime = countHours(rows[0].inTime, req.body.outTime);
                // var checkCountHourTime = checkCountHours(rows[0].inTime, req.body.outTime);
                data.hours_count = countHourTime;
                /* if (checkCountHourTime == 0) {
                    return res.status(403).json(createResponse('FAIL', 88));
                } */
                db.query('UPDATE taskreporting SET ? where id = ?', [data, id], function (err) {
                    if (err)
                        console.error(err.message);
                    return res.status(200).json(createResponse('Success', 18));
                });
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

// view report detail
router.get('/view-reportDetails/:id', auth, function (req, res, next) {
    try {
        db.query('SELECT t.*, CONCAT(`firstName`, " ", `lastName`) AS name, s.statusName FROM taskreporting AS t join users AS u ON (t.userId=u.id) JOIN statusname AS s ON (s.id=t.status) where t.id=?', req.params.id, function (err, rows) {
            if (err)
                console.error(err.message)
            return res.status(200).json({
                data: rows
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

//delete report
router.get('/deleteReport/:id', auth, function (req, res, next) {
    try {
        db.query('UPDATE taskreporting SET active=0 WHERE id=?', req.params.id, function (err, rows) {
            if (err)
                console.error(err.message)
            return res.status(200).json(createResponse('Success', 19));
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))

    }
});

//edit report
router.post('/editReport/:id', auth, [
    check('outTime', 'Your Out Time is required').not().isEmpty(),
    check('inTime', 'Your In Time is required').not().isEmpty(),
], function (req, res) {
    console.log(req.body, 'body');
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                errors: utils.createErrorResponse(errors.array())
            });
        }
        var user = req.user;
        var userId = user.uid;
        console.log(userId, 'id');
        if (!req.files) {
            var data = {
                date: moment(new Date()).format('YYYY-MM-DD'),
                outTime: req.body.outTime,
                inTime: req.body.inTime,
                description: req.body.description,
                status: 0,
                active: 1
            };
        } else {
            var imageFile = req.files.attachment;
            let imageExtension = imageFile.name.split('.');
            if (imageExtension[1] == "jpg" || imageExtension[1] == "JPG" || imageExtension[1] == "jpeg" || imageExtension[1] == "JPEG" || imageExtension[1] == "png" || imageExtension[1] == "PNG" || imageExtension[1] == "pdf" || imageExtension[1] == "PDF") {
                let ext = imageExtension[(imageExtension).length - 1];
                var image = userId + '_' + new Date().toISOString();
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
                    status: 0,
                    active: 1
                };
                imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {});
            } else {
                return res.status(404).json(createResponse('FAIL', 9));
            }
        }
        db.query('SELECT userId, status FROM taskreporting WHERE id = ?', req.params.id, function (err, rows) {
            if (rows[0].userId == userId && rows[0].status == 0) {
                db.query('SELECT id, inTime FROM taskreporting where userId="' + userId + '"', function (err, row) {
                    if (row.length != 0) {
                        var id = row[0].id;
                        var countHourTime = countHours(row[0].inTime, req.body.outTime);
                        // var checkCountHourTime = checkCountHours(row[0].inTime, req.body.outTime);
                        data.hours_count = countHourTime;
                        /*  if (checkCountHourTime == 0) {
                             return res.status(403).json(createResponse('FAIL', 88));
                         } */
                        db.query('UPDATE taskreporting SET ? WHERE id = ? ', [data, req.params.id],
                            function (err) {
                                if (err)
                                    console.error(err.message)
                                return res.status(200).json(createResponse('Success', 21));
                            });
                    } else {
                        return res.status(404).json(createResponse('FAIL', 0));
                    }
                });
            } else {
                return res.status(404).json(createResponse('FAIL', 22));
            }
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))
    }
});

/* GET to see my offers */
router.get('/view-offers', auth, function (req, res) {
    try {
        var user = req.user;
        var userId = user.uid;
        /*db.query('SELECT jo.jobId, jo.id AS offerId, j.jobName, j.jobCode, j.startDate, j.endDate,countries.name AS country, cities.name AS city, states.name AS state FROM `joboffers` AS jo JOIN jobs AS j ON (jo.jobId=j.id) JOIN jobsites AS js ON (j.siteId=js.id) JOIN countries ON (js.country = countries.id) JOIN cities ON (js.`city` = cities.id) JOIN states ON (js.state = states.id) WHERE jo.userId=? AND jo.status=0 GROUP BY jo.jobId', userId, function(err, rows) {*/
        db.query('SELECT jo.jobId, jo.id AS offerId, j.jobName, j.jobCode, j.startDate, j.endDate,js.newAddress FROM `joboffers` AS jo JOIN jobs AS j ON (jo.jobId=j.id) JOIN jobsites AS js ON (j.siteId=js.id) WHERE jo.userId=? AND jo.status=0 GROUP BY jo.jobId', userId, function (err, rows) {
            if (err)
                console.error(err.message);
            if (rows.length == 0)
                return res.status(404).json(createResponse('NOT Found', 48));
            return res.status(200).json({
                data: rows
            });
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))
    }
});

/* GET Single Job */
router.get('/viewSingleJobs/:id', auth, function (req, res) {
    try {
        var user = req.user;
        var userId = user.uid;
        db.query('SELECT jobs.jobName, jobs.siteId, jobs.createDate AS startDate, jobs.noOfPhases, jobs.jobCode, jobs.description, jobs.experience, jobsites.siteName, jobsites.sitesCode, jobsites.newAddress, (SELECT firstName from users WHERE id=jobs.jobSupervisor) AS SupervisorName, (SELECT statusName from statusname WHERE id=jobs.status) AS jobStatus FROM `jobs` LEFT JOIN jobsites ON (jobsites.id = jobs.siteId) WHERE jobs.id=?', req.params.id, function (err, rows) {
            if (err)
                console.error(err.message)
            return res.status(200).json({
                data: rows[0]
            });
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0));

    }
});



/* POST to approve & reject jobs */
router.post('/acceptUser/:id', auth, function (req, res) {
    try {
        console.log(req.body, 'body')
        var user = req.user;
        var userId = user.uid;
        var id = req.body.act;
        var s = db.query('SELECT userId, jobId FROM joboffers WHERE id=?', req.body.offerId, function (err, rows) {
            console.log(s.sql,'sssssss')
            if (rows[0].userId == userId && rows[0].jobId == req.body.jobId) {
                switch (id) {
                    case '1':
                        var a1 = db.query('select j.startDate,js.latitude, js.longitude from jobs j JOIN jobsites AS js ON(j.siteId=js.id) where j.id =?', req.body.jobId, function (err, jobdet) {
                            console.log(a1.sql,'a11111111111')
                            var a2 = db.query('SELECT uj.job_id AS userCurrJobId, j.startDate, j.endDate, js.latitude, js.longitude FROM users_job AS uj JOIN jobs AS j ON(uj.job_id=j.id) JOIN jobsites AS js ON(uj.siteId=js.id) WHERE uj.user_id=? AND uj.isCurrentJob=1 AND (CAST(? AS DATE) BETWEEN CAST( j.startDate AS DATE) AND CAST(j.endDate AS DATE))', [userId, jobdet[0].startDate], function (err, currJob) {
                                console.log(a2.sql,'a222222222222')
                                var disdiff = 0;
                                var jobdetsite_latitude = parseFloat(jobdet[0].latitude);
                                var jobdetsite_longitude = parseFloat(jobdet[0].longitude);
                                console.log(jobdetsite_latitude,'jobdetsite_latitude',jobdetsite_longitude,'jobdetsite_longitude')
                                if (!currJob[0]) {
                                    var a3 = db.query('SELECT siteId, startDate, endDate, jobSupervisor FROM jobs WHERE id = ?', req.body.jobId, function (err, job) {
                                        console.log(a3.sql,'a3333333333333')
                                        if (err)
                                            console.error(err.message)
                                        let currSiteId = job[0].siteId;

                                        var jobs = {
                                            user_id: userId,
                                            job_id: req.body.jobId,
                                            sup_id: job[0].jobSupervisor,
                                            siteId: currSiteId,
                                            enroll_Indate: moment(req.body.startDate).format('YYYY-MM-DD'),
                                            enroll_Outdate: moment(req.body.endDate).format('YYYY-MM-DD'),
                                        };
                                        console.log(jobs,'jobs')
                                        if (err)
                                            console.error(err.message)
                                            var a4 = db.query('UPDATE joboffers SET status = ? WHERE id = ? ', [5, req.body.offerId], function (err, jobOfferData) {
                                                console.log(a4.sql,'a44444444444')
                                            if (err)
                                                console.error(err.message)
                                                var a5 = db.query('INSERT INTO users_job SET ?', jobs, function (err, jobsData) {
                                                db.query('SELECT jobType FROM users WHERE id=?', userId, function (err, user) {
                                                    console.log(a5.sql,'a55555555')
                                                    var a6 = db.query('INSERT INTO user_sites (user_id, site_id, user_role, jobType) VALUES (?,?,1,?)', [userId, currSiteId, user[0].jobType], function (err, jobsData) {
                                                        console.log(a6.sql,'a666666666')
                                                        if (err)
                                                            console.error(err.message)
                                                    });
                                                    if (err)
                                                        console.error(err.message)
                                                    return res.status(200).json(createResponse('Success', 23))
                                                });
                                            });
                                        });
                                    });
                                } else {
                                    var cursite_latitude = parseFloat(currJob[0].latitude);
                                    var cursite_longitude = parseFloat(currJob[0].longitude);
                                    console.log(cursite_latitude,'cursite_latitude',cursite_longitude,'cursite_longitude')
                                    options = {
                                        uri: 'https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=' + jobdetsite_latitude + '%2C' + jobdetsite_longitude + '&destinations=' + cursite_latitude + '%2C' + cursite_longitude + '&key='+config.apiKey,
                                        timeout: 200000000,
                                        followAllRedirects: true
                                    };
                                    request(options, function (error, response, body) {
                                        var jsonData = JSON.parse(body);
                                        var row = jsonData.rows;
                                        row.forEach(function (a) {

                                            var element = a.elements;
                                            element.forEach(function (b) {

                                                if (b.status == 'OK') {
                                                    disdiff = b.distance.text;
                                                }

                                            });
                                        });

                                        if (disdiff.includes('ft')) {
                                            var a = db.query('SELECT siteId, startDate, endDate, jobSupervisor FROM jobs WHERE id = ?', req.body.jobId, function (err, job) {
                                                console.log(a.sql,'aaaaaaaaaa')
                                                if (err)
                                                    console.error(err.message)
                                                let currSiteId = job[0].siteId;

                                                var jobs = {
                                                    user_id: userId,
                                                    job_id: req.body.jobId,
                                                    sup_id: job[0].jobSupervisor,
                                                    siteId: currSiteId,
                                                    enroll_Indate: moment(req.body.startDate).format('YYYY-MM-DD'),
                                                    enroll_Outdate: moment(req.body.endDate).format('YYYY-MM-DD'),
                                                };
                                                console.log(jobs,'jobs')
                                                if (err)
                                                    console.error(err.message)
                                                    var a1 = db.query('UPDATE joboffers SET status = ? WHERE id = ? ', [5, req.body.offerId], function (err, jobOfferData) {
                                                        console.log(a1.sql,'a11111111111')
                                                    if (err)
                                                        console.error(err.message)
                                                        var a2 = db.query('INSERT INTO users_job SET ?', jobs, function (err, jobsData) {
                                                            console.log(a2.sql,'a222222222')
                                                            var a3 = db.query('SELECT jobType FROM users WHERE id=?', userId, function (err, user) {
                                                                console.log(a3.sql,'a333333333')
                                                            var a4 = db.query('INSERT INTO user_sites (user_id, site_id, user_role, jobType) VALUES (?,?,1,?)', [userId, currSiteId, user[0].jobType], function (err, jobsData) {
                                                                console.log(a4.sql,'a44444444444')
                                                                if (err)
                                                                    console.error(err.message)
                                                            });
                                                            if (err)
                                                                console.error(err.message)
                                                            return res.status(200).json(createResponse('Success', 23))
                                                        });
                                                    });
                                                });
                                            });
                                        }
                                        if (disdiff.includes('mi')) {
                                            var distDiffer = disdiff.replace(',', '');
                                            var dis = parseFloat(distDiffer);
                                            if ((dis < 25)) {
                                                var a1 = db.query('SELECT siteId, startDate, endDate, jobSupervisor FROM jobs WHERE id = ?', req.body.jobId, function (err, job) {
                                                    if (err)
                                                        console.error(err.message)
                                                    let currSiteId = job[0].siteId;

                                                    var jobs = {
                                                        user_id: userId,
                                                        job_id: req.body.jobId,
                                                        sup_id: job[0].jobSupervisor,
                                                        siteId: currSiteId,
                                                        enroll_Indate: moment(req.body.startDate).format('YYYY-MM-DD'),
                                                        enroll_Outdate: moment(req.body.endDate).format('YYYY-MM-DD'),
                                                    };
                                                    if (err)
                                                        console.error(err.message)
                                                    db.query('UPDATE joboffers SET status = ? WHERE id = ? ', [5, req.body.offerId], function (err, jobOfferData) {
                                                        if (err)
                                                            console.error(err.message)
                                                        db.query('INSERT INTO users_job SET ?', jobs, function (err, jobsData) {
                                                            db.query('SELECT jobType FROM users WHERE id=?', userId, function (err, user) {
                                                                var a4 = db.query('INSERT INTO user_sites (user_id, site_id, user_role, jobType) VALUES (?,?,1,?)', [userId, currSiteId, user[0].jobType], function (err, jobsData) {
                                                                    if (err)
                                                                        console.error(err.message)
                                                                });
                                                                if (err)
                                                                    console.error(err.message)
                                                                return res.status(200).json(createResponse('Success', 23))
                                                            });
                                                        });
                                                    });
                                                });
                                            } else {
                                                return res.status(403).json(createResponse('FAIL', 110))
                                            }
                                        }
                                    });

                                }
                            });
                        });
                        break;
                    case '2':
                        var a5 = db.query('UPDATE joboffers SET status=6 WHERE userId=? AND id=?', [userId, req.params.id], function (err, rows, fields) {
                            if (err)
                                console.error(err.message)
                            return res.status(200).json(createResponse('Success', 24))
                        });

                        break;

                    default:
                        return res.status(404).json(createResponse('FAIL', 25))
                }
            } else {
                return res.status(404).json(createResponse('FAIL', 26))
            }
        })
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0));

    }
});


/* GET To View Report Card */
router.get('/report-card', auth, function (req, res) {
    var user = req.user;
    var userId = user.uid;
    var jobType = user.jobType;

    try {
        db.query('SELECT * FROM users WHERE id = ?', userId, function (err, rows) {
            db.query('SELECT id, type_name FROM jobtype', function (err, row) {
                db.query('SELECT AVG(rating) as total_rating, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=1) AS Workmanship_Quality, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=2) AS Attendance_Punctuality, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=3) AS Organization_Cleanliness, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=4) AS Communication_Updates, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=5) AS Worked_Safe, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=6) AS Followed_Instructions_Schedule, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=7) AS Team_Player FROM `user_ratings` WHERE userId=?', [userId, userId, userId, userId, userId, userId, userId, userId], function (err, rating) {
                    db.query('SELECT * FROM jobtype WHERE id = ?', rows[0].jobType, function (err, Job_type) {
                        db.query('SELECT exam_date, start_time, end_time, question, no_of_given_answer, level_1_score, level_2_score, level_3_score, total_score, wrong_answer_count, neg_mark FROM `results` WHERE userId=?', userId, function (err, result) {

                            let jobType = row.filter(a => a.id == rows[0].jobType);
                            if (err)
                                console.error(err.message)
                            return res.status(200).json({
                                rating: {
                                    "total_rating": rating[0].total_rating ? rating[0].total_rating : "",
                                    "Workmanship_Quality": rating[0].Workmanship_Quality ? rating[0].Workmanship_Quality : "",
                                    "Attendance_Punctuality": rating[0].Attendance_Punctuality ? rating[0].Attendance_Punctuality : "",
                                    "Organization_Cleanliness": rating[0].Organization_Cleanliness ? rating[0].Organization_Cleanliness : "",
                                    "Communication_Updates": rating[0].Communication_Updates ? rating[0].Communication_Updates : "",
                                    "Worked_Safe": rating[0].Worked_Safe ? rating[0].Worked_Safe : "",
                                    "Followed_Instructions_Schedule": rating[0].Followed_Instructions_Schedule ? rating[0].Followed_Instructions_Schedule : "",
                                    "Team_Player": rating[0].Team_Player ? rating[0].Team_Player : "",
                                },
                                Job_type: Job_type[0].type_name,
                                userResult: result[0],
                            });
                        });
                    });
                });
            });
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0));

    }
});


// /* GET To View Report Card */
// router.get('/report-card', auth, function (req, res) {
//     var user = req.user;
//     var userId = user.uid;
//     var jobType = user.jobType;

//     try {
//         db.query('SELECT * FROM users WHERE id = ?', userId, function (err, rows) {
//             db.query('SELECT id, type_name FROM jobtype', function (err, row) {
//                 db.query('SELECT AVG(rating) as total_rating, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=1) AS Workmanship_Quality, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=2) AS Attendance_Punctuality, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=3) AS Organization_Cleanliness, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=4) AS Communication_Updates, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=5) AS Worked_Safe, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=6) AS Followed_Instructions_Schedule, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=7) AS Team_Player FROM `user_ratings` WHERE userId=?', [userId, userId, userId, userId, userId, userId, userId, userId], function (err, rating) {
//                     db.query('SELECT * FROM jobtype WHERE id = ?', rows[0].jobType, function (err, Job_type) {
//                        db.query('SELECT IFNULL(exam_date, "") AS exam_date, IFNULL(start_time, "") AS start_time, IFNULL(end_time, "") AS end_time, IFNULL(question, "") AS question, IFNULL(no_of_given_answer, "") AS no_of_given_answer, IFNULL(level_1_score, "") AS level_1_score, IFNULL(level_2_score, "") AS level_2_score, IFNULL(level_3_score, "") AS level_3_score, IFNULL(total_score, "") AS total_score, IFNULL(wrong_answer_count, "") AS wrong_answer_count,IFNULL(neg_mark, "") AS  neg_mark FROM `results` WHERE userId=?', userId, function (err, result) {

//                             let jobType = row.filter(a => a.id == rows[0].jobType);
//                             if (err)
//                                 console.error(err.message)
//                             return res.status(200).json({
//                                 rating: {
//                                     "total_rating": rating[0].total_rating ? rating[0].total_rating : "",
//                                     "Workmanship_Quality": rating[0].Workmanship_Quality ? rating[0].Workmanship_Quality : "",
//                                     "Attendance_Punctuality": rating[0].Attendance_Punctuality ? rating[0].Attendance_Punctuality : "",
//                                     "Organization_Cleanliness": rating[0].Organization_Cleanliness ? rating[0].Organization_Cleanliness : "",
//                                     "Communication_Updates": rating[0].Communication_Updates ? rating[0].Communication_Updates : "",
//                                     "Worked_Safe": rating[0].Worked_Safe ? rating[0].Worked_Safe : "",
//                                     "Followed_Instructions_Schedule": rating[0].Followed_Instructions_Schedule ? rating[0].Followed_Instructions_Schedule : "",
//                                     "Team_Player": rating[0].Team_Player ? rating[0].Team_Player : "",
//                                 },
//                                 Job_type: Job_type[0].type_name,
//                                 userResult: result[0],
//                             });
//                         });
//                     });
//                 });
//             });
//         });
//     } catch (err) {
//         console.error(err.message)
//         return res.status(500).json(createResponse('FAIL', 0));

//     }
// });

//show preferred designation
router.get('/preferred-designation', auth, function (req, res) {
    var user = req.user;
    var userId = user.uid;
    try {
        db.query('select jobType, search from users where id = ?', userId, function (err, user) {
            db.query('select id, skill_level, designation_name from designation where job_type = ?', user[0].jobType, function (err, showdesignation) {
                db.query('select GROUP_CONCAT(designation_prefer_id) as designation_prefer_id,user_id from user_preferred_designation where user_id = ?', userId, function (err, data) {
                    if (data[0].designation_prefer_id != null) {
                        var designation_prefer_id = data[0].designation_prefer_id;
                        var select_pre = designation_prefer_id;
                        if (err)
                            console.error(err.message)
                        return res.status(200).json({
                            selecteddata: showdesignation,
                            showdesignation: select_pre,
                            userSearch: user[0].search,
                        });
                    } else {
                        return res.status(200).json({
                            selecteddata: showdesignation,
                            userSearch: user[0].search,
                        });
                    }
                });
            });
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0));

    }
});

//post function add-Predesignation
router.post('/add-Predesignation', auth, function (req, res, next) {
    try {
        var user = req.user;
        var userId = user.uid;
        var data = {
            designation_prefer_id: req.body.designation_id,
            user_id: userId,
        };
        var designation_id = req.body.designation_id;
        if (typeof designation_id != "object")
            designation_id = [designation_id];

        db.query('select user_id from user_preferred_designation where user_id="' + data.user_id + '"', function (err, rows) {
            if (rows.length != 0) {
                db.query('DELETE FROM user_preferred_designation where user_id= ?', userId)
                designation_id.forEach(function (d) {
                    db.query('INSERT INTO user_preferred_designation (user_id,designation_prefer_id)VALUES (?, ?)', [userId, d],
                        function (err) {
                            if (err)
                                console.error(err.message)
                        });
                });
                return res.status(200).json(createResponse('Success', 27));
            } else {
                designation_id.forEach(function (d) {
                    db.query('INSERT INTO user_preferred_designation (user_id,designation_prefer_id)VALUES (?, ?)', [userId, d],
                        function (err) {
                            if (err)
                                console.error(err.message)
                        });
                });
                return res.status(200).json(createResponse('Success', 27));
            }
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0));

    }
});



/* POST to change password*/
router.post('/changePassword', auth, [
    check('currentPassword').not().isEmpty().withMessage('Current Password is required!'),
    check('newPassword').not().isEmpty().withMessage('New Password is required!'),
    check('confirmNewPassword').not().isEmpty().withMessage('Confirm Password is required!')
], function (req, res) {

    var user = req.user;
    var user_id = user.uid;

    const {
        currentPassword,
        newPassword,
        confirmNewPassword
    } = req.body;
    db.query('SELECT password FROM users WHERE id = ?', user_id, function (err, rows) {
        bcrypt.compare(currentPassword, rows[0].password, function (err, isMatch) {
            if (isMatch) {
                if (currentPassword != newPassword) {
                    if (newPassword == confirmNewPassword) {
                        bcrypt.genSalt(10, (err, salt) => {
                            bcrypt.hash(newPassword, salt, (err, hash) => {
                                db.query('UPDATE users SET password= ? WHERE id =?', [hash, user_id], function (err) {
                                    if (err)
                                        console.error(err.message)
                                    return res.status(200).json(createResponse('Success', 38))
                                });
                            });
                        });
                    } else {
                        return res.status(200).json(createResponse('Success', 39))
                    }
                } else {
                    return res.status(200).json(createResponse('Success', 40))
                }
            } else {
                return res.status(200).json(createResponse('Success', 41))
            }
        });

    });
});

router.post('/updateLocation/', auth, function (req, res) {
    var user_id = req.user.uid;

    var latitude = req.body.latitude;
    var longitude = req.body.longitude;

    if (req.user.siteId != null || req.user.siteId != 0) {
        var site_id = req.user.siteId;
    }
    var data = {
        newLongitude: longitude,
        newLatitude: latitude

    };
    var location_data = {
        user_id: user_id,
        longitude: longitude,
        latitude: latitude
    }

    db.query('UPDATE users SET ? WHERE id =?', [data, user_id], function (err) {
        db.query('INSERT INTO user_location SET ?', location_data, function (err) {
            if (err)
                console.error(err.message)
            // return res.status(200).json(createResponse('Success', 42))
            return res.status(200).json({
                msg: 'Location Updated',
                site_id: site_id
            });
        });
    });

});

router.post('/getDashboard', auth, function (req, res) {
    var latitude = req.body.latitude;
    var longitude = req.body.longitude;
    return res.status(200).json({
        offer: 'yes',
        viewTimesheet: 'yes',
        editviewaccount: 'yes',
        latitude: latitude,
        longitude: longitude

    })


});

/*Sarita 07_10_2019 */

/*Add Subjects */
router.post('/add-subject', auth, [
    check('subject_name').not().isEmpty().withMessage('Subject Name must have required .')
], function (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(403).json({
            request: 'FAIL',
            errors: utils.createErrorResponse(errors.array())
        });
    }
    try {
        var data = {
            sub_name: req.body.subject_name,
            sub_date: new Date()
        };
        db.query('INSERT INTO subjects SET ?', data, function (err) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json(createResponse("Success", 44));
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/*View Subjects List */
router.get('/get-subject', auth, function (req, res) {
    try {
        db.query('SELECT sub_id, sub_name,sub_date FROM subjects WHERE active = 1', function (err, subjects) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            res.status(200).json({
                data: subjects
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

router.post('/edit-subject/:id', auth, [
    check('subject_name').not().isEmpty().withMessage('Subject Name must have required .')
], function (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(403).json({
            request: 'FAIL',
            errors: utils.createErrorResponse(errors.array())
        });
    }
    try {
        var data = {
            sub_name: req.body.subject_name
        };
        db.query('UPDATE subjects SET ? WHERE sub_id = ?', [data, req.params.id], function (err) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json(createResponse("Success", 45));
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/*End */

/*Delete Subject */
router.get('/deleteSubject/:id', auth, function (req, res, next) {
    try {
        db.query('UPDATE subjects SET active=0 WHERE sub_id = ?', req.params.id, function (err, rows) {
            if (err)
                console.error(err.message)
            return res.status(200).json(createResponse('Success', 46));
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))

    }
});
/*End */

/*Add Ques Answers */
router.post('/add-quesAns', auth, [
    check('subject_id', 'Subject Name is required').not().isEmpty(),
    check('exam_level', 'Exam Level is required').not().isEmpty(),
    check('question', 'Question is required').not().isEmpty(),
    check('ch1', 'Choice 1 is required').not().isEmpty(),
    check('ch2', 'Choice 2 is required').not().isEmpty(),
    check('correct_ans', 'Correct Answer Field is required').not().isEmpty()
], function (req, res) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                errors: utils.createErrorResponse(errors.array())
            });
        }
        if (!req.files) {
            var data = {
                sub_id: req.body.subject_id,
                exam_level: req.body.exam_level,
                question: req.body.question,
                ch1: req.body.ch1,
                ch2: req.body.ch2,
                ch3: req.body.ch3,
                ch4: req.body.ch4,
                correct_ans: req.body.correct_ans,

                date: moment(new Date()).format('YYYY-MM-DD')
            };
        } else {
            var imageFile = req.files.quesImg_attach;
            let imageExtension = imageFile.name.split('.');

            if (imageExtension[1] == "jpg" || imageExtension[1] == "JPG" || imageExtension[1] == "jpeg" || imageExtension[1] == "JPEG" || imageExtension[1] == "png" || imageExtension[1] == "PNG" || imageExtension[1] == "pdf" || imageExtension[1] == "PDF") {
                let ext = imageExtension[(imageExtension).length - 1];
                var image = image + '_' + new Date().toISOString();
                new_image = md5(image);
                new_image = new_image + '.' + ext;
                let fileName = new_image;
                var uploadPath = 'uploads/Question_Img';

                var data = {
                    sub_id: req.body.subject_id,
                    exam_level: req.body.exam_level,
                    question: req.body.question,
                    ch1: req.body.ch1,
                    ch2: req.body.ch2,
                    ch3: req.body.ch3,
                    ch4: req.body.ch4,
                    quesImg_attach: fileName,
                    correct_ans: req.body.correct_ans,
                    date: moment(new Date()).format('YYYY-MM-DD')
                };
                imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {});
            } else {
                return res.status(404).json(createResponse('FAIL', 9));
            }
        }
        db.query('INSERT INTO questions SET ?', data, function (err, rows, fields) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json(createResponse('Success', 47));
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))
    }
});
/*End */

/*Get Question Paper */
router.get('/get-quesAns/:sub_id', auth, function (req, res) {
    try {
        var sub_id = req.params.sub_id;
        if (sub_id == 0) {
            skcartSubjectFilter = ''
        } else {
            skcartSubjectFilter = ` AND q.sub_id = ${sub_id} `
        }
        db.query(`SELECT q.q_id,s.sub_id AS subjectId, q.question, q.ch1, q.ch2, q.ch3, q.ch4, q.correct_ans, q.date,(SELECT ques_level FROM questions_level WHERE id=exam_level) AS exam_level, s.sub_name FROM questions AS q JOIN subjects AS s ON (s.sub_id=q.sub_id) WHERE q.active=1 ${skcartSubjectFilter}  AND s.active=1 ORDER BY date DESC`, function (err, rows) {
            if (err) {
                res.json({
                    success: false,
                    msg: err.message
                });
            }
            if (rows.length == 0)
                return res.status(404).json(createResponse('NOT Found', 48));
            res.status(200).json({
                data: rows
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/*Search Question Paper */
router.get('/searchQues/:sub_id', auth, function (req, res) {
    try {
        db.query('SELECT q.q_id, q.question, q.ch1, q.ch2, q.ch3, q.ch4, q.correct_ans, q.date,(SELECT ques_level FROM questions_level WHERE id=exam_level) AS exam_level, s.sub_name FROM questions AS q JOIN subjects AS s ON (s.sub_id=q.sub_id) WHERE q.sub_id = ? AND q.active=1 AND s.active=1 ORDER BY date DESC', req.params.sub_id, function (err, rows) {
            if (err) {
                res.json({
                    success: false,
                    msg: err.message
                });
            }
            if (rows.length == 0)
                return res.status(404).json(createResponse('NOT Found', 48));
            res.status(200).json({
                data: rows
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/*Delete Questions */
router.get('/deleteQuestion/:id', auth, function (req, res, next) {
    try {
        db.query('UPDATE questions SET active=0 WHERE q_id = ?', req.params.id, function (err, rows) {
            if (err)
                console.error(err.message)
            return res.status(200).json(createResponse('Success', 49));
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))

    }
});
/*End */

/*Edit Question Answer  */
router.post('/edit-quesAnswers/:id', auth, [
    check('subject_id', 'Subject Name is required').not().isEmpty(),
    check('exam_level', 'Exam Level is required').not().isEmpty(),
    check('question', 'Question is required').not().isEmpty(),
    check('ch1', 'Choice 1 is required').not().isEmpty(),
    check('ch2', 'Choice 2 is required').not().isEmpty(),
    check('correct_ans', 'Correct Answer Field is required').not().isEmpty()
], function (req, res) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                errors: utils.createErrorResponse(errors.array())
            });
        }
        if (!req.files) {
            var data = {
                sub_id: req.body.subject_id,
                exam_level: req.body.exam_level,
                question: req.body.question,
                ch1: req.body.ch1,
                ch2: req.body.ch2,
                ch3: req.body.ch3,
                ch4: req.body.ch4,
                correct_ans: req.body.correct_ans,

                date: moment(new Date()).format('YYYY-MM-DD')
            };
        } else {
            var imageFile = req.files.quesImg_attach;
            let imageExtension = imageFile.name.split('.');

            if (imageExtension[1] == "jpg" || imageExtension[1] == "JPG" || imageExtension[1] == "jpeg" || imageExtension[1] == "JPEG" || imageExtension[1] == "png" || imageExtension[1] == "PNG" || imageExtension[1] == "pdf" || imageExtension[1] == "PDF") {
                let ext = imageExtension[(imageExtension).length - 1];
                var image = image + '_' + new Date().toISOString();
                new_image = md5(image);
                new_image = new_image + '.' + ext;
                let fileName = new_image;
                var uploadPath = 'uploads/Question_Img';

                var data = {
                    sub_id: req.body.subject_id,
                    exam_level: req.body.exam_level,
                    question: req.body.question,
                    ch1: req.body.ch1,
                    ch2: req.body.ch2,
                    ch3: req.body.ch3,
                    ch4: req.body.ch4,
                    quesImg_attach: fileName,
                    correct_ans: req.body.correct_ans,
                    date: moment(new Date()).format('YYYY-MM-DD')
                };
                imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {});
            } else {
                return res.status(404).json(createResponse('FAIL', 9));
            }
        }
        db.query('UPDATE questions SET ? WHERE q_id = ?', [data, req.params.id], function (err) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json(createResponse('Success', 50));
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))
    }
});
/*End */

/*Get Exam Rules */
router.get('/setExamRules', auth, function (req, res) {
    try {
        db.query('SELECT easy, medium, high, negative_marking, neg_marking_value FROM exam_rules', function (err, rows) {
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
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))
    }
});
/*End */

/*Set Exam Rules */
router.post('/setExamRules', auth, [
    check('easy', 'Easy Question is required').not().isEmpty(),
    check('medium', 'Medium Question is required').not().isEmpty(),
    check('high', 'High Question is required').not().isEmpty(),
    check('negative_marking', 'Negative Marking Conditions is required').not().isEmpty(),
    check('neg_marking_value', 'Negative Marking Value is required').not().isEmpty(),
], function (req, res) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                errors: utils.createErrorResponse(errors.array())
            });
        }
        if (req.body.negative_marking == 0) {
            var neg_marking_value = 0;
        } else {
            var neg_marking_value = req.body.neg_marking_value;
        }
        var data = {
            easy: req.body.easy,
            medium: req.body.medium,
            high: req.body.high,
            negative_marking: req.body.negative_marking,
            neg_marking_value: neg_marking_value,
            updated_at: moment(new Date()).format('YYYY-MM-DD'),
            updated_by: req.user.uid
        };
        db.query('SELECT MIN(count) as count FROM view_questions_count WHERE exam_level = ? ', [1], function (err, rule) {
            var easy_count = rule[0].count;
            if (req.body.easy > easy_count) {
                var msg = 'Easy Question has mininum ' + easy_count + ' Question';
                res.status(400).json({
                    request: 'ERROR',
                    message: msg
                });
            } else {
                db.query('SELECT MIN(count) as count FROM view_questions_count WHERE exam_level = ? ', [2], function (err, rule2) {
                    var medium_count = rule2[0].count;
                    if (req.body.medium > medium_count) {
                        var msg = 'Medium Question has mininum ' + medium_count + ' Question';
                        res.status(400).json({
                            request: 'ERROR',
                            message: msg
                        });
                    } else {
                        db.query('SELECT MIN(count) as count FROM view_questions_count WHERE exam_level = ? ', [3], function (err, rule3) {
                            var high_count = rule3[0].count;
                            if (req.body.high > high_count) {
                                var msg = 'High Question has mininum ' + high_count + ' Question';
                                res.status(400).json({
                                    request: 'ERROR',
                                    message: msg
                                });
                            } else {
                                db.query('UPDATE exam_rules SET ?', data, function (err, rows, fields) {
                                    if (err)
                                        res.json({
                                            success: false,
                                            msg: err.message
                                        });
                                    return res.status(200).json(createResponse('Success', 51));
                                });
                            }
                        });
                    }
                });
            }
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))
    }
});
/*End */

/*Planner */

/*Create Planner in hr */
router.post('/createPlanner', auth, [
    check('firstName').isAlpha().withMessage('Name Must be only alphabetical chars'),
    check('lastName').isAlpha().withMessage('Last Name Must be only alphabetical chars'),
    check('email').isEmail().withMessage('email').withMessage('xyz@gmail.com'),
    check('password').isLength({
        min: 3
    }).withMessage('Password Must be at least 3 digits')
], function (req, res) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                errors: utils.createErrorResponse(errors.array())
            });
        }
        bcrypt.genSalt(10, (err, salt) => {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            bcrypt.hash(req.body.password, salt, (err, hash) => {
                var data = {
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    email: req.body.email,
                    password: hash,
                    role: '2',
                    createdAt: new Date()
                };
                db.query('select email from users where email="' + data.email + '"', function (err, rows) {
                    if (rows.length == 0) {
                        var q = db.query('INSERT INTO users SET ?', data, function (err, rows, fields) {
                            if (err)
                                res.json({
                                    success: false,
                                    msg: err.message
                                });
                            var id = q._results[0]['insertId'];
                            let w = id.toString(16);
                            var userCode = 'Pln_' + w;
                            db.query('UPDATE users SET eCode= ? WHERE id =?', [userCode, id], function (err) {
                                if (err) {
                                    db.query('DELETE FROM users where id= ?', id)
                                    res.status(403);
                                    return res.json(createResponse("FAIL", 0));
                                }
                            });
                            return res.status(200).json(createResponse('Success', 52));
                        });
                    } else {
                        res.status(403);
                        return res.json(createResponse("FAIL", 6));
                    }
                });
            });
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))
    }
});
/*End */

/*get Planner in hr */
router.get('/get-Planner', auth, function (req, res) {
    try {
        db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, IFNULL(u.dob,"") AS dob, u.email, u.phone_number, IFNULL(u.jobtype, "") AS jobtype, IFNULL(u.skills, "") AS skills, IFNULL(u.experience, "") AS experience, IFNULL(js.siteName, "") AS siteName FROM users AS u LEFT JOIN jobsites AS js ON(u.currSiteId=js.id) where role=2', function (err, rows) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (rows.length == 0)
                return res.status(404).json(createResponse('NOT Found', 48));
            res.status(200).json({
                data: rows
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/*View Planner in hr */
router.get('/view-plannerProfile/:id', auth, function (req, res) {
    try {
        db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, u.dob, u.email, u.experience, jt.type_name, s.skill_name FROM users AS u LEFT JOIN jobtype AS jt ON(u.jobType=jt.id) LEFT JOIN skills AS s ON(u.skills=s.id) where u.id=?', req.params.id, function (err, rows) {
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
/*End */

/*End */


/*Supervisor */

/*Add Supervisor in hr */
router.post('/add-supervisor', auth, [
    check('firstName').isAlpha().withMessage('Name Must be only alphabetical chars'),
    check('lastName').isAlpha().withMessage('Last Name Must be only alphabetical chars'),
    check('email').isEmail().withMessage('email').withMessage('xyz@gmail.com'),
    check('password').isLength({
        min: 3
    }).withMessage('Password Must be at least 3 digits')
], function (req, res) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                errors: utils.createErrorResponse(errors.array())
            });
        } else {
            bcrypt.genSalt(10, (err, salt) => {
                if (err)
                    res.json({
                        success: false,
                        msg: err.message
                    });
                bcrypt.hash(req.body.password, salt, (err, hash) => {
                    var data = {
                        firstName: req.body.firstName,
                        lastName: req.body.lastName,
                        email: req.body.email,
                        password: hash,
                        role: '3',
                        createdAt: new Date()
                    };

                    db.query('select email from users where email="' + data.email + '"', function (err, rows) {
                        if (rows.length == 0) {
                            var q = db.query('INSERT INTO users SET ?', data, function (err, rows, fields) {
                                if (err)
                                    console.error(err.message)
                                var id = q._results[0]['insertId'];
                                let w = id.toString(16);
                                var userCode = 'SUP_' + w;
                                db.query('UPDATE users SET eCode= ? WHERE id =?', [userCode, id], function (err) {
                                    if (err) {
                                        db.query('DELETE FROM users where id= ?', id)
                                        res.status(403);
                                        return res.json(createResponse("FAIL", 0));
                                    }
                                });
                                return res.status(200).json(createResponse('Success', 53));
                            });
                        } else {
                            res.status(403);
                            return res.json(createResponse("FAIL", 6));
                        }
                    });
                });
            });
        }
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/*Get All Supervisor */
router.get('/get-supervisor', auth, function (req, res) {
    try {
        var a = db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, IFNULL(u.dob, "") AS dob, u.email, u.phone_number, IFNULL(u.jobtype, "") AS jobtype, IFNULL(jt.type_name, "") AS project_trade, IFNULL(u.skills, "") AS skills, IFNULL(u.experience, "") AS experience, IFNULL(u.newAddress, "") AS newAddress, IFNULL(js.siteName, "") AS siteName, IFNULL(js.sitesCode, "") AS sitesCode FROM users AS u LEFT JOIN jobtype AS jt ON(u.jobType=jt.id) LEFT JOIN jobsites AS js ON(u.currSiteId=js.id) where role=3', function (err, rows) {
            console.log(a.sql, 'qqqqqqqq')
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (rows.length == 0)
                return res.status(404).json(createResponse('NOT Found', 48));
            res.status(200).json({
                data: rows
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/*View Supervisor */
router.get('/view-supervisor/:id', auth, function (req, res) {
    try {
        db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, u.dob, u.email, u.experience, jt.type_name, ci.name as city , s.name as state, C.name as country, (select GROUP_CONCAT(skill_name) from skills s join user_skills us2 on us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) as skills FROM users AS u LEFT JOIN jobtype AS jt ON(u.jobType=jt.id) LEFT JOIN cities ci ON (u.city = ci.id) LEFT JOIN states s ON (u.state = s.id) LEFT JOIN countries C ON (u.country = C.id)where u.id=?', req.params.id, function (err, rows) {
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
/*End */
/*End */


/*Roles */

/*Add Roles In hr */
router.post('/addRoles', auth, function (req, res) {
    try {
        var data = {
            type_name: req.body.type_name,
            description: req.body.description,
        };
        db.query('SELECT type_name FROM jobtype where type_name="' + data.type_name + '"', function (err, rows) {
            if (rows.length == 0) {
                db.query('INSERT INTO jobtype SET ?', data, function (err, rows, fields) {
                    if (err)
                        res.json({
                            success: false,
                            msg: err.message
                        });
                    return res.status(200).json(createResponse('Success', 55));
                });
            } else {
                res.status(403);
                return res.json(createResponse("FAIL", 54));
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/*Get Roles */
router.get('/view-Roles', auth, function (req, res) {
    try {
        db.query('SELECT id, type_name, description FROM jobtype where active = 1', function (err, rows) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (rows.length == 0)
                return res.status(404).json(createResponse('NOT Found', 48));
            res.status(200).json({
                data: rows
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/*Edit Roles in hr */
router.post('/edit-Roles/:id', auth, function (req, res) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                errors: utils.createErrorResponse(errors.array())
            });
        }
        var data = {
            type_name: req.body.type_name,
            description: req.body.description,
        };
        db.query('SELECT type_name FROM jobtype where type_name="' + data.type_name + '" AND id !="' + req.params.id + '"', function (err, rows) {
            if (rows.length == 0) {
                db.query('UPDATE jobtype SET ? WHERE id = ? ', [data, req.params.id], function (err, rows, fields) {
                    if (err)
                        res.json({
                            success: false,
                            msg: err.message
                        });
                    return res.status(200).json(createResponse('Success', 56));
                });
            } else {
                res.status(403);
                return res.json(createResponse("FAIL", 54));
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/*Delete Roles */
router.get('/deleteRoles/:id', auth, function (req, res, next) {
    try {
        db.query('UPDATE jobtype SET active=0 WHERE id = ?', req.params.id, function (err) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json(createResponse('Success', 57));
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))

    }
});
/*End */
/*End */

/*Skills */
/*Add Skills */
router.post('/addSkills', auth, [
    check('job_type_id', 'Job Type is required').not().isEmpty(),
    check('skill_name', 'Skill Name is required').not().isEmpty()
], function (req, res) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                errors: utils.createErrorResponse(errors.array())
            });
        }
        var data = {
            job_type_id: req.body.job_type_id,
            skill_name: req.body.skill_name,
            description: req.body.description
        };
        db.query('INSERT INTO skills SET ?', data, function (err, rows, fields) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json(createResponse('Success', 58));
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))

    }
});
/*End */

/*Get All Skills */
router.get('/view-Skills/:id', auth, function (req, res) {
    try {
        var jobId = req.params.id;
        if (jobId == 0) {
            skcartSkillsFilter = ''
        } else {
            skcartSkillsFilter = ` AND jt.id = ${jobId} `
        }
        db.query(`SELECT s.id, s.skill_name, s.active, IFNULL(s.description, "") AS description, jt.type_name, jt.id AS TypeId FROM skills AS s join jobtype AS jt ON(s.job_type_id=jt.id) WHERE s.active=1 ${skcartSkillsFilter}`, function (err, rows) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (rows.length == 0)
                return res.status(404).json(createResponse('NOT Found', 48));
            res.status(200).json({
                data: rows
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */
/*Edit Skills */
router.post('/edit-Skills/:id', auth, [
    check('skill_name', 'Skill Name is required').not().isEmpty()
], function (req, res) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                errors: utils.createErrorResponse(errors.array())
            });
        }
        var data = {
            skill_name: req.body.skill_name,
            description: req.body.description
        };
        db.query('UPDATE skills SET ? WHERE id = ? ', [data, req.params.id], function (err, rows, fields) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json(createResponse('Success', 59));
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))

    }
});
/*End */

/*Delete Skills */
router.get('/deleteSkills/:id', auth, function (req, res, next) {
    try {
        db.query('UPDATE skills SET active=0 WHERE id=?', req.params.id, function (err, rows) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json(createResponse('Success', 60));
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))

    }
});
/*End */

/*View Technition in hr */
router.get('/view-technicians/:id', auth, function (req, res) {
    try {
        var jobType = req.params.id;
        if (jobType == 0) {
            skcartJobFilter = ''
        } else {
            skcartJobFilter = ` AND jobtype.id = ${jobType}`
        }
        var a = db.query(`SELECT CONCAT(firstName, " ", lastName) AS name, users.id as user_id, users.jobType, users.eCode, users.experience, users.status, users.ratings, jobtype.id, jobtype.type_name AS jobtype, IFNULL(ud.designation_id,"") AS designation_id, IFNULL( CONCAT (d.skill_level, ". ", d.designation_name), "") AS designation_name FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) LEFT JOIN user_designation AS ud ON(users.id=ud.user_id) LEFT JOIN designation AS d ON(ud.designation_id=d.id) where users.role=1 ${skcartJobFilter} AND users.completeProfile=1 `, function (err, rows) {
            console.log(a.sql,'qq')
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (rows.length == 0)
                return res.status(404).json(createResponse('NOT Found', 48));
            res.status(200).json({
                data: rows
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/*View Technician according to mechnical and Electrical in hr */
router.get('/search_jobType/:id', auth, function (req, res) {
    try {
        db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, users.id as user_id,users.jobType, users.eCode, users.experience, users.status, users.ratings, jobtype.id, jobtype.type_name AS jobtype, ud.designation_id, d.skill_level, d.designation_name FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) LEFT JOIN user_designation AS ud ON(users.id=ud.user_id) LEFT JOIN designation AS d ON(ud.designation_id=d.id) where users.role=1 AND users.jobType=?', req.params.id, function (err, rows) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (rows.length == 0)
                return res.status(404).json(createResponse('NOT Found', 48));
            res.status(200).json({
                data: rows
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/*Change designation of technician from hr */
router.post('/change-designation', auth, [
    check('designation_id', 'Designation Name is required').not().isEmpty(),
    check('user_id', 'User Id is required').not().isEmpty()
], function (req, res) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                errors: utils.createErrorResponse(errors.array())
            });
        }
        db.query('SELECT id, skill_level, designation_name, job_type, hourly_rate,max_pertime_rate FROM designation where id = ?', req.body.designation_id, function (err, Designation) {
            var data = {
                user_id: req.body.user_id,
                designation_id: req.body.designation_id,
            };
            var userDesignation = {
                userId: req.body.user_id,
                max_pertime_rate: Designation[0].max_pertime_rate,
                hourly_rate: Designation[0].hourly_rate
            };
            db.query('select user_id from user_designation where user_id="' + data.user_id + '"', function (err, rows) {
                if (rows.length != 0) {
                    db.query('DELETE FROM user_designation where user_id= ?', data.user_id)
                    db.query('INSERT INTO user_designation SET ?', data, function (err, rows, fields) {
                        db.query('INSERT INTO user_rates SET ?', userDesignation, function (err) {
                            if (err)
                                res.json({
                                    success: false,
                                    msg: err.message
                                });
                            return res.status(200).json(createResponse('Success', 62));
                        });
                    });
                } else {
                    db.query('INSERT INTO user_designation SET ?', data, function (err, rows, fields) {
                        db.query('INSERT INTO user_rates SET ?', userDesignation, function (err) {
                            if (err)
                                res.json({
                                    success: false,
                                    msg: err.message
                                });
                            return res.status(200).json(createResponse('Success', 62));
                        });
                    });
                }
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/*Change Location*/
router.post('/addLocation', auth, function (req, res) {
    try {
        var data = {
            newLatitude: req.body.latitude,
            newLongitude: req.body.longitude
        };
        var location_data = {
            user_id: req.body.user_id,
            longitude: req.body.longitude,
            latitude: req.body.latitude
        }
        db.query('UPDATE users SET ? WHERE id = ?', [data, req.body.user_id], function (err) {
            db.query('INSERT INTO user_location SET ?', location_data, function (err) {
                if (err)
                    res.json({
                        success: false,
                        msg: err.message
                    });
                return res.status(200).json(createResponse('Success', 84));
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End*/

/*Manage Time Sheet in Technician */
router.get('/manage-TimeSheet/:id', auth, function (req, res) {
    try {
        db.query('SELECT t.id AS taskreportingId, t.userId, t.jobId, t.date, t.inTime, t.outTime, t.description, t.hours_count, t.attachment, t.active, CONCAT(`firstName`, " ", `lastName`) AS supervisors_name, j.id AS jobId, j.jobName FROM taskreporting AS t JOIN users AS u ON (t.sup_id=u.id) LEFT JOIN jobs AS j ON(t.jobId=j.id) where t.userId=? AND t.active=1 ORDER BY t.date DESC', req.params.id, function (err, rows) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (rows.length == 0)
                return res.status(404).json(createResponse('NOT Found', 48));
            res.status(200).json({
                data: rows
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/*Change Status of Technician */
router.get('/block-UnblockTech/:id', auth, function (req, res) {
    try {
        db.query('SELECT id, status from users where id=?', req.params.id, function (err, rows) {
            if (rows[0].status == 1) {
                db.query('UPDATE users SET status=0 WHERE id=?', req.params.id, function (err) {
                    if (err)
                        res.json({
                            success: false,
                            msg: err.message
                        });
                    return res.status(200).json(createResponse('Success', 63));
                });
            } else {
                db.query('UPDATE users SET status=1 WHERE id=?', req.params.id, function (err) {
                    if (err)
                        res.json({
                            success: false,
                            msg: err.message
                        });
                    return res.status(200).json(createResponse('Success', 64));
                });
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/* View Reviews*/
router.get('/view-reviews/:id', function (req, res) {
    try {
        db.query('SELECT ur.id, ur.reviews, ur.reviewDate, ur.isJobreview, CONCAT(`firstName`, " ", `lastName`) AS name FROM user_reviews AS ur JOIN users AS u ON (ur.review_by=u.id) WHERE active=1 AND userId=? ORDER BY reviewDate DESC', req.params.id, function (err, reviews) {
            var rDate = '';
            var d = '';
            var revDate = [];
            reviews.forEach(function (a) {
                rDate = moment(a.reviewDate).format('YYYY-MM-DD');
                d = revDate.push(rDate);
            });
            for (i = 0; i < d; i++) {
                reviews[i].reviewDate = revDate[i];
            }
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (reviews.length == 0)
                // return res.status(404).json(createResponse('NOT Found', 48));
                return res.status(404).json(createResponse('NOT Found', 107));
            res.status(200).json({
                data: reviews
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End*/

/*Get Degination in All */
router.get('/get-Designation/:id', auth, function (req, res) {
    try {
        db.query('SELECT s.id as id, CONCAT(skill_level, ". ", designation_name) as designation_name FROM designation AS s  WHERE s.active=1 AND job_type = ?', req.params.id, function (err, rows) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (rows.length == 0)
                return res.status(404).json(createResponse('NOT Found', 48));
            res.status(200).json({
                data: rows
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/*Search Jobs or Users */
router.post('/get-searchUsers/:id', auth, function (req, res) {
    try {
        var jobId = req.params.id;
        var cartUser = '';
        var cartUser = req.body.users;
        _skcartUserFilter = ' ';
        if (cartUser) {
            if (typeof cartUser == 'object') {
                _skcartUserFilter = ` AND u.id NOT IN (`
                cartUser.forEach(function (a) {
                    _skcartUserFilter += a + ','
                })
                _skcartUserFilter += `0 ) `
            } else {
                _skcartUserFilter = ` AND u.id NOT IN (${cartUser}) `
            }
        }
        db.query('SELECT jobTypeId, latitude as site_latitude,longitude as site_longitude FROM jobs JOIN jobsites ON (jobsites.id = jobs.siteId) where jobs.id=?', jobId, function (err, rows) {
            var jobtype = rows[0].jobTypeId;
            db.query('SELECT id AS designationId, skill_level, designation_name FROM designation WHERE job_type=?', jobtype, function (err, designation) {
                db.query('SELECT predicated_budget FROM jobs WHERE id=?', jobId, function (err, budget) {
                    db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.role, u.email, u.ratings, IFNULL(u.profileImg, "") AS profileImg, IFNULL(u.phone_number, "") AS phone_number, IFNULL(u.newAddress, "") AS newAddress, IFNULL(u.latitude, "") AS latitude, IFNULL(u.longitude, "") AS longitude, j.type_name, count(u.id) as rank, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation, (SELECT id FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designationId, IFNULL((select (total_score-(wrong_answer_count*neg_mark)) as totalS from results where userId=u.id ORDER by exam_date+end_time desc limit 1), "") as total_score, (SELECT CONCAT(hourly_rate,'/',max_pertime_rate) FROM user_rates AS ur WHERE ur.userId =u.id GROUP by ur.userId) AS rates, ur.hourly_rate, ur.max_pertime_rate, (SELECT jobsites.latitude FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_lat,(SELECT jobsites.longitude as jobsite_long FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_long FROM users u JOIN user_rates AS ur ON (u.id = ur.userId) LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.role=1 AND u.id NOT IN (select user_id from users_job where job_id='${jobId}' ) AND u.id NOT IN (select userId from joboffers where jobId='${jobId}') ${_skcartUserFilter} AND u.jobType=(SELECT jobTypeId FROM jobs WHERE id ='${jobId}') AND u.search=1 GROUP BY u.id order by rank desc`, function (err, users) {
                        var site_latitude = parseFloat(rows[0].site_latitude);
                        var site_longitude = parseFloat(rows[0].site_longitude);
                        distDiffer = [];
                        distDiffer1 = [];
                        parameters = '';
                        parameters1 = '';
                        var d = '';
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

                        request(options, function (error, response, body) {
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
                                        var s = b.distance;
                                        d = distDiffer.push(s);
                                    }
                                });
                            });
                            for (i = 0; i < d; i++) {
                                users[i].distance = distDiffer[i];
                                if (distDiffer[i] != 0) {
                                    arr.push(users[i]);
                                }
                            }


                            /************************/
                            request(options1, function (error, response, body1) {
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

                                /************************/


                                if (err)
                                    res.json({
                                        success: false,
                                        msg: err.message
                                    });

                                res.status(200).json({
                                    data: arr,
                                    designation: designation,
                                    job_budget: budget,
                                    jobtype: jobtype,
                                    jobId: jobId,
                                });
                            });
                        });
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

/*Search Jobs or Users */
router.post('/get-newSearchUsers/:id', auth, function (req, res) {
    var jobId = req.params.id;
    var cartUser = '';
    var cartUser = req.body.users;
    /////////////////////////Same location user/////////////////////////////
    var users_dup = [];
    var users_dup_list = [];
    var users_dup_only = [];
    var users_dup_inner = [];
    var duplicateArr = [];
    /////////////////////////Same location user/////////////////////////////
    _skcartUserFilter = ' ';
    try {

        if (cartUser) {
            if (typeof cartUser == 'object') {
                _skcartUserFilter = ` AND u.id NOT IN (`
                cartUser.forEach(function (a) {
                    _skcartUserFilter += a + ','
                })
                _skcartUserFilter += `0 ) `
            } else {
                _skcartUserFilter = ` AND u.id NOT IN (${cartUser}) `
            }
        }
        db.query('SELECT jobTypeId, latitude as site_latitude,longitude as site_longitude FROM jobs JOIN jobsites ON (jobsites.id = jobs.siteId) where jobs.id=?', jobId, function (err, rows) {
            var jobtype = rows[0].jobTypeId;
            db.query('SELECT id AS designationId, skill_level, designation_name FROM designation WHERE job_type=?', jobtype, function (err, designation) {
                db.query('SELECT predicated_budget FROM jobs WHERE id=?', jobId, function (err, budget) {
                    db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.role, u.email, u.ratings, IFNULL(u.profileImg, "") AS profileImg, IFNULL(u.phone_number, "") AS phone_number, IFNULL(u.newAddress, "") AS newAddress, IFNULL(u.latitude, "") AS latitude, IFNULL(u.longitude, "") AS longitude, j.type_name, count(u.id) as rank, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation, (SELECT id FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designationId, IFNULL((select (total_score-(wrong_answer_count*neg_mark)) as totalS from results where userId=u.id ORDER by exam_date+end_time desc limit 1), "") as total_score, (SELECT CONCAT(hourly_rate,'/',max_pertime_rate) FROM user_rates AS ur WHERE ur.userId =u.id GROUP by ur.userId) AS rates, ur.hourly_rate, ur.max_pertime_rate, (SELECT jobsites.latitude FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_lat,(SELECT jobsites.longitude as jobsite_long FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_long FROM users u JOIN user_rates AS ur ON (u.id = ur.userId) LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.role=1 AND u.id NOT IN (select user_id from users_job where job_id='${jobId}' ) AND u.id NOT IN (select userId from joboffers where jobId='${jobId}') ${_skcartUserFilter} AND u.jobType=(SELECT jobTypeId FROM jobs WHERE id ='${jobId}') AND u.search=1 GROUP BY u.id order by rank desc`, function (err, users) {
                        var site_latitude = parseFloat(rows[0].site_latitude);
                        var site_longitude = parseFloat(rows[0].site_longitude);
                        distDiffer = [];
                        distDiffer1 = [];
                        parameters = '';
                        parameters1 = '';
                        var d = '';
                        var d1 = '';
                        users.forEach(function (a) {
                            lat = a.latitude;
                            long = a.longitude;
                            /////////////////////////Same location user/////////////////////////////
                            a.duplicate = [];
                            var index = users_dup.indexOf(lat + "#" + long);
                            if (index == -1) {

                                users_dup.push(lat + "#" + long);
                                var indexx = users_dup.indexOf(lat + "#" + long);
                                users_dup_list[indexx] = users_dup_list[indexx] || [];
                                users_dup_list[indexx].push(a);
                            } else {
                                users_dup_list[index] = users_dup_list[index] || [];
                                users_dup_list[index].push(a);

                            }
                            /////////////////////////Same location user/////////////////////////////
                            // users_dup[lat][long]=lat+"-"+long;
                            // if(users_dup[lat][long])
                            //  users_dup.push();

                            /************************/
                            jobsitelat = a.jobsite_lat;
                            jobsitelong = a.jobsite_long;
                            /************************/

                            parameters += `${parameters ? '|' : ''}${a.latitude},${a.longitude}`

                            /************************/

                            parameters1 += `${parameters1 ? '|' : ''}${a.jobsite_lat ? a.jobsite_lat : 0},${a.jobsite_long ? a.jobsite_long : 0}`
                            /************************/
                        });

                        /////////////////////////Same location user/////////////////////////////
                        users_dup_list.forEach(function (kk) {
                            if (kk.length == 1) {
                                users_dup_inner.push(kk.pop());
                            } else {
                                duplicateArr = [];
                                kk.forEach(function (k, v) {
                                    duplicateArr.push(k);
                                });
                                kk[kk.length - 1].duplicate = JSON.stringify(duplicateArr)
                                users_dup_inner.push(kk[kk.length - 1]);
                            }

                        });
                        users_dup_only = users_dup_inner;

                        /////////////////////////Same location user/////////////////////////////
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
                                res.json({
                                    success: false,
                                    msg: err.message
                                });
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
                                        var s = b.distance;
                                        d = distDiffer.push(s);
                                    }
                                });
                            });
                            for (i = 0; i < d; i++) {
                                users[i].distance = distDiffer[i];
                                if (distDiffer[i] != 0) {
                                    arr.push(users[i]);
                                }
                            }


                            /************************/
                            request(options1, function (err, response, body1) {
                                if (err)
                                    res.json({
                                        success: false,
                                        msg: err.message
                                    });
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

                                if (distDiffer1[i] != 0) {
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

                                    /************************/




                                    res.status(200).json({
                                        /////////////////////////Same location user/////////////////
                                        data: users_dup_only,
                                        /////////////////////////Same location user/////////////////
                                        // data: arr,
                                        // designation: designation,
                                        job_budget: budget,
                                        jobtype: jobtype,
                                        jobId: jobId,
                                    });
                                } else {
                                    return res.status(403).json(createResponse('Success', 108));
                                }


                            });
                        });
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

/*Job Offers from Add To cart */
router.post('/userCart', auth, function (req, res) {
    try {
        var user_id = req.user.uid;
        var users1 = req.body.users;
        var user = users1.split(",");
        var budget = req.body.Ammount;
        var predicated_budget = budget.split(",")
        var suuum = 0;
        predicated_budget.forEach(budget => {
            suuum += parseFloat(budget);
        });
        user.forEach(function (k1, a1) {

            predicated_budget.forEach(function (k2, a2) {

                if (a1 == a2) {

                    db.query('INSERT INTO joboffers (userId, jobId, offeredBy, predicated_budget)VALUES (?, ?, ?, ?)', [k1, req.body.jobId, user_id, k2], function (err) {
                        db.query('SELECT email FROM users where id=?', user, function (err, row) {

                            if (err)
                                res.json({
                                    success: false,
                                    msg: err.message
                                });
                        });
                    });
                    /*  db.query('SELECT predicated_budget FROM jobs WHERE id =?', req.body.jobId, function (err, rows) {
                         var sum = parseFloat(rows[0].predicated_budget);
                         sum += parseFloat(predicated_budget);
                         db.query('UPDATE jobs SET predicated_budget = ? WHERE id = ?', [sum, req.body.jobId], function (err) {
                             if (err)
                                 console.error(err.message)
                         });
                     }); */
                }

            });
        });
        db.query('SELECT predicated_budget FROM jobs WHERE id =?', req.body.jobId, function (err, rows) {
            var sum = parseFloat(rows[0].predicated_budget);
            sum += suuum;
            db.query('UPDATE jobs SET predicated_budget = ? WHERE id = ?', [sum, req.body.jobId], function (err) {
                if (err)
                    console.error(err.message)
            });
        });
        return res.status(200).json(createResponse('Success', 71));
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/*End */

/* API update new user profile */
router.post('/update-userProfileNew', auth, [
        check('firstName').not().isEmpty().withMessage('Name must have more than 2 characters'),
        check('lastName').not().isEmpty().withMessage('Name must have more than 2 characters'),
        // check('Date of birth is required').not().isEmpty()
    ],
    function (req, res) {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                errors: utils.createErrorResponse(errors.array())
            });
        }
        try {
            var user = req.user;
            var userId = user.uid;
            // var sk = req.body.skills;
            // var sks = sk.split(",");
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
                    dob: moment(req.body.dob).format('YYYY-MM-DD'),
                    phone_number: req.body.phone_number,
                    preferredName: req.body.preferredName,
                    jobType: req.body.jobType,
                    experience: experience,
                    newAddress: req.body.newAddress,
                    latitude: req.body.latitude,
                    longitude: req.body.longitude
                };
            } else {
                var imageFile = req.files.Img;
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
                        dob: moment(req.body.dob).format('YYYY-MM-DD'),
                        phone_number: req.body.phone_number,
                        preferredName: req.body.preferredName,
                        jobType: req.body.jobType,
                        experience: experience,
                        newAddress: req.body.newAddress,
                        latitude: req.body.latitude,
                        longitude: req.body.longitude,
                        profileImg: fileName
                    };
                    req.session.profileImg = fileName;
                    imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {});
                } else {
                    res.status(403);
                    return res.json(createResponse("FAIL", 9));
                    req.end();
                }
            }
            db.query('UPDATE users SET ? WHERE id = ? ', [data, userId], function (err, rows) {
                db.query('delete from user_skills where user_id=?', userId);
                // sk.forEach(function (a) {
                /*  sks.forEach(function (a) {
                     db.query('INSERT INTO user_skills (user_id, skill_id)VALUES (?, ?)', [userId, a], function (err) {
                         if (err)
                             res.json({
                                 success: false,
                                 msg: err.message
                             });
                     });
                 }) */
                res.status(200);
                return res.json(createResponse("Success", 10));
            });
        } catch (err) {
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }
    });
/*End */


/*End */

/*Get Difference Between Distance */
router.get('/get-distanceDiffer/:user_id/:job_id', auth, function (req, res) {
    try {
        db.query('SELECT jobTypeId, latitude as site_latitude,longitude as site_longitude FROM jobs JOIN jobsites ON (jobsites.id = jobs.siteId) where jobs.id=?', req.params.job_id, function (err, rows) {
            db.query('SELECT latitude, longitude FROM users WHERE id = ?', req.params.user_id, function (err, users) {
                var site_latitude1 = parseFloat(rows[0].site_latitude);
                var site_longitude1 = parseFloat(rows[0].site_longitude);
                var lat1 = parseFloat(users[0].latitude);
                var log1 = parseFloat(users[0].longitude);
                options = {
                    uri: 'https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=' + site_latitude1 + ',' + site_longitude1 + '&destinations=' + lat1 + '%2C' + log1 + '&key=AIzaSyCgUP8KQ_skTDXdPTWbDo1IEG2BhkKzk2I',
                    timeout: 200000000,
                    followAllRedirects: true
                };
                request(options, function (error, response, body) {
                    var jsonData = JSON.parse(body);
                    var dist_Differ = JSON.parse(jsonData.rows[0].elements[0].distance.value);

                    if (err)
                        res.json({
                            success: false,
                            msg: err.message
                        });
                    res.status(200).json({
                        distance_difference: dist_Differ
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


/*Add Company*/
router.post('/add-company', auth, [
    check('company_name', 'Company Name is required').not().isEmpty(),
    check('company_code', 'Company Code is required').not().isEmpty()
], function (req, res) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                errors: utils.createErrorResponse(errors.array())
            });
        }
        if (!req.files) {
            res.status(403).json(createResponse("FAIL", 81));
        } else {
            var imageFile = req.files.company_logo;
            let imageExtension = imageFile.name.split('.');
            if (imageExtension[1] == "jpg" || imageExtension[1] == "JPG" || imageExtension[1] == "jpeg" || imageExtension[1] == "JPEG" || imageExtension[1] == "png" || imageExtension[1] == "PNG" || imageExtension[1] == "pdf" || imageExtension[1] == "PDF") {
                let ext = imageExtension[(imageExtension).length - 1];
                var image = image + '_' + new Date().toISOString();
                new_image = md5(image);
                new_image = new_image + '.' + ext;
                let fileName = new_image;
                var uploadPath = 'uploads/company_logo';
                var data = {
                    company_name: req.body.company_name,
                    company_code: req.body.company_code,
                    company_logo: fileName,
                    description: req.body.description
                };
                imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {
                    db.query('INSERT INTO company SET ?', data, function (err, rows, fields) {
                        if (err)
                            res.json({
                                success: false,
                                msg: err.message
                            });
                        res.status(200).json(createResponse("SUCCESS", 77));
                    });
                });
            } else {
                res.status(403).json(createResponse("FAIL", 78));
            }
        }
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))
    }
});
/*End*/

/*view-company API */
router.get('/view-company', auth, function (req, res) {
    try {
        db.query('SELECT id, company_name, company_code, company_logo FROM company WHERE active=1', function (err, rows) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json({
                companyList: rows
            });
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))
    }
});
/*End */

/*Edit Company */
router.post('/edit-company/:id', auth, function (req, res) {
    try {
        if (!req.files) {
            var data = {
                company_name: req.body.company_name,
                company_code: req.body.company_code,
                description: req.body.description
            };
        } else {
            var imageFile = req.files.company_logo;
            let imageExtension = imageFile.name.split('.');
            if (imageExtension[1] == "jpg" || imageExtension[1] == "JPG" || imageExtension[1] == "jpeg" || imageExtension[1] == "JPEG" || imageExtension[1] == "png" || imageExtension[1] == "PNG" || imageExtension[1] == "pdf" || imageExtension[1] == "PDF") {
                let ext = imageExtension[(imageExtension).length - 1];
                var image = image + '_' + new Date().toISOString();
                new_image = md5(image);
                new_image = new_image + '.' + ext;
                let fileName = new_image;
                var uploadPath = 'uploads/company_logo';
                var data = {
                    company_name: req.body.company_name,
                    company_code: req.body.company_code,
                    company_logo: fileName,
                    description: req.body.description

                };
                imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {});
            } else {
                res.status(403).json(createResponse("FAIL", 78));
            }
        }
        db.query('UPDATE company SET ? WHERE id = ? ', [data, req.params.id], function (err, rows, fields) {
            if (err) {
                res.json({
                    success: false,
                    msg: err.message
                });
            } else {
                res.status(200).json(createResponse("Success", 79));
            }
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))
    }
});
/*End */

/* Delete Company */
router.get('/deleteCompany/:id', auth, function (req, res) {
    try {
        db.query('UPDATE company SET active=0 WHERE id=?', req.params.id, function (err) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            res.status(200).json(createResponse("Success", 80));
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))
    }
});
/*End */

/* --------------------------------------------------------------------------------- */

/* GET HR Technician profile */
router.get('/hr-techProfile/:id', auth, function (req, res) {
    var id = req.params.id;
    db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, u.dob, u.email, u.experience, u. newAddress, jt.type_name, s.skill_name, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = ?)) as designation, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) AS skills FROM users AS u LEFT JOIN jobtype AS jt ON(u.jobType=jt.id) LEFT JOIN skills AS s ON(u.skills=s.id) where u.id=?', [id, id], function (err, rows) {
        db.query('SELECT AVG(rating) as total_rating, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=1) AS Workmanship_Quality, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=2) AS Attendance_Punctuality, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=3) AS Organization_Cleanliness, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=4) AS Communication_Updates, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=5) AS Worked_Safe, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=6) AS Followed_Instructions_Schedule, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=7) AS Team_Player FROM `user_ratings` WHERE userId=?', [id, id, id, id, id, id, id, id], function (err, rating) {
            db.query('SELECT userId, hourly_rate, max_pertime_rate FROM user_rates WHERE userId=?', id, function (err, rate) {
                db.query('SELECT exam_date, start_time, end_time, question, no_of_given_answer, level_1_score, level_2_score, level_3_score, total_score, wrong_answer_count, neg_mark FROM `results` WHERE userId=?', id, function (err, result) {
                    if (err)
                        res.json({
                            success: false,
                            msg: err.message
                        });
                    return res.status(200).json({
                        user: rows,
                        rating: rating[0],
                        designationRate: rate[0],
                        userResult: result[0],
                    });
                });
            });
        });
    });
});

/*Change Rate API */
router.post('/updateRate', auth, [
    check('hourly_rate', 'Hourly Rate Field is required').not().isEmpty(),
    check('max_pertime_rate', 'Max Rate Field is required').not().isEmpty()
], function (req, res) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                errors: utils.createErrorResponse(errors.array())
            });
        }
        var data = {
            hourly_rate: req.body.hourly_rate,
            max_pertime_rate: req.body.max_pertime_rate
        };
        db.query('UPDATE user_rates SET ? WHERE userId = ?', [data, req.body.user_id], function (err) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json(createResponse('Success', 75));
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* GET To manage designation */
router.get('/manage-designationRate/:jobType/:designationId', auth, function (req, res) {
    try {

        db.query('SELECT j.id, j.type_name, d.id as designationId, d.skill_level, d.designation_name, d.hourly_rate,d.max_pertime_rate FROM jobtype AS j JOIN designation AS d ON (j.id = d.job_type) WHERE j.active=1 AND d.job_type=? AND d.id=?', [req.params.jobType, req.params.designationId], function (err, designationData) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            res.json({
                success: true,
                data: designationData
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }

});

/* POST to manage designation */
router.post('/update-designation', auth, function (req, res) {
    try {

        var id = req.body.designation_id;
        var data = {
            hourly_rate: req.body.hourly_rate,
            max_pertime_rate: req.body.max_pertime_rate,
        };
        db.query('UPDATE designation SET ? WHERE id = ? ', [data, id], function (err) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json(createResponse('Success', 85));
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/*18/11/19 */
/* GET to Map View */
router.get('/plannerMap-view', auth, function (req, res) {
    try {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.email, u.dob, u.experience, u.id, u.phone_number, u.newAddress, u.profileImg, u.role, u.latitude, u.longitude From users AS u WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=2 AND u.status=1`, function (err, plannerList) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json({
                plannerList: plannerList
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }

});

/* GET to Map View */
router.get('/plannerNewMapView', auth, function (req, res) {
    /////////////////////////Same location user/////////////////////////////
    var users_dup = [];
    var users_dup_list = [];
    var users_dup_only = [];
    var users_dup_inner = [];
    var duplicateArr = [];
    /////////////////////////Same location user/////////////////////////////
    try {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.email, u.dob, u.experience, u.id, u.phone_number, u.newAddress, u.profileImg, u.role, u.latitude, u.longitude From users AS u WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=2 AND u.status=1`, function (err, plannerList) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            /////////////////////////Same location user/////////////////////////////
            plannerList.forEach(function (a) {
                lat = a.latitude;
                long = a.longitude;
                a.duplicate = [];
                var index = users_dup.indexOf(lat + "#" + long);
                if (index == -1) {

                    users_dup.push(lat + "#" + long);
                    var indexx = users_dup.indexOf(lat + "#" + long);
                    users_dup_list[indexx] = users_dup_list[indexx] || [];
                    users_dup_list[indexx].push(a);
                } else {
                    users_dup_list[index] = users_dup_list[index] || [];
                    users_dup_list[index].push(a);

                }
            });

            users_dup_list.forEach(function (kk) {
                if (kk.length == 1) {
                    users_dup_inner.push(kk.pop());
                } else {
                    duplicateArr = [];
                    kk.forEach(function (k, v) {
                        duplicateArr.push(k);
                    });
                    kk[kk.length - 1].duplicate = JSON.stringify(duplicateArr)
                    users_dup_inner.push(kk[kk.length - 1]);
                }

            });
            users_dup_only = users_dup_inner;
            /////////////////////////Same location user/////////////////////////////
            return res.status(200).json({
                // plannerList: plannerList,
                /////////////////////////Same location user/////////////////
                plannerList: users_dup_only,
                /////////////////////////Same location user/////////////////
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }

});

/* GET to Supervisor Map View For Planner & hr */
router.get('/supervisorMap-view', auth, function (req, res) {
    try {
        var a = db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.phone_number, u.newAddress, u.profileImg, u.role, u.email, IFNULL(u.dob, "") AS dob, u.latitude, u.longitude, j.type_name, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) AS skills From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=3 AND u.status=1`, function (err, supervisorList) {
            console.log(a.sql, 'qqaaaaaaa')
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json({
                supervisorList: supervisorList
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});


/* GET to Supervisor Map View For Planner & hr */
router.get('/supervisorNewMapView', auth, function (req, res) {
    /////////////////////////Same location user/////////////////////////////
    var users_dup = [];
    var users_dup_list = [];
    var users_dup_only = [];
    var users_dup_inner = [];
    var duplicateArr = [];
    /////////////////////////Same location user/////////////////////////////
    try {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.phone_number, u.newAddress, u.profileImg, u.role, u.email, u.dob, u.latitude, u.longitude, j.type_name, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) AS skills From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=3 AND u.status=1`, function (err, supervisorList) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            /////////////////////////Same location user/////////////////////////////
            supervisorList.forEach(function (a) {
                lat = a.latitude;
                long = a.longitude;
                a.duplicate = [];
                var index = users_dup.indexOf(lat + "#" + long);
                if (index == -1) {

                    users_dup.push(lat + "#" + long);
                    var indexx = users_dup.indexOf(lat + "#" + long);
                    users_dup_list[indexx] = users_dup_list[indexx] || [];
                    users_dup_list[indexx].push(a);
                } else {
                    users_dup_list[index] = users_dup_list[index] || [];
                    users_dup_list[index].push(a);

                }
            });

            users_dup_list.forEach(function (kk) {
                if (kk.length == 1) {
                    users_dup_inner.push(kk.pop());
                } else {
                    duplicateArr = [];
                    kk.forEach(function (k, v) {
                        duplicateArr.push(k);
                    });
                    kk[kk.length - 1].duplicate = JSON.stringify(duplicateArr)
                    users_dup_inner.push(kk[kk.length - 1]);
                }

            });
            users_dup_only = users_dup_inner;
            /////////////////////////Same location user/////////////////////////////
            return res.status(200).json({
                // supervisorList: supervisorList,
                /////////////////////////Same location user/////////////////
                supervisorList: users_dup_only,
                /////////////////////////Same location user/////////////////
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* GET to Map View */
router.get('/hr-technicianMapView', auth, function (req, res) {
    try {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.dob, u.experience, u.ratings, u.profileImg, u.phone_number, u.role, u.latitude, u.longitude, j.type_name, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) AS skills, GROUP_CONCAT(jobName) as jobName, GROUP_CONCAT(jobCode) as jobCode, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1 GROUP by u.id`, function (err, usersList) {
            db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.dob, u.experience, u.ratings, u.profileImg, u.phone_number, u.role, u.latitude, u.longitude, j.type_name, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) AS skills, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) LEFT JOIN users_job AS uj ON(u.id=uj.user_id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND u.id NOT IN (SELECT u.id From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1) GROUP by u.id`, function (err, jobUsersDetail) {
                var list = usersList.concat(jobUsersDetail);
                if (err)
                    res.json({
                        success: false,
                        msg: err.message
                    });
                return res.status(200).json({
                    list: list
                });
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }

});

/* GET to Map View */
router.get('/hrNewTechnicianMapView', auth, function (req, res) {
    /////////////////////////Same location user/////////////////////////////
    var users_dup = [];
    var users_dup_list = [];
    var users_dup_only = [];
    var users_dup_inner = [];
    var duplicateArr = [];
    /////////////////////////Same location user/////////////////////////////
    try {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.dob, u.experience, u.ratings, u.profileImg, u.phone_number, u.role, u.latitude, u.longitude, j.type_name, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) AS skills, GROUP_CONCAT(jobName) as jobName, GROUP_CONCAT(jobCode) as jobCode, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1 GROUP by u.id`, function (err, usersList) {
            db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.dob, u.experience, u.ratings, u.profileImg, u.phone_number, u.role, u.latitude, u.longitude, j.type_name, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) AS skills, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) LEFT JOIN users_job AS uj ON(u.id=uj.user_id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND u.id NOT IN (SELECT u.id From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1) GROUP by u.id`, function (err, jobUsersDetail) {
                var list = usersList.concat(jobUsersDetail);
                if (err)
                    res.json({
                        success: false,
                        msg: err.message
                    });
                /////////////////////////Same location user/////////////////////////////
                list.forEach(function (a) {
                    lat = a.latitude;
                    long = a.longitude;
                    a.duplicate = [];
                    var index = users_dup.indexOf(lat + "#" + long);
                    if (index == -1) {

                        users_dup.push(lat + "#" + long);
                        var indexx = users_dup.indexOf(lat + "#" + long);
                        users_dup_list[indexx] = users_dup_list[indexx] || [];
                        users_dup_list[indexx].push(a);
                    } else {
                        users_dup_list[index] = users_dup_list[index] || [];
                        users_dup_list[index].push(a);

                    }
                });

                users_dup_list.forEach(function (kk) {
                    if (kk.length == 1) {
                        users_dup_inner.push(kk.pop());
                    } else {
                        duplicateArr = [];
                        kk.forEach(function (k, v) {
                            duplicateArr.push(k);
                        });
                        kk[kk.length - 1].duplicate = JSON.stringify(duplicateArr)
                        users_dup_inner.push(kk[kk.length - 1]);
                    }

                });
                users_dup_only = users_dup_inner;
                /////////////////////////Same location user/////////////////////////////
                return res.status(200).json({
                    // list: list,
                    /////////////////////////Same location user/////////////////
                    list: users_dup_only,
                    /////////////////////////Same location user/////////////////
                });
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }

});

/* GET to Map View */
router.get('/hr-mapView', auth, function (req, res) {
    try {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.phone_number, u.latitude, u.longitude, u.role, u.ratings, j.type_name, GROUP_CONCAT(jobName) as jobName, GROUP_CONCAT(jobCode) as jobCode From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1 GROUP by u.id`, function (err, jobUsersList) {
            db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.phone_number, u.latitude, u.longitude, u.role, u.ratings, j.type_name From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) LEFT JOIN users_job AS uj ON(u.id=uj.user_id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND u.id NOT IN (SELECT u.id From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1) GROUP by u.firstName`, function (err, usersList) {

                db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.email, u.dob, u.experience, u.id, u.phone_number, u.newAddress, u.profileImg, u.role, u.latitude, u.longitude From users AS u WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=2 AND u.status=1`, function (err, plannerList) {

                    db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.phone_number, u.newAddress, u.profileImg, u.role, u.email, u.dob, u.latitude, u.longitude, j.type_name, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) AS skills From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=3 AND u.status=1`, function (err, supervisorList) {

                        db.query(`SELECT js.id, js.sitesCodeCpy AS sitesCode, js.siteName, js.newAddress, js.latitude, js.longitude, u.firstName AS supervisorName, u.lastName AS supervisorLastName, us.firstName AS plannerName, us.lastName AS plannerLastName, (SELECT GROUP_CONCAT(firstName,' ',lastName) AS name FROM user_sites AS us JOIN users AS u ON (us.user_id=u.id) WHERE us.user_role=1 AND us.is_current=1 AND us.site_id=js.id) AS technicianList FROM jobsites AS js LEFT JOIN users AS u ON (js.supervisors=u.id) LEFT JOIN users AS us ON (js.planner=us.id)WHERE js.latitude IS NOT NULL AND js.latitude != ''`, function (err, jobSiteList) {

                            var list = jobUsersList.concat(usersList, plannerList, supervisorList, jobSiteList);

                            if (err) {
                                res.json({
                                    success: false,
                                    msg: err.message
                                });
                            } else {

                                return res.status(200).json({
                                    list: list
                                });
                            }
                        });
                    });
                });
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }

});

/* GET to Map View */
router.get('/hrNewMapView', auth, function (req, res) {
    /////////////////////////Same location user/////////////////////////////
    var users_dup = [];
    var users_dup_list = [];
    var users_dup_only = [];
    var users_dup_inner = [];
    var duplicateArr = [];
    /////////////////////////Same location user/////////////////////////////
    try {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.phone_number, u.latitude, u.longitude, u.role, u.ratings, j.type_name, GROUP_CONCAT(jobName) as jobName, GROUP_CONCAT(jobCode) as jobCode From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1 GROUP by u.id`, function (err, jobUsersList) {
            db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.phone_number, u.latitude, u.longitude, u.role, u.ratings, j.type_name From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) LEFT JOIN users_job AS uj ON(u.id=uj.user_id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND u.id NOT IN (SELECT u.id From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1) GROUP by u.firstName`, function (err, usersList) {

                db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.email, u.dob, u.experience, u.id, u.phone_number, u.newAddress, u.profileImg, u.role, u.latitude, u.longitude From users AS u WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=2 AND u.status=1`, function (err, plannerList) {

                    db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.phone_number, u.newAddress, u.profileImg, u.role, u.email, u.dob, u.latitude, u.longitude, j.type_name, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) AS skills From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=3 AND u.status=1`, function (err, supervisorList) {

                        db.query(`SELECT js.id, js.sitesCodeCpy AS sitesCode, js.siteName, js.newAddress, js.latitude, js.longitude, u.firstName AS supervisorName, u.lastName AS supervisorLastName, us.firstName AS plannerName, us.lastName AS plannerLastName, (SELECT GROUP_CONCAT(firstName,' ',lastName) AS name FROM user_sites AS us JOIN users AS u ON (us.user_id=u.id) WHERE us.user_role=1 AND us.is_current=1 AND us.site_id=js.id) AS technicianList FROM jobsites AS js LEFT JOIN users AS u ON (js.supervisors=u.id) LEFT JOIN users AS us ON (js.planner=us.id)WHERE js.latitude IS NOT NULL AND js.latitude != ''`, function (err, jobSiteList) {

                            var list = jobUsersList.concat(usersList, plannerList, supervisorList, jobSiteList);

                            if (err) {
                                res.json({
                                    success: false,
                                    msg: err.message
                                });
                            } else {
                                /////////////////////////Same location user/////////////////////////////
                                list.forEach(function (a) {
                                    lat = a.latitude;
                                    long = a.longitude;
                                    a.duplicate = [];
                                    var index = users_dup.indexOf(lat + "#" + long);
                                    if (index == -1) {

                                        users_dup.push(lat + "#" + long);
                                        var indexx = users_dup.indexOf(lat + "#" + long);
                                        users_dup_list[indexx] = users_dup_list[indexx] || [];
                                        users_dup_list[indexx].push(a);
                                    } else {
                                        users_dup_list[index] = users_dup_list[index] || [];
                                        users_dup_list[index].push(a);

                                    }
                                });

                                users_dup_list.forEach(function (kk) {
                                    if (kk.length == 1) {
                                        users_dup_inner.push(kk.pop());
                                    } else {
                                        duplicateArr = [];
                                        kk.forEach(function (k, v) {
                                            duplicateArr.push(k);
                                        });
                                        kk[kk.length - 1].duplicate = JSON.stringify(duplicateArr)
                                        users_dup_inner.push(kk[kk.length - 1]);
                                    }

                                });
                                users_dup_only = users_dup_inner;
                                /////////////////////////Same location user/////////////////////////////

                                return res.status(200).json({
                                    // list: list,
                                    /////////////////////////Same location user/////////////////
                                    list: users_dup_only,
                                    /////////////////////////Same location user/////////////////
                                });
                            }
                        });
                    });
                });
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }

});

/* GET to edit intime & outtime on taskreporting table*/
router.post('/InTime-OutTime', auth, function (req, res) {
    try {

        var userId = req.body.userId;
        var taskreportingId = req.body.id;

        var countHourTime = countHours(req.body.inTime, req.body.outTime);
        /* var checkCountHourTime = checkCountHours(req.body.inTime, req.body.outTime);
        if (checkCountHourTime == 0) {
            return res.status(403).json(createResponse('FAIL', 88));
        } */

        var data = {
            inTime: req.body.inTime,
            outTime: req.body.outTime,
            hours_count: countHourTime,
        };
        db.query('UPDATE taskreporting SET ? WHERE id = ?', [data, taskreportingId], function (err, rows, fields) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json(createResponse('Success', 86));
        });

    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }

});

/* GET Planner & Supervisor edit-job */
router.get('/edit-jobs/:id', auth, function (req, res) {
    try {
        db.query('SELECT GROUP_CONCAT(skill_id) as skills_id, j.id, j.jobName, j.jobCode, j.jobTypeId,j.startDate, j.endDate, j.jobSupervisor, j.description, j.noOfVacancy, j.noOfPhases, j.workingHoursPerDay, j.workingDayPerWeek, j.days_count, j.proposed_budget, js.job_id, GROUP_CONCAT(s.skill_name) as skills_name, jt.type_name FROM jobs as j JOIN job_skills as js ON (j.id = js.job_id) JOIN jobtype AS jt ON (j.jobTypeId = jt.id) JOIN skills AS s ON (js.skill_id = s.id) WHERE j.id = ? AND jt.active=1 AND  s.active=1', req.params.id, function (err, rows) {
            db.query('SELECT id, type_name FROM jobtype WHERE active=1', function (err, row) {
                db.query('SELECT id, skill_name FROM skills WHERE active=1', function (err, skill) {
                    db.query('SELECT id, jobId, phaseName, phaseDescription, startDate, endDate FROM jobphases WHERE jobId=?', req.params.id, function (err, phases) {
                        if (err)
                            res.json({
                                success: false,
                                msg: err.message
                            });
                        return res.status(200).json({
                            jobDetails: rows[0],
                            skill: skill,
                            jobtype: row,
                            jobPhases: phases,
                        });
                    });
                });
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }
});

/* GET to Map View */
router.get('/userMap-view/:id', auth, function (req, res) {
    try {
        var jobId = req.params.id;
        console.log(jobId, 'kios');
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
        var x = db.query('SELECT jobTypeId, latitude as site_latitude, longitude as site_longitude FROM jobs AS j JOIN jobsites AS js ON (js.id = j.siteId) where j.id=?', jobId, function (err, rows) {
            console.log(x.sql, 'query');
            var jobtype = rows[0].jobTypeId;
            // db.query('SELECT id AS designationId, designation_name FROM designation WHERE job_type=?', jobtype, function (err, designation) {
            db.query('SELECT predicated_budget FROM jobs WHERE id=?', jobId, function (err, budget) {
                db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg, u.phone_number, u.email, u.ratings, u.newAddress, u.role, u.latitude, u.longitude, j.type_name, count(u.id) as rank, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation, (select (total_score-(wrong_answer_count*neg_mark)) as totalS from results where userId=u.id ORDER by exam_date+end_time desc limit 1) as total_score,  (SELECT CONCAT(hourly_rate,'/',max_pertime_rate) FROM user_rates AS ur WHERE ur.userId =u.id GROUP by ur.userId) AS rates FROM users u JOIN user_rates AS ur ON (u.id = ur.userId) LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE firstName LIKE '%${req.params.search ? req.params.search : '%'}%' ${_designationFilter} AND u.jobType=(SELECT jobTypeId FROM jobs WHERE id ='${jobId}') AND u.role=1 AND u.id NOT IN (select user_id from users_job where job_id=? ) AND u.id NOT IN (select userId from joboffers where jobId=? ) AND u.search=1 GROUP BY u.id order by rank desc`, [jobId, jobId], function (err, users) {

                    var site_latitude = parseFloat(rows[0].site_latitude);
                    var site_longitude = parseFloat(rows[0].site_longitude);
                    distDiffer = [];
                    parameters = '';
                    var d = '';
                    users.forEach(function (a) {
                        lat = a.latitude;
                        long = a.longitude;
                        parameters += `${parameters ? '|' : ''}${a.latitude},${a.longitude}`
                    });
                    options = {
                        uri: 'https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=' + parameters + '&destinations=' + site_latitude + '%2C' + site_longitude + '&key='+config.apiKey,
                        timeout: 200000000,
                        followAllRedirects: true
                    };

                    request(options, function (error, response, body) {
                        var jsonData = JSON.parse(body);
                        var row = jsonData.rows;
                        row.forEach(function (a) {
                            var element = a.elements;
                            element.forEach(function (b) {
                                // var s = b.distance.value;
                                // d = distDiffer.push(s);

                                if (b.status == 'OK') {
                                    var s = b.distance.text;
                                    d = distDiffer.push(s);
                                } else {
                                    var s = b.distance;
                                    d = distDiffer.push(s);
                                }

                            });
                        });
                        for (i = 0; i < d; i++) {
                            users[i].distance = distDiffer[i];
                        }
                        if (err)
                            res.json({
                                success: false,
                                msg: err.message
                            });
                        res.status(200).json({
                            users: users,
                            // designation: designation,
                            job_budget: budget,
                            jobtype: jobtype,
                            jobId: jobId,
                            // });
                        });
                    });
                });
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }

});

/* GET Filter users on map */
router.post('/searchUsersOnMap', auth, function (req, res) {
    try {
        var jobId = req.body.jobId;
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

        db.query('SELECT jobTypeId, latitude as site_latitude,longitude as site_longitude FROM jobs AS j JOIN jobsites AS js ON (js.id = j.siteId) where j.id=?', jobId, function (err, rows) {
            var jobtype = rows[0].jobTypeId;
            db.query('SELECT id AS designationId, skill_level, designation_name FROM designation WHERE job_type=?', jobtype, function (err, designation) {
                db.query('SELECT predicated_budget FROM jobs WHERE id=?', jobId, function (err, budget) {
                    // db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg,u.newAddress, u.latitude, u.longitude, u.ratings, u.latitude, u.longitude, count(user_id) as rank, (select GROUP_CONCAT(skill_name) from skills s join user_skills us2 on us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) as skills FROM user_skills us JOIN job_skills js on us.skill_id = js.skill_id JOIN users u on u.id = us.user_id WHERE js.job_id = ? ${_designationFilter} ${_ratingFilter} AND firstName LIKE '%${req.body.search ? req.body.search : '%'}%' AND u.role=1 AND u.latitude IS NOT NULL AND u.latitude != '' AND u.search=1 GROUP BY us.user_id order by rank desc`, [jobId, jobId], function (err, users) {

                    db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg, u.phone_number, u.email, u.ratings, u.newAddress, u.role, u.latitude, u.longitude, j.type_name, count(u.id) as rank, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation, (select (total_score-(wrong_answer_count*neg_mark) ) as totalS from results where userId=u.id ORDER by exam_date+end_time desc limit 1) as total_score, (SELECT CONCAT(hourly_rate,'/',max_pertime_rate) FROM user_rates AS ur WHERE ur.userId =u.id GROUP by ur.userId) AS rates FROM users u JOIN user_rates AS ur ON (u.id = ur.userId) LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE firstName LIKE '%${req.body.search ? req.body.search : '%'}%' ${_designationFilter} ${_ratingFilter} AND u.jobType=(SELECT jobTypeId FROM jobs WHERE id ='${jobId}') AND u.role=1 AND u.id NOT IN (select user_id from users_job where job_id=? ) AND u.id NOT IN (select userId from joboffers where jobId=? ) AND u.search=1 GROUP BY u.id order by rank desc`, [jobId, jobId], function (err, users) {

                        var cart = req.params.id;
                        var site_latitude = parseFloat(rows[0].site_latitude);
                        var site_longitude = parseFloat(rows[0].site_longitude);
                        distDiffer = [];
                        parameters = '';
                        var d = '';
                        users.forEach(function (a) {
                            lat = a.latitude;
                            long = a.longitude;
                            parameters += `${parameters ? '|' : ''}${a.latitude},${a.longitude}`
                        });
                        options = {
                            uri: 'https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=' + parameters + '&destinations=' + site_latitude + '%2C' + site_longitude + '&key='+config.apiKey,
                            timeout: 200000000,
                            followAllRedirects: true
                        };
                        request(options, function (error, response, body) {
                            var jsonData = JSON.parse(body);
                            var row = jsonData.rows;
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
                            for (i = 0; i < d; i++) {
                                users[i].distance = distDiffer[i];
                            }
                            if (err)
                                res.json({
                                    success: false,
                                    msg: err.message
                                });
                            res.status(200).json({
                                users: users,
                                designation: designation,
                                job_budget: budget,
                                jobtype: jobtype,
                                jobId: jobId,
                                search: req.body.search
                            });
                        });
                    });
                });
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }


});


/* POST to send job notification */
router.post('/map-jobNotification', auth, async function (req, res) {
    try {
        var id = req.body.id;
        var jobId = req.body.jobId;
        var distance = req.body.distance;

        db.query('SELECT ur.hourly_rate, ur.max_pertime_rate, d.skill_level, d.designation_name, d.id AS designationID FROM user_rates AS ur LEFT JOIN user_designation AS ud ON (ur.userId=ud.user_id) LEFT JOIN designation AS d ON (ud.designation_id=d.id) WHERE ur.userId = ?', id, function (err, rates) {

            db.query('SELECT workingHoursPerDay FROM jobs WHERE id= ?', jobId, function (err, hours) {

                if (err)
                    console.error(err.message)
                var hours = hours[0].workingHoursPerDay;
                // var budget = (rates[0].max_pertime_rate + rates[0].hourly_rate + (distance * 0.58));
                var budget = (420 / 7 + 14.00 * hours + (distance * 0.58));
                if ((rates[0].designationID <= 1 && rates[0].designationID <= 4) || ((rates[0].designationID >= 11 && rates[0].designationID <= 14))) {

                    var predicated_budget = budget * 20 / 100;
                    var total_predicated_budget = budget + predicated_budget;
                } else if ((rates[0].designationID <= 5 && rates[0].designationID <= 8) || ((rates[0].designationID >= 15 && rates[0].designationID <= 18))) {

                    var predicated_budget = budget * 25 / 100;
                    var total_predicated_budget = budget + predicated_budget;
                    /* } else if ((rates[0].designationID <= 9 && rates[0].designationID <= 10) || ((rates[0].designationID >= 19 && rates[0].designationID <= 20))) { */
                } else {

                    var predicated_budget = budget * 30 / 100;
                    var total_predicated_budget = budget + predicated_budget;
                }

                var data = {
                    userId: id,
                    jobId: jobId,
                    offeredBy: req.user.uid,
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
                                res.json({
                                    success: false,
                                    msg: err.message
                                });

                            /* var transporter = nodemailer.createTransport({
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
                                    
                            }); */
                            return res.status(200).json(createResponse('Success', 87));
                        });
                    });
                });
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* POST to get user rates to show on predicated budget on user map view */
router.post('/getUserRates/:id/:jobId/:distance', auth, function (req, res) {
    try {

        var userId = req.params.id;
        var jobId = req.params.jobId;
        var distance = req.params.distance;
        db.query('SELECT ur.hourly_rate, ur.max_pertime_rate, d.skill_level, d.designation_name, d.id AS designationID FROM user_rates AS ur LEFT JOIN user_designation AS ud ON (ur.userId=ud.user_id) LEFT JOIN designation AS d ON (ud.designation_id=d.id) WHERE ur.userId = ?', userId, function (err, rates) {
            db.query('SELECT workingHoursPerDay FROM jobs WHERE id= ?', jobId, function (err, hours) {
                if (err)
                    console.error(err.message)
                var hours = hours[0].workingHoursPerDay;
                // var budget = (rates[0].max_pertime_rate + rates[0].hourly_rate + (distance * 0.58));
                var budget = (420 / 7 + 14.00 * hours + (distance * 0.58));

                if (rates == 'null') {

                    if ((rates[0].designationID >= 1 && rates[0].designationID >= 4) || ((rates[0].designationID >= 11 && rates[0].designationID <= 14))) {

                        var predicated_budget = budget * 20 / 100;
                        var total_predicated_budget = budget + predicated_budget;

                    } else if ((rates[0].designationID >= 5 && rates[0].designationID >= 8) || ((rates[0].designationID >= 15 && rates[0].designationID <= 18))) {

                        var predicated_budget = budget * 25 / 100;
                        var total_predicated_budget = budget + predicated_budget;

                    } else if ((rates[0].designationID >= 9 && rates[0].designationID >= 10) || ((rates[0].designationID >= 19 && rates[0].designationID <= 20))) {

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
                    data: total_predicated_budget
                });
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* POST to change technician password from hr end */
router.post('/hr-ChangePassword', auth, [
    check('newPassword').not().isEmpty().withMessage('New Password is required!'),
    check('confirmNewPassword').not().isEmpty().withMessage('Confirm Password is required!')
], function (req, res) {
    try {
        const {
            newPassword,
            confirmNewPassword
        } = req.body;
        var userId = req.body.id;
        if (newPassword == confirmNewPassword) {
            bcrypt.genSalt(10, (err, salt) => {
                bcrypt.hash(newPassword, salt, (err, hash) => {
                    db.query('UPDATE users SET password= ? WHERE id =?', [hash, userId], function (err) {
                        if (err)
                            console.error(err.message)
                        return res.status(200).json(createResponse('Success', 89));
                    });
                });
            });
        } else {
            return res.status(403).json(createResponse('FAIL', 39));
        }
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }


});

/* GET Technician block-Unblock Status */
router.get('/mark-TechAvilability', auth, function (req, res) {
    try {
        db.query('SELECT id, search from users where id=?', req.user.uid, function (err, rows) {

            if (rows[0].search == 1) {
                db.query('UPDATE users SET search=0 WHERE id=?', req.user.uid, function (err) {

                    if (err)
                        console.error(err.message)
                    return res.json(createResponse("FAIL", 90));
                });
            } else {
                db.query('UPDATE users SET search=1 WHERE id=?', req.user.uid, function (err) {

                    if (err)
                        console.error(err.message)
                    return res.json(createResponse("Success", 91));
                });
            }

        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }
});

/* GET question paper based on subject */
router.get('/giveExam', auth, function (req, res) {
    try {
        var q_ans = [];
        var question_id = [];
        let easyData = [];
        let mediumData = [];
        let highData = [];

        db.query('SELECT jobtype FROM users WHERE id=?', req.user.uid, function (err, randomPaper) {

            db.query('SELECT * FROM exam_rules', function (err, rules) {
                easyData = rules[0].easy;
                mediumData = rules[0].medium;
                highData = rules[0].high;
                db.query('SELECT * FROM questions WHERE active=1 AND sub_id=? AND exam_level=1 AND active=1 ORDER BY RAND() LIMIT ?', [randomPaper[0].jobtype, easyData], function (err, easyData) {
                    easyData.forEach(function (item) {
                        q_ans.push(item)
                    });
                });
                db.query('SELECT * FROM questions WHERE active=1 AND sub_id=? AND exam_level=2 ORDER BY RAND() LIMIT ?', [randomPaper[0].jobtype, mediumData], function (err, mediumData) {
                    mediumData.forEach(function (item) {
                        q_ans.push(item)
                    });
                });
                db.query('SELECT * FROM questions WHERE active=1 AND sub_id=? AND exam_level=3 ORDER BY RAND() LIMIT ?', [randomPaper[0].jobtype, highData], function (err, highData) {
                    highData.forEach(function (item) {
                        q_ans.push(item)
                    });
                    q_ans.forEach(function (item) {
                        question_id.push(item.q_id)
                    });
                    db.query('SELECT neg_marking_value FROM exam_rules', function (err, neg_marks) {
                        var quesId = question_id.toString();
                        var data = {
                            userId: req.user.uid,
                            start_time: new Date(),
                            exam_date: new Date(),
                            question: quesId,
                            neg_mark: neg_marks[0].neg_marking_value
                        };
                        var q = db.query('INSERT INTO results SET ?', data, function (err, rows) {
                            var id = q._results[0]['insertId'];
                            return res.status(200).json({
                                questionAnswers: q_ans,
                                randomQuesPaper: randomPaper,
                                result_id: id,
                            });
                        });
                    });
                });
            });
        })
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }
});


/* POST to save questions & answers */
router.post('/save-QuestionAnser', auth, async function (req, res) {
    try {
        var easy_marks = 0;
        var medium_marks = 0;
        var high_marks = 0;
        var total_marks = 0;
        var wrong_count = 0;
        var not_answered = 0;
        var userId = req.user.uid;
        var end_time = new Date();
        var date1 = new Date();
        var date = date1.toISOString().slice(0, 10)

        var ansData = [];

        var result_id = req.body.result_id;
        var ans = req.body.userAnswers;

        ansData = ans.split(',');
        if(result_id != '') {
            db.query('SELECT id, question FROM results WHERE userId = ? AND exam_date = ? ', [userId, date], function (err, data) {

                var quesData = data[0].question;
                var ques = [];
                if (data == null) {
                    return res.status(403).json(createResponse('FAIL', 92));
                } else {
                    ques = quesData.split(',');

                    for (let key = 0; key < Object.keys(ques).length; key++) {

                        if (ansData[key] === '0') {
                            not_answered++;
                        }

                        db.query('SELECT exam_level FROM questions where q_id = ?', ques[key], async function (err, exam_level) {

                            if (err)
                                console.error(err.message)
                            var levelCount = exam_level[0].exam_level;

                            exam_level = levelCount;

                            if (exam_level == 1) {
                                db.query('SELECT correct_ans FROM questions where q_id = ?', ques[key], function (err, correct_ans) {
                                    if (err)
                                        console.error(err.message)

                                    if (correct_ans[0].correct_ans == ansData[key]) {
                                        var a = 1;
                                    } else {
                                        var a = 0;
                                    }
                                    if (a == 0) {
                                        wrong_count++;
                                    } else {
                                        easy_marks++;
                                        total_marks++;
                                    }
                                    var wrngCount = ((given_ans) - (total_marks));
                                    var result = {
                                        userId: req.user.uid,
                                        end_time: new Date(),
                                        std_answers: ans,
                                        level_1_score: easy_marks,
                                        total_score: total_marks,
                                        wrong_answer_count: wrngCount,
                                        correct_answer_count: total_marks,
                                    };

                                    db.query('UPDATE results SET ? WHERE id = ?', [result, result_id], function (err, rows, fields) {
                                        if (err)
                                            console.error(err.message)

                                    });
                                })
                            }
                            if (exam_level == 2) {
                                db.query('SELECT correct_ans FROM questions where q_id = ?', ques[key], function (err, correct_ans) {
                                    if (err)
                                        console.error(err.message)

                                    if (correct_ans[0].correct_ans == ansData[key]) {
                                        var a = 1;
                                    } else {
                                        var a = 0;
                                    }
                                    if (a == 0) {
                                        wrong_count++;
                                    } else {
                                        medium_marks++;
                                        total_marks++;
                                    }
                                    var wrngCount = ((given_ans) - (total_marks));
                                    var result = {
                                        userId: req.user.uid,
                                        end_time: new Date(),
                                        std_answers: ans,
                                        level_2_score: medium_marks,
                                        total_score: total_marks,
                                        wrong_answer_count: wrngCount,
                                        correct_answer_count: total_marks,
                                    };

                                    db.query('UPDATE results SET ? WHERE id = ? AND exam_date=?', [result, data[0].id, date], function (err, rows, fields) {
                                        if (err)
                                            console.error(err.message)
                                    });
                                })
                            }
                            if (exam_level == 3) {
                                db.query('SELECT correct_ans FROM questions where q_id = ?', ques[key], function (err, correct_ans) {
                                    if (err)
                                        console.error(err.message)

                                    if (correct_ans[0].correct_ans == ansData[key]) {
                                        var a = 1;
                                    } else {
                                        var a = 0;
                                    }
                                    if (a == 0) {
                                        wrong_count++;
                                    } else {
                                        high_marks++;
                                        total_marks++;
                                    }
                                    var wrngCount = ((given_ans) - (total_marks));
                                    var result = {
                                        userId: req.user.uid,
                                        end_time: new Date(),
                                        std_answers: ans,
                                        level_3_score: high_marks,
                                        total_score: total_marks,
                                        wrong_answer_count: wrngCount,
                                        correct_answer_count: total_marks,
                                    };


                                    db.query('UPDATE results SET ? WHERE id = ? AND exam_date=?', [result, data[0].id, date], function (err, rows, fields) {
                                        if (err)
                                            console.error(err.message)
                                    });

                                })
                            }
                        });
                    }

                    var given_ans = ((ansData.length) - (not_answered));
                    db.query('UPDATE results SET no_of_given_answer=? WHERE id = ? AND exam_date=?', [given_ans, data[0].id, date], function (err) {
                        if (err)
                            console.error(err.message)


                    });

                }
            });
            return res.status(200).json(createResponse('Success', 93));
        } else {
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }



});

/* GET to view report on particular user job */
router.get('/report/:id', auth, function (req, res) {
    try {
        var userId = req.user.uid;
        db.query('SELECT id, inTime, jobId, date FROM taskreporting where userId="' + userId + '" AND outTime IS NULL AND jobId=?', req.params.id, function (err, rows) {
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
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* GET get user profile */
router.get('/edit-TechnicianProfile/:id', auth, function (req, res) {
    try {
        var userId = req.params.id;
        db.query('SELECT IFNULL(GROUP_CONCAT(skill_id),"") as skills_id, IFNULL(u.phone_number,"") AS phone_number, IFNULL(u.preferredName,"") AS preferredName, u.profileImg, IFNULL(u.firstName,"") AS firstName , IFNULL(u.lastName,"") AS lastName, u.dob,IFNULL(u.email,"") AS email,IFNULL(u.experience,"") AS experience, u.skills, IFNULL(u.jobType,"") AS jobType,IFNULL(u.country,"") AS country ,IFNULL(u.state,"") AS state , IFNULL(u.city,"") AS city , IFNULL(u.address,"") AS address ,IFNULL(u.newAddress,"") AS newAddress ,IFNULL(u.latitude,"") AS latitude ,IFNULL(u.longitude,"") AS longitude , us.user_id, IFNULL(us.skill_id,"") AS skill_id FROM users as u JOIN user_skills as us ON (u.id = us.user_id) WHERE u.id = ?', userId, function (err, rows) {

            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            res.status(200).json({
                "userId": req.params.id,
                "profile": {
                    "basicProfile": {
                        'firstName': rows[0].firstName,
                        'lastName': rows[0].lastName,
                        'phone number': rows[0].phone_number,
                        'preferredName': rows[0].preferredName,
                        'email': rows[0].email,
                        'birthday': rows[0].dob ? moment(new Date(rows[0].dob)).format("YYYY-MM-DD") : "",
                        'experience': rows[0].experience,
                        'imageUrl': rows[0].profileImg ? config.get("appUrl") + 'uploads/profile_img' + '/' + rows[0].profileImg.trim() : "",
                        'NewAddress': rows[0].newAddress,
                        'Latitude': rows[0].latitude,
                        'Longitude': rows[0].longitude,
                        'jobType': rows[0].jobType
                    }
                }

            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* POST to edit technician profile */
router.post('/update-TechnicianProfile/:id', auth, [
        check('firstName').not().isEmpty().withMessage('Name must have more than 2 characters'),
        check('lastName').not().isEmpty().withMessage('Name must have more than 2 characters'),
        check('dob', 'Date of birth is required').not().isEmpty(),
    ],
    function (req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(403).json({
                    request: 'FAIL',
                    errors: utils.createErrorResponse(errors.array())
                });

            }

            var userId = req.params.id;

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
                        newAddress: req.body.newAddress,
                        latitude: req.body.latitude,
                        longitude: req.body.longitude,
                        jobtype: req.body.jobType,
                        completeProfile: 1
                    };
                    req.session.profileImg = fileName;
                    imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {});
                } else {
                    return res.status(403).json(createResponse('FAIL', 9));
                }
            }

            db.query('UPDATE users SET ? WHERE id = ? ', [data, userId], function (err, rows) {

                if (err)
                    console.error(err.message)

                return res.status(200).json(createResponse('Success', 95));
            });


        } catch (err) {
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }
    });

/* POST to add uploads */
router.post('/uploads-attachment', auth, function (req, res) {
    try {
        if (req.user.role == 2 || req.user.role == 3) {
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
                    projectId: projectId,
                    attachment: fileName,
                    description: req.body.description,
                    uploadedBy: req.user.uid,
                    active: 1
                };

                imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {
                    db.query('INSERT INTO upload SET ?', data, function (err) {

                        if (err)
                            console.error(err.message)
                        res.status(200).json(createResponse("Success", 102));
                    });
                });
            } else {
                res.status(403).json(createResponse("FAIL", 78));
            }

        } else {
            res.status(403).json(createResponse("FAIL", 104));
        }
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* GET To View Job Site Wise */
router.get('/viewUploadAttachment/:id', auth, function (req, res) {
    try {
        db.query('SELECT id, projectId, attachment, description, date FROM upload where projectId=? AND active=1', req.params.id, function (err, rows) {

            if (err)
                console.error(err.message)
            res.status(200).json({
                uploadList: rows,
            })
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }

});

/* Delete Uploads */
router.get('/deleteUploadAttachment/:id', auth, function (req, res) {
    try {
        db.query('UPDATE upload SET active=0 WHERE id=?', req.params.id, function (err) {
            if (err)
                console.error(err.message)
            res.status(200).json(createResponse("Success", 103));
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* GET to progect List based on siteId */
router.get('/projectList/:id', auth, function (req, res) {
    try {
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
                    projectList: projectList,
                });
        })
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* GET to userList */
router.get('/userList/:id', auth, function (req, res) {
    try {
        var jobId = req.params.id;
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, id FROM users LEFT JOIN users_job AS uj ON(users.id=uj.user_id) WHERE uj.isCurrentJob=1 AND uj.job_id=?`, jobId, function (err, userList) {

            if (err)
                console.error(err.message)

            if (userList.length == 0)
                res.status(403).json(createResponse("FAIL", 70));
            else
                return res.status(200).json({
                    userList: userList,
                });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

router.post('/senderMsg', auth, function (req, res) {
    try {
        var senderId = req.body.senderId;
        var reciverId = req.body.reciverId;
        var message = req.body.message;
        var tokenId = req.user.uid;
        if(senderId != '' && reciverId != '' && tokenId != '') {
            if (tokenId == senderId) {
                var data = {
                    msg_from: senderId,
                    msg_to: reciverId,
                    message: message,
                    time: new Date(),
                };
                db.query('INSERT INTO tech_messages SET ?', data, function (err) {
                    if (err)
                        console.error(err.message)
                    return res.status(200).json({
                        success: true
                    });
                });
            } else {
                console.error(err.message);
                return res.status(500).json(createResponse('FAIL', 0));
            }
        } else {
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

router.post('/getMsgDetail', auth, function (req, res) {
    try {
        console.log(req.user, 'wholeuser')
        var user_id = req.user.uid;
        if ((user_id == req.body.msg_from) || (user_id == req.body.msg_to)) {
            if ((user_id == req.body.msg_from) || (user_id == req.body.msg_to)) {
                db.query(`UPDATE tech_messages SET status=1 WHERE msg_from IN (?,?) AND msg_to IN (?,?)`, [req.body.msg_from, req.body.msg_to, req.body.msg_from, req.body.msg_to], function (err) {

                    if (err)
                        console.error(err.message)
                });
            }

            db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id as user_id, u.profileImg, tm.msg_from, tm.msg_to, tm.message, tm.time FROM tech_messages AS tm JOIN users AS u ON(tm.msg_to=u.id) WHERE tm.msg_from IN (?,?) AND tm.msg_to IN (?,?) ORDER BY tm.time `, [req.body.msg_from, req.body.msg_to, req.body.msg_from, req.body.msg_to], function (err, msgDetail) {
                if (err)
                    console.error(err.message)

                return res.status(200).json({
                    success: true,
                    msgDetails: msgDetail
                });
            });

        } else {
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

router.get('/hrChat', auth, function (req, res) {
    try {
        var uid = req.user.uid;

        db.query(`SELECT DISTINCT msg_from AS msg_to, CONCAT(firstName,' ',lastName) AS name, IFNULL(u.profileImg, "") AS profileImg FROM tech_messages AS tm join users as u on (tm.msg_from = u.id) WHERE msg_to=? UNION SELECT DISTINCT msg_to AS msg_to, CONCAT(firstName,' ',lastName) AS name, u.profileImg FROM tech_messages AS tm join users as u on (tm.msg_to = u.id) WHERE msg_from=?`, [uid, uid], function (err, message) {

            db.query(`SELECT id, msg_to, msg_from FROM tech_messages ORDER BY id DESC LIMIT 1`, function (err, lastId) {
                var msg_to = lastId[0].msg_to;
                var msg_from = lastId[0].msg_from;

                db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.profileImg, tm.msg_from, tm.msg_to, tm.message, tm.time FROM tech_messages AS tm JOIN users AS u ON(tm.msg_to=u.id) WHERE tm.msg_from IN (?,?) AND tm.msg_to IN (?,?) AND tm.active=1 GROUP BY tm.id ORDER BY tm.time LIMIT 100`, [msg_from, msg_to, msg_from, msg_to], function (err, msgDetail) {
                    if (err)
                        console.error(err.message)
                    return res.status(200).json({
                        uid: uid,
                        msg_from: uid,
                        msg: message,
                        msg_to: msg_to,
                        // msgDetails: msgDetail,
                    });
                });
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }

});

/* GET chat */
router.get('/chat', auth, function (req, res) {
    try {
        var uid = req.user.uid;

        db.query(`SELECT msg_from FROM tech_messages WHERE msg_to=?`, uid, function (err, id) {
            var hrId = id[0].msg_from;
            db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, IFNULL(u.profileImg, "") AS profileImg, tm.id, tm.msg_from, tm.msg_to, tm.message, tm.time FROM tech_messages AS tm JOIN users AS u ON(tm.msg_from=u.id) WHERE msg_from IN (?,?) AND msg_to IN (?,?) AND tm.active=1 ORDER BY tm.time LIMIT 1`, [uid, hrId, uid, hrId], function (err, message) {

                db.query(`SELECT id, msg_to, msg_from FROM tech_messages ORDER BY id DESC LIMIT 1`, function (err, lastId) {

                    var msg_to = lastId[0].msg_to;
                    var msg_from = lastId[0].msg_from;
                    db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.profileImg, tm.msg_from, tm.msg_to, tm.message, tm.time FROM tech_messages AS tm JOIN users AS u ON(tm.msg_to=u.id) WHERE tm.msg_from IN (?,?) AND tm.msg_to IN (?,?) AND tm.active=1 GROUP BY tm.id ORDER BY tm.time `, [msg_from, msg_to, msg_from, msg_to], function (err, msgDetail) {
                        if (err)
                            console.error(err.message)
                        return res.status(200).json({
                            uid: uid,
                            msg: message,
                            msg_to: msg_to,
                            msgDetails: msgDetail,
                        });
                    });
                });
            });

        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* GET to view all active jobs */
router.get('/getActiveProjects', auth, function (req, res) {
    try {
        db.query(`SELECT j.id AS jobId, j.jobName, j.predicated_budget, j.proposed_budget, j.status AS finsihed,js.siteName, CONCAT(u.firstName,' ',u.lastName) AS supervisorName, CONCAT(u1.firstName,' ',u1.lastName) AS supervisorNameTwo from jobs AS j JOIN jobsites AS js ON(j.siteId=js.id) JOIN users AS u ON(js.supervisors=u.id) JOIN users AS u1 ON (js.supervisorTwo=u1.id) WHERE j.status=1`, function (err, projects) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            for (var i = 0; i < projects.length; i++) {
                if (projects[i].supervisorName)
                    projects[i].name = projects[i].supervisorName;
                if (projects[i].supervisorNameTwo)
                    projects[i].name = projects[i].supervisorNameTwo;
                if (projects[i].supervisorNameTwo && projects[i].supervisorName)
                    projects[i].name = projects[i].supervisorNameTwo + '/' + projects[i].supervisorName;
            };

            for (let i = 0; i < projects.length; i++) {
                if (projects[i].finsihed != 3) {

                    /* In progress Over Budget */
                    if ((projects[i].predicated_budget > projects[i].proposed_budget) && (new Date() > projects[i].startDate) && (new Date() < projects[i].endDate))
                        projects[i].status = 8;

                    /* In progress ON Budget */
                    if ((projects[i].predicated_budget <= projects[i].proposed_budget) && (new Date() > projects[i].startDate) && (new Date() < projects[i].endDate))
                        projects[i].status = 9;

                    /* Delayed Over Budget */
                    if ((projects[i].predicated_budget > projects[i].proposed_budget) && (new Date() > projects[i].endDate))
                        projects[i].status = 10;

                    /* Delayed On Budget */
                    if ((projects[i].predicated_budget <= projects[i].proposed_budget) && (new Date() > projects[i].endDate))
                        projects[i].status = 11;


                    /* Yet to start */
                    if (projects[i].startDate < new Date())
                        projects[i].status = 12;

                    projects[i].budget = parseFloat(projects[i].predicated_budget).toFixed(2) + '/' + projects[i].proposed_budget;
                } else {
                    projects[i].status = 3;
                }

            }

            if (projects.length == 0)
                res.status(403).json(createResponse("FAIL", 111));
            else
                return res.status(200).json({
                    projects: projects,
                });
        });

    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }

});

/* GET to view sites based on users */
router.get('/getUserSites', auth, function (req, res) {
    try {
        db.query(`SELECT js.id AS jobsitesId, js.siteName, js.newAddress, CONCAT(u.firstName,' ',u.lastName)AS supervisorName, CONCAT(u1.firstName,' ',u1.lastName) AS supervisorNameTwo FROM user_sites AS us JOIN jobsites AS js ON (us.site_id=js.id) JOIN users AS u ON(js.supervisors=u.id) JOIN users AS u1 ON (js.supervisorTwo=u1.id) WHERE us.user_id=? AND us.is_current=1 GROUP by us.site_id`, req.user.uid, function (err, userSites) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });

            for (var i = 0; i < userSites.length; i++) {
                if (userSites[i].supervisorName)
                    userSites[i].name = userSites[i].supervisorName;
                if (userSites[i].supervisorNameTwo)
                    userSites[i].name = userSites[i].supervisorNameTwo;
                if (userSites[i].supervisorNameTwo && userSites[i].supervisorName)
                    userSites[i].name = userSites[i].supervisorNameTwo + '/' + userSites[i].supervisorName;
            };
            if (userSites.length == 0)
                res.status(403).json(createResponse("FAIL", 112));
            else
                return res.status(200).json({
                    data: userSites,
                });

        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* GET to view user sites based on project */
router.get('/userSitesProject/:id', auth, function (req, res) {
    try {
        db.query('SELECT j.id as jobId, j.jobName, j.startDate, j.endDate FROM jobs AS j JOIN users_job AS uj ON(j.id=uj.job_id) WHERE uj.user_id=? AND uj.siteId=? AND uj.isCurrentJob=1',[req.user.uid, req.params.id], function (err, data) {
            if (err)
            res.json({
                success: false,
                msg: err.message
            });
            if (data.length == 0)
                res.status(403).json(createResponse("FAIL", 113));
            else
                return res.status(200).json({
                    data: data,
                });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
router.post('/postId/', auth, function (req, res) {
    try { 
        if (!req.files) {
            console.log('not found')
            return res.status(404).json(createResponse('FAIL', 114));
        } else {
            var userId = req.user.uid;
            let frontfileName = null;
            let updatefrontfileName = null;
            let backfileName = null;
            let updatebackfileName = null;
            if(req.files.front_id) {
                var imageFile = req.files.front_id;
                let imageExtension = imageFile.name.split('.');
                if (imageExtension[1] == "jpg" || imageExtension[1] == "JPG" || imageExtension[1] == "jpeg" || imageExtension[1] == "JPEG" || imageExtension[1] == "png" || imageExtension[1] == "PNG") {
                    let ext = imageExtension[(imageExtension).length - 1];
                    var image = userId + '_' + new Date().toISOString();
                    new_image = md5(image);
                    new_image = new_image + '.' + ext;
                    frontfileName = new_image;
                    updatefrontfileName = new_image;
                    let uploadPath = 'uploads/user_id';
                    imageFile.mv(`public/${uploadPath}/${frontfileName}`, function (err) {
                    });
                } else {
                    return res.status(404).json(createResponse('FAIL', 9));
                }
            }
            if(req.files.back_id) {
                var imageFile = req.files.back_id;
                let imageExtension = imageFile.name.split('.');
                if (imageExtension[1] == "jpg" || imageExtension[1] == "JPG" || imageExtension[1] == "jpeg" || imageExtension[1] == "JPEG" || imageExtension[1] == "png" || imageExtension[1] == "PNG") {
                    let ext = imageExtension[(imageExtension).length - 1];
                    var image = userId + '_' + new Date().toISOString();
                    new_image = md5(image);
                    new_image = new_image + '.' + ext;
                    backfileName = new_image;
                    updatebackfileName = new_image;
                    let uploadPath = 'uploads/user_id';
                    imageFile.mv(`public/${uploadPath}/${backfileName}`, function (err) {});
                } else {
                    return res.status(404).json(createResponse('FAIL', 9));
                }
            }
            var data = {
                user_id: userId,
                front_id: frontfileName,
                back_id: backfileName,
                updated_at: moment(new Date()).format('YYYY-MM-DD'),
            };           
            db.query('SELECT  * FROM user_id WHERE user_id = ?', userId, function (err, rows) {
                if(rows == "") {
                    db.query('INSERT INTO user_id SET ?', data, function (err, data) {
                        if (err)
                            console.error(err.message);
                        return res.status(200).json(createResponse('Success', 115));
                    });
                } else {
                    if(updatefrontfileName == null) {
                        updatefrontfileName = rows[0].front_id;
                    }
                    if(updatebackfileName == null) {
                        updatebackfileName = rows[0].back_id;
                    }
                    var updateData = {
                        user_id: userId,
                        front_id: updatefrontfileName,
                        back_id: updatebackfileName,
                        updated_at: moment(new Date()).format('YYYY-MM-DD'),
                    };  
                    var a = db.query('UPDATE user_id SET ? WHERE user_id = ?', [updateData, userId], function (err, updateData) {
                        if (err)
                            console.error(err.message);
                        return res.status(200).json(createResponse('Success', 115));
                    });
                }
            });
        }
    }  catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

router.get('/getId/', auth, function (req, res) {
    try{
        var userId = req.user.uid;
        db.query(`SELECT  id,user_id, IFNULL(front_id, "") AS front_id , IFNULL(back_id, "") AS back_id  FROM user_id WHERE user_id = ?`, userId, function (err, rows) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if(rows.length == 0) {
                var data = {
                    id: "",
                    user_id: userId,
                    front_id: "",
                    back_id: "",
                }; 
                return res.status(200).json({
                    data: data,
                });
            }
            if(rows.length != 0) {
                var data = {
                    id: rows[0].id,
                    user_id: rows[0].user_id,
                    front_id: rows[0].front_id,
                    back_id: rows[0].back_id,
                };
            }
            return res.status(200).json({
                data: data,
            });
        });
    }  catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
module.exports = router;