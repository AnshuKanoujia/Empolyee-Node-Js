var express = require('express');
var router = express.Router();
var db = require('../../config/db');
// var url = require('../../config/default.json');
const config = require('config');
const url = config.get('appUrl');
const bcrypt = require("bcrypt");
var moment = require('moment');
const excel = require('exceljs');
var path = require('path');
const readXlsxFile = require('read-excel-file/node');
var jwt = require('jsonwebtoken');
const {
    check,
    validationResult
} = require('express-validator');
var md5 = require('md5');

function chksession(req, res) {
    if (!req.session.uid || req.session.role != "4") {
        res.redirect(url + 'login');
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
    hour = hours-(days*24); */

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

/* GET users listing. */
router.get('/', function (req, res) {
    res.send('respond with a resource');
});

/* GET dashboard */
router.get('/dashboard', function (req, res) {
    chksession(req, res);
    res.render('admin/hr/dashboard', {
        title: 'HR Dashboard',
        layout: 'layout/hr-layout.jade',
        applications: req.session
    });
});

/* POST hr edit-profile */
router.get('/edit-profile', function (req, res) {
    chksession(req, res);
    db.query('SELECT GROUP_CONCAT(skill_id) as skills_id, u.profileImg, u.firstName, u.lastName,u.preferredName, u.dob, u.phone_number, u.email, u.experience, u.skills, u.jobType, u.newAddress, us.user_id, us.skill_id, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = ?)) as designation FROM users as u JOIN user_skills AS us ON (u.id = us.user_id) WHERE u.id = ?', [req.session.uid, req.session.uid], function (err, rows) {
        db.query('SELECT id, type_name FROM jobtype WHERE active=1', function (err, row) {
            db.query('SELECT id, name FROM countries', function (err, country) {
                db.query('SELECT id, name FROM states where country_id = ?', rows[0].country, function (err, state) {
                    db.query('SELECT id, name FROM cities where state_id =?', rows[0].state, function (err, city) {
                        db.query('SELECT id, skill_name FROM skills WHERE active=1', function (err, skill) {
                            if (err)
                                console.error(err.message)
                            res.render('admin/hr/edit-profile', {
                                title: 'Edit Profile',
                                layout: 'layout/hr-layout.jade',
                                country: country,
                                state: state,
                                city: city,
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
            res.redirect('/admin/hr/edit-profile');
        } else {

            if (!req.files) {
                var data = {
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    preferredName: req.body.preferredName,
                    dob: moment(req.body.dob).format('YYYY-MM-DD'),
                    phone_number: req.body.phone_number,
                    email: req.body.email,
                    newAddress: req.body.newAddress,
                    latitude: req.body.latitude,
                    longitude: req.body.longitude,
                    completeProfile: 1
                };
            } else {
                var imageFile = req.files.profileImg;
                let imageExtension = imageFile.name.split('.');

                if (imageExtension[1] == "jpg" || imageExtension[1] == "jpeg" || imageExtension[1] == "png" || imageExtension[1] == "pdf") {

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
                        email: req.body.email,
                        newAddress: req.body.newAddress,
                        latitude: req.body.latitude,
                        longitude: req.body.longitude,
                        profileImg: fileName,
                        completeProfile: 1
                    };
                    req.session.profileImg = fileName;
                    imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {});
                } else {
                    req.flash('msg_error', "This format is not allowed , please upload file with '.png','.gif','.jpg','.pdf'");
                    res.redirect('/admin/hr/edit-profile');
                    req.end();
                }
            }
            db.query('UPDATE users SET ? WHERE id = ? ', [data, userId], function (err) {
                if (err)
                    console.error(err.message)
                req.flash('msg_info', "Profile Updated Successfully");
                res.redirect('/admin/hr/edit-profile');
            });
        }
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
                        res.redirect('/admin/hr/edit-profile');
                    }
                } else {
                    req.flash('msg_error', "Current Password and New Password can not be same!");
                    res.redirect('/admin/hr/edit-profile');
                }
            } else {
                req.flash('msg_error', "Current Password is Invalid!");
                res.redirect('/admin/hr/edit-profile');
            }
        });

    });


});

/* GET to Add company */
router.get('/add-company', function (req, res) {
    chksession(req, res);
    res.render('admin/hr/add-company', {
        title: 'Add Company',
        layout: 'layout/hr-layout.jade',
        url: url,
        applications: req.session
    });

});

/* POST to add company */
router.post('/add-company', function (req, res) {

    chksession(req, res);
    var imageFile = req.files.company_logo;
    let imageExtension = imageFile.name.split('.');

    if (imageExtension[1] == "jpg" || imageExtension[1] == "jpeg" || imageExtension[1] == "png" || imageExtension[1] == "pdf") {
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
                    console.error(err.message)
                req.flash('msg_info', "Company Added Successfully.");
                res.redirect('/admin/hr/view-company');
            });
        });
    } else {
        req.flash('msg_error', "This format is not allowed , please upload file with '.png','.gif','.jpg','.pdf'");
        res.redirect('/admin/hr/add-company');
    }
});

/* GET To View Job Site Wise */
router.get('/view-company', function (req, res) {
    chksession(req, res);

    db.query('SELECT id, company_name, company_code, company_logo FROM company WHERE active=1', function (err, rows) {
        if (err)
            console.error(err.message)
        res.render('admin/hr/view-company', {
            title: 'Company View',
            layout: 'layout/hr-layout.jade',
            companyList: rows,
            applications: req.session
        });
    });
});

/* GET Edit-Company */
router.get('/edit-company/:id', function (req, res) {
    chksession(req, res);
    db.query('SELECT id, company_name, company_code, company_logo, description FROM company WHERE id = ?', req.params.id, function (err, rows) {
        if (err)
            console.error(err.message)
        res.render('admin/hr/edit-company', {
            title: 'Edit company',
            layout: 'layout/hr-layout.jade',
            company: rows,
            applications: req.session,
            id: req.params.id
        });
    });
});

/* POST Edit Company */
router.post('/edit-company/:id', [
        check('company_name').isAlpha().withMessage('Name Must be only alphabetical chars')
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
            res.redirect('/admin/hr/add-company');
        } else {
            if (!req.files) {
                var data = {
                    company_name: req.body.company_name,
                    company_code: req.body.company_code,
                    description: req.body.description
                };
            } else {
                var imageFile = req.files.company_logo;
                let imageExtension = imageFile.name.split('.');
                if (imageExtension[1] == "jpg" || imageExtension[1] == "jpeg" || imageExtension[1] == "png" || imageExtension[1] == "pdf") {
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
                    req.flash('msg_error', "This format is not allowed , please upload file with '.png','.gif','.jpg','.pdf'");
                    res.redirect('/admin/hr/edit-company/' + req.params.id);
                }
            }
            db.query('UPDATE company SET ? WHERE id = ? ', [data, req.params.id], function (err, rows, fields) {
                if (err) {
                    console.error(err.message)
                    req.flash('msg_error', "Some error occured!");
                    res.redirect('/admin/hr/add-certificate');
                } else {
                    req.flash('msg_info', "Company Details Updated Successfully");
                    res.redirect('/admin/hr/view-company');
                }
            });
        }
    });

/* Delete Company */
router.get('/deleteCompany/:id', function (req, res) {
    chksession(req, res);
    db.query('UPDATE company SET active=0 WHERE id=?', req.params.id, function (err) {
        if (err)
            console.error(err.message)
        req.flash('msg_error', "Company Deleted Successfully");
        res.redirect('/admin/hr/view-company');
    });
});

/* GET to view subject-list */
router.get('/subject', function (req, res) {
    chksession(req, res);
    db.query('SELECT sub_id AS subId, sub_name, sub_date FROM subjects WHERE active=1', function (err, rows) {
        if (err)
            console.error(err.message)
        res.render('admin/hr/subject', {
            title: 'Edit company',
            layout: 'layout/hr-layout.jade',
            subjectList: rows,
            applications: req.session,
            id: req.params.id
        });
    });
});

/* GET to add subject */
router.get('/add-subject', function (req, res) {
    chksession(req, res);
    res.render('admin/hr/add-subject', {
        title: 'Edit company',
        layout: 'layout/hr-layout.jade',
        url: url,
        applications: req.session
    });
});

/* POST to add subject */
router.post('/add-subject', function (req, res) {
    chksession(req, res);
    var data = {
        sub_name: req.body.sub_name,
        sub_date: new Date()
    };
    db.query('INSERT INTO subjects SET ?', data, function (err) {
        if (err)
            console.error(err.message)
        req.flash('msg_info', "Subject Added Successfully!");
        res.redirect('/admin/hr/subject');
    });
});

/* POST to update subject name */
router.post('/updateSubject', function (req, res) {
    chksession(req, res);
    var sub_id = req.body.changeSub;
    var data = {
        sub_name: req.body.sub_name
    };
    db.query('UPDATE subjects SET ? WHERE sub_id = ?', [data, sub_id], function (err) {
        if (err)
            console.error(err.message)
        req.flash('msg_info', "Suject Updated Successfully");
        res.redirect('/admin/hr/subject');
    });

});

/* delete subject */
router.get('/delete-sub/:id', function (req, res) {
    chksession(req, res);
    db.query('UPDATE subjects SET active=0 WHERE sub_id=?', req.params.id, function (err) {
        if (err)
            console.error(err.message)
        req.flash('msg_error', "Subject Deleted Successfully");
        res.redirect('/admin/hr/subject');
    });
});

/* GET to view ques-ans-list based on subject */
router.post('/search_ques-ans', function (req, res) {
    chksession(req, res);
    if (req.body.sub_id) {

        db.query('SELECT q.q_id as quesId, q.question, q.ch1, q.ch2, q.ch3, q.ch4, q.correct_ans, q.date, q.quesImg_attach, (SELECT ques_level FROM questions_level WHERE id=exam_level) AS exam_level, s.sub_name FROM questions AS q JOIN subjects AS s ON (s.sub_id=q.sub_id) WHERE q.sub_id = ? AND q.active=1 ORDER BY date DESC', req.body.sub_id, function (err, rows) {
            db.query('SELECT sub_id, sub_name, sub_date FROM subjects', function (err, subject) {
                if (err)
                    console.error(err.message)
                res.render('admin/hr/manage_ques-ans', {
                    title: 'Edit company',
                    layout: 'layout/hr-layout.jade',
                    subjectList: rows,
                    listOfSubject: subject,
                    applications: req.session,
                    id: req.params.id
                });
            });

        });
    } else {
        res.redirect('/admin/hr/ques-ans');
    }

});

/* GET to Add ques-ans */
router.get('/add-ques_ans', function (req, res) {
    chksession(req, res);
    db.query('SELECT sub_id AS subId, sub_name, sub_date FROM subjects WHERE active=1', function (err, subject) {
        db.query('SELECT id, ques_level FROM questions_level', function (err, level) {
            if (err)
                console.error(err.message)
            res.render('admin/hr/add-ques_ans', {
                title: 'Add Question-Answer',
                layout: 'layout/hr-layout.jade',
                listOfSubject: subject,
                quesLevel: level,
                applications: req.session
            });
        });
    });

});

/* Post To add questions & answers */
router.post('/add-ques_ans', function (req, res) {
    chksession(req, res);
    if (!req.files) {
        var data = {
            sub_id: req.body.sub_id,
            exam_level: req.body.exam_level,
            question: req.body.question,
            ch1: req.body.ch1,
            ch2: req.body.ch2,
            ch3: req.body.ch3,
            ch4: req.body.ch4,
            // quesImg_attach: fileName,
            correct_ans: req.body.correct_ans,

            date: moment(new Date()).format('YYYY-MM-DD')
        };
    } else {
        var imageFile = req.files.quesImg_attach;
        let imageExtension = imageFile.name.split('.');

        if (imageExtension[1] == "jpg" || imageExtension[1] == "jpeg" || imageExtension[1] == "png" || imageExtension[1] == "pdf") {
            let ext = imageExtension[(imageExtension).length - 1];
            var image = image + '_' + new Date().toISOString();
            new_image = md5(image);
            new_image = new_image + '.' + ext;
            let fileName = new_image;
            var uploadPath = 'uploads/Question_Img';

            var data = {
                sub_id: req.body.sub_id,
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
            imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {

                // db.query('INSERT INTO questions SET ?', data, function (err, rows, fields) {
                //     if (err)
                //         console.error(err.message)
                //     req.flash('msg_info', "Question & Answer Added Successfully");
                //     res.redirect('/admin/hr/manage_ques-ans');
                // });
            });
        } else {
            req.flash('msg_error', "This format is not allowed , please upload file with '.png','.gif','.jpg','.pdf'");
            res.redirect('/admin/hr/add-ques_ans');
        }
    }
    db.query('INSERT INTO questions SET ?', data, function (err, rows, fields) {
        if (err)
            console.error(err.message)
        req.flash('msg_info', "Question & Answer Added Successfully");
        res.redirect('/admin/hr/manage_ques-ans');
    });

});

router.post('/import_excel', async function (req, res) {
    chksession(req, res);

    var tempfile = require('tempfile');
    var tempFilePath = tempfile('.xlsx');
    var tempPath = path.dirname(tempFilePath);
    var excelData;
    var parameters = '';
    if (req.files.import_excel.mimetype == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
        let imageFile = req.files.import_excel;
        let uploadPath = tempPath + '/' + req.files.import_excel.name;
        imageFile.mv(uploadPath, function (err) {
            if (err)
                console.error(err.message)
            readXlsxFile(uploadPath).then((rows) => {


                // `rows` is an array of rows
                // each row being an array of cells.
                if (rows[0].length < 5) {

                    req.flash('msg_error', "Columns are not matched, please import correct file");
                } else {

                    for (let index = 1; index < rows.length; index++) {
                        excelData = rows[index];
                        parameters += `${parameters ? ', ' : ''}("${excelData[0]}","${excelData[1]}","${excelData[2]}","${excelData[3]}","${excelData[4]}","${excelData[5]}","${excelData[6]}","${excelData[7]}")`
                    }

                    let query = 'INSERT INTO questions(`sub_id`,`exam_level`,`question`,`ch1`,`ch2`,`ch3`,`ch4`,`correct_ans`) VALUES ';

                    if (parameters) {
                        query = query + parameters;
                        db.query(query, function (err) {
                            if (err)
                                console.error(err.message)
                        })
                    }
                    req.flash('msg_info', "Question Added Successfully");
                    res.redirect('/admin/hr/manage_ques-ans');
                }
            });
        });
    }

});

/* GET to view ques-ans-list based on filter*/
router.get('/manage_ques-ans', function (req, res) {
    chksession(req, res);
    db.query('SELECT q.q_id as quesId, q.question, q.ch1, q.ch2, q.ch3, q.ch4, q.correct_ans, q.date, q.quesImg_attach, l.ques_level AS exam_level, s.sub_name FROM questions AS q JOIN subjects AS s ON (q.sub_id=s.sub_id) JOIN questions_level AS l ON (q.exam_level=l.id) where q.active=1', function (err, rows) {
        db.query('SELECT sub_id, sub_name, sub_date FROM subjects WHERE active=1', function (err, subject) {
            if (err)
                console.error(err.message)
            res.render('admin/hr/manage_ques-ans', {
                title: 'Edit company',
                layout: 'layout/hr-layout.jade',
                subjectList: rows,
                listOfSubject: subject,
                applications: req.session,
                id: req.params.id
            });
        });
    });
});

/* GET to Add ques-ans */
router.get('/edit-ques_ans/:id', function (req, res) {
    chksession(req, res);
    db.query('SELECT q_id as quesId, sub_id AS subId, exam_level, question, ch1, ch2, ch3, ch4, correct_ans, date FROM questions WHERE q_id = ?', req.params.id, function (err, subject) {
        db.query('SELECT sub_id AS subId, sub_name FROM subjects', function (err, list) {
            db.query('SELECT id, ques_level FROM questions_level', function (err, level) {
                if (err)
                    console.error(err.message)
                res.render('admin/hr/edit-ques_ans', {
                    title: 'Add Question-Answer',
                    layout: 'layout/hr-layout.jade',
                    listOfSubject: subject[0],
                    subject: list,
                    quesLevel: level,
                    quesId: req.params.id,
                    applications: req.session
                });
            });
        });
    });
});

/* Post To add questions & answers */
router.post('/edit-ques_ans/:id', function (req, res) {
    chksession(req, res);

    if (!req.files) {
        var data = {
            sub_id: req.body.sub_id,
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
        if (imageExtension[1] == "jpg" || imageExtension[1] == "jpeg" || imageExtension[1] == "png" || imageExtension[1] == "pdf") {
            let ext = imageExtension[(imageExtension).length - 1];
            var image = image + '_' + new Date().toISOString();
            new_image = md5(image);
            new_image = new_image + '.' + ext;
            let fileName = new_image;
            var uploadPath = 'uploads/Question_Img';

            var data = {
                sub_id: req.body.sub_id,
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

            imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {})
        } else {
            req.flash('msg_error', "This format is not allowed , please upload file with '.png','.gif','.jpg',");
            res.redirect('/admin/hr/edit-ques_ans');
        }
    }

    db.query('UPDATE questions SET ? WHERE q_id = ?', [data, req.params.id], function (err, rows, fields) {
        if (err)
            console.error(err.message)
        req.flash('msg_info', "Question & Answer Updated Successfully");
        res.redirect('/admin/hr/manage_ques-ans');
    });

});

/* delete subject */
router.get('/delete-ques_ans/:id', function (req, res) {
    chksession(req, res);
    db.query('UPDATE questions SET active=0 WHERE q_id=?', req.params.id, function (err) {
        if (err)
            console.error(err.message)
        req.flash('msg_error', "Question & Answers are Deleted Successfully");
        res.redirect('/admin/hr/manage_ques-ans');
    });
});

/* GET to add exam rules */
router.get('/set-exam_rules', function (req, res) {
    chksession(req, res);
    db.query('SELECT * FROM exam_rules', function (err, rows) {
        res.render('admin/hr/set-exam_rules', {
            title: 'Set exam rules',
            layout: 'layout/hr-layout.jade',
            rulesData: rows[0],
            url: url,
            applications: req.session
        });
    });

});

/* POST to set exam rules */
router.post('/set-exam_rules', function (req, res) {
    chksession(req, res);
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
        updated_by: req.session.uid
    };
    db.query('UPDATE exam_rules SET ?', data, function (err, rows, fields) {
        if (err)
            console.error(err.message)
        req.flash('msg_info', "Rules Applied Successfully");
        res.redirect('/admin/hr/manage_ques-ans');
    });

});

/* Add Planner */
router.get('/add-planner', function (req, res) {
    chksession(req, res);
    res.render('admin/hr/add-planner', {
        title: 'Add Profile',
        layout: 'layout/hr-layout.jade',
        url: url,
        applications: req.session
    });

});

/* Post Planner */
router.post('/add-planner', [
        check('firstName').isAlpha().withMessage('Name Must be only alphabetical chars'),
        check('lastName').isAlpha().withMessage('Last Name Must be only alphabetical chars'),
        check('email').isEmail().withMessage('email').withMessage('xyz@gmail.com'),
        check('password').isLength({
            min: 6
        }).withMessage('Password Must be at least 6 digits')
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
            res.redirect('/admin/hr/add-planner');
        } else {
            bcrypt.genSalt(10, (err, salt) => {
                if (err)
                    console.error(err.message)
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
                                    console.error(err.message)
                                var id = q._results[0]['insertId'];
                                let w = id.toString(16);
                                var userCode = 'Pln_' + w;
                                db.query(`SELECT id FROM users WHERE role='4'`, function (err, hrId) {

                                    db.query('INSERT INTO tech_messages (msg_from, msg_to, message, time)VALUES (?, ?, ?, ?)', [hrId[0].id, id, 'For any query please drop a message here only !', new Date()], function (err) {});
                                })
                                db.query('UPDATE users SET eCode= ? WHERE id =?', [userCode, id], function (err) {
                                    if (err) {
                                        db.query('DELETE FROM users where id= ?', id)
                                        req.flash('msg_error', "Some Error Occured, Please Try Again!");
                                        res.redirect('/sign-up');
                                    }
                                });

                                req.flash('msg_info', "New planner Created Successfully");
                                res.redirect('/admin/hr/view-planner');
                            });
                        } else {
                            req.flash('msg_error', "Email already exists!");
                            res.redirect('/admin/hr/view-planner');
                        }
                    });
                });
            });
        }
    });

