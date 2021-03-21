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

/*Planner Apis */

/*Create Sites(Create Location) */
router.post('/create-sitess', auth, [
    check('siteName').not().isEmpty().withMessage('Please Enter Site Name'),
    // check('sitesCode').not().isEmpty().withMessage('Please Enter Site Code'),
    check('newAddress').not().isEmpty().withMessage('Please Enter Address'),
    // check('state').not().isEmpty().withMessage('Please Select The State'),
    // check('city').not().isEmpty().withMessage('Please Select The City'),
    check('description').isLength({
        min: 5
    }).withMessage('Description Must be at least 5 chars long')
], function (req, res) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(403).json({
                request: 'FAIL',
                errors: utils.createErrorResponse(errors.array())
            });
        }
        console.log(req.body.mSupervisor, 'mSupervisor', req.body.eSupervisor, 'eSupervisor')
        db.query('SELECT siteName FROM jobsites where siteName=?', req.body.siteName, function (err, sites) {
            var mSupervisor, eSupervisor;
            // if (req.body.mSupervisor == 0)
            //     mSupervisor = '';
            // if (req.body.eSupervisor == 0)
            //     eSupervisor = '';

            var data = {
                siteName: req.body.siteName,
                description: req.body.description,
                supervisors: req.body.mSupervisor,
                supervisorTwo: req.body.eSupervisor,
                planner: req.user.uid,
                // sitesCode: req.body.sitesCode,
                createdBy: req.user.uid,
                createDate: moment(new Date()).format('YYYY-MM-DD'),
                newAddress: req.body.newAddress,
                latitude: req.body.latitude,
                longitude: req.body.longitude
            };
            console.log(data, 'data')
            var q = db.query('INSERT INTO jobsites SET ?', data, function (err, rows) {
                console.log(q.sql, '1111')
                if (err)
                    res.json({
                        success: false,
                        msg: err.message
                    });
                var id = q._results[0]['insertId'];
                let w = id.toString(16);
                w = w.toUpperCase();
                var sitesCodeCpy = 'SITES_' + w;
                var a = db.query('INSERT INTO user_sites (site_id, user_id, user_role, jobType) VALUES (?, ?, 3, 1), (?, ?, 3, 2)', [id, req.body.mSupervisor, id, req.body.eSupervisor], function (err) {
                    console.log(a.sql, '222222222')
                    if (err)
                        res.json({
                            success: false,
                            msg: err.message
                        });
                    db.query('DELETE FROM `user_sites` WHERE user_id=0');
                    var e = db.query('UPDATE jobsites SET sitesCodeCpy= ? WHERE id =?', [sitesCodeCpy, id], function (err) {
                        console.log(e.sql, '3333333333')
                        if (err)
                            res.json({
                                success: false,
                                msg: err.message
                            });
                        return res.status(200).json(createResponse('Success', 66));
                    });
                });
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }
});
/*End */

/*View All Sites */
router.get('/view-sites', auth, function (req, res) {
    try {
        db.query('SELECT jobsites.id, jobsites.siteName, jobsites.sitesCode, jobsites.description, jobsites.newAddress, jobsites.createDate FROM `jobsites` ', function (err, rows) {
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
        return res.status(500).json(createResponse('Success', 0));
    }
});
/************************NEW BASED ON WEB***************************/
router.get('/view-newSites', auth, function (req, res) {
    try {
        db.query('SELECT id, siteName, sitesCode, description, newAddress, createDate FROM jobsites WHERE planner=?', req.user.uid, function (err, rows) {
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
        return res.status(500).json(createResponse('Success', 0));
    }
});
/***************************************************/
/*End */

/*View Sites By Site id */
router.get('/view-singleSite/:id', auth, function (req, res) {
    var id = req.params.id;
    try {
        db.query('SELECT planner FROM jobsites WHERE id=?', id, function (err, jobSites) {
            if ((jobSites[0]) && (jobSites[0].planner == req.user.uid)) {
                // db.query('SELECT jobsites.id, jobsites.siteName, jobsites.sitesCode, jobsites.description, jobsites.createDate,  jobsites.description, jobsites.supervisors,jobsites.newAddress, jobsites.latitude, jobsites.longitude, CONCAT(`firstName`, " ", `lastName`) AS name FROM `jobsites` LEFT JOIN users ON (jobsites.supervisors = users.id) WHERE jobsites.id=?', req.params.id, function (err, rows) {
                db.query(`SELECT jobsites.id, jobsites.siteName, jobsites.sitesCode, jobsites.description, jobsites.newAddress, jobsites.latitude, jobsites.longitude, jobsites.createDate, (SELECT CONCAT(firstName, " ", lastName) from users JOIN user_sites ON (users.id = user_sites.user_id) WHERE user_sites.user_role=3 AND user_sites.is_current=1 AND user_sites.jobType=1 AND user_sites.site_id=jobsites.id) AS mname,(SELECT CONCAT(firstName, " ", lastName) from users JOIN user_sites ON (users.id = user_sites.user_id) WHERE user_sites.user_role=3 AND user_sites.is_current=1 AND user_sites.jobType=2 AND user_sites.site_id=jobsites.id) AS ename FROM jobsites WHERE jobsites.id=?`, id, function (err, rows) {

                    for (var i = 0; i < rows.length; i++) {
                        if (rows[i].mname)
                            rows[i].name = rows[i].mname;
                        if (rows[i].ename)
                            rows[i].name = rows[i].ename;
                        if (rows[i].ename && rows[i].mname)
                            rows[i].name = rows[i].ename + '/' + rows[i].mname;
                    };
                    db.query('SELECT id, jobCode, jobName, noOfPhases, endDate FROM jobs WHERE siteId=? ORDER BY createDate DESC limit 5', req.params.id, function (err, list) {
                        if (err)
                            res.json({
                                success: false,
                                msg: err.message
                            });
                        return res.status(200).json({
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
                            /* projects_list: {
                                "id": list[0].id,
                                "jobCode": list[0].jobCode,
                                "jobName": list[0].jobName,
                                "noOfPhases": list[0].noOfPhases,
                                "endDate": list[0].endDate,
                            } */

                        });
                    });
                });
            } else {
                return res.status(404).json(createResponse('NOT Found', 48));
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }
});
/*End */

/*Change Supervisor */
/* router.post('/updateSupervisor/:id', auth, function (req, res) {
    db.query('UPDATE jobsites SET supervisors=? WHERE id=?', [req.body.jobSupervisor, req.params.id], function (err, rows) {
        db.query('SELECT user_id FROM user_sites WHERE user_role=3 AND site_id=? AND is_current=1', req.params.id, function (err, supId) {
            db.query('UPDATE user_sites SET is_current=0 WHERE user_id=? AND site_id=?', [supId[0].user_id, req.params.id], function (err) {
                db.query('INSERT INTO user_sites (site_id, user_id, user_role) VALUES (?, ?, 3)', [req.params.id, req.body.jobSupervisor], function (err, rows) {
                    db.query('UPDATE jobsites SET supervisors=? WHERE id=?', [supId[0].user_id, req.params.id], function (err) {
                        db.query('UPDATE users_job SET sup_id=? WHERE siteId=? AND sup_id=?', [req.body.jobSupervisor, req.params.id, supId[0].user_id], function (err) {
                            if (err)
                                res.json({
                                    success: false,
                                    msg: err.message
                                });
                            return res.status(200).json(createResponse('Success', 67));
                        });
                    });
                });
            });
        });
    });
}); */

router.post('/updateSupervisor/:id', auth, function (req, res) {
    try {
        var siteId = req.params.id;
        var userId = req.body.jobSupervisor;
        var jobType = req.body.jobType;
        var dsup;
        if (jobType == 1) {
            dsup = 'supervisors'
        }
        if (jobType == 2) {
            dsup = 'supervisorTwo'
        }


        db.query('SELECT user_id FROM user_sites WHERE user_role=3 AND jobType=? AND site_id=? AND is_current=1', [jobType, siteId], function (err, supId) {
            if (supId[0]) {

                db.query('UPDATE user_sites SET is_current=0 WHERE user_id=? AND site_id=?', [supId[0].user_id, siteId], function (err) {
                    db.query('INSERT INTO user_sites (site_id, user_id,jobType, user_role) VALUES (?, ?,?, 3)', [siteId, userId, jobType], function (err, rows) {
                        db.query('UPDATE taskreporting SET sup_id=? WHERE jobId IN (select id from jobs where siteId=?) AND sup_id=?', [userId, siteId, supId[0].user_id], function (err) {
                            db.query('UPDATE users_job SET sup_id=? WHERE siteId=? AND sup_id=?', [userId, siteId, supId[0].user_id], function (err) {
                                db.query('UPDATE jobs SET jobSupervisor=? WHERE siteId=?', [userId, siteId], function (err) {
                                    db.query(`UPDATE jobsites SET ` + dsup + `=? WHERE id=?`, [userId, siteId], function (err, rows) {
                                        if (err)
                                            res.json({
                                                success: false,
                                                msg: err.message
                                            });
                                        return res.status(200).json(createResponse('Success', 67));
                                    });
                                });
                            });
                        });
                    });
                });
            } else {
                db.query('INSERT INTO user_sites (site_id, user_id,jobType, user_role) VALUES (?, ?,?, 3)', [siteId, userId, jobType], function (err, rows) {
                    db.query(`UPDATE jobsites SET ` + dsup + `=? WHERE id=?`, [userId, siteId], function (err, rows) {
                        if (err)
                            res.json({
                                success: false,
                                msg: err.message
                            });
                        return res.status(200).json(createResponse('Success', 67));
                    });
                });
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }

});
/*End */

/*Create Planner Jobs  */

router.post('/create-plannerJobs/:id', auth, [
        check('description').isLength({
            min: 5
        }).withMessage('Description Must be at least 5 chars long'),
        check('noOfVacancy').isNumeric(),
        check('noOfPhases').isNumeric(),
    ],
    async function (req, res) {
        var id = req.params.id;
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
                    db.query('SELECT supervisors FROM jobsites WHERE id=?', req.params.id, function (err, supervisors) {
                        sup = supervisors[0].supervisors;
                        var data = {
                            siteId: req.params.id,
                            jobName: req.body.jobName,
                            jobCode: req.body.jobCode,
                            jobTypeId: req.body.jobType,
                            description: req.body.description,
                            jobPlanner: req.user.uid,
                            jobSupervisor: sup,
                            startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
                            endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
                            createdBy: req.user.uid,
                            createDate: new Date(),
                            noOfVacancy: req.body.noOfVacancy,
                            noOfPhases: req.body.noOfPhases,
                            days_count: req.body.days_count,
                            proposed_budget: req.body.proposed_budget,
                            workingHoursPerDay: req.body.workingHoursPerDay,
                            workingDayPerWeek: req.body.workingDayPerWeek,
                        };
                        var q = db.query('INSERT INTO jobs SET ?', data, function (err, rows) {
                            if (err)
                                console.error(err.message)
                            var id = q._results[0]['insertId'];
                            let w = id.toString(16);
                            w = w.toUpperCase();
                            var userCode = 'JOB_' + w;
                            /* sks.forEach(function (a) {
                                db.query('INSERT INTO job_skills(job_id, skill_id)VALUES (?, ?)', [id, a]);
                                db.query('DELETE FROM job_skills WHERE skill_id = 0', function (err) {});
                            }); */
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
                } else {
                    return res.status(403).json(createResponse('FAIL', 69));
                }
            });
        } catch (err) {
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }
    });

/********************************************************/
router.post('/create-newPlannerJobs/:id', auth, [
        check('description').isLength({
            min: 5
        }).withMessage('Description Must be at least 5 chars long'),
        check('noOfVacancy').isNumeric(),
        check('noOfPhases').isNumeric(),
    ],
    async function (req, res) {
        var id = req.params.id;
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
            var a = db.query('SELECT user_id AS supervisors FROM user_sites WHERE user_role=3 AND site_id=? AND is_current=1 AND jobType=?', [req.params.id, req.body.jobType], function (err, supervisors) {
                console.log(a.sql,'qqqq')
                if (!supervisors[0]) {
                    return res.status(403).json(createResponse('FAIL', 109));

                } else {

                    db.query('SELECT jobCode FROM jobs WHERE jobCode=?', req.body.jobCode, function (err, jobCode) {
                        if (jobCode.length == 0) {

                            sup = supervisors[0].supervisors;
                            db.query('SELECT planner FROM jobsites WHERE id=?', id, function (err, jobSites) {
                                if ((jobSites[0]) && (jobSites[0].planner == req.user.uid)) {
                                    var data = {
                                        siteId: req.params.id,
                                        jobName: req.body.jobName,
                                        jobCode: req.body.jobCode,
                                        jobTypeId: req.body.jobType,
                                        description: req.body.description,
                                        jobPlanner: req.user.uid,
                                        jobSupervisor: sup,
                                        startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
                                        endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
                                        createdBy: req.user.uid,
                                        createDate: new Date(),
                                        noOfVacancy: req.body.noOfVacancy,
                                        noOfPhases: req.body.noOfPhases,
                                        days_count: req.body.days_count,
                                        proposed_budget: req.body.proposed_budget,
                                        workingHoursPerDay: req.body.workingHoursPerDay,
                                        workingDayPerWeek: req.body.workingDayPerWeek,
                                    };
                                    var q = db.query('INSERT INTO jobs SET ?', data, function (err, rows) {
                                        if (err)
                                            console.error(err.message)
                                        var id = q._results[0]['insertId'];
                                        let w = id.toString(16);
                                        w = w.toUpperCase();
                                        var userCode = 'JOB_' + w;
                                        /* sks.forEach(function (a) {
                                            db.query('INSERT INTO job_skills(job_id, skill_id)VALUES (?, ?)', [id, a]);
                                            db.query('DELETE FROM job_skills WHERE skill_id = 0', function (err) {});
                                        }); */
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
                                } else {
                                    return res.status(404).json(createResponse('FAIL', 48));
                                }
                            });


                        } else {
                            return res.status(403).json(createResponse('FAIL', 69));
                        }
                    });
                }
            });
        } catch (err) {
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }
    });
/********************************************************/

/*End */

/*Edit Planner Jobs */
router.post('/edit-plannerJobs/:id', auth, [
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
                    var data = {
                        jobName: req.body.jobName,
                        jobCode: req.body.jobCode,
                        jobTypeId: req.body.jobType,
                        description: req.body.description,
                        jobPlanner: req.user.uid,
                        startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
                        endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
                        createdBy: req.user.uid,
                        createDate: new Date(),
                        noOfVacancy: req.body.noOfVacancy,
                        noOfPhases: req.body.noOfPhases,
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

                } else {
                    return res.status(403).json(createResponse('FAIL', 69));
                }
            });
        } catch (err) {
            console.error(err.message);
            return res.status(500).json(createResponse('Success', 0));
        }
    });
/*End */

/*View All projects */
router.get('/view-plannerJobs/:id', auth, function (req, res) {
    try {
        db.query('SELECT js.id as jobSiteId, js.siteName, js.sitesCode, j.id AS jobId, j.jobCode, j.jobName, j.noOfVacancy, j.noOfPhases, j.startDate, j.endDate, j.days_count,j.workingHoursPerDay, j.workingDayPerWeek, j.predicated_budget, (SELECT GROUP_CONCAT(id) FROM designation WHERE job_type=j.jobTypeId) AS des_id, (SELECT GROUP_CONCAT(designation_name) FROM designation WHERE job_type=j.jobTypeId) AS des_name,(SELECT COUNT(user_id) FROM `users_job` WHERE job_id=jobId AND isCurrentJob=1) AS emp_count FROM jobs AS j LEFT JOIN jobsites AS js ON(js.id=j.siteId) WHERE js.id=? AND j.status=1', req.params.id, function (err, list) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (list.length == 0)
                return res.status(404).json(createResponse('NOT FOUND', 48));
            return res.status(200).json({
                jobList: list
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }
});

/************************NEW BASED ON WEB*********************************/
router.get('/view-newPlannerJobs/:id', auth, function (req, res) {
    try {
        db.query('SELECT js.id as jobSiteId, js.siteName, js.sitesCode, j.id AS jobId, j.jobCode, j.jobName, j.noOfVacancy, j.noOfPhases, j.startDate, j.endDate, j.days_count,j.workingHoursPerDay, j.workingDayPerWeek, j.predicated_budget, (SELECT GROUP_CONCAT(id) FROM designation WHERE job_type=j.jobTypeId) AS des_id, (SELECT GROUP_CONCAT(designation_name) FROM designation WHERE job_type=j.jobTypeId) AS des_name,(SELECT COUNT(user_id) FROM `users_job` WHERE job_id=jobId AND isCurrentJob=1) AS emp_count FROM jobs AS j LEFT JOIN jobsites AS js ON(js.id=j.siteId) WHERE js.id=? AND j.status=1 AND js.planner=?', [req.params.id, req.user.uid], function (err, list) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (list.length == 0)
                return res.status(404).json(createResponse('NOT FOUND', 48));
            return res.status(200).json({
                jobList: list
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }
});
/*********************************************************/

/*********************************************************/
router.get('/get-newSupervisorList', auth, function (req, res) {
    try {
        var a = db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, IFNULL(u.dob, "") AS dob, u.email, u.phone_number, IFNULL(u.jobtype, "") AS jobtype, IFNULL(jt.type_name, "") AS project_trade, IFNULL(u.skills, "") AS skills, IFNULL(u.experience, "") AS experience, IFNULL(u.newAddress, "") AS newAddress, IFNULL(js.siteName, "") AS siteName, IFNULL(js.sitesCode, "") AS sitesCode, (SELECT count(id) FROM supervisor_taskreporting WHERE status=0 AND supId=u.id AND plannerId=?) as pending_reports FROM users AS u LEFT JOIN jobtype AS jt ON(u.jobType=jt.id) LEFT JOIN jobsites AS js ON(u.currSiteId=js.id) where role=3 AND u.id in (Select user_id from user_sites where user_role=3 AND is_current =1 AND site_id IN (select id from jobsites where planner =?))', [req.user.uid, req.user.uid], function (err, rows) {
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
/*********************************************************/
/*End */

/*View Supervisor in Planner */
router.get('/view-supervisorList', auth, function (req, res) {
    try {
        db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, u.dob, u.email, u.jobtype, u.experience, (SELECT siteName FROM jobsites WHERE id=(SELECT site_id FROM user_sites WHERE user_id=u.id AND is_current =1 limit 1)) as siteName FROM users AS u where role=3', function (err, rows) {

            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json({
                data: rows
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }
});
/*End */

/*View Supervisor Profile */
router.get('/view-supervisorProfile/:id', auth, function (req, res) {
    try {
        db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, u.dob, u.email, u.experience, u.newAddress, jt.type_name, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) AS skills FROM users AS u LEFT JOIN jobtype AS jt ON(u.jobType=jt.id) LEFT JOIN skills AS s ON(u.skills=s.id) where u.id=?', req.params.id, function (err, rows) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json({
                data: rows
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }
});
/*End */

/*Planner Tecnicians List */
router.get('/planner-technicianList/:id', auth, function (req, res) {
    try {
        var jobtype = req.params.id;
        if (jobtype == 0) {
            skcartJobytpeFilter = ''
        } else {
            skcartJobytpeFilter = ` AND jobtype.id = ${jobtype} `
        }
        db.query(`SELECT CONCAT(firstName, ' ', lastName) AS name, users.id, users.eCode, IFNULL(users.experience, "") AS experience, users.status, IFNULL(jobtype.type_name, "") AS jobtype FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) where role=1 ${skcartJobytpeFilter}`, function (err, rows) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            return res.status(200).json({
                data: rows
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }
});

/**********************************************************/
router.get('/planner-newTechnicianList/:id', auth, function (req, res) {
    try {
        var jobtype = req.params.id;
        if (jobtype == 0) {
            skcartJobytpeFilter = ''
        } else {
            skcartJobytpeFilter = ` AND jobtype.id = ${jobtype} `
        }
        var a = db.query(`SELECT CONCAT(firstName, ' ', lastName) AS name, users.id, users.eCode, IFNULL(users.experience, "") AS experience, users.status, IFNULL(jobtype.type_name, "") AS jobtype FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) where role=1 AND users.id in (Select user_id from user_sites where user_role=1 AND is_current =1 AND site_id IN (select id from jobsites where planner =?)) ${skcartJobytpeFilter}`, req.user.uid, function (err, rows) {
            console.log(a.sql,'qq')
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (rows.length == 0)
                return res.status(404).json(createResponse('NOT Found', 48));
            return res.status(200).json({
                data: rows
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('Success', 0));
    }
});
/**********************************************************/

/*End */

/*View Planners Jobs */
router.get('/view-plannerJobs', auth, function (req, res) {
    try {
        db.query('SELECT js.id as jobSiteId, js.siteName, js.sitesCode, j.id AS jobId, j.jobCode,j.jobName, j.noOfVacancy, j.noOfPhases, j.startDate, j.endDate, j.days_count, j.workingHoursPerDay, j.workingDayPerWeek, j.predicated_budget, j.createdBy, (SELECT GROUP_CONCAT(id) FROM designation WHERE job_type=j.jobTypeId) AS des_id, (SELECT GROUP_CONCAT(designation_name) FROM designation WHERE job_type=j.jobTypeId) AS des_name, (SELECT COUNT(user_id) FROM `users_job` WHERE job_id=jobId AND isCurrentJob=1) AS emp_count FROM jobs AS j LEFT JOIN jobsites AS js ON(js.id=j.siteId)', function (err, list) {

            if (err)
                console.error(err.message)
            return res.status(200).json({
                jobList: list,
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/************************NEW BASED ON WEB***************************/
router.get('/view-newPlannerJobs', auth, function (req, res) {
    try {
        db.query('SELECT js.id as jobSiteId, js.siteName, js.sitesCode, j.id AS jobId, j.jobCode,j.jobName, j.noOfVacancy, j.noOfPhases, j.startDate, j.endDate, j.days_count, j.workingHoursPerDay, j.workingDayPerWeek, j.predicated_budget, j.createdBy, (SELECT GROUP_CONCAT(id) FROM designation WHERE job_type=j.jobTypeId) AS des_id, (SELECT GROUP_CONCAT(designation_name) FROM designation WHERE job_type=j.jobTypeId) AS des_name, (SELECT COUNT(user_id) FROM `users_job` WHERE job_id=jobId AND isCurrentJob=1) AS emp_count FROM jobs AS j LEFT JOIN jobsites AS js ON(js.id=j.siteId) WHERE j.status=1 AND js.planner=?', req.user.uid, function (err, list) {
            if (err)
                console.error(err.message)
            if (list.length == 0)
                return res.status(404).json(createResponse('FAIL', 48));
            return res.status(200).json({
                jobList: list,
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/***************************************************/

/***************************************************/
router.get('/planner-newSupervisorMapView', auth, function (req, res) {
    try {
        var a = db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.phone_number, u.newAddress, u.profileImg, u.role, u.email, IFNULL(u.dob, "") AS dob, u.latitude, u.longitude, j.type_name From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=3 AND u.status=1 AND u.status=1 AND u.id in (Select user_id from user_sites where user_role=3 AND is_current =1 AND site_id IN (select id from jobsites where planner =? ))`, req.user.uid, function (err, supervisorList) {
            console.log(a.sql, 'qqqqqqq')
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
/***************************************************/

/***************************************************/
router.get('/plannerNewSupervisorMapView', auth, function (req, res) {
    /////////////////////////Same location user/////////////////////////////
    var users_dup = [];
    var users_dup_list = [];
    var users_dup_only = [];
    var users_dup_inner = [];
    var duplicateArr = [];
    /////////////////////////Same location user/////////////////////////////
    try {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.phone_number, u.newAddress, u.profileImg, u.role, u.email, u.dob, u.latitude, u.longitude, j.type_name From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=3 AND u.status=1 AND u.status=1 AND u.id in (Select user_id from user_sites where user_role=3 AND is_current =1 AND site_id IN (select id from jobsites where planner =? ))`, req.user.uid, function (err, supervisorList) {
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
/***************************************************/

/* GET user list to view on Map View */
router.get('/planner-technicianMap-view', auth, function (req, res) {
    try {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.role, u.ratings, u.phone_number, u.latitude, u.longitude, j.type_name, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 GROUP by u.id`, function (err, usersListDetail) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (usersListDetail.length == 0)
                return res.status(404).json(createResponse('NOT FOUND', 48));
            res.status(200).json({
                data: usersListDetail
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* GET user list to view on Map View */
router.get('/plannerNewtechnicianMapView', auth, function (req, res) {
    /////////////////////////Same location user/////////////////////////////
    var users_dup = [];
    var users_dup_list = [];
    var users_dup_only = [];
    var users_dup_inner = [];
    var duplicateArr = [];
    /////////////////////////Same location user/////////////////////////////
    try {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.role, u.ratings, u.phone_number, u.latitude, u.longitude, j.type_name, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 GROUP by u.id`, function (err, usersListDetail) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (usersListDetail.length == 0)
                return res.status(404).json(createResponse('NOT FOUND', 48));
            /////////////////////////Same location user/////////////////////////////
            usersListDetail.forEach(function (a) {
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
            res.status(200).json({
                // data: usersListDetail,
                /////////////////////////Same location user/////////////////
                data: users_dup_only,
                /////////////////////////Same location user/////////////////
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/**********************************************************/
router.get('/planner-newTechnicianMapView', auth, function (req, res) {
    try {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.role, u.ratings, u.phone_number, u.latitude, u.longitude, j.type_name, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND u.id in (Select user_id from user_sites where user_role=1 AND is_current =1 AND site_id IN (select id from jobsites where planner =? )) GROUP by u.id`, req.user.uid, function (err, usersListDetail) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (usersListDetail.length == 0)
                return res.status(404).json(createResponse('NOT FOUND', 48));
            res.status(200).json({
                data: usersListDetail
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/**********************************************************/

/**********************************************************/
router.get('/plannerNewTechnicianMapView', auth, function (req, res) {
    /////////////////////////Same location user/////////////////////////////
    var users_dup = [];
    var users_dup_list = [];
    var users_dup_only = [];
    var users_dup_inner = [];
    var duplicateArr = [];
    /////////////////////////Same location user/////////////////////////////
    try {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.role, u.ratings, u.phone_number, u.latitude, u.longitude, j.type_name, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND u.id in (Select user_id from user_sites where user_role=1 AND is_current =1 AND site_id IN (select id from jobsites where planner =? )) GROUP by u.id`, req.user.uid, function (err, usersListDetail) {
            if (err)
                res.json({
                    success: false,
                    msg: err.message
                });
            if (usersListDetail.length == 0)
                return res.status(404).json(createResponse('NOT FOUND', 48));
            /////////////////////////Same location user/////////////////////////////
            usersListDetail.forEach(function (a) {
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
            res.status(200).json({
                // data: usersListDetail,
                /////////////////////////Same location user/////////////////
                data: users_dup_only,
                /////////////////////////Same location user/////////////////
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/**********************************************************/

/* GET get user profile */
router.get('/getProfile', auth, function (req, res) {
    try {
        var user = req.user;
        var userId = user.uid;
        db.query('SELECT IFNULL(u.phone_number,"") AS phone_number, IFNULL(u.preferredName,"") AS preferredName, u.profileImg, IFNULL(u.firstName,"") AS firstName , IFNULL(u.lastName,"") AS lastName, u.dob, IFNULL(u.email,"") AS email, IFNULL(u.newAddress,"") AS newAddress ,IFNULL(u.latitude,"") AS latitude ,IFNULL(u.longitude,"") AS longitude FROM users as u WHERE u.id = ?', userId, function (err, rows) {
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
                        'email': rows[0].email,
                        'birthday': rows[0].dob ? moment(new Date(rows[0].dob)).format("YYYY-MM-DD") : "",
                        // 'experience': rows[0].experience,
                        'imageUrl': rows[0].profileImg ? config.get("appUrl") + 'uploads/profile_img' + '/' + rows[0].profileImg.trim() : "",
                        // 'skills': rows[0].skills_id,
                        // 'country': rows[0].country,
                        // 'state': rows[0].state,
                        // 'city': rows[0].city,
                        // 'Address': rows[0].address,
                        'NewAddress': rows[0].newAddress,
                        'Latitude': rows[0].latitude,
                        'Longitude': rows[0].longitude,
                        'preferredName': rows[0].preferredName,
                        // 'jobType': rows[0].jobType
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
router.post('/updateProfile', auth, [
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
            if (!req.files) {
                var data = {
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    dob: moment(req.body.dob).format('YYYY-MM-DD'),
                    newAddress: req.body.newAddress,
                    phone_number: req.body.phone_number,
                    preferredName: req.body.preferredName,
                    newLatitude: req.body.latitude,
                    newLongitude: req.body.longitude,
                    // jobType: req.body.jobType,
                    // experience: parseFloat(req.body.year + '.' + req.body.month),
                    // country: req.body.country,
                    // state: req.body.state,
                    // city: req.body.city
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
                        newAddress: req.body.newAddress,
                        phone_number: req.body.phone_number,
                        preferredName: req.body.preferredName,
                        newLatitude: req.body.latitude,
                        newLongitude: req.body.longitude,
                        // jobType: req.body.jobType,
                        // experience: req.body.year + '.' + req.body.month,
                        // country: req.body.country,
                        // state: req.body.state,
                        // city: req.body.city,
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
                res.status(200);
                return res.json(createResponse("Success", 10));
            });
        } catch (err) {
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }
    });

/*Edit Sites Details */
router.post('/edit-sites/:id', auth, [
        check('siteName').not().isEmpty().withMessage('Please Enter Site Name'),
        check('description').isLength({
            min: 5
        }).withMessage('Description Must be at least 5 chars long')
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
            console.log(req.body, 'dddddddd')
            var data = {
                siteName: req.body.siteName,
                // sitesCode: req.body.sitesCode,
                newAddress: req.body.newAddress,
                latitude: req.body.latitude,
                longitude: req.body.longitude,
                description: req.body.description,

            };
            db.query('UPDATE jobsites SET ? WHERE id=?', [data, req.params.id], function (err) {
                if (err)
                    res.json({
                        success: false,
                        msg: err.message
                    });
                return res.status(200).json(createResponse('Success', 72));
            });
        } catch (err) {
            console.error(err.message);
            return res.status(500).json(createResponse('Success', 0));
        }
    });
/*End */

/* GET to Map View */
router.get('/planner-mapView', auth, function (req, res) {
    try {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.phone_number, u.latitude, u.longitude, u.role, u.ratings, j.type_name, GROUP_CONCAT(jobName)as jobName, GROUP_CONCAT(jobCode) as jobCode From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1 GROUP by u.id`, function (err, jobUsersList) {
            db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.phone_number, u.latitude, u.longitude, u.role, u.ratings, j.type_name From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) LEFT JOIN users_job AS uj ON(u.id=uj.user_id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND u.id NOT IN (SELECT u.id From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1) GROUP by u.firstName`, function (err, usersList) {

                db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.phone_number, u.newAddress, u.profileImg, u.role, u.latitude, u.longitude, j.type_name, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) AS skills From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=3 AND u.status=1`, function (err, supervisorList) {

                    db.query(`SELECT js.id, js.sitesCodeCpy AS sitesCode, js.siteName, js.newAddress, js.latitude, js.longitude, CONCAT(u.firstName,' ',u.lastName) AS supervisorName, CONCAT(us.firstName,' ',us.lastName) AS plannerName, (SELECT GROUP_CONCAT(firstName,' ',lastName) AS name FROM user_sites AS us JOIN users AS u ON (us.user_id=u.id) WHERE us.user_role=1 AND us.is_current=1 AND us.site_id=js.id) AS technicianList, j.predicated_budget FROM jobsites AS js LEFT JOIN jobs AS j ON (js.id=j.siteId) LEFT JOIN users AS u ON (js.supervisors=u.id) LEFT JOIN users AS us ON (js.planner=us.id) WHERE js.latitude IS NOT NULL AND js.latitude != ''`, function (err, jobSiteList) {
                        var list = jobUsersList.concat(usersList, supervisorList, jobSiteList);
                        if (err)
                            res.json({
                                success: false,
                                msg: err.message
                            });
                        return res.status(200).json({
                            list: list,
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

/******************************************************************/
router.get('/planner-newMapView', auth, function (req, res) {
    try {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress,u.email,u.dob, u.profileImg, u.phone_number, u.latitude, u.longitude, u.role, u.ratings, j.type_name, GROUP_CONCAT(jobName)as jobName, GROUP_CONCAT(jobCode) as jobCode From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1 AND u.id in (Select user_id from user_sites where user_role=1 AND is_current =1 AND site_id IN (select id from jobsites where planner =? )) GROUP by u.id`, req.user.uid, function (err, jobUsersList) {
            db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress,u.email,u.dob, u.profileImg, u.phone_number, u.latitude, u.longitude, u.role, u.ratings, j.type_name From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) LEFT JOIN users_job AS uj ON(u.id=uj.user_id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND u.id NOT IN (SELECT u.id From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1) AND u.id in (Select user_id from user_sites where user_role=1 and is_current =1 and site_id IN (select id from jobsites where planner =? )) GROUP by u.firstName`, req.user.uid, function (err, usersList) {

                db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience,u.email,u.dob, u.phone_number, u.newAddress, u.profileImg, u.role, u.latitude, u.longitude, j.type_name, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) AS skills From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=3 AND u.status=1 AND u.id in (Select user_id from user_sites where user_role=3 and is_current =1 and site_id IN (select id from jobsites where planner =? ))`, req.user.uid, function (err, supervisorList) {

                    db.query(`SELECT js.id, js.sitesCodeCpy AS sitesCode, js.siteName, js.newAddress, js.latitude, js.longitude, CONCAT(u.firstName,' ',u.lastName) AS supervisorName, CONCAT(u1.firstName,' ',u1.lastName) AS supervisorNameTwo, CONCAT(us.firstName,' ',us.lastName) AS plannerName, (SELECT GROUP_CONCAT(firstName,' ',lastName) AS name FROM user_sites AS us JOIN users AS u ON (us.user_id=u.id) WHERE us.user_role=1 AND us.is_current=1 AND us.site_id=js.id) AS technicianList, j.predicated_budget FROM jobsites AS js LEFT JOIN jobs AS j ON (js.id=j.siteId) LEFT JOIN users AS u ON (js.supervisors=u.id) LEFT JOIN users AS u1 ON (js.supervisorTwo=u1.id) LEFT JOIN users AS us ON (js.planner=us.id) WHERE js.latitude IS NOT NULL AND js.latitude != '' AND js.planner=?`, req.user.uid, function (err, jobSiteList) {

                        if (err)
                            res.json({
                                success: false,
                                msg: err.message
                            });
                        for (var i = 0; i < jobSiteList.length; i++) {
                            if (jobSiteList[i].supervisorName)
                                jobSiteList[i].name = jobSiteList[i].supervisorName;
                            if (jobSiteList[i].supervisorNameTwo)
                                jobSiteList[i].name = jobSiteList[i].supervisorNameTwo;
                            if (jobSiteList[i].supervisorNameTwo && jobSiteList[i].supervisorName)
                                jobSiteList[i].name = jobSiteList[i].supervisorNameTwo + '/' + jobSiteList[i].supervisorName;
                        };
                        var list = jobUsersList.concat(usersList, supervisorList, jobSiteList);
                        return res.status(200).json({
                            list: list,
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
/******************************************************************/

/******************************************************************/
router.get('/plannerNewMapView', auth, function (req, res) {
    /////////////////////////Same location user/////////////////////////////
    var users_dup = [];
    var users_dup_list = [];
    var users_dup_only = [];
    var users_dup_inner = [];
    var duplicateArr = [];
    /////////////////////////Same location user/////////////////////////////
    try {
        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.phone_number, u.latitude, u.longitude, u.role, u.ratings, j.type_name, GROUP_CONCAT(jobName)as jobName, GROUP_CONCAT(jobCode) as jobCode From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1 AND u.id in (Select user_id from user_sites where user_role=1 AND is_current =1 AND site_id IN (select id from jobsites where planner =? )) GROUP by u.id`, req.user.uid, function (err, jobUsersList) {
            db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.phone_number, u.latitude, u.longitude, u.role, u.ratings, j.type_name From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) LEFT JOIN users_job AS uj ON(u.id=uj.user_id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND u.id NOT IN (SELECT u.id From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1) AND u.id in (Select user_id from user_sites where user_role=1 and is_current =1 and site_id IN (select id from jobsites where planner =? )) GROUP by u.firstName`, req.user.uid, function (err, usersList) {

                db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.phone_number, u.newAddress, u.profileImg, u.role, u.latitude, u.longitude, j.type_name, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) AS skills From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=3 AND u.status=1 AND u.id in (Select user_id from user_sites where user_role=3 and is_current =1 and site_id IN (select id from jobsites where planner =? ))`, req.user.uid, function (err, supervisorList) {

                    db.query(`SELECT js.id, js.sitesCodeCpy AS sitesCode, js.siteName, js.newAddress, js.latitude, js.longitude, CONCAT(u.firstName,' ',u.lastName) AS supervisorName, CONCAT(us.firstName,' ',us.lastName) AS plannerName, (SELECT GROUP_CONCAT(firstName,' ',lastName) AS name FROM user_sites AS us JOIN users AS u ON (us.user_id=u.id) WHERE us.user_role=1 AND us.is_current=1 AND us.site_id=js.id) AS technicianList, j.predicated_budget FROM jobsites AS js LEFT JOIN jobs AS j ON (js.id=j.siteId) LEFT JOIN users AS u ON (js.supervisors=u.id) LEFT JOIN users AS us ON (js.planner=us.id) WHERE js.latitude IS NOT NULL AND js.latitude != '' AND js.planner=?`, req.user.uid, function (err, jobSiteList) {
                        var list = jobUsersList.concat(usersList, supervisorList, jobSiteList);
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
            });
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});
/******************************************************************/

/*18/11/19 */
/* post planner new create jobs based on enhancement */
router.post('/planner-createJobs/:id', auth, [
        check('description').isLength({
            min: 5
        }).withMessage('Description Must be at least 5 chars long'),
        check('noOfVacancy').isNumeric(),
        check('noOfPhases').isNumeric(),
    ],
    async function (req, res) {
        var id = req.params.id;
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
                    db.query('SELECT supervisors FROM jobsites WHERE id=?', req.params.id, function (err, supervisors) {
                        sup = supervisors[0].supervisors;
                        if (!(req.body.workingHoursPerDay || req.body.workingDayPerWeek)) {
                            var data = {
                                siteId: req.params.id,
                                jobName: req.body.jobName,
                                jobCode: req.body.jobCode,
                                jobTypeId: req.body.jobType,
                                description: req.body.description,
                                jobPlanner: req.user.uid,
                                jobSupervisor: sup,
                                startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
                                endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
                                createdBy: req.user.uid,
                                createDate: new Date(),
                                noOfVacancy: req.body.noOfVacancy,
                                noOfPhases: req.body.noOfPhases,
                                days_count: req.body.days_count,
                            };
                        } else {
                            var data = {
                                siteId: req.params.id,
                                jobName: req.body.jobName,
                                jobCode: req.body.jobCode,
                                jobTypeId: req.body.jobType,
                                description: req.body.description,
                                jobPlanner: req.user.uid,
                                jobSupervisor: sup,
                                startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
                                endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
                                createdBy: req.user.uid,
                                createDate: new Date(),
                                noOfVacancy: req.body.noOfVacancy,
                                noOfPhases: req.body.noOfPhases,
                                days_count: req.body.days_count,
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
                            /*  sks.forEach(function (a) {
                                db.query('INSERT INTO job_skills(job_id, skill_id)VALUES (?, ?)', [id, a]);
                                db.query('DELETE FROM job_skills WHERE skill_id = 0', function (err) {});
                            }); */
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
                } else {
                    return res.status(403).json(createResponse('FAIL', 69));
                }
            });
        } catch (err) {
            console.error(err.message);
            return res.status(500).json(createResponse('FAIL', 0));
        }
    });

/* Update Planner Jobs with new enhancement */
router.post('/planner-editJobs/:id', auth, [
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
                    if (!(req.body.workingHoursPerDay || req.body.workingDayPerWeek)) {

                        var data = {
                            jobName: req.body.jobName,
                            jobCode: req.body.jobCode,
                            // jobTypeId: req.body.jobType,
                            description: req.body.description,
                            jobPlanner: req.user.uid,
                            startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
                            endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
                            createdBy: req.user.uid,
                            createDate: new Date(),
                            noOfVacancy: req.body.noOfVacancy,
                            noOfPhases: req.body.noOfPhases,
                        };

                    } else {
                        var data = {
                            jobName: req.body.jobName,
                            jobCode: req.body.jobCode,
                            // jobTypeId: req.body.jobType,
                            description: req.body.description,
                            jobPlanner: req.user.uid,
                            startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
                            endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
                            createdBy: req.user.uid,
                            createDate: new Date(),
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

/* GET Free supervisor list for sites */
router.get('/supervisorList', auth, function (req, res) {
    try {

        db.query('SELECT id, CONCAT(`firstName`, " ", `lastName`) AS firstName FROM users where role=3 AND id NOT IN (SELECT user_id FROM user_sites WHERE is_current=1 )', function (err, userSupervisor) {
            if (err)
                console.error(err.message)
            return res.status(200).json({
                list: userSupervisor
            });

        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

router.get('/newSupervisorList', auth, function (req, res) {
    try {
        var mechanical = [],
            electrical = [];
        db.query('SELECT id, CONCAT(`firstName`, " ", `lastName`) AS firstName, jobType, latitude, longitude FROM users where role=3', function (err, userSupervisor) {
            if (err)
                console.error(err.message)
            userSupervisor.forEach(function (a) {
                if (a.jobType == 1) {
                    mechanical.push(a);
                }
                if (a.jobType == 2) {
                    electrical.push(a);
                }
            });
            return res.status(200).json({
                list: userSupervisor,
                mechanical: mechanical,
                electrical: electrical
            });

        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/* POST to mark job finish */
router.post('/plannerJob-finish', auth, function (req, res) {
    try {
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
                    return res.status(200).json(createResponse('Success', 82));
                });
            } else {
                return res.status(500).json(createResponse('FAIL', 76));
            }

        });

    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }
});

/**********************************************************/
router.post('/newPlannerJob-finish', auth, function (req, res) {
    var job_id = req.body.jobId;
    try {

        // db.query('SELECT planner FROM jobsites WHERE id=?', job_id, function (err, jobSites) {
        //     if ((jobSites[0]) && (jobSites[0].planner == req.user.uid)) {
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
                    if (err)
                        console.error(err.message)
                    return res.status(200).json(createResponse('Success', 82));
                });
            } else {
                return res.status(500).json(createResponse('FAIL', 76));
            }

        });
        //     } else {
        //         return res.status(404).json(createResponse('NOT FOUND', 48));
        //     }
        // });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json(createResponse('FAIL', 0));
    }

});
/**********************************************************/

router.get('/plannerView-finishJob', auth, function (req, res, next) {
    try {
        db.query('SELECT js.id, js.siteName, js.sitesCode, j.id As jobid, j.jobCode, j.jobName, j.noOfPhases, j.endDate, j.startDate, j.finishDate, j.noOfVacancy, (SELECT GROUP_CONCAT(id) FROM designation WHERE job_type=j.jobTypeId) AS des_id, (SELECT GROUP_CONCAT(designation_name) FROM designation WHERE job_type=j.jobTypeId) AS des_name, (select count(user_id) from users_job WHERE job_id = j.id and isCurrentJob =1) as empCount FROM jobs AS j LEFT JOIN jobsites AS js ON(js.id=j.siteId) WHERE j.status=3', function (err, list) {

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

/***************************NEW BASED ON WEB*************************/
router.get('/plannerView-NewfinishJob', auth, function (req, res, next) {
    try {
        db.query('SELECT js.id, js.siteName, js.sitesCode, j.id As jobid, j.jobCode, j.jobName, j.noOfPhases, j.endDate, j.startDate, j.finishDate, j.noOfVacancy, (SELECT GROUP_CONCAT(id) FROM designation WHERE job_type=j.jobTypeId) AS des_id, (SELECT GROUP_CONCAT(designation_name) FROM designation WHERE job_type=j.jobTypeId) AS des_name, (select count(user_id) from users_job WHERE job_id = j.id and isCurrentJob =1) as empCount FROM jobs AS j LEFT JOIN jobsites AS js ON(js.id=j.siteId) WHERE j.status=3 AND js.planner=?', req.user.uid, function (err, list) {

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
/****************************************************/


/********************************************************/
router.get('/plannerSubmitted-reports/:id', auth, function (req, res) {
    try {
        let id = req.params.id;
        var a = db.query('SELECT st.*, u.firstName, s.statusName, j.jobName FROM supervisor_taskreporting AS st join users AS u JOIN statusname AS s ON(s.id=st.status) JOIN jobs AS j ON(st.jobId=j.id) where st.plannerId=? AND st.supId = u.id AND active=1 AND st.status=0 AND st.supId=? ORDER BY st.date DESC', [req.user.uid, id], function (err, rows) {
            console.log(a.sql,'aaaaaaa')
            if (err)
                console.error(err.message)
            if (rows.length == 0)
                return res.status(404).json(createResponse('NOT Found', 48));
            res.status(200).json({
                reports: rows
            });
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))

    }
});

router.post('/approveRejectTime', auth, function (req, res) {
    try {
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
            return res.status(200).json(createResponse('Success', 101))
        });

    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))

    }
});

router.post('/supervisorInTime-OutTime', auth, function (req, res) {
    try {

        var supTaskreportingId = req.body.id;
        var supId = req.body.userId;
        var countHourTime = countHours(req.body.inTime, req.body.outTime);

        var data = {
            inTime: req.body.inTime,
            outTime: req.body.outTime,
            hours_count: countHourTime
        };

        db.query('UPDATE supervisor_taskreporting SET ? WHERE id = ?', [data, supTaskreportingId], function (err, rows, fields) {
            if (err)
                console.error(err.message)
            return res.status(200).json(createResponse('Success', 35));
        });
    } catch (err) {
        console.error(err.message)
        return res.status(500).json(createResponse('FAIL', 0))

    }

});
/********************************************************/
module.exports = router;