/* GET Planner view On Hr End*/
router.get('/view-planner', function (req, res) {
    chksession(req, res);
    db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, u.dob, u.email, u.jobtype, u.skills, u.experience, js.siteName FROM users AS u LEFT JOIN jobsites AS js ON(u.currSiteId=js.id) where role=2', function (err, rows) {
        if (err)
            console.error(err.message)
        res.render('admin/hr/view-planner', {
            title: 'Edit Profile',
            layout: 'layout/hr-layout.jade',
            users: rows,
            applications: req.session
        });
    });
});

/* GET Planner view Profile */
router.get('/view-plannerProfile/:id', function (req, res) {
    chksession(req, res);
    var id = req.params.id;
    db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, u.dob, u.email, u.experience, jt.type_name, s.skill_name FROM users AS u LEFT JOIN jobtype AS jt ON(u.jobType=jt.id) LEFT JOIN skills AS s ON(u.skills=s.id) where u.id=?', id, function (err, rows) {
        db.query('SELECT id, certification_name, certificate_attachment, authority FROM certification where userId=? AND active=1', id, function (err, list) {
            if (err)
                console.error(err.message)
            res.render('admin/hr/view-plannerProfile', {
                title: 'View planner Profile',
                layout: 'layout/hr-layout.jade',
                users: rows,
                certificatonList: list,
                applications: req.session
            });
        });
    });
});

/* POST to change supervisor password from hr end */
router.post('/plannerChangePassword', [
    check('newPassword').isLength({
        min: 6
    }).withMessage('New Password Must be at least 6 chars long')
    .not().isEmpty().withMessage('New Password is required!'),
    check('confirmNewPassword').isLength({
        min: 6
    }).withMessage('Confirm Password Must be at least 6 chars long')
    .not().isEmpty().withMessage('Confirm Password is required!')
], function (req, res) {
    chksession(req, res);
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
                    req.flash('msg_info', "This Planner Password Has Successfully Changed.");
                    res.redirect('/admin/hr/view-plannerProfile/' + userId);
                });
            });
        });
    } else {
        req.flash('msg_error', "New Password and Confirrm New Password not matched!");
        res.redirect('/admin/hr/view-plannerProfile/' + userId);
    }

});

/* Add Supervisor */
router.get('/add-supervisor', function (req, res) {
    chksession(req, res);
    db.query('SELECT id,type_name FROM jobtype WHERE active=1', function (err, rows) {
        res.render('admin/hr/add-supervisor', {
            title: 'Add Profile',
            layout: 'layout/hr-layout.jade',
            jobType: rows,
            url: url,
            applications: req.session
        });
    });

});

/* Post supervisor */
router.post('/add-supervisor', [
        check('firstName').isAlpha().withMessage('Name Must be only alphabetical chars'),
        check('lastName').isAlpha().withMessage('Last Name Must be only alphabetical chars'),
        check('email').isEmail().withMessage('email').withMessage('xyz@gmail.com'),
        check('password').isLength({
            min: 6
        }).withMessage('Password Must be at least 6 digits')
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
            res.redirect('/admin/hr/add-supervisor');
        } else {
            bcrypt.genSalt(10, (err, salt) => {
                if (err)
                    console.error(err.message)
                bcrypt.hash(req.body.password, salt, (err, hash) => {
                    var data = {
                        firstName: req.body.firstName,
                        lastName: req.body.lastName,
                        jobType: req.body.jobType,
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
                                db.query(`SELECT id FROM users WHERE role='4'`, function (err, hrId) {

                                    db.query('INSERT INTO tech_messages (msg_from, msg_to, message, time)VALUES (?, ?, ?, ?)', [hrId[0].id, id, 'For any query please drop a message here only !', new Date()], function (err) {});
                                })
                                db.query('UPDATE users SET eCode= ? WHERE id =?', [userCode, id], function (err) {
                                    if (err) {
                                        db.query('DELETE FROM users where id= ?', id)
                                        req.flash('msg_error', "Some Error Occured, Please Try Again!");
                                        res.redirect('/sign-up');
                                    }
                                });

                                req.flash('msg_info', "New Supervisor Created Successfully");
                                res.redirect('/admin/hr/view-supervisor');
                            });
                        } else {
                            req.flash('msg_error', "Email already exist!");
                            res.redirect('/admin/hr/view-supervisor');
                        }
                    });
                });
            });
        }
    });

/* GET Supervisor view On Hr End*/
router.get('/view-supervisor', function (req, res) {
    chksession(req, res);
    db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, u.dob, u.email, u.jobtype, u.skills, u.experience, u.newAddress, js.siteName, js.sitesCode, jt.type_name, (SELECT count(id) FROM supervisor_taskreporting WHERE status=0 AND supId=u.id) as pending_reports FROM users AS u LEFT JOIN jobsites AS js ON(u.currSiteId=js.id) LEFT JOIN jobtype AS jt ON(u.jobType=jt.id) where role=3', function (err, rows) {
        if (err)
            console.error(err.message)
        res.render('admin/hr/view-supervisor', {
            title: 'Edit Profile',
            layout: 'layout/hr-layout.jade',
            users: rows,
            applications: req.session
        });
    });
});

/* Get technician submitted reports */
router.get('/supSubmitted-reports/:id', function (req, res) {
    chksession(req, res);
    let id = req.params.id;
    db.query('SELECT st.*, u.firstName, s.statusName FROM supervisor_taskreporting AS st join users AS u JOIN statusname AS s ON(s.id=st.status) where st.supId = u.id AND active=1 AND st.status=0 AND st.supId=? ORDER BY st.date DESC', id, function (err, rows) {
        if (err)
            console.error(err.message)
        res.render('admin/hr/report-view', {
            title: 'Supervisor Report View',
            layout: 'layout/admin-layout.jade',
            reports: rows,
            applications: req.session,
            id: id
        });
    });
});

/* GET to edit intime & outtime on taskreporting table*/
router.post('/supInTime-OutTime', function (req, res) {
    chksession(req, res);
    var supTaskreportingId = req.body.id;
    var supId = req.body.userId;
    var countHourTime = countHours(req.body.inTime, req.body.outTime);
    /* var checkCountHourTime = checkCountHours(req.body.inTime, req.body.outTime);
    if (checkCountHourTime == 0) {
        req.flash('msg_error', "Please Enter Valid Time.");
        res.redirect('/admin/hr/submitted-reports/' + supId);
        req.end();
    } */
    var data = {
        inTime: req.body.inTime,
        outTime: req.body.outTime,
        hours_count: countHourTime

    };
    db.query('UPDATE supervisor_taskreporting SET ? WHERE id = ?', [data, supTaskreportingId], function (err, rows, fields) {
        if (err)
            console.error(err.message)
        req.flash('msg_info', "Time Updated Successfully");
        res.redirect('/admin/hr/supSubmitted-reports/' + supId);
    });

});

/* POST to update time based on planner to approve or reject time sheet */
router.post('/approveRejectTime', function (req, res) {
    chksession(req, res);
    var status = req.body.status;
    var supId = req.body.supId;
    var plannerId = req.body.plannerId;
    var data = {
        supId: supId,
        plannerId: plannerId,
        status: status
    };
    db.query('UPDATE supervisor_taskreporting SET ? WHERE status = 0', data, function (err) {
        if (err)
            console.error(err.message)
        req.flash('msg_info', "Time Stauts Updated Successfully");
        res.redirect('/admin/hr/submitted-reports/' + supId);
    });
});

/* GET Supervisor view Profile */
router.get('/view-supervisorProfile/:id', function (req, res) {
    chksession(req, res);
    var id = req.params.id;
    // db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, u.dob, u.email, u.experience, jt.type_name, s.skill_name FROM users AS u LEFT JOIN jobtype AS jt ON(u.jobType=jt.id) LEFT JOIN skills AS s ON(u.skills=s.id) where u.id=?', id, function (err, rows) {
    db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, u.dob, u.email, u.experience, u.newAddress, jt.type_name, (select GROUP_CONCAT(skill_name) from skills s join user_skills us2 on us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) as skills FROM users AS u LEFT JOIN jobtype AS jt ON(u.jobType=jt.id) where u.id=?', id, function (err, rows) {

        if (err)
            console.error(err.message)
        res.render('admin/hr/view-supervisorProfile', {
            title: 'View Supervisor Profile',
            layout: 'layout/hr-layout.jade',
            users: rows,
            applications: req.session
        });

    });
});

/* POST to change supervisor password from hr end */
router.post('/supChangePassword', [
    check('newPassword').isLength({
        min: 6
    }).withMessage('New Password Must be at least 6 chars long').not().isEmpty().withMessage('New Password is required!'),
    check('confirmNewPassword').isLength({
        min: 6
    }).withMessage('Confirm Password Must be at least 6 chars long').not().isEmpty().withMessage('Confirm Password is required!')
], function (req, res) {
    chksession(req, res);
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
                    req.flash('msg_info', "This Supervisor Password Has Successfully Changed.");
                    res.redirect('/admin/hr/view-supervisorProfile/' + userId);
                });
            });
        });
    } else {
        req.flash('msg_error', "New Password and Confirrm New Password not matched!");
        res.redirect('/admin/hr/view-supervisorProfile/' + userId);
    }

});

/* GET Manage Application */
router.get('/manage-application', function (req, res) {
    chksession(req, res);
    db.query('SELECT ua.id, ua.date, u.firstName,u.lastName, j.jobName, j.jobCode, sn.statusName, s.shift from userapplications AS ua LEFT JOIN users AS u ON(ua.userId=u.id) LEFT JOIN jobs AS j ON(ua.jobId=j.id) LEFT JOIN statusname AS sn ON(ua.status=sn.id) LEFT JOIN shifts AS s ON(ua.preferredShift=s.id) WHERE ua.active=1', function (err, rows) {
        if (err)
            console.error(err.message);
        res.render('admin/hr/manage-application', {
            title: 'View Job',
            layout: 'layout/hr-layout.jade',
            userlists: rows,
            applications: req.session
        });
    });
});

/* GET To View Application */
router.get('/viewApplication/:id', function (req, res) {
    chksession(req, res);
    db.query('SELECT u.id, u.firstName, u.lastName, u.address, u.experience, u.currSiteId, us.date, j.jobName, j.jobCode, jt.type_name, sn.statusName, s.shift, js.sitesCode, js.siteName, js.newAddress from users AS u LEFT JOIN userapplications AS us ON(u.id=us.userId) LEFT JOIN jobs AS j ON(u.currJobId=j.id) LEFT JOIN jobtype AS jt ON(u.jobType=jt.id) LEFT JOIN statusname AS sn ON(u.status=sn.id) LEFT JOIN shifts AS s ON(u.currShift=s.id) LEFT JOIN jobsites AS js ON(u.currSiteId=js.id) WHERE u.status=1 AND u.id=?', req.params.id, function (err, rows) {
        if (err)
            console.error(err.message);
        res.render('admin/hr/viewApplication', {
            title: 'View Job',
            layout: 'layout/hr-layout.jade',
            viewApplication: rows,
            id: req.params.id,
            applications: req.session
        });
    });

});

/* POST to update application statu */
router.post('/updateUserStatus/', function (req, res) {
    chksession(req, res);
    var id = req.body.id;
    var status = req.body.status;
    db.query("UPDATE userapplications SET status=?  WHERE  id=?", [status, id], function (err, rows) {
        if (err)
            console.error(err.message);
        req.flash('msg_info', "Update Successfully");
        res.redirect('/admin/hr/manage-application');
    });
});

/* Get view-technician List */
/* router.get('/view-technician', function (req, res, next) {
    chksession(req, res);
    db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, users.id as user_id,users.jobType, users.eCode, users.experience, users.status,jobtype.id, jobtype.type_name AS jobtype , ud.designation_id,d.designation_name FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) LEFT JOIN user_designation AS ud ON(users.id=ud.user_id) LEFT JOIN designation AS d ON(ud.designation_id=d.id) where role=1', function (err, rows) {
        db.query('SELECT designation.id as designation_id,designation.designation_name,designation.job_type,jobtype.type_name,jobtype.id  FROM designation LEFT JOIN jobtype ON(designation.job_type=jobtype.id))', function (err, Designation) {
            if (err)
                console.error(err.message)
            res.render('admin/hr/view-technician', {
                title: 'hr-hr Dashboard',
                layout: 'layout/hr-layout.jade',
                users: rows,
                Designation: Designation,
                applications: req.session
            });
        });
    });
}); */
router.get('/view-technician', function (req, res, next) {
    chksession(req, res);
    db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, users.id as user_id,users.jobType, users.eCode, users.experience, users.status, users.ratings, users.allowExam, jobtype.id, jobtype.type_name AS jobtype, ud.designation_id,d.designation_name FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) LEFT JOIN user_designation AS ud ON(users.id=ud.user_id) LEFT JOIN designation AS d ON(ud.designation_id=d.id) where users.role=1 AND users.completeProfile=1', function (err, rows) {
        db.query('SELECT designation.id as designation_id,designation.designation_name,designation.job_type,jobtype.type_name,jobtype.id  FROM designation LEFT JOIN jobtype ON(designation.job_type=jobtype.id)', function (err, Designation) {
            db.query('SELECT jobtype.id AS jobTypeId, jobtype.type_name AS jobtype FROM jobtype Where active=1', function (err, jobType) {
                if (err)
                    console.error(err.message)
                res.render('admin/hr/view-technician', {
                    title: 'hr-hr Dashboard',
                    layout: 'layout/hr-layout.jade',
                    users: rows,
                    apiKey: config.get('apiKey'),
                    Designation: Designation,
                    jobTypeList: jobType,
                    applications: req.session
                });
            });
        });
    });
});

/* POST to find job based on jobType */
router.post('/search_jobType', function (req, res) {
    chksession(req, res);
    if (req.body.id) {
        db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, users.id as user_id,users.jobType, users.eCode, users.experience, users.status, users.ratings, users.allowExam, jobtype.id, jobtype.type_name AS jobtype, ud.designation_id,d.designation_name FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) LEFT JOIN user_designation AS ud ON(users.id=ud.user_id) LEFT JOIN designation AS d ON(ud.designation_id=d.id) where users.role=1 AND users.jobType=?', req.body.id, function (err, rows) {
            db.query('SELECT designation.id as designation_id,designation.designation_name,designation.job_type,jobtype.type_name, jobtype.id  FROM designation LEFT JOIN jobtype ON(designation.job_type=jobtype.id)', function (err, Designation) {
                db.query('SELECT jobtype.id jobTypeId, jobtype.type_name AS jobtype FROM jobtype Where active=1', function (err, jobType) {

                    if (err)
                        console.error(err.message)
                    res.render('admin/hr/view-technician', {
                        title: 'Edit company',
                        layout: 'layout/hr-layout.jade',
                        users: rows,
                        Designation: Designation,
                        jobTypeList: jobType,
                        applications: req.session,
                        id: req.params.id
                    });

                });
            });
        });
    } else {
        res.redirect('/admin/hr/view-technician');
    }
});


/* POST designation */
router.post('/ViewDesignationForm',
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
            res.redirect('/admin/hr/view-technician');
        } else {
            db.query('SELECT id, designation_name, job_type, hourly_rate,max_pertime_rate FROM designation where id = ?', req.body.designation_id, function (err, Designation) {

                var data = {
                    user_id: req.body.destid,
                    designation_id: req.body.designation_id,
                    // salary: Designation[0].max_pertime_rate
                };
                var userDesignation = {
                    userId: req.body.destid,
                    max_pertime_rate: Designation[0].max_pertime_rate,
                    hourly_rate: Designation[0].hourly_rate
                };
                db.query('select user_id from user_designation where user_id="' + data.user_id + '"', function (err, rows) {
                    if (rows.length != 0) {
                        db.query('DELETE FROM user_designation where user_id= ?', data.user_id)
                        db.query('INSERT INTO user_designation SET ?', data, function (err, rows, fields) {
                            db.query('DELETE FROM user_rates where userId= ?', userDesignation.userId)
                            db.query('INSERT INTO user_rates SET ?', userDesignation, function (err) {
                                if (err)
                                    console.error(err.message)
                                req.flash('msg_info', "Designation Change Successfully.");
                                res.redirect('/admin/hr/view-technician');
                            });
                        });
                    } else {
                        db.query('INSERT INTO user_designation SET ?', data, function (err, rows, fields) {
                            db.query('DELETE FROM user_rates where userId= ?', userDesignation.userId)
                            db.query('INSERT INTO user_rates SET ?', userDesignation, function (err) {
                                if (err)
                                    console.error(err.message)
                                req.flash('msg_info', "Designation Added Successfully.");
                                res.redirect('/admin/hr/view-technician');

                            });
                        });
                    }
                });
            });

        }
    });

/* POST to add location on user table */
router.post('/addLocation', function (req, res) {
    chksession(req, res);

    var userId = req.body.id;
    var data = {
        newLatitude: req.body.latitude,
        newLongitude: req.body.longitude
    };
    var location_data = {
        user_id: userId,
        longitude: req.body.longitude,
        latitude: req.body.latitude
    }
    db.query('UPDATE users SET ? WHERE id = ?', [data, userId], function (err) {
        db.query('INSERT INTO user_location SET ?', location_data, function (err) {
            if (err)
                console.error(err.message)
            req.flash('msg_info', "Location Added Successfully");
            res.redirect('/admin/hr/view-technician');
        });
    });
});

/* GET Technian view Profile */
router.get('/view-technicianProfile/:id', function (req, res) {
    chksession(req, res);
    var id = req.params.id;
    db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, u.dob, u.email, u.experience, u.newAddress, jt.type_name, s.skill_name, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = ?)) as designation, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) AS skills FROM users AS u LEFT JOIN jobtype AS jt ON(u.jobType=jt.id) LEFT JOIN skills AS s ON(u.skills=s.id) where u.id=?', [id, id], function (err, rows) {
        db.query('SELECT AVG(rating) as total_rating, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=1) AS Workmanship_Quality, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=2) AS Attendance_Punctuality, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=3) AS Organization_Cleanliness, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=4) AS Communication_Updates, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=5) AS Worked_Safe, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=6) AS Followed_Instructions_Schedule, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=7) AS Team_Player FROM `user_ratings` WHERE userId=?', [id, id, id, id, id, id, id, id], function (err, rating) {
            db.query('SELECT userId, hourly_rate, max_pertime_rate FROM user_rates WHERE userId=?', id, function (err, rate) {
                db.query('SELECT exam_date, start_time, end_time, question, no_of_given_answer, level_1_score, level_2_score, level_3_score, total_score, wrong_answer_count, neg_mark FROM `results` WHERE userId=?', id, function (err, result) {

                    /* var startTime = moment(result.start_time, "HH:mm:ss a");
                    var endTime = moment(result.end_time, "HH:mm:ss a");

                    var duration = moment.duration(endTime.diff(startTime));
                    var hours = parseInt(duration.asHours());
                    var minutes = parseInt(duration.asMinutes()) % 60;

                    return (hours + ' hour and ' + minutes + ' minutes.'); */

                    /*  var resolution
                     var EndTime = result.end_time;
                     var StartTime = result.start_time;
                     resolution = EndTime - StartTime
                     var resolutionTime = (((resolution / 1000) / 60) / 60) */
                    if (err)
                        console.error(err.message)
                    res.render('admin/hr/view-technicianProfile', {
                        title: 'View Supervisor Profile',
                        layout: 'layout/hr-layout.jade',
                        users: rows,
                        rating: rating[0],
                        designationRate: rate[0],
                        userResult: result[0],
                        url: url,
                        applications: req.session
                    });
                });
            });
        });
    });
});

/* GET To Update Technician Profile */
router.get('/edit-TechnicianProfile/:id', function (req, res) {
    chksession(req, res);
    var id = req.params.id;
    // db.query('SELECT GROUP_CONCAT(skill_id) as skills_id, u.profileImg, u.firstName, u.lastName, u.preferredName,u.dob, u.phone_number, u.email, u.experience, u.skills, u.jobType, u.country, u.state, u.city, u.address, u.newAddress, us.user_id, us.skill_id FROM users as u JOIN user_skills as us ON (u.id = us.user_id) WHERE u.id = ?', id, function (err, rows) {
    db.query('SELECT GROUP_CONCAT(skill_id) as skills_id, u.id, u.profileImg, u.firstName, u.lastName, u.preferredName,u.dob, u.phone_number, u.email, u.experience, u.skills, u.jobType, u.newAddress, us.user_id, us.skill_id, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = ?)) as designation FROM users as u JOIN user_skills as us ON (u.id = us.user_id) WHERE u.id = ?', [id, id], function (err, rows) {
        // db.query('SELECT GROUP_CONCAT(skill_id) as skills_id, u.profileImg, u.firstName, u.lastName, u.preferredName,u.dob, u.phone_number, u.email, u.experience, u.skills, u.jobType, u.newAddress, us.user_id, us.skill_id, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = ?)) as designation, d.max_pertime_rate FROM users as u JOIN user_skills as us ON (u.id = us.user_id) JOIN user_designation AS ud ON (u.id = ud.user_id) JOIN designation AS d ON (ud.designation_id = d.id) WHERE u.id = ?', [id, id], function (err, rows) {
        db.query('SELECT id, type_name FROM jobtype WHERE active=1', function (err, row) {
            db.query('SELECT id, name FROM countries', function (err, country) {
                db.query('SELECT id, name FROM states where country_id = ?', rows[0].country, function (err, state) {
                    db.query('SELECT id, name FROM cities where state_id =?', rows[0].state, function (err, city) {
                        db.query('SELECT id, skill_name FROM skills WHERE active=1', function (err, skill) {
                            if (err)
                                console.error(err.message)
                            res.render('admin/hr/edit-TechnicianProfile', {
                                title: 'View Supervisor Profile',
                                layout: 'layout/hr-layout.jade',
                                country: country,
                                state: state,
                                city: city,
                                skill: skill,
                                jobtype: row,
                                url: url,
                                apiKey: config.get('apiKey'),
                                value: rows[0],
                                id: id,
                                applications: req.session
                            });
                        });
                    });
                });
            });
        });
    });
});

/* POST to edit technician profile */
router.post('/edit-TechnicianProfile/:id', [
        check('firstName').not().isEmpty().withMessage('Name must have more than 2 characters'),
        check('lastName').not().isEmpty().withMessage('Name must have more than 2 characters'),
        check('dob', 'Date of birth is required').not().isEmpty(),
        check('email', 'Your email is not valid').not().isEmpty(),
    ],
    function (req, res) {
        chksession(req, res);
        const errors = validationResult(req);
        // var userId = req.session.uid;
        var userId = req.params.id;
        if (!errors.isEmpty()) {
            const validationErrors = errors.array();
            let errorMessages = [];
            validationErrors.forEach(function (row) {
                errorMessages.push(row.msg);
            })
            req.flash('msg_error', errorMessages);
            res.redirect('/admin/hr/edit-TechnicianProfile' + userId);
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

                if (imageExtension[1] == "jpg" || imageExtension[1] == "jpeg" || imageExtension[1] == "png" || imageExtension[1] == "pdf") {
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
                    req.flash('msg_error', "This format is not allowed , please upload file with '.png','.gif','.jpg',");
                    res.redirect('/admin/hr/edit-TechnicianProfile' + userId);
                    req.end();
                }
            }

            db.query('UPDATE users SET ? WHERE id = ? ', [data, userId], function (err, rows) {
                db.query('delete from user_skills where user_id=?', userId);
                sk.forEach(function (a) {
                    db.query('INSERT INTO user_skills (user_id, skill_id)VALUES (?, ?)', [userId, a], function (err) {
                        db.query('DELETE FROM user_skills WHERE skill_id = 0', function (err) {});
                        db.query('DELETE FROM user_rates WHERE userId = ?', userId, function (err) {});
                        db.query('INSERT INTO user_rates (userId, rate)VALUES (?, ?)', [userId, req.body.max_pertime_rate], function (err) {
                            if (err)
                                console.error(err.message)
                        });
                    });
                });
                req.flash('msg_info', "Technicnian Profile Updated Successfully");
                res.redirect('/admin/hr/edit-TechnicianProfile/' + userId);
            });
        }
    });

/* POST to change technician password from hr end */
router.post('/techChangePassword', [
    check('newPassword').isLength({
        min: 6
    }).withMessage('New Password Must be at least 6 chars long').not().isEmpty().withMessage('New Password is required!'),
    check('confirmNewPassword').isLength({
        min: 6
    }).withMessage('Confirm Password Must be at least 6 chars long').not().isEmpty().withMessage('Confirm Password is required!')
], function (req, res) {
    chksession(req, res);
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
                    req.flash('msg_info', "This User Password Has Successfully Changed.");
                    res.redirect('/admin/hr/view-technicianProfile/' + userId);
                });
            });
        });
    } else {
        req.flash('msg_error', "New Password and Confirrm New Password not matched!");
        res.redirect('/admin/hr/view-technicianProfile/' + userId);
    }

});

/* POST to update subject name */
router.post('/updateRate', function (req, res) {
    chksession(req, res);
    var userId = req.body.userId;
    var data = {
        hourly_rate: req.body.hourly_rate,
        max_pertime_rate: req.body.max_pertime_rate,
    };
    db.query('SELECT userId FROM user_rates WHERE userId = ?', userId, function (err, ratesData) {
        if (ratesData[0].userId != 0) {
            db.query('UPDATE user_rates SET ? WHERE userId = ?', [data, userId], function () {});
        } else {
            db.query('DELETE FROM user_rates where userId= ?', userId);
            db.query('INSERT INTO user_rates SET ?', data);
        }

    })

    req.flash('msg_info', "Rates Updated Successfully");
    res.redirect('/admin/hr/view-technicianProfile/' + userId);
});

/* POST meaasge to hr from particular technician */
router.post('/sendMsg', function (req, res) {
    chksession(req, res);
    var data = {
        msg_from: req.session.uid,
        msg_to: req.body.id,
        message: req.body.message,
    };
    db.query('INSERT INTO tech_messages SET ?', data, function (err) {
        if (err)
            console.error(err.message)
        req.flash('msg_info', "Message has been send successfully");
        res.redirect('/admin/hr/chat');
    });
});

/* GET To manage designation */
router.get('/manage-designation', function (req, res) {
    chksession(req, res);
    db.query('SELECT id, type_name FROM jobtype WHERE active=1', function (err, row) {
        db.query('SELECT j.id, j.type_name, d.id as designationId, d.designation_name, d.skill_level, d.hourly_rate, d.max_pertime_rate FROM jobtype AS j JOIN designation AS d ON (j.id = d.job_type) WHERE j.active=1 AND d.job_type=?', row[0].id, function (err, designationData) {
            if (err)
                console.error(err.message)
            res.render('admin/hr/manage-designation', {
                title: 'Manage Designation',
                layout: 'layout/hr-layout.jade',
                jobtype: row,
                designation: designationData,
                url: url,
                applications: req.session
            });
        });
    });
});

/* POST to manage designation */
router.post('/update-designation', function (req, res) {
    chksession(req, res);
    // var id = req.body.designation_name;
    var id = req.body.designationId;

    var data = {
        hourly_rate: req.body.hourly_rate,
        max_pertime_rate: req.body.max_pertime_rate,
    };
    db.query('UPDATE designation SET ? WHERE id = ? ', [data, id], function (err) {
        db.query('SELECT user_id FROM user_designation WHERE designation_id=?', id, function (err, userIds) {

            let query = 'INSERT INTO user_rates(userId,hourly_rate,max_pertime_rate)  VALUES ',
                parameters = '';
            var x = '(';
            userIds.forEach(function (a) {
                x += a.user_id + ',';
                parameters += `${parameters ? ', ' : ''}(${a.user_id},${req.body.hourly_rate},${req.body.max_pertime_rate})`
            });
            x += '0)';

            db.query(`DELETE from user_rates WHERE userId IN ${x}`, function (err) {
                if (err)
                    console.error(err.message)
                if (parameters) {
                    query = query + parameters;
                    db.query(query, data, function (err) {

                        if (err) {
                            console.error(err.message)
                            req.flash('msg_error', "Some error occured!");
                            res.redirect('/admin/hr/manage-designation');
                        } else {
                            req.flash('msg_info', "Designation Updated Successfully");
                            res.redirect('/admin/hr/manage-designation');
                        }
                    })
                }
            });
        });
    });
});

/* GET manage time sheet view On Hr End*/
router.get('/manage-TimeSheet/:id', function (req, res) {
    chksession(req, res);
    var taskreportingId = req.params.id;
    db.query('SELECT t.id AS taskreportingId, t.userId, t.jobId, t.date, t.inTime, t.outTime, t.description, t.hours_count, t.attachment, t.active, CONCAT(`firstName`, " ", `lastName`) AS supervisors_name, j.id AS jobId, j.jobName FROM taskreporting AS t JOIN users AS u ON (t.sup_id=u.id) LEFT JOIN jobs AS j ON(t.jobId=j.id) where t.userId=? AND t.active=1 ORDER BY t.date DESC', taskreportingId, function (err, rows) {
        if (err)
            console.error(err.message)
        res.render('admin/hr/manage-TimeSheet', {
            title: 'Edit Profile',
            layout: 'layout/hr-layout.jade',
            timeSheetDetails: rows,
            timeSheet: req.params.id,
            url: url,
            applications: req.session,
            taskreportingId: req.params.id
        });
    });
});

/* GET to edit intime & outtime on taskreporting table*/
router.post('/manage-TimeSheet/:id', function (req, res) {
    chksession(req, res);

    db.query('SELECT t.id AS taskreportingId, t.userId, t.jobId, t.date, t.inTime, t.outTime, t.description, t.active, CONCAT(`firstName`, " ", `lastName`) AS supervisors_name, j.id AS jobId, j.jobName FROM taskreporting AS t JOIN users AS u ON (t.sup_id=u.id) LEFT JOIN jobs AS j ON(t.jobId=j.id) where t.userId=? AND t.active=1 ORDER BY t.date DESC', req.params.id, function (err, rows) {
        if (err)
            console.error(err.message)
        res.render('admin/hr/manage-TimeSheet', {
            title: 'Edit Profile',
            layout: 'layout/hr-layout.jade',
            // timeSheetDetails: rows,
            url: url,
            applications: req.session

        });
    });
});

/* GET to edit intime & outtime on taskreporting table*/
router.post('/InTime-OutTime', function (req, res) {
    chksession(req, res);
    var userId = req.body.userId;
    var taskreportingId = req.body.id;

    var countHourTime = countHours(req.body.inTime, req.body.outTime);
    /* var checkCountHourTime = checkCountHours(req.body.inTime, req.body.outTime);
     if (checkCountHourTime == 0) {
        req.flash('msg_error', "Please Enter Valid Time.");
        res.redirect('/admin/hr/manage-TimeSheet/' + userId);
        req.end();
    }
 */
    var data = {
        inTime: req.body.inTime,
        outTime: req.body.outTime,
        hours_count: countHourTime,
    };
    db.query('UPDATE taskreporting SET ? WHERE id = ?', [data, taskreportingId], function (err, rows, fields) {
        if (err)
            console.error(err.message)
        req.flash('msg_info', "Time Updated Successfully");
        res.redirect('/admin/hr/manage-TimeSheet/' + userId);
    });

});

router.get('/excel-export/:id', async function (req, res) {
    // chksession(req, res);
    var taskreportingId = req.params.id;
    db.query('SELECT t.id AS taskreportingId, t.userId, t.jobId, t.date, t.inTime, t.outTime, t.description, t.active, CONCAT(`firstName`, " ", `lastName`) AS supervisors_name, j.id AS jobId, j.jobName, (SELECT u.firstName FROM taskreporting AS t JOIN users as u ON (t.userId = u.id) WHERE t.userId=? GROUP BY firstName) AS userName FROM taskreporting AS t JOIN users AS u ON (t.sup_id=u.id) LEFT JOIN jobs AS j ON(t.jobId=j.id) where t.userId=? AND t.active=1 ORDER BY t.date DESC', [taskreportingId, taskreportingId], async function (err, rows) {

        if (rows.length) {
            var timeSheetName = rows[0].userName;

            if (err)
                console.error(err.message)
            const reportings = JSON.parse(JSON.stringify(rows));

            let workbook = new excel.Workbook(); //creating workbook
            let worksheet = workbook.addWorksheet('Reportings'); //creating worksheet

            //  WorkSheet Header
            worksheet.columns = [{
                    header: 'Job Name',
                    key: 'jobName',
                    width: 10
                },
                {
                    header: 'In Time',
                    key: 'inTime',
                    width: 30
                },
                {
                    header: 'Out Time',
                    key: 'outTime',
                    width: 30
                },
                {
                    header: 'Date',
                    key: 'date',
                    width: 10,
                    outlineLevel: 1
                }
            ];

            // Add Array Rows
            worksheet.addRows(reportings);

            // Write to File
            var tempfile = require('tempfile');
            var tempFilePath = tempfile('.xlsx');
            workbook.xlsx.writeFile(tempFilePath).then(function () {
                res.sendFile(tempFilePath, function (err) {
                    req.flash('msg_error', "Some error occured to download excel");
                });
            });
        } else {
            req.flash('msg_error', "You don't have any time sheet to download yet !");
            res.redirect('/admin/hr/manage-TimeSheet/' + taskreportingId);
        }

    });

});

/* GET Technician block-Unblock Status */
router.get('/block-UnblockTech/:id', function (req, res, next) {
    chksession(req, res);
    db.query('SELECT id, status from users where id=?', req.params.id, function (err, rows) {
        if (rows[0].status == 1) {

            db.query('UPDATE users SET status=0 WHERE id=?', req.params.id, function (err) {
                if (err)
                    console.error(err.message)
                req.flash('msg_error', "Technician Blocked Successfully");
                res.redirect('/admin/hr/view-technician');
            });
        } else {
            db.query('UPDATE users SET status=1 WHERE id=?', req.params.id, function (err) {
                if (err)
                    console.error(err.message)
                req.flash('msg_info', "Technician Unblocked Successfully");
                res.redirect('/admin/hr/view-technician');
            });
        }

    });
});

/* GET to see reviews */
router.get('/view-reviews/:id', function (req, res) {
    chksession(req, res);
    var id = req.params.body;
    db.query('SELECT ur.id, ur.reviews, ur.reviewDate, ur.isJobreview, CONCAT(`firstName`, " ", `lastName`) AS name FROM user_reviews AS ur JOIN users AS u ON (ur.review_by=u.id) WHERE active=1 AND userId=? ORDER BY reviewDate DESC', req.params.id, function (err, reviews) {
        if (err)
            console.error(err.message)
        res.render('admin/hr/view-reviews', {
            title: 'hr-hr Dashboard',
            layout: 'layout/hr-layout.jade',
            reviewsList: reviews,
            applications: req.session
        });
    });
});

/* To Add Roles */
router.get('/addRoles', function (req, res, next) {
    chksession(req, res);
    res.render('admin/hr/addRoles', {
        title: 'hr-hr Dashboard',
        layout: 'layout/hr-layout.jade',
        applications: req.session
    });
});

/* Post Roles */
router.post('/addRoles', function (req, res, next) {
    chksession(req, res);

    var data = {
        type_name: req.body.type_name,
        description: req.body.description,
    };

    db.query('SELECT type_name FROM jobtype where type_name="' + data.type_name + '"', function (err, rows) {
        if (rows.length == 0) {
            db.query('INSERT INTO jobtype SET ?', data, function (err, rows, fields) {

                if (err)
                    console.error(err.message)
                req.flash('msg_info', "Role Added Successfully");
                res.redirect('/admin/hr/manageRoles');
            });

        } else {
            req.flash('msg_error', "Role already exist!");
            res.redirect('/admin/hr/addRoles');
        }
    });
    // }

});

/* GET ManagaRoles */
router.get('/manageRoles', function (req, res, next) {
    chksession(req, res);
    db.query('SELECT id, type_name, description FROM jobtype where active=1', function (err, rows) {
        if (err)
            console.error(err.message)
        res.render('admin/hr/manageRoles', {
            title: 'hr-hr Dashboard',
            layout: 'layout/hr-layout.jade',
            roles: rows,
            applications: req.session
        });
    });
});

/* Delete Roles */
router.get('/deleteRoles/:id', function (req, res, next) {
    chksession(req, res);
    db.query('UPDATE jobtype SET active=0 WHERE id=?', req.params.id, function (err) {
        if (err)
            console.error(err.message)
        req.flash('msg_error', "Skill Deleted Successfully");
        res.redirect('/admin/hr/manageRoles');
    });
});

/* Get Edit-Roles */
router.get('/editRoles/:id', function (req, res) {
    chksession(req, res);
    db.query('SELECT id, type_name, description FROM jobtype WHERE id = ?', req.params.id, function (err, rows, role) {
        if (err)
            console.error(err.message)
        res.render('admin/hr/editRoles', {
            title: 'hr-hr Dashboard',
            layout: 'layout/hr-layout.jade',
            skills: rows,
            'roles': role,
            applications: req.session
        });
    });
});

/* POST Edit-Roles */
router.post('/editRoles', function (req, res) {
    chksession(req, res);

    var data = {
        type_name: req.body.type_name,
        description: req.body.description,
    };
    db.query('SELECT type_name FROM jobtype where type_name="' + data.type_name + '" AND id !="' + req.body.id + '"', function (err, rows) {
        if (rows.length == 0) {

            db.query('UPDATE jobtype SET ? WHERE id = ? ', [data, req.body.id], function (err) {
                if (err) {
                    console.error(err.message)
                    req.flash('msg_error', "Some error occured!");
                    res.redirect('/admin/hr/addRoles');
                } else {

                    req.flash('msg_info', "Role Updated Successfully");
                    res.redirect('/admin/hr/manageRoles');
                }
            });
        } else {
            req.flash('msg_error', "Role already exist!");
            res.redirect('/admin/hr/editRoles/' + req.body.id);
        }
    });
    // }
});

/* GET to Add skills */
router.get('/addSkills', function (req, res, next) {
    chksession(req, res);
    db.query('SELECT id, type_name FROM jobtype WHERE active=1', function (err, rows) {
        if (err)
            console.error(err.message)
        res.render('admin/hr/addSkills', {
            title: 'hr-hr Dashboard',
            layout: 'layout/hr-layout.jade',
            roles: rows,
            applications: req.session
        });
    });
});

/* POST to Add skills */
router.post('/addSkills', function (req, res, next) {
    chksession(req, res);
    var data = {
        job_type_id: req.body.job_type_id,
        skill_name: req.body.skill_name,
        description: req.body.description
    };
    db.query('INSERT INTO skills SET ?', data, function (err, rows, fields) {

        if (err)
            console.error(err.message)
        req.flash('msg_info', "Skill Added Successfully");
        res.redirect('/admin/hr/manageSkills');
    });

});

/* GET to manage skills */
router.get('/manageSkills', function (req, res, next) {
    chksession(req, res);
    db.query('SELECT s.id, s.skill_name, s.active, s.description, jt.type_name FROM skills AS s join jobtype AS jt ON(s.job_type_id=jt.id) WHERE s.active=1', function (err, rows) {

        if (err)
            console.error(err.message)
        res.render('admin/hr/manageSkills', {
            title: 'hr-hr Dashboard',
            layout: 'layout/hr-layout.jade',
            skills: rows,
            applications: req.session
        });
    });
});

/* GET to delete skills */
router.get('/deleteSkills/:id', function (req, res, next) {
    chksession(req, res);
    db.query('UPDATE skills SET active=0 WHERE id=?', req.params.id, function (err, rows) {
        if (err)
            console.error(err.message)
        req.flash('msg_error', "Skill Deleted Successfully");
        res.redirect('/admin/hr/manageSkills');
    });
});

/* GET to edit skills */
router.get('/editSkills/:id', function (req, res, next) {
    chksession(req, res);
    db.query('SELECT skills.id, skills.skill_name, skills.description, jobtype.type_name FROM skills LEFT join jobtype ON (skills.job_type_id = jobtype.id) WHERE skills.id = ?', req.params.id, function (err, rows) {
        db.query('SELECT id, type_name FROM jobtype', function (err) {
            if (err)
                console.error(err.message)
            res.render('admin/hr/editSkills', {
                title: 'hr-hr Dashboard',
                layout: 'layout/hr-layout.jade',
                skills: rows,
                applications: req.session
            });
        });
    });
});

router.post('/editSkills/:id', function (req, res) {
    chksession(req, res);
    var data = {
        skill_name: req.body.skill_name,
        description: req.body.description
    };
    db.query('UPDATE skills SET ? WHERE id = ? ', [data, req.params.id], function (err, rows, fields) {
        if (err)
            console.error(err.message)
        req.flash('msg_info', "Skill Updated Successfully");
        res.redirect('/admin/hr/manageSkills');
    });
});

/* POST to find skills based on jobType */
router.post('/search_skills', function (req, res) {
    chksession(req, res);
    if (req.body.id) {
        db.query('SELECT s.id, s.skill_name, s.active, s.description, jt.type_name FROM skills AS s join jobtype AS jt ON(s.job_type_id=jt.id) WHERE s.job_type_id=? AND s.active=1', req.body.id, function (err, rows) {
            // db.query('SELECT designation.id as designation_id,designation.designation_name,designation.job_type,jobtype.type_name, jobtype.id  FROM designation LEFT JOIN jobtype ON(designation.job_type=jobtype.id)', function (err, Designation) {
            // db.query('SELECT jobtype.id jobTypeId, jobtype.type_name AS jobtype FROM jobtype Where active=1', function (err, jobType) {
            if (err)
                console.error(err.message)
            res.render('admin/hr/manageSkills', {
                title: 'Manage Skills',
                layout: 'layout/hr-layout.jade',
                skills: rows,
                // Designation: Designation,
                // jobTypeList: jobType,
                applications: req.session,
                id: req.params.id
            });

            // });
            // });
        });
    } else {
        res.redirect('/admin/hr/manageSkills');
    }
});

/* GET to Map View */
router.get('/map-view', function (req, res) {
    chksession(req, res);

    db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.phone_number, u.latitude, u.longitude, u.role, u.ratings, j.type_name, GROUP_CONCAT(jobName) as jobName, GROUP_CONCAT(jobCode) as jobCode, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation, s.total_score, s.neg_mark, s.wrong_answer_count From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN results AS s ON(u.id = s.userId) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1 GROUP by u.id`, function (err, jobUsersList) {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.phone_number, u.latitude, u.longitude, u.role, u.ratings, j.type_name, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation, s.total_score, s.neg_mark, s.wrong_answer_count From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) LEFT JOIN results AS s ON(u.id = s.userId) LEFT JOIN users_job AS uj ON(u.id=uj.user_id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND u.id NOT IN (SELECT u.id From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1) GROUP by u.firstName`, function (err, usersList) {

            db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.phone_number, u.newAddress, u.profileImg, u.role, u.latitude, u.longitude From users AS u WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=2 AND u.status=1`, function (err, plannerList) {

                db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.phone_number, u.newAddress, u.profileImg, u.role, u.latitude, u.longitude, j.type_name From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=3 AND u.status=1`, function (err, supervisorList) {

                    var a = db.query(`SELECT js.id, js.sitesCode, js.sitesCodeCpy, js.siteName, js.newAddress, js.latitude, js.longitude, CONCAT(u.firstName, " ", u.lastName) AS mname, CONCAT(u1.firstName, " ", u1.lastName) AS ename, CONCAT(us.firstName, " ", us.lastName) AS plannerName, (SELECT GROUP_CONCAT(firstName,' ',lastName) AS name FROM user_sites AS us JOIN users AS u ON (us.user_id=u.id) WHERE us.user_role=1 AND us.is_current=1 AND us.site_id=js.id) AS technicianList FROM jobsites AS js LEFT JOIN users AS u ON (js.supervisors=u.id) LEFT JOIN users AS u1 ON (js.supervisorTwo=u1.id) LEFT JOIN users AS us ON (js.planner=us.id) WHERE js.latitude IS NOT NULL AND js.latitude != ''`, function (err, jobSiteList) {
                        console.log(a.sql, 'qq')
                        var list = jobUsersList.concat(usersList, plannerList, supervisorList, jobSiteList);
                        for (var i = 0; i < jobSiteList.length; i++) {
                            if (jobSiteList[i].mname)
                                jobSiteList[i].supervisorName = jobSiteList[i].mname;
                            if (jobSiteList[i].ename)
                                jobSiteList[i].supervisorName = jobSiteList[i].ename;
                            if (jobSiteList[i].mname && jobSiteList[i].ename)
                                jobSiteList[i].supervisorName = jobSiteList[i].mname + '\n' + jobSiteList[i].ename;
                        };
                        res.render('admin/hr/map-view', {
                            title: 'Map View',
                            layout: 'layout/hr-layout.jade',
                            list: list,
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

/* GET to Map View */
router.get('/technicianMap-view', function (req, res) {
    chksession(req, res);
    db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.phone_number, u.role, u.latitude, u.longitude, u.ratings, j.type_name, GROUP_CONCAT(jobName) as jobName, GROUP_CONCAT(jobCode) as jobCode, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation, s.total_score, s.neg_mark, s.wrong_answer_count From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) LEFT JOIN results AS s ON(u.id = s.userId) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1 GROUP by u.id`, function (err, usersList) {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.phone_number, u.role, u.latitude, u.ratings, u.longitude, j.type_name, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation, s.total_score, s.neg_mark, s.wrong_answer_count From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) LEFT JOIN results AS s ON(u.id = s.userId) LEFT JOIN users_job AS uj ON(u.id=uj.user_id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND u.id NOT IN (SELECT u.id From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1) GROUP by u.id`, function (err, usersListDetail) {
            var list = usersList.concat(usersListDetail);
            res.render('admin/hr/technicianMap-view', {
                title: 'Hr Map View',
                layout: 'layout/hr-layout.jade',
                list: list,
                url: url,
                apiKey: config.get('apiKey'),
                applications: req.session
            });
        });
    });

});

/* GET to Map View */
router.get('/plannerMap-view', function (req, res) {
    chksession(req, res);
    db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.phone_number, u.newAddress, u.profileImg, u.role, u.latitude, u.longitude From users AS u WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=2 AND u.status=1`, function (err, plannerList) {
        res.render('admin/hr/plannerMap-view', {
            title: 'Hr Map View',
            layout: 'layout/hr-layout.jade',
            plannerList: plannerList,
            url: url,
            apiKey: config.get('apiKey'),
            applications: req.session
        });
    });

});

/* GET to Map View */
router.get('/supervisorMap-view', function (req, res) {
    chksession(req, res);
    db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.phone_number, u.newAddress, u.profileImg, u.role, u.latitude, u.longitude, j.type_name From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=3 AND u.status=1`, function (err, supervisorList) {
        res.render('admin/hr/supervisorMap-view', {
            title: 'Hr Map View',
            layout: 'layout/hr-layout.jade',
            supervisorList: supervisorList,
            url: url,
            apiKey: config.get('apiKey'),
            applications: req.session
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

    // db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.profileImg, tm.* FROM tech_messages AS tm JOIN users AS u ON(tm.msg_to=u.id) JOIN ( SELECT msg_to, MAX(time) AS time FROM tech_messages WHERE msg_from=4 GROUP BY msg_to ) AS tm2 ON tm.msg_to = tm2.msg_to AND tm.time = tm2.time WHERE msg_from=4 AND tm.active=1 GROUP BY name ORDER BY tm.time DESC`, [uid, uid], function (err, message) {
    // db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.profileImg, tm.* FROM tech_messages AS tm JOIN users AS u ON(tm.msg_to=u.id) JOIN ( SELECT msg_to, MAX(time) AS time FROM tech_messages GROUP BY msg_to ) AS tm2 ON tm.msg_to = tm2.msg_to AND tm.time = tm2.time WHERE tm.active=1 GROUP BY name ORDER BY tm.time DESC`, [uid, uid], function (err, message) {
    db.query(`SELECT DISTINCT msg_from AS msg_to, CONCAT(firstName,' ',lastName) AS name, u.profileImg FROM tech_messages AS tm join users as u on (tm.msg_from = u.id) WHERE msg_to=? UNION SELECT DISTINCT msg_to AS msg_to, CONCAT(firstName,' ',lastName) AS name, u.profileImg FROM tech_messages AS tm join users as u on (tm.msg_to = u.id) WHERE msg_from=?`, [uid, uid], function (err, message) {
        // db.query(`SELECT MAX(id) AS id, msg_to, msg_from FROM tech_messages WHERE msg_from=? ORDER BY id DESC`, uid, function (err, lastId) {
        db.query(`SELECT id, msg_to, msg_from FROM tech_messages ORDER BY id DESC LIMIT 1`, function (err, lastId) {
            var msg_to = lastId[0].msg_to;
            var msg_from = lastId[0].msg_from;


            db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.profileImg, tm.msg_from, tm.msg_to, tm.message, tm.time FROM tech_messages AS tm JOIN users AS u ON(tm.msg_to=u.id) WHERE tm.msg_from IN (?,?) AND tm.msg_to IN (?,?) AND tm.active=1 GROUP BY tm.id ORDER BY tm.time LIMIT 100`, [msg_from, msg_to, msg_from, msg_to], function (err, msgDetail) {
                res.render('admin/hr/chat', {
                    title: 'Technician & HR Chat View',
                    layout: 'layout/hr-layout.jade',
                    uid: uid,
                    msg_from: uid,
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

/* POST chat */
router.post('/chatUser', function (req, res) {
    chksession(req, res);
    var uid = req.session.uid;
    var token = req.session.token;
    var decoded = jwt.decode(token);
    var tokenId = decoded.id;

    // db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.profileImg, tm.* FROM tech_messages AS tm JOIN users AS u ON(tm.msg_to=u.id) JOIN ( SELECT msg_to, MAX(time) AS time FROM tech_messages WHERE msg_from=4 GROUP BY msg_to ) AS tm2 ON tm.msg_to = tm2.msg_to AND tm.time = tm2.time WHERE msg_from=4 AND tm.active=1 GROUP BY name ORDER BY tm.time DESC`, [uid, uid], function (err, message) {
    // db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.profileImg, tm.* FROM tech_messages AS tm JOIN users AS u ON(tm.msg_to=u.id) JOIN ( SELECT msg_to, MAX(time) AS time FROM tech_messages GROUP BY msg_to ) AS tm2 ON tm.msg_to = tm2.msg_to AND tm.time = tm2.time WHERE tm.active=1 GROUP BY name ORDER BY tm.time DESC`, [uid, uid], function (err, message) {
    db.query(`SELECT DISTINCT msg_from AS msg_to, CONCAT(firstName,' ',lastName) AS name, u.profileImg FROM tech_messages AS tm join users as u on (tm.msg_from = u.id) WHERE msg_to=? UNION SELECT DISTINCT msg_to AS msg_to, CONCAT(firstName,' ',lastName) AS name, u.profileImg FROM tech_messages AS tm join users as u on (tm.msg_to = u.id) WHERE firstName LIKE '%${req.body.search ? req.body.search : '%'}%' AND msg_from=?`, [uid, uid], function (err, message) {
        // db.query(`SELECT MAX(id) AS id, msg_to, msg_from FROM tech_messages WHERE msg_from=? ORDER BY id DESC`, uid, function (err, lastId) {
        db.query(`SELECT id, msg_to, msg_from FROM tech_messages ORDER BY id DESC LIMIT 1`, uid, function (err, lastId) {
            var msg_to = lastId[0].msg_to;
            var msg_from = lastId[0].msg_from;


            db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.profileImg, tm.msg_from, tm.msg_to, tm.message, tm.time FROM tech_messages AS tm JOIN users AS u ON(tm.msg_to=u.id) WHERE tm.msg_from IN (?,?) AND tm.msg_to IN (?,?) AND tm.active=1 GROUP BY tm.id ORDER BY tm.time LIMIT 100`, [msg_from, msg_to, msg_from, msg_to], function (err, msgDetail) {
                res.render('admin/hr/chat', {
                    title: 'Technician & HR Chat View',
                    layout: 'layout/hr-layout.jade',
                    uid: uid,
                    msg_from: uid,
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

/* POST to allow user for exam */
router.get('/allowExam/:id', function (req, res, next) {
    chksession(req, res);
    db.query('SELECT id, allowExam from users where id=?', req.params.id, function (err, rows) {
        if (rows[0].allowExam == 0) {

            db.query('UPDATE users SET allowExam=1 WHERE id=?', req.params.id, function (err) {
                if (err)
                    console.error(err.message)
                req.flash('msg_error', "You are eligible for exam !");
                res.redirect('/admin/hr/view-technician');
            });
        } else {
            db.query('UPDATE users SET allowExam=0 WHERE id=?', req.params.id, function (err) {
                if (err)
                    console.error(err.message)
                req.flash('msg_info', "You are not eligible for exam !");
                res.redirect('/admin/hr/view-technician');
            });
        }

    });
});

module.exports = router;