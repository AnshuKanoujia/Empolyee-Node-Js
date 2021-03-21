var express = require('express');
var router = express.Router();
var db = require('../../config/db');
const config = require('config');
const url = config.get('appUrl');
const bcrypt = require("bcrypt");
var moment = require('moment');
var Cart = require('../../config/cart');
var request = require("request");
var jwt = require('jsonwebtoken');
const {
  check,
  validationResult
} = require('express-validator');
var md5 = require('md5');

function chksession(req, res) {
  if (!req.session.uid || req.session.role != "2") {
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
  hour = hours - (days * 24); */

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
  res.render('admin/project-planner/dashboard', {
    title: 'Project-Planner Dashboard',
    layout: 'layout/admin-layout.jade',
    applications: req.session
  });
});

/* GET planner edit-profile */
router.get('/edit-profile', function (req, res) {
  chksession(req, res);

  // db.query('SELECT GROUP_CONCAT(skill_id) as skills_id, u.profileImg, u.firstName, u.lastName, u.preferredName, u.dob, u.phone_number, u.email, u.experience, u.skills, u.jobType, u.country, u.state, u.city, u.address, u.newAddress, us.user_id, us.skill_id FROM users as u JOIN user_skills as us ON (u.id = us.user_id) WHERE u.id = ?', req.session.uid, function (err, rows) {
  db.query('SELECT GROUP_CONCAT(skill_id) as skills_id, u.profileImg, u.firstName, u.lastName, u.preferredName, u.dob, u.phone_number, u.email, u.experience, u.skills, u.jobType, u.newAddress, us.user_id, us.skill_id FROM users as u JOIN user_skills as us ON (u.id = us.user_id) WHERE u.id = ?', req.session.uid, function (err, rows) {
    db.query('SELECT id, type_name FROM jobtype WHERE active=1', function (err, row) {
      db.query('SELECT id, name FROM countries', function (err, country) {
        db.query('SELECT id, name FROM states where country_id = ?', rows[0].country, function (err, state) {
          db.query('SELECT id, name FROM cities where state_id =?', rows[0].state, function (err, city) {
            db.query('SELECT id, skill_name FROM skills WHERE active=1', function (err, skill) {
              if (err)
                console.error(err.message)
              res.render('admin/project-planner/edit-profile', {
                title: 'Edit Profile',
                layout: 'layout/admin-layout.jade',
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
      res.redirect('/admin/project-planner/edit-profile');
    } else {

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
          newAddress: req.body.newAddress,
          latitude: req.body.latitude,
          longitude: req.body.longitude,
          experience: experience,
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
            newAddress: req.body.newAddress,
            latitude: req.body.latitude,
            longitude: req.body.longitude,
            experience: experience,
            profileImg: fileName,
            completeProfile: 1
          };
          req.session.profileImg = fileName;
          imageFile.mv(`public/${uploadPath}/${fileName}`, function (err) {});
        } else {
          req.flash('msg_error', "This format is not allowed , please upload file with '.png','.gif','.jpg',");
          res.redirect('/admin/project-planner/edit-profile');
          req.end();
        }
      }
      db.query('UPDATE users SET ? WHERE id = ? ', [data, userId], function (err, rows) {
        req.flash('msg_info', "Profile Updated Successfully");
        res.redirect('/admin/project-planner/edit-profile');
      });
    }
  });

/* GET To Add Certification */
router.get('/add-certificate', function (req, res) {
  chksession(req, res);
  res.render('admin/project-planner/add-certificate', {
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
      db.query('INSERT INTO certification SET ?', data, function (err, rows, fields) {

        if (err)
          console.error(err.message)
        req.flash('msg_info', "Certification Added Successfully.");
        res.redirect('/admin/project-planner/view-certificate');
      });
    });
  } else {
    req.flash('msg_error', "This format is not allowed , please upload file with '.png','.gif','.jpg','.pdf'");
    res.redirect('/admin/project-planner/add-certificate');
  }
});

/* GET To View Job Site Wise */
router.get('/view-certificate', function (req, res) {
  chksession(req, res);

  db.query('SELECT id, certification_name, certificate_attachment, authority,exp_date FROM certification where userId=? AND active=1', req.session.uid, function (err, rows) {
    if (err)
      console.error(err.message)
    res.render('admin/project-planner/view-certificate', {
      title: 'Certificate View',
      layout: 'layout/user-layout.jade',
      certificateList: rows,
      applications: req.session
    });
  });
});

/* Get Edit-Roles */
router.get('/edit-certificate/:id', function (req, res) {
  chksession(req, res);
  db.query('SELECT id, certification_name, certificate_attachment, authority,exp_date,description FROM certification WHERE id = ?', req.params.id, function (err, rows) {
    if (err)
      console.error(err.message)
    res.render('admin/project-planner/edit-certificate', {
      title: 'Edit Certificate',
      layout: 'layout/user-layout.jade',
      certificate: rows,
      applications: req.session,
      id: req.params.id
    });
  });
});

/* POST Edit Certificate */
router.post('/edit-certificate/:id', function (req, res) {
  chksession(req, res);
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
      res.redirect('/admin/project-planner/edit-certificate/' + req.params.id);
      req.end();
    }
  }
  db.query('UPDATE certification SET ? WHERE id = ? ', [data, req.params.id], function (err, rows, fields) {
    if (err) {
      console.error(err.message)
      req.flash('msg_error', "Some error occured!");
      res.redirect('/admin/project-planner/add-certificate');
    } else {
      req.flash('msg_info', "Certificate Updated Successfully");
      res.redirect('/admin/project-planner/view-certificate');
    }
  });
});

/* Delete Certificate */
router.get('/deleteCertificate/:id', function (req, res) {
  chksession(req, res);
  db.query('UPDATE certification SET active=0 WHERE id=?', req.params.id, function (err) {
    if (err)
      console.error(err.message)
    req.flash('msg_error', "Certificate Deleted Successfully");
    res.redirect('/admin/project-planner/view-certificate');
  });
});

/* GET Create-sites */
router.get('/create-sites', function (req, res) {
  chksession(req, res);
  // var mechanical = [],
  //   elctrical = [];
  db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, id FROM users WHERE role=3', function (err, supervisor) {
    db.query('SELECT id, firstName FROM users where role=2', function (err, userPlanner) {
      db.query('SELECT id, CONCAT(`firstName`, " ", `lastName`) AS firstName, jobType, latitude, longitude FROM users where role=3', function (err, userSupervisor) {
        if (err)
          console.error(err.message)
        // userSupervisor.forEach(function (a) {
        //   if (a.jobType == 1) {
        //     mechanical.push(a);
        //   }
        //   if (a.jobType == 2) {
        //     elctrical.push(a);
        //   }
        // });
        res.render('admin/project-planner/create-sites', {
          title: 'Project-Planner Dashboard',
          layout: 'layout/admin-layout.jade',
          supervisor: supervisor,
          planner: userPlanner,
          supervisor: userSupervisor,
		  url: url,
		  apiKey: config.get('apiKey'),
          applications: req.session
        });
      });
    });
  });
});

/* Add create-sites */
router.post('/create-sites', [
    check('siteName').not().isEmpty().withMessage('Please Enter Site Name'),
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
      res.redirect('/admin/project-planner/create-sites');
    } else {
      // db.query('INSERT INTO jobsites (siteName, description, city, state, supervisors, planner, sitesCode, createdBy, createDate, newAddress, latitude, longitude) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT siteName FROM jobsites where siteName=?)', [req.body.siteName, req.body.description, req.body.city, req.body.state, req.body.jobSupervisor, req.session.uid, req.body.sitesCode, req.session.uid, moment(new Date()).format('YYYY-MM-DD'), req.body.newAddress, req.body.latitude, req.body.longitude, req.body.siteName], function (err, rows, fields) {

      // db.query('INSERT INTO jobsites (siteName, description, supervisors, planner, sitesCode, createdBy, createDate, newAddress, latitude, longitude) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT siteName FROM jobsites where siteName=?)', [req.body.siteName, req.body.description, req.body.jobSupervisor, req.session.uid, req.body.sitesCode, req.session.uid, moment(new Date()).format('YYYY-MM-DD'), req.body.newAddress, req.body.latitude, req.body.longitude, req.body.siteName], function (err, rows, fields) {

      var q = db.query('INSERT INTO jobsites (siteName, description, supervisors, supervisorTwo, planner, createdBy, createDate, newAddress, latitude, longitude) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?', [req.body.siteName, req.body.description, req.body.mSupervisor, req.body.eSupervisor, req.session.uid, req.session.uid, moment(new Date()).format('YYYY-MM-DD'), req.body.newAddress, req.body.latitude, req.body.longitude], function (err, rows, fields) {
        // db.query('INSERT INTO jobsites (siteName, description, supervisors, planner, sitesCode, createdBy, createDate, newAddress, latitude, longitude) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?', [req.body.siteName, req.body.description, req.body.jobSupervisor, req.session.uid, req.body.sitesCode, req.session.uid, moment(new Date()).format('YYYY-MM-DD'), req.body.newAddress, req.body.latitude, req.body.longitude], function (err, rows, fields) {
        if (err)
          console.error(err.message)
        var id = q._results[0]['insertId'];
        let w = id.toString(16);
        w = w.toUpperCase();
        var sitesCodeCpy = 'SITES_' + w;

        db.query('INSERT INTO user_sites (site_id, user_id, user_role, jobType) VALUES (?, ?, 3, 1),(?, ?, 3, 2)', [id, req.body.mSupervisor, id, req.body.eSupervisor], function (err) {

          if (err)
            console.error(err.message)
        });
        db.query('DELETE FROM `user_sites` WHERE user_id=0');
        db.query('UPDATE jobsites SET sitesCodeCpy= ? WHERE id =?', [sitesCodeCpy, id], function (err) {
          req.flash('msg_info', "New Location Successfully Created");
          res.redirect('/admin/project-planner/manage-sites');

          /* if (id == 0) {

            req.flash('msg_error', "Site Name Already Exist , Please Try New One");
            res.redirect('/admin/project-planner/create-sites');
          } else {
            if (err)
              console.error(err.message)
            req.flash('msg_info', "New Site Successfully Created");
            res.redirect('/admin/project-planner/manage-sites');
          } */
        });
      });
    }

  });

/* GET Manage-sites */
router.get('/manage-sites', function (req, res) {
  chksession(req, res);
  db.query('SELECT id, siteName, sitesCode, description, newAddress, createDate FROM jobsites WHERE planner=?', req.session.uid, function (err, rows) {

    db.query('SELECT id, CONCAT(`firstName`, " ", `lastName`) AS firstName, jobType FROM users where role=3', function (err, userSupervisor) {
      if (err)
        console.error(err.message)
      res.render('admin/project-planner/manage-sites', {
        title: 'Project-Planner Dashboard',
        layout: 'layout/admin-layout.jade',
        siteLists: rows,
        supervisor: userSupervisor,
        applications: req.session
      });
    });
  });
});

/* GET View Manage-site */
router.get('/view-sites/:id', function (req, res) {
  var id = req.params.id;
  chksession(req, res);
  db.query('SELECT planner FROM jobsites WHERE id=?', id, function (err, jobSites) {
    if ((jobSites[0]) && (jobSites[0].planner == req.session.uid)) {

      // db.query('SELECT jobsites.id, jobsites.siteName, jobsites.sitesCode, jobsites.description, jobsites.newAddress, jobsites.createDate, jobsites.description, jobsites.supervisors, CONCAT(`firstName`, " ", `lastName`) AS name FROM `jobsites` LEFT JOIN users ON (jobsites.supervisors = users.id) WHERE jobsites.id=?', id, function (err, rows) {
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
          res.render('admin/project-planner/view-sites', {
            title: 'Supervisor View Profile',
            layout: 'layout/admin-layout.jade',
            siteLists: rows,
            jobList: list,
            applications: req.session
          });
        });
      });
    } else {
      res.render('404', {
        title: 'Not Found',
      });
    }
  });
});

/* GET edit-sites */
router.get('/edit-sites/:id', function (req, res) {
  chksession(req, res);
  var id = req.params.id;
  db.query('SELECT js.id AS jobsitesId, js.sitesCode, js.siteName, js.supervisors, js.description, js.newAddress FROM jobsites AS js WHERE js.id = ?', id, function (err, site) {
    // db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, id FROM users WHERE role=3', function (err, supervisor) {
    if (err)
      console.error(err.message)
    res.render('admin/project-planner/edit-sites', {
      title: 'Project-Planner Dashboard',
      layout: 'layout/admin-layout.jade',
      siteDetails: site[0],
      // supervisor: supervisor,

	  url: url,
	  apiKey: config.get('apiKey'),
      applications: req.session

    });

    // });

  });
});

/* POST edit-sites */
router.post('/edit-sites', [
    check('siteName').not().isEmpty().withMessage('Please Enter Site Name'),
  ],
  function (req, res) {
    var id = req.body.id;

    chksession(req, res);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const validationErrors = errors.array();
      let errorMessages = [];
      validationErrors.forEach(function (row) {
        errorMessages.push(row.msg);
      })
      req.flash('msg_error', errorMessages);
      res.redirect('/admin/project-planner/edit-sites/' + id);
    } else {
      var data = {
        siteName: req.body.siteName,
        sitesCode: req.body.sitesCode,
        newAddress: req.body.newAddress,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        description: req.body.description,

      };
      db.query('UPDATE jobsites SET ? WHERE id=?', [data, id], function (err) {
        if (err)
          console.error(err.message)

        req.flash('msg_info', "Location Successfully Updated");
        res.redirect('/admin/project-planner/manage-sites');
      });
    }

  });

/* GET To View Job Site Wise */
/* router.get('/view-jobSites/:id', function (req, res) {
  chksession(req, res);
  db.query('SELECT us.userId, us.date, us.jobId, j.jobCode, j.jobName, j.siteId, s.shift FROM userapplications AS us JOIN jobs AS j ON (us.jobId = j.id) JOIN shifts AS s ON (us.preferredShift = s.id) WHERE j.siteId=?AND us.active=1', req.params.id, function (err, rows) {
    if (err)
      console.error(err.message)
    res.render('admin/project-planner/view-jobSites', {
      title: 'Supervisor View Profile',
      layout: 'layout/admin-layout.jade',
      siteLists: rows,
      applications: req.session
    });
  });
}); */

/* GET ALL JOBS ON VIEW SITES PAGE*/
router.get('/view-jobs/:id', function (req, res) {
  var id = req.params.id;
  chksession(req, res);

  db.query('SELECT planner FROM jobsites WHERE id=?', id, function (err, jobSites) {
    if ((jobSites[0]) && (jobSites[0].planner == req.session.uid)) {

      db.query('SELECT js.id as jobSiteId, js.siteName, js.sitesCode, j.id AS jobId, j.jobCode, j.jobName, j.noOfVacancy, j.noOfPhases, j.startDate, j.endDate, j.createdBy, j.days_count, j.predicated_budget, (SELECT GROUP_CONCAT(id) FROM designation WHERE job_type=j.jobTypeId) AS des_id, (SELECT GROUP_CONCAT(designation_name) FROM designation WHERE job_type=j.jobTypeId) AS des_name, (SELECT COUNT(user_id) FROM `users_job` WHERE job_id=jobId AND isCurrentJob=1) AS emp_count FROM jobs AS j LEFT JOIN jobsites AS js ON(js.id=j.siteId) WHERE js.id=? AND j.status=1', id, function (err, list) {

        var suid = req.session.uid;
        req.session.cart = '';
        res.render('admin/project-planner/view-jobs', {
          title: 'Supervisor View Profile',
          layout: 'layout/admin-layout.jade',
          jobList: list,
          suid: suid,
          applications: req.session
        });
      });
    } else {
      res.render('404', {
        title: 'Not Found',
      });
    }
  })

});

/* GET Planner edit-job */
router.get('/edit-jobs/:id', function (req, res) {
  chksession(req, res);
  db.query('SELECT GROUP_CONCAT(skill_id) as skills_id, j.id, j.jobName, j.jobCode, j.jobTypeId,j.startDate AS proposedStartDate, j.endDate AS proposedEndDate, j.jobSupervisor, j.description, j.noOfVacancy, j.noOfPhases, j.workingHoursPerDay, j.workingDayPerWeek, j.days_count, j.proposed_budget, js.job_id, GROUP_CONCAT(s.skill_name) as skills_name, jt.type_name FROM jobs as j JOIN job_skills as js ON (j.id = js.job_id) JOIN jobtype AS jt ON (j.jobTypeId = jt.id) JOIN skills AS s ON (js.skill_id = s.id) WHERE j.id = ? AND jt.active=1 AND  s.active=1', req.params.id, function (err, rows) {
    // db.query('SELECT id, type_name FROM jobtype WHERE active=1', function (err, row) {
    db.query('SELECT id, skill_name FROM skills WHERE active=1', function (err, skill) {
      db.query('SELECT id, jobId, phaseName, phaseDescription, startDate, endDate FROM jobphases WHERE jobId=?', req.params.id, function (err, phases) {
        if (err)
          console.error(err.message)
        res.render('admin/project-planner/edit-jobs', {
          title: 'Edit Jobs',
          layout: 'layout/admin-layout.jade',
          jobDetails: rows[0],
          skill: skill,
          // jobtype: row,
          jobPhases: phases,
          url: url,
          applications: req.session
        });

      });
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
  async function (req, res) {
    chksession(req, res);

    var id = req.body.id;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const validationErrors = errors.array();
      let errorMessages = [];
      validationErrors.forEach(function (row) {
        errorMessages.push(row.msg);
      })
      req.flash('msg_error', errorMessages);
      res.redirect('/admin/project-planner/edit-jobs/' + id);
    } else {
      // var sk = req.body.skills;
      // if (!sk)
      //   sk = 0;
      // if (typeof sk != "object")
      //   sk = [sk];
      let sup;
      // var a = await db.query('SELECT supervisors FROM jobsites WHERE id=?', req.body.jobSupervisor, function (err, supervisors) {

      // sup = req.body.jobSupervisor;

      var hours = req.body.workingHoursPerDay;
      days = req.body.workingDayPerWeek;
      var Difference_In_Hours = hours * days;

      if (!(req.body.workingHoursPerDay || req.body.workingDayPerWeek)) {
        var data = {
          // siteId: req.session.siteId,
          jobName: req.body.jobName,
          jobCode: req.body.jobCode,
          // jobTypeId: req.body.jobType,
          description: req.body.description,
          jobPlanner: req.session.uid,
          // jobSupervisor: sup,
          startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
          endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
          createdBy: req.session.uid,
          createDate: new Date(),
          experience: req.body.year + '.' + req.body.month,
          // noOfVacancy: req.body.noOfVacancy,
          noOfPhases: req.body.noOfPhases,
          days_count: req.body.days_count,
          proposed_budget: req.body.proposed_budget,
          // Difference_In_Hours: Difference_In_Hours,
        };
      } else {
        var data = {
          // siteId: req.session.siteId,
          jobName: req.body.jobName,
          jobCode: req.body.jobCode,
          // jobTypeId: req.body.jobType,
          description: req.body.description,
          jobPlanner: req.session.uid,
          // jobSupervisor: sup,
          startDate: moment(req.body.proposedStartDate).format('YYYY-MM-DD'),
          endDate: moment(req.body.proposedEndDate).format('YYYY-MM-DD'),
          createdBy: req.session.uid,
          createDate: new Date(),
          experience: req.body.year + '.' + req.body.month,
          noOfVacancy: req.body.noOfVacancy,
          noOfPhases: req.body.noOfPhases,
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
        // sk.forEach(function (a) {

        //   db.query('INSERT INTO job_skills (job_id, skill_id)VALUES (?, ?)', [id, a], function (err) {});
        // });
        // db.query('DELETE FROM jobphases WHERE jobId = ?', id, function (err) {
        //   if (err) {
        //     req.flash('msg_error', "Some Error Occured, Please Try Again!");
        //     res.redirect('/admin/project-planner/edit-jobs/' + id);

        //   } else {

        // if (req.body.noOfPhases > 1) {

        //   for (i = 0; i < req.body.noOfPhases; i++) {
        //     db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT  ?, ?, ?, ?, ?', [id, req.body.phaseName[i], moment(req.body.startDate[i]).format('YYYY-MM-DD'), moment(req.body.endDate[i]).format('YYYY-MM-DD'), req.body.phaseDescription[i]], function (err) {
        //       if (err)
        //         console.error(err.message)
        //     });
        //   }
        // } else {
        //   var jobId = id;
        //   var phaseName = req.body.jobName + '_Phase1';
        //   var startDate = new Date();
        //   var endDate = req.body.projectEndDate;
        //   var phaseDescription = req.body.description;
        //   db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT ?, ?, ?, ?, ?', [jobId, phaseName, moment(req.body.startDate).format('YYYY-MM-DD'), moment(req.body.endDate).format('YYYY-MM-DD'), phaseDescription], function (err) {
        //     if (err)
        //       console.error(err.message)
        //   });
        // }
        req.flash('msg_info', "Project Updated Successfully");
        req.session.cart = '';
        res.redirect('/admin/project-planner/view-jobs');
        // }
        // });
      });
      // });
    }
  });

/* GET to mark job finish */
router.get('/job-finish/:id', function (req, res) {
  chksession(req, res);

  var jobId = req.params.id;
  db.query('SELECT planner FROM jobsites WHERE id=?', jobId, function (err, jobSites) {
    if ((jobSites[0]) && (jobSites[0].planner == req.session.uid)) {
      db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, uj.user_id, uj.sup_id, uj.siteId FROM users_job AS uj JOIN users AS u ON (uj.user_id = u.id) WHERE job_id=?', jobId, function (err, users) {
        if (err)
          console.error(err.message)
        res.render('admin/project-planner/job-finish', {
          title: 'Job Finish',
          layout: 'layout/admin-layout.jade',
          userDetail: users,
          jobId: jobId,
          url: url,
          applications: req.session
        });

      });
    } else {
      res.render('404', {
        title: 'Not Found',
      });
    }
  });
});

/* POST to mark job finish */
router.post('/job-finish', function (req, res) {
  chksession(req, res);
  var job_id = req.body.jobId;
  db.query('SELECT planner FROM jobsites WHERE id=?', job_id, function (err, jobSites) {
    if ((jobSites[0]) && (jobSites[0].planner == req.session.uid)) {
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
            req.flash('msg_info', "Job Marked as Finished Successfully.");
            req.session.cart = '';
            res.redirect('/admin/project-planner/view-jobs');
          });
        } else {
          req.flash('msg_error', "You Are Not Authorized To Finish The Job Yet !");
          res.redirect('/admin/project-planner/job-finish/' + job_id);
        }

      });
    } else {
      res.render('404', {
        title: 'Not Found',
      });
    }
  });

});

/* GET Single Job */
router.get('/viewSingelJobs/:id', function (req, res) {
  chksession(req, res);

  var id = req.params.id;
  // db.query('SELECT jobs.jobName, jobs.siteId, jobs.createDate AS startDate, jobs.noOfPhases, jobs.jobCode, jobs.description, jobs.experience, jobsites.siteName, jobsites.sitesCode, countries.name AS country, cities.name AS city, states.name AS state, (SELECT firstName from users WHERE id=jobs.jobSupervisor) AS SupervisorName, (SELECT statusName from statusname WHERE id=jobs.status) AS jobStatus FROM `jobs` LEFT JOIN jobsites ON (jobsites.id = jobs.siteId) LEFT JOIN countries ON (jobsites.country = countries.id) LEFT JOIN cities ON (jobsites.`city` = cities.id) LEFT JOIN states ON (jobsites.state = states.id) WHERE jobs.id=?', req.params.id, function (err, rows) {
  // db.query(`SELECT jobs.jobName, jobs.siteId, jobs.startDate, jobs.endDate, jobs.noOfPhases, jobs.jobCode, jobs.description, jobs.experience, jobs.days_count, jobsites.siteName, jobsites.sitesCode, jobsites.newAddress, jobtype.type_name, (SELECT CONCAT(firstName,' ',lastName) AS name from users WHERE id=jobsites.supervisors) AS SupervisorName, (SELECT statusName from statusname WHERE id=jobs.status) AS jobStatus FROM jobs LEFT JOIN jobsites ON (jobsites.id = jobs.siteId) LEFT JOIN jobtype ON (jobs.jobTypeId = jobtype.id) WHERE jobs.id=?`, req.params.id, function (err, rows) {
  db.query(`SELECT jobs.jobName, jobs.siteId, jobs.startDate, jobs.endDate, jobs.noOfPhases, jobs.jobCode, jobs.description, jobs.experience, jobs.days_count, jobsites.siteName, jobsites.sitesCode, jobsites.newAddress, jobtype.type_name, (SELECT CONCAT(firstName, " ", lastName) from users WHERE jobs.jobPlanner=users.id) AS plannerName, (SELECT CONCAT(firstName, " ", lastName) from users JOIN user_sites ON (users.id = user_sites.user_id) WHERE user_sites.user_role=3 AND user_sites.is_current=1 AND user_sites.jobType=jobtype.id AND user_sites.site_id=jobsites.id) AS SupervisorName, (SELECT statusName from statusname WHERE id=jobs.status) AS jobStatus FROM jobs LEFT JOIN jobsites ON (jobsites.id = jobs.siteId) LEFT JOIN jobtype ON (jobs.jobTypeId = jobtype.id) LEFT JOIN users_job ON (jobsites.id=users_job.siteId) WHERE jobs.id=?`, id, function (err, rows) {
    if (err)
      console.error(err.message)


    res.render('admin/project-planner/viewSingelJobs', {
      title: 'Job Description',
      layout: 'layout/admin-layout.jade',
      viewReportList: rows[0],
      id: id,
      applications: req.session
    });
  });

});

/* GET Create-jobs page */
router.get('/create-jobs/:id', function (req, res) {
  var id = req.params.id;
  chksession(req, res);
  db.query('SELECT planner FROM jobsites WHERE id=?', id, function (err, jobSites) {
    if ((jobSites[0]) && (jobSites[0].planner == req.session.uid)) {
      db.query('SELECT id,type_name FROM jobtype WHERE active=1', function (err, rows) {
        db.query('SELECT skill_name FROM skills WHERE active=1', function (err, row) {
          // db.query('SELECT id, firstName FROM users where role=3', function (err, userSupervisor) {
          if (err)
            console.error(err.message)
          res.render('admin/project-planner/create-jobs', {
            title: 'Create / Select Jobs',
            layout: 'layout/admin-layout.jade',
            jobType: rows,
            // supervisor: userSupervisor,
            id: id,
            url: url,
            applications: req.session
          });
          // });
        });
      });
    } else {
      res.render('404', {
        title: 'Not Found',
      });
    }
  });
});

/* Add Create-job */
router.post('/create-jobs/:id', [
    check('description').isLength({
      min: 5
    }).withMessage('Description Must be at least 5 chars long'),
    check('noOfVacancy').isNumeric(),
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
      res.redirect('/admin/project-planner/create-jobs/' + id);
    } else {

      /* var sk = req.body.skills;
      if (!sk)
        sk = 0;
      if (typeof sk != "object")
        sk = [sk]; */
      let sup;
      var a = await db.query('SELECT user_id AS supervisors FROM user_sites WHERE user_role=3 AND site_id=? AND is_current=1 AND jobType=?', [id, req.body.jobType], function (err, supervisors) {
        if (!supervisors[0]) {
          req.flash('msg_error', "There is no supervisor assigned for the selected trade,Proceed with the different trade or assign a suppervisor.");
          res.redirect('/admin/project-planner/create-jobs/' + id);


        } else {

          // var a = await db.query('SELECT supervisors FROM jobsites WHERE id=?', req.params.id, function (err, supervisors) {
          sup = supervisors[0].supervisors;
          db.query('SELECT planner FROM jobsites WHERE id=?', id, function (err, jobSites) {
            if ((jobSites[0]) && (jobSites[0].planner == req.session.uid)) {
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
                  jobTypeId: req.body.jobType,
                  description: req.body.description,
                  jobPlanner: req.session.uid,
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
                console.log(q.sql, 'qqqqqqqqqqq')
                if (err)
                  console.error(err.message)
                var id = q._results[0]['insertId'];
                let w = id.toString(16);
                w = w.toUpperCase();
                var userCode = 'JOB_' + w;
                /* sk.forEach(function (a) {
      
                  db.query('INSERT INTO job_skills (job_id, skill_id)VALUES (?, ?)', [id, a]);
                  db.query('DELETE FROM job_skills WHERE skill_id = 0', function (err) {});
                }); */
                db.query('UPDATE jobs SET jobCodeCpy= ? WHERE id =?', [userCode, id], function (err) {
                  if (err) {

                    db.query('DELETE FROM jobs where id= ?', id)
                    req.flash('msg_error', "Some Error Occured, Please Try Again!");
                    res.redirect('/admin/project-planner/create-jobs/' + id);

                  } else {

                    // if (req.body.noOfPhases > 1) {

                    //   for (i = 0; i < req.body.noOfPhases; i++) {
                    //     db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT  ?, ?, ?, ?, ?', [id, req.body.phaseName[i], moment(req.body.startDate[i]).format('YYYY-MM-DD'), moment(req.body.endDate[i]).format('YYYY-MM-DD'), req.body.phaseDescription[i]], function (err) {
                    //       if (err)
                    //         console.error(err.message)
                    //     });
                    //   }
                    // } else {
                    //   var jobId = id;
                    //   var phaseName = req.body.jobName + '_Phase1';
                    //   var startDate = new Date();
                    //   var endDate = req.body.projectEndDate;
                    //   var phaseDescription = req.body.description;
                    //   db.query('INSERT INTO jobphases (jobId, phaseName, startDate, endDate, phaseDescription)SELECT ?, ?, ?, ?, ?', [jobId, phaseName, moment(req.body.startDate).format('YYYY-MM-DD'), moment(req.body.endDate).format('YYYY-MM-DD'), phaseDescription], function (err) {
                    //     if (err)
                    //       console.error(err.message)
                    //   });
                    // }
                    req.flash('msg_info', "Project Created Successfully");
                    req.session.cart = '';
                    res.redirect('/admin/project-planner/view-jobs/' + req.params.id);
                  }
                });
              });
            } else {
              res.render('404', {
                title: 'Not Found',
              });
            }
          });
        }
      });
    }
  });

/* POST for update supervisor for site*/
router.post('/updateSupervisor', function (req, res) {
  chksession(req, res);
  var siteId = req.body.applyJob;
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
                    console.error(err.message)
                  req.flash('msg_info', "Supervisor Updated Successfully");
                  res.redirect('/admin/project-planner/manage-sites');
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
            console.error(err.message)
          req.flash('msg_info', "Supervisor Updated Successfully");
          res.redirect('/admin/project-planner/manage-sites');
        });
      });
    }
  });
});

/* GET Supervisor view */
router.get('/view-supervisor', function (req, res) {
  chksession(req, res);
  // db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, u.dob, u.email, u.jobtype, u.skills, u.experience, jt.type_name, (SELECT siteName FROM jobsites WHERE id=(SELECT site_id FROM user_sites WHERE user_id=u.id AND is_current =1)) as siteName FROM users AS u LEFT JOIN jobtype AS jt ON(u.jobType=jt.id)  where role=3', function (err, rows) {


  // db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, u.dob, u.email, u.jobtype, u.skills, u.experience, jt.type_name, (SELECT siteName FROM jobsites WHERE id=(SELECT site_id FROM user_sites WHERE user_id=u.id AND is_current =1)) as siteName, (SELECT count(id) FROM supervisor_taskreporting WHERE status=0 AND supId=u.id) as pending_reports FROM users AS u LEFT JOIN jobtype AS jt ON(u.jobType=jt.id)  where role=3 AND u.id in (Select user_id from user_sites where user_role=3 AND is_current =1 AND site_id IN (select id from jobsites where planner =?))', req.session.uid, function (err, rows) {

  db.query(`SELECT CONCAT(firstName, " ", lastName) AS name, u.id, u.eCode, u.dob, u.email, u.jobtype, u.skills, u.experience, jt.type_name, 'testing' as siteName, (SELECT count(id) FROM supervisor_taskreporting WHERE status=0 AND supId=u.id AND plannerID=?) as pending_reports FROM users AS u LEFT JOIN jobtype AS jt ON(u.jobType=jt.id)  where role=3 AND u.id in (Select user_id from user_sites where user_role=3 AND is_current =1 AND site_id IN (select id from jobsites where planner =?))`, [req.session.uid, req.session.uid], function (err, rows) {
    if (err)
      console.error(err.message)
    res.render('admin/project-planner/view-supervisor', {
      title: 'Edit Profile',
      layout: 'layout/admin-layout.jade',
      users: rows,
      applications: req.session
    });
  });
});

/* GET Supervisor view Profile */
router.get('/view-supervisorProfile/:id', function (req, res) {
  chksession(req, res);
  var id = req.params.id;
  // db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, u.dob, u.email, u.experience, jt.type_name, s.skill_name FROM users AS u LEFT JOIN jobtype AS jt ON(u.jobType=jt.id) LEFT JOIN skills AS s ON(u.skills=s.id) where u.id=?', id, function (err, rows) {
  db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, u.id, u.eCode, u.dob, u.email, u.experience, u.newAddress, jt.type_name, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) AS skills FROM users AS u LEFT JOIN jobtype AS jt ON(u.jobType=jt.id) LEFT JOIN skills AS s ON(u.skills=s.id) where u.id=?', id, function (err, rows) {
    if (err)
      console.error(err.message)
    res.render('admin/project-planner/view-supervisorProfile', {
      title: 'View Supervisor Profile',
      layout: 'layout/admin-layout.jade',
      users: rows,
      applications: req.session
    });

  });
});

/* GET to view finised Job list */
router.get('/view-finishJob', function (req, res, next) {
  chksession(req, res);
  db.query('SELECT js.id as jobSiteId, js.siteName, js.sitesCode, j.id AS jobId, j.jobCode, j.jobName, j.noOfVacancy, j.noOfPhases, j.startDate, j.endDate, j.finishDate, (SELECT GROUP_CONCAT(id) FROM designation WHERE job_type=j.jobTypeId) AS des_id, (SELECT GROUP_CONCAT(designation_name) FROM designation WHERE job_type=j.jobTypeId) AS des_name, (SELECT COUNT(user_id) FROM `users_job` WHERE job_id=jobId AND isCurrentJob=1) AS emp_count FROM jobs AS j LEFT JOIN jobsites AS js ON(js.id=j.siteId) WHERE j.status=3 AND js.planner=?', req.session.uid, function (err, list) {
    res.render('admin/project-planner/view-finishJob', {
      title: 'Supervisor View Profile',
      layout: 'layout/admin-layout.jade',
      jobList: list,
      applications: req.session
    });
  });
});

/* Get technician submitted reports */
router.get('/submitted-reports/:id', function (req, res) {
  chksession(req, res);
  let id = req.params.id;
  db.query('SELECT st.*, u.firstName, s.statusName, j.jobName FROM supervisor_taskreporting AS st join users AS u JOIN statusname AS s ON(s.id=st.status) JOIN jobs AS j ON(st.jobId=j.id) where st.plannerId=? AND st.supId = u.id AND active=1 AND st.status=0 AND st.supId=? ORDER BY st.date DESC', [req.session.uid, id], function (err, rows) {
    if (err)
      console.error(err.message)
    res.render('admin/project-planner/report-view', {
      title: 'Supervisor Report View',
      layout: 'layout/admin-layout.jade',
      reports: rows,
      applications: req.session,
      id: id
    });
  });
});

/* GET to edit intime & outtime on taskreporting table*/
router.post('/editSupInTimeOutTime', function (req, res) {
  chksession(req, res);
  var supTaskreportingId = req.body.id;
  var supId = req.body.userId;
  var countHourTime = countHours(req.body.inTime, req.body.outTime);
  /* var checkCountHourTime = checkCountHours(req.body.inTime, req.body.outTime);
  if (checkCountHourTime == 0) {
    req.flash('msg_error', "Please Enter Valid Time.");
    res.redirect('/admin/project-planner/submitted-reports/' + supId);
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
    res.redirect('/admin/project-planner/submitted-reports/' + supId);
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
    res.redirect('/admin/project-planner/submitted-reports/' + supId);
  });
});

/* GET ALL JOBS */
router.get('/view-jobs', function (req, res) {
  chksession(req, res);

  // db.query('SELECT js.id as jobSiteId, js.siteName, js.sitesCode, j.id AS jobId, j.jobCode, j.jobName, j.noOfVacancy, j.noOfPhases, j.endDate, (SELECT COUNT(user_id) FROM `users_job` WHERE job_id=jobId AND isCurrentJob=1) AS emp_count FROM jobs AS j LEFT JOIN jobsites AS js ON(js.id=j.siteId)', function (err, list) {
  db.query('SELECT js.id as jobSiteId, js.siteName, js.sitesCode, j.id AS jobId, j.jobCode, j.jobName, j.noOfVacancy, j.noOfPhases, j.startDate, j.endDate, j.predicated_budget, j.createdBy, j.days_count, (SELECT GROUP_CONCAT(id) FROM designation WHERE job_type=j.jobTypeId) AS des_id, (SELECT GROUP_CONCAT(designation_name) FROM designation WHERE job_type=j.jobTypeId) AS des_name, (SELECT COUNT(user_id) FROM `users_job` WHERE job_id=jobId AND isCurrentJob=1) AS emp_count FROM jobs AS j LEFT JOIN jobsites AS js ON(js.id=j.siteId) WHERE j.status=1 AND js.planner=?', req.session.uid, function (err, list) {
    var suid = req.session.uid;
    req.session.cart = '';
    res.render('admin/project-planner/view-jobs', {
      title: 'Supervisor View Profile',
      layout: 'layout/admin-layout.jade',
      jobList: list,
      suid: suid,
      applications: req.session
    });
  });
});


/* POST to add user designation */
router.post('/add-userDesignation', function (req, res) {
  chksession(req, res);
  var jobId = req.body.jobid;
  req.session.designation_name = req.body.designation_name;
  res.redirect('/admin/project-planner/viewUsers/' + jobId);
});

/* GET to add cart */
// router.get('/add/:id', function (req, res) {
router.get('/add', function (req, res) {
  chksession(req, res);
  // var id = req.params.id;
  var id = req.query.id;
  var distance = req.query.siteDistance;
  var rates = req.query.rates;
  var jobId = req.session.jobId;
  var cart = new Cart(req.session.cart ? req.session.cart : {});

  db.query('SELECT id, firstName, experience, skills, profileImg from users where id=?', id, function (err, users) {
    var data = {
      id: users[0].id,
      firstName: users[0].firstName,
      experience: users[0].experience,
      skills: users[0].skills,
      profileImg: users[0].profileImg,
    };
    cart.add(data, id, distance, rates);
    req.session.cart = cart;
    res.redirect('/admin/project-planner/viewUsers/' + jobId);

  });
});

/* POST to delete cart */
router.get('/remove/:id', function (req, res) {
  chksession(req, res);
  var id = req.params.id;
  var cart = new Cart(req.session.cart ? req.session.cart : {});
  cart.remove(id);
  req.session.cart = cart;
  res.redirect('/admin/project-planner/userCart');
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

  // _skFilter = '';
  // if (sk) {
  //   if (typeof sk == 'object') {
  //     _skFilter = ` AND u.id IN (SELECT user_id from user_designation WHERE designation_id IN (`
  //     sk.forEach(function (a) {
  //       _skFilter += a + ','
  //     })
  //     _skFilter += `0 ) )`
  //   } else {
  //     _skFilter = ` AND u.id IN (SELECT user_id from user_designation WHERE designation_id IN (${sk}) )`
  //   }
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

  db.query('SELECT jobTypeId, latitude as site_latitude, longitude as site_longitude FROM jobs AS j JOIN jobsites AS js ON (js.id = j.siteId) where j.id=?', jobId, function (err, rows) {
    var jobtype = rows[0].jobTypeId;

    /* db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg, ci.name as city , s.name as state, C.name as country, count(user_id) as rank, (select GROUP_CONCAT(skill_name) from skills s join user_skills us2 on us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) as skills FROM user_skills us JOIN job_skills js on us.skill_id = js.skill_id JOIN users u on u.id = us.user_id LEFT JOIN cities ci ON (u.city = ci.id) LEFT JOIN states s ON (u.state = s.id) LEFT JOIN countries C ON (u.country = C.id) WHERE js.job_id = ? ${_skFilter}  ${_skcartUserFilter} AND firstName LIKE '%${req.params.search ? req.params.search : '%'}%' AND u.role=1 AND u.id IN (SELECT user_id FROM user_designation WHERE designation_id = ?)  AND u.id NOT IN (select user_id from users_job where job_id=? ) AND u.id NOT IN (select userId from joboffers where jobId=? ) AND u.search=1 GROUP BY us.user_id order by rank desc`, [jobId, req.session.designation_name, jobId, jobId], function (err, users) { */
    db.query('SELECT id AS designationId, designation_name FROM designation WHERE job_type=?', jobtype, function (err, designation) {
      var a = db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg, u.newAddress, u.latitude, u.longitude, count(u.id) as rank, u.ratings, (SELECT CONCAT(hourly_rate,'/',max_pertime_rate) FROM user_rates AS ur WHERE ur.userId =u.id GROUP by ur.userId) AS rates, (SELECT jobsites.latitude FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_lat,(SELECT jobsites.longitude as jobsite_long FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_long FROM users u JOIN user_rates AS ur ON (u.id = ur.userId) WHERE firstName LIKE '%${req.params.search ? req.params.search : '%'}%' ${_designationFilter} ${_skcartUserFilter} AND u.jobType=(SELECT jobTypeId FROM jobs WHERE id ='${jobId}') AND u.role=1 AND u.latitude IS NOT NULL AND u.latitude != '' AND u.id NOT IN (select user_id from users_job where job_id=? ) AND u.id NOT IN (select userId from joboffers where jobId=? ) AND u.search=1 GROUP BY u.id order by rank desc`, [jobId, jobId], function (err, users) {
        console.log(a.sql,'qqqq')
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
        console.log(parameters,'parameters',parameters1,'parameters1parameters1')
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
        console.log(options,'options',options1,'options1options1')
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
                var s = 0;
                d = distDiffer.push(s);
              }

            });
          });
          console.log(distDiffer,'diff')
          /* for (i = 0; i < d; i++) {
            users[i].distance = distDiffer[i] / 1000;
          } */
          var arrDistance = [];
          var aa = [];
          console.log(d,'dddddddddddd')
          for (i = 0; i < d; i++) {
            arrDistance[i] = distDiffer[i];
            console.log(arrDistance[i],'arrDistance[i]')
            // if (arrDistance[i] != 0) {
              console.log(arrDistance[i],'iiiiiiiii')

              var dis = arrDistance[i];
              aa[i] = dis;
              users[i].distance = aa[i];
              console.log(users[i],'us')
              // if (aa[i] != 0) {
                arr.push(users[i]);
              // }
            // }
          }
          console.log(arr,'arr')
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
            console.log(arr.length,'length')
            for (i = 0; i < arr.length; i++) {

              if (distDiffer1[i] != 0 && distDiffer1[i] != undefined) {
                distDiffer1[i] = distDiffer1[i].replace(',', '');
                distDiffer1[i] = parseInt(distDiffer1[i]);

                arr[i].siteDistance = distDiffer1[i];
              } else {
                arr[i].siteDistance = 0;
              }
            }

            res.render('admin/project-planner/viewUsers', {
              title: 'Project-Planner Dashboard',
              layout: 'layout/admin-layout.jade',
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

/* POST to offered users */
router.post('/jobOfferedUsers', async function (req, res) {
  chksession(req, res);

  var users = req.session.cart.users;
  var userDistance = req.body.distance;
  var userRates = req.body.rates;
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
    db.query('SELECT ur.hourly_rate, ur.max_pertime_rate, d.designation_name, d.id AS designationID FROM user_rates AS ur LEFT JOIN user_designation AS ud ON (ur.userId=ud.user_id) LEFT JOIN designation AS d ON (ud.designation_id=d.id) WHERE ur.userId = ? GROUP BY ur.userId ORDER BY ur.userId DESC', user, function (err, rates) {

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
        var budget = ((per_diem * total_weeks) + ((totalHours * rates[0].hourly_rate) + (totalExtraHours * (rates[0].hourly_rate * 1.5))) + (distance * 0.58));

        rates.forEach(function (id) {

          var d_id = id.designationID;

          if ((d_id >= 1 && d_id >= 4) || ((d_id >= 11 && d_id <= 14))) {

            var predicated_budget = budget * 20 / 100;
            total_predicated_budget = budget + predicated_budget;

          } else if ((d_id >= 5 && d_id >= 8) || ((d_id >= 15 && d_id <= 18))) {

            var predicated_budget = budget * 25 / 100;
            total_predicated_budget = budget + predicated_budget;

          } else if ((d_id >= 9 && d_id >= 10) || ((d_id >= 19 && d_id <= 20))) {

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
  // req.flash('msg_info', "Selected users have been sent job notifications, proceed with other designation !!");
  req.flash('msg_info', "Selected users have been sent job notifications.");
  req.session.cart = '';
  res.redirect('/admin/project-planner/view-jobs');
  // });

});

/* GET Filter users */
router.post('/searchUsers', function (req, res) {
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

  _ratingFilter = '';
  if (ratings) {
    _ratingFilter = ` AND u.ratings >= (${ratings})`
  }

  db.query('SELECT jobTypeId, latitude as site_latitude,longitude as site_longitude FROM jobs AS j JOIN jobsites AS js ON (js.id = j.siteId) where j.id=?', jobId, function (err, rows) {
    var jobtype = rows[0].jobTypeId;
    /* db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg, u.ratings, ci.name as city , s.name as state, C.name as country, count(user_id) as rank, (select GROUP_CONCAT(skill_name) from skills s join user_skills us2 on us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) as skills FROM user_skills us JOIN job_skills js on us.skill_id = js.skill_id JOIN users u on u.id = us.user_id LEFT JOIN cities ci ON (u.city = ci.id) LEFT JOIN states s ON (u.state = s.id) LEFT JOIN countries C ON (u.country = C.id) WHERE js.job_id = ? ${_skFilter} ${_ratingFilter} AND firstName LIKE '%${req.body.search ? req.body.search : '%'}%' AND u.role=1 AND u.id IN (SELECT user_id FROM user_designation WHERE designation_id = ?) AND u.search=1 GROUP BY us.user_id order by rank desc`, [jobId, jobId], function (err, users) { */
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
                var s = 0;
                d = distDiffer.push(s);
              }
            });
          });
          /* for (i = 0; i < d; i++) {
            users[i].distance = distDiffer[i] / 1000;
          } */
          for (i = 0; i < d; i++) {
            users[i].distance = distDiffer[i];
            // if (distDiffer[i] != 0) {
              arr.push(users[i]);
            // }
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

              if (distDiffer1[i] != 0 && distDiffer1[i] != undefined) {
                distDiffer1[i] = distDiffer1[i].replace(',', '');
                distDiffer1[i] = parseInt(distDiffer1[i]);

                arr[i].siteDistance = distDiffer1[i];
              } else {
                arr[i].siteDistance = 0;
              }
            }

            if (err)
              console.error(err.message)
            res.render('admin/project-planner/viewUsers', {
              title: 'Project-Planner Dashboard',
              layout: 'layout/admin-layout.jade',
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

/* GET user cart to see added all user list */
router.get('/userCart', function (req, res, next) {
  let jobId = req.session.jobId;

  chksession(req, res);
  var cartCount = req.session.cart.totalUsers;

  if (cartCount == 0) {

    res.redirect('/admin/project-planner/userMap-view/' + jobId);
  } else {

    var userdis = [];
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
    var totalDis = '';
    var totalRates = '';
    var list = '( 0';
    userList.forEach(function (user) {
      list = list + ',' + user;
    });

    list = list + ')';
    userDistance.forEach(function (distance) {
      totalDis = dis.push(distance);
    });

    userRates.forEach(function (rates) {
      totalRates = r.push(rates);
    });


    db.query(`SELECT users.id, users.profileImg, CONCAT(firstName,' ',lastName) AS firstName, users.experience, users.newAddress from users where users.id IN ` + list + 'ORDER BY users.id DESC', function (err, users) {
      for (i = 0; i < totalDis; i++) {
        users[i].distance = dis[i];
      }
      for (i = 0; i < totalRates; i++) {
        users[i].rates = r[i];
      }

      db.query('SELECT ur.userId, ur.hourly_rate, ur.max_pertime_rate, d.designation_name, d.id AS designationID FROM user_rates AS ur LEFT JOIN user_designation AS ud ON (ur.userId=ud.user_id) LEFT JOIN designation AS d ON (ud.designation_id=d.id) WHERE ur.userId IN' + list + 'GROUP BY ur.userId ORDER BY ur.userId DESC', function (err, rates) {

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

          res.render('admin/project-planner/userCart', {
            title: 'Project-Planner  Dashboard',
            layout: 'layout/admin-layout.jade',
            cart: users,
            cartCount: cartCount,
            applications: req.session,
            id: jobId
          });
        });
      });
    });
  };
});


/* Get view-technician List */
router.get('/view-technician', function (req, res) {
  chksession(req, res);
  db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, users.id, users.eCode, users.experience, users.status, jobtype.type_name AS jobtype FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) where role=1 AND users.id in (Select user_id from user_sites where user_role=1 AND is_current =1 AND site_id IN (select id from jobsites where planner =?))', req.session.uid, function (err, rows) {

    if (err)
      console.error(err.message)
    res.render('admin/project-planner/view-technician', {
      title: 'Project-Planner Dashboard',
      layout: 'layout/admin-layout.jade',
      users: rows,
      applications: req.session
    });
  });
});

/* POST to find users based on jobType */
router.post('/search_userSkills', function (req, res) {
  chksession(req, res);
  if (req.body.id) {
    db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, users.id, users.eCode, users.experience, users.status, jobtype.type_name AS jobtype FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) where users.jobType=? AND role=1 AND users.id in (Select user_id from user_sites where user_role=1 AND is_current =1 AND site_id IN (select id from jobsites where planner =?))', [req.body.id, req.session.uid], function (err, rows) {
      // db.query('SELECT designation.id as designation_id,designation.designation_name,designation.job_type,jobtype.type_name, jobtype.id  FROM designation LEFT JOIN jobtype ON(designation.job_type=jobtype.id)', function (err, Designation) {
      // db.query('SELECT jobtype.id jobTypeId, jobtype.type_name AS jobtype FROM jobtype Where active=1', function (err, jobType) {
      if (err)
        console.error(err.message)
      res.render('admin/project-planner/view-technician', {
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
    res.redirect('/admin/project-planner/view-technician');
  }
});

/* GET Technician block-Unblock Status */
router.get('/block-UnblockTech/:id', function (req, res) {
  chksession(req, res);
  db.query('SELECT id, status from users where id=?', req.params.id, function (err, rows) {
    if (rows[0].status == 1) {

      db.query('UPDATE users SET status=0 WHERE id=?', req.params.id, function (err) {
        if (err)
          console.error(err.message)
        req.flash('msg_error', "Technician Blocked Successfully");
        res.redirect('/admin/project-planner/view-technician');
      });
    } else {
      db.query('UPDATE users SET status=1 WHERE id=?', req.params.id, function (err) {
        if (err)
          console.error(err.message)
        req.flash('msg_info', "Technician Unblocked Successfully");
        res.redirect('/admin/project-planner/view-technician');
      });
    }

  });
});

/* GET Technician profile */
router.get('/viewTechProfile/:id', function (req, res) {
  chksession(req, res);
  // db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, users.id, users.eCode, users.experience, users.status, jobtype.type_name AS jobtype, jobtype.description FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) where users.id=? AND role=1', req.params.id, function (err, rows) {
  db.query('SELECT CONCAT(`firstName`, " ", `lastName`) AS name, users.id, users.email, users.eCode, users.dob, users.experience, users.status, users.newAddress, jobtype.type_name AS jobtype, jobtype.description, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = ?)) as designation, (SELECT GROUP_CONCAT(skill_name) FROM skills s join user_skills us2 ON us2.skill_id = s.id WHERE us2.user_id = users.id GROUP BY us2.user_id) AS skills FROM users LEFT JOIN jobtype ON(users.jobType=jobtype.id) where users.id=? AND role=1 ', [req.params.id, req.params.id], function (err, rows) {
    db.query('SELECT id, certification_name, certificate_attachment, authority FROM certification where userId=? AND active=1', req.params.id, function (err, list) {
      db.query('SELECT AVG(rating) as total_rating, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=1) AS Workmanship_Quality, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=2) AS Attendance_Punctuality, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=3) AS Organization_Cleanliness, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=4) AS Communication_Updates, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=5) AS Worked_Safe, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=6) AS Followed_Instructions_Schedule, (SELECT AVG(rating) FROM `user_ratings` WHERE userId=? AND rating_type=7) AS Team_Player FROM `user_ratings` WHERE userId=?', [req.params.id, req.params.id, req.params.id, req.params.id, req.params.id, req.params.id, req.params.id, req.params.id], function (err, rating) {
        if (err)
          console.error(err.message)
        res.render('admin/project-planner/viewTechProfile', {
          title: 'Project-Planner',
          layout: 'layout/admin-layout.jade',
          users: rows,
          rating: rating[0],
          certificatonList: list,
          applications: req.session
        });
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
    res.render('admin/project-planner/manage-TimeSheet', {
      title: 'project-planner',
      layout: 'layout/admin-layout.jade',
      timeSheetDetails: rows,
      timeSheet: req.params.id,
      url: url,
      applications: req.session,
      taskreportingId: req.params.id
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
    res.redirect('/admin/project-planner/manage-TimeSheet/' + userId);
    req.end();
  } */

  var data = {
    inTime: req.body.inTime,
    outTime: req.body.outTime,
    hours_count: countHourTime,
  };
  console.log(data, 'data')
  var a = db.query('UPDATE taskreporting SET ? WHERE id = ?', [data, taskreportingId], function (err, rows, fields) {
    console.log(a.sql, 'qqqqqqq')
    if (err)
      console.error(err.message)
    req.flash('msg_info', "Time Updated Successfully");
    res.redirect('/admin/project-planner/manage-TimeSheet/' + userId);
  });

});

/* GET to see reviews */
router.get('/view-reviews/:id', function (req, res) {
  chksession(req, res);
  var id = req.params.body;
  db.query('SELECT ur.id, ur.reviews, ur.reviewDate, ur.isJobreview, CONCAT(`firstName`, " ", `lastName`) AS name FROM user_reviews AS ur JOIN users AS u ON (ur.review_by=u.id) WHERE active=1 AND userId=? ORDER BY reviewDate DESC', req.params.id, function (err, reviews) {
    if (err)
      console.error(err.message)
    res.render('admin/project-planner/view-reviews', {
      title: 'project-planner Dashboard',
      layout: 'layout/admin-layout.jade',
      reviewsList: reviews,
      applications: req.session
    });
  });
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
            res.redirect('/admin/project-planner/edit-profile');
          }
        } else {
          req.flash('msg_error', "Current Password and New Password can not be same!");
          res.redirect('/admin/project-planner/edit-profile');
        }
      } else {
        req.flash('msg_error', "Current Password is Invalid!");
        res.redirect('/admin/project-planner/edit-profile');
      }
    });

  });
});

/* GET to Map View */
router.get('/map-view', function (req, res) {
  chksession(req, res);

  db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.phone_number, u.latitude, u.longitude, u.role, u.ratings, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation,  s.total_score, s.neg_mark, s.wrong_answer_count, j.type_name, GROUP_CONCAT(jobName)as jobName, GROUP_CONCAT(jobCode) as jobCode From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) LEFT JOIN results AS s ON(u.id = s.userId) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1 AND u.id in (Select user_id from user_sites where user_role=1 AND is_current =1 AND site_id IN (select id from jobsites where planner =? )) GROUP by u.id`, req.session.uid, function (err, jobUsersList) {
    db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.phone_number, u.latitude, u.longitude, u.role, u.ratings, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation,  s.total_score, s.neg_mark, s.wrong_answer_count, j.type_name From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN results AS s ON(u.id = s.userId) LEFT JOIN users_job AS uj ON(u.id=uj.user_id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND u.id NOT IN (SELECT u.id From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) JOIN users_job AS uj ON(u.id=uj.user_id) JOIN jobs ON (uj.job_id=jobs.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND uj.isCurrentJob=1) AND u.id in (Select user_id from user_sites where user_role=1 and is_current =1 and site_id IN (select id from jobsites where planner =? )) GROUP by u.firstName`, req.session.uid, function (err, usersList) {

      // db.query(`SELECT js.id, js.sitesCode, js.siteName, js.newAddress, js.latitude, js.longitude, u.firstName AS supervisorName, us.firstName AS plannerName, (SELECT GROUP_CONCAT(firstName,' ',lastName) AS name FROM user_sites AS us JOIN users AS u ON (us.user_id=u.id) WHERE us.user_role=1 AND us.is_current=1 AND us.site_id=js.id) AS technicianList FROM jobsites AS js LEFT JOIN users AS u ON (js.supervisors=u.id) LEFT JOIN users AS us ON (js.planner=us.id)WHERE js.latitude IS NOT NULL AND js.latitude != ''`, function (err, jobSiteList) {

      // db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.phone_number, u.newAddress, u.profileImg, u.role, u.latitude, u.longitude From users AS u WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=2 AND u.status=1`, function (err, plannerList) {

      db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.phone_number, u.newAddress, u.profileImg, u.role, u.latitude, u.longitude, j.type_name From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=3 AND u.status=1 AND u.id in (Select user_id from user_sites where user_role=3 and is_current =1 and site_id IN (select id from jobsites where planner =? ))`, req.session.uid, function (err, supervisorList) {
        db.query(`SELECT js.id, js.sitesCode, js.sitesCodeCpy, js.siteName, js.newAddress, js.latitude, js.longitude, u.firstName AS supervisorName, u.lastName AS supervisorLastName, us.firstName AS plannerName, us.lastName AS plannerLastName, (SELECT GROUP_CONCAT(firstName,' ',lastName) AS name FROM user_sites AS us JOIN users AS u ON (us.user_id=u.id) WHERE us.user_role=1 AND us.is_current=1 AND us.site_id=js.id) AS technicianList, j.predicated_budget FROM jobsites AS js LEFT JOIN jobs AS j ON (js.id=j.siteId) LEFT JOIN users AS u ON (js.supervisors=u.id) LEFT JOIN users AS us ON (js.planner=us.id) WHERE js.latitude IS NOT NULL AND js.latitude != '' AND js.planner=?`, req.session.uid, function (err, jobSiteList) {
          var list = jobUsersList.concat(usersList, supervisorList, jobSiteList);
          res.render('admin/project-planner/map-view', {
            title: 'Map View',
            layout: 'layout/admin-layout.jade',
            list: list,
			url: url,
			apiKey: config.get('apiKey'),
            applications: req.session
          });
        });
        // });
      });
    });
  });

});

/* GET to Map View */
router.get('/technicianMap-view', function (req, res) {
  chksession(req, res);
  db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.newAddress, u.profileImg, u.phone_number, u.ratings, u.role, u.latitude, u.longitude, j.type_name, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation, s.total_score, s.neg_mark, s.wrong_answer_count From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) LEFT JOIN results AS s ON(u.id = s.userId)WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=1 AND u.status=1 AND u.id in (Select user_id from user_sites where user_role=1 AND is_current =1 AND site_id IN (select id from jobsites where planner =? )) GROUP by u.id`, req.session.uid, function (err, usersListDetail) {
    res.render('admin/project-planner/technicianMap-view', {
      title: 'Technician Map View',
      layout: 'layout/admin-layout.jade',
      usersListDetail: usersListDetail,
	  url: url,
	  apiKey: config.get('apiKey'),
      applications: req.session
    });
  });
});

/* GET to Map View */
router.get('/supervisorMap-view', function (req, res) {
  chksession(req, res);
  db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.phone_number, u.newAddress, u.profileImg, u.role, u.latitude, u.longitude, j.type_name From users AS u LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE u.latitude IS NOT NULL AND u.latitude != '' AND u.role=3 AND u.status=1 AND u.id in (Select user_id from user_sites where user_role=3 AND is_current =1 AND site_id IN (select id from jobsites where planner =? ))`, req.session.uid, function (err, supervisorList) {
    res.render('admin/project-planner/supervisorMap-view', {
      title: 'Technician Map View',
      layout: 'layout/admin-layout.jade',
      supervisorList: supervisorList,
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
  db.query('SELECT jobTypeId, latitude as site_latitude,longitude as site_longitude FROM jobs AS j JOIN jobsites AS js ON (js.id = j.siteId) where j.id=?', jobId, function (err, rows) {
    var jobtype = rows[0].jobTypeId;
    db.query('SELECT id AS designationId, designation_name FROM designation WHERE job_type=?', jobtype, function (err, designation) {
      db.query('SELECT predicated_budget, proposed_budget FROM jobs WHERE id=?', jobId, function (err, budget) {
        // var budget = Number(parseFloat(perdicatedBudget[0].predicated_budget).toFixed(2)).toLocaleString();
        // db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg, u.phone_number, u.email, u.ratings, u.newAddress, u.role, u.latitude, u.longitude, j.type_name, count(user_id) as rank, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation, (select (total_score-(wrong_answer_count*neg_mark)) as totalS from results where userId=u.id ORDER by exam_date+end_time desc limit 1) as total_score, (select GROUP_CONCAT(skill_name) from skills s join user_skills us2 on us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) as skills, (SELECT CONCAT(hourly_rate,'/',max_pertime_rate)) AS rates FROM user_skills us JOIN job_skills js on us.skill_id = js.skill_id JOIN users u on (u.id = us.user_id) JOIN user_rates AS ur ON (u.id = ur.userId) LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE js.job_id = ? ${_designationFilter} ${_skcartUserFilter} AND firstName LIKE '%${req.params.search ? req.params.search : '%'}%' AND u.role=1 AND u.id NOT IN (select user_id from users_job where job_id=? ) AND u.id NOT IN (select userId from joboffers where jobId=? ) AND u.search=1 GROUP BY us.user_id order by rank desc`, [jobId, jobId, jobId], function (err, users) {

        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg, u.phone_number, u.email, u.ratings, u.newAddress, u.role, u.latitude, u.longitude, j.type_name, count(u.id) as rank, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation, (select (total_score-(wrong_answer_count*neg_mark)) as totalS from results where userId=u.id ORDER by exam_date+end_time desc limit 1) as total_score,  (SELECT CONCAT(hourly_rate,'/',max_pertime_rate) FROM user_rates AS ur WHERE ur.userId =u.id GROUP by ur.userId) AS rates, (SELECT jobsites.latitude FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_lat,(SELECT jobsites.longitude as jobsite_long FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_long FROM users u JOIN user_rates AS ur ON (u.id = ur.userId) LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE firstName LIKE '%${req.params.search ? req.params.search : '%'}%' ${_designationFilter} ${_skcartUserFilter} AND u.jobType=(SELECT jobTypeId FROM jobs WHERE id ='${jobId}') AND u.role=1 AND u.id NOT IN (select user_id from users_job where job_id=? ) AND u.id NOT IN (select userId from joboffers where jobId=? ) AND u.search=1 GROUP BY u.id order by rank desc`, [jobId, jobId], function (err, users) {

          var cart = req.params.id;
          var site_latitude = parseFloat(rows[0].site_latitude);
          var site_longitude = parseFloat(rows[0].site_longitude);
          distDiffer = [];
          distDiffer1 = [];
          parameters = '';
          parameters1 = '';
          var d = '';
          var d1 = '';

          //Get Users with same lat long
          /*  var values = [
             { name: 'someName1' },
             { name: 'someName2' },
             { name: 'someName1' },
             { name: 'someName1' }
           ];
           var repeats = [], item, i = 0;
           for (let index = 0; index < values.length; index++) {
             //const element = array[index];
             
           } */
          /* while(i < values.length ){
            //repeats.indexOf(item = values[i++].name) > -1 ? values.pop(i--) : repeats.push(item)
          } */
          //Get Users with same lat long

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
            if (err)
              console.error(err.message)
            var jsonData = JSON.parse(body);
            var row = jsonData.rows;
            var arr = [];
            row.forEach(function (a) {
              var element = a.elements;
              element.forEach(function (b) {
                if (b.status == 'OK') {
                  var s = b.distance.text;
                  d = distDiffer.push(s);
                } else {
                  var s = b.distance;
                  d = distDiffer.push(s);
                }
              });
            });
            // for (i = 0; i < d; i++) {
            //   users[i].distance = distDiffer[i] / 1000;
            // }
            for (i = 0; i < d; i++) {
              users[i].distance = distDiffer[i];
              if (distDiffer[i] != 0) {
                arr.push(users[i]);
              }
            }

            request(options1, function (error, response, body1) {
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
                if (distDiffer1[i] != 0 && distDiffer1[i] != undefined) {
                  distDiffer1[i] = distDiffer1[i].replace(',', '');
                  distDiffer1[i] = parseInt(distDiffer1[i]);

                  arr[i].siteDistance = distDiffer1[i];
                } else {
                  arr[i].siteDistance = 0;
                }
              }
              res.render('admin/project-planner/userMap-view', {
                title: 'Technician Map View',
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
    req.flash('msg_info', "Selected user have been added into cart.");
    res.send('success');
    // res.redirect('/admin/project-planner/userMap-view/' + jobId);

  });
});

/* POST to send job notification */
/* router.post('/jobNotification', async function (req, res) {
  chksession(req, res);
  var id = req.body.id;
  var jobId = req.body.jobId;
  var distance = req.body.distance;
  var total_days = 0;
  var total_weeks = 0;
  var per_diem = 0;

  db.query('SELECT ur.hourly_rate, ur.max_pertime_rate, d.designation_name, d.id AS designationID FROM user_rates AS ur LEFT JOIN user_designation AS ud ON (ur.userId=ud.user_id) LEFT JOIN designation AS d ON (ud.designation_id=d.id) WHERE ur.userId = ?', id, function (err, rates) {
    db.query('SELECT workingHoursPerDay, workingDayPerWeek, days_count FROM jobs WHERE id= ?', jobId, function (err, hours) {
      if (err)
        console.error(err.message)

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
      var budget = ((per_diem * total_weeks) + (total_days * rates[0].hourly_rate) + (distance * 0.58));
      if (rates == 'null') {

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
      } else {
        var predicated_budget = budget * 20 / 100;
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
});
 */
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

  _ratingFilter = '';
  if (ratings) {
    _ratingFilter = ` AND u.ratings >= (${ratings})`
  }

  db.query('SELECT jobTypeId, latitude as site_latitude,longitude as site_longitude FROM jobs AS j JOIN jobsites AS js ON (js.id = j.siteId) where j.id=?', jobId, function (err, rows) {
    var jobtype = rows[0].jobTypeId;
    db.query('SELECT id AS designationId, designation_name FROM designation WHERE job_type=?', jobtype, function (err, designation) {
      db.query('SELECT predicated_budget FROM jobs WHERE id=?', jobId, function (err, budget) {
        // db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg,u.newAddress, u.latitude, u.longitude, u.ratings, u.latitude, u.longitude, count(user_id) as rank, (select GROUP_CONCAT(skill_name) from skills s join user_skills us2 on us2.skill_id = s.id WHERE us2.user_id = u.id GROUP BY us2.user_id) as skills FROM user_skills us JOIN job_skills js on us.skill_id = js.skill_id JOIN users u on u.id = us.user_id WHERE js.job_id = ? ${_designationFilter} ${_ratingFilter} AND firstName LIKE '%${req.body.search ? req.body.search : '%'}%' AND u.role=1 AND u.latitude IS NOT NULL AND u.latitude != '' AND u.search=1 GROUP BY us.user_id order by rank desc`, [jobId, jobId], function (err, users) {

        db.query(`SELECT CONCAT(firstName,' ',lastName) AS name, u.id, u.experience, u.profileImg, u.phone_number, u.email, u.ratings, u.newAddress, u.role, u.latitude, u.longitude, j.type_name, count(u.id) as rank, (SELECT designation_name FROM designation WHERE id=(SELECT designation_id from user_designation WHERE user_id = u.id)) as designation, (select (total_score-(wrong_answer_count*neg_mark)) as totalS from results where userId=u.id ORDER by exam_date+end_time desc limit 1) as total_score, (SELECT CONCAT(hourly_rate,'/',max_pertime_rate) FROM user_rates AS ur WHERE ur.userId =u.id GROUP by ur.userId) AS rates, (SELECT jobsites.latitude FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_lat,(SELECT jobsites.longitude as jobsite_long FROM joboffers JOIN jobs ON (joboffers.jobId=jobs.id) JOIN jobsites on (jobs.siteId= jobsites.id) WHERE userId = u.id and joboffers.status=5 ORDER by joboffers.date DESC LIMIT 1) as jobsite_long FROM users u JOIN user_rates AS ur ON (u.id = ur.userId) LEFT JOIN jobtype AS j ON(u.jobType = j.id) WHERE firstName LIKE '%${req.body.search ? req.body.search : '%'}%' ${_designationFilter} ${_skcartUserFilter} ${_ratingFilter} AND u.jobType=(SELECT jobTypeId FROM jobs WHERE id ='${jobId}') AND u.role=1 AND u.id NOT IN (select user_id from users_job where job_id=? ) AND u.id NOT IN (select userId from joboffers where jobId=? ) AND u.search=1 GROUP BY u.id order by rank desc`, [jobId, jobId], function (err, users) {
          var cart = req.params.id;
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

          options1 = {
            uri: 'https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=' + parameters1 + '&destinations=' + site_latitude + '%2C' + site_longitude + '&key='+config.apiKey,
            timeout: 200000000,
            followAllRedirects: true
          };

          request(options, function (err, response, body) {
            if (err)
              console.error(err.message)
            var jsonData = JSON.parse(body);
            var row = jsonData.rows;
            var arr = [];
            row.forEach(function (a) {
              var element = a.elements;
              element.forEach(function (b) {

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

              res.render('admin/project-planner/userMap-view', {
                title: 'Project Planner Map View',
                layout: 'layout/admin-layout.jade',
                users: arr,
                jobtype: jobtype,
                designation: designation,
                job_budget: budget,
				url: url,
				apiKey: config.get('apiKey'),
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

          res.render('admin/project-planner/chat', {
            title: 'Project Planner & HR Chat View',
            layout: 'layout/admin-layout.jade',
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

/***************************************************/

/*GET to upload attachment */
router.get('/upload-attachment/:id', function (req, res) {
  chksession(req, res);
  var id = req.params.id;
  res.render('admin/project-planner/upload-attachment', {
    title: 'add project attachment',
    layout: 'layout/admin-layout.jade',
    id: id,
    url: url,
    applications: req.session
  });
});

/* POST to upload attachment */
router.post('/upload-attachment/:id', function (req, res) {
  chksession(req, res);
  var id = req.params.id;
  // var projectId = req.body.projectId;
  let imageFile = req.files.attachment;
  let imageExtension = imageFile.name.split('.');
  if (imageExtension[1] == "jpg" || imageExtension[1] == "JPG" || imageExtension[1] == "jpeg" || imageExtension[1] == "JPEG" || imageExtension[1] == "png" || imageExtension[1] == "PNG" || imageExtension[1] == "pdf" || imageExtension[1] == "PDF") {

    let ext = imageExtension[(imageExtension).length - 1];
    var image = id + '_' + new Date().toISOString();
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
        res.redirect('/admin/project-planner/view-attachmentList/' + id);
      });
    });
  } else {
    req.flash('msg_info', "This format is not allowed , please upload file with '.png','.gif','.jpg','.pdf'");
    res.redirect('/admin/project-planner/upload-attachment/' + id);
  }


});
/* POST to upload attachment */
router.post('/uploadProject', function (req, res) {
  chksession(req, res);
  var id = req.body.jobId;
  let imageFile = req.files.attachment;
  let imageExtension = imageFile.name.split('.');
  if (imageExtension[1] == "jpg" || imageExtension[1] == "JPG" || imageExtension[1] == "jpeg" || imageExtension[1] == "JPEG" || imageExtension[1] == "png" || imageExtension[1] == "PNG" || imageExtension[1] == "pdf" || imageExtension[1] == "PDF") {

    let ext = imageExtension[(imageExtension).length - 1];
    var image = id + '_' + new Date().toISOString();
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
        res.redirect('/admin/project-planner/view-attachmentList/' + id);
      });
    });
  } else {
    req.flash('msg_info', "This format is not allowed , please upload file with '.png','.gif','.jpg','.pdf'");
    res.redirect('/admin/project-planner/upload-attachment/' + id);
  }


});

/* GET to view uploaded attcahment list based on projectId */
router.get('/view-attachmentList/:id', function (req, res) {
  chksession(req, res);
  var projectId = req.params.id;
  db.query('SELECT id, attachment, description, date FROM upload where projectId=? AND active=1', projectId, function (err, rows) {
    if (err)
      console.error(err.message)
    res.render('admin/project-planner/view-attachmentList', {
      title: 'Project Attachment View',
      layout: 'layout/admin-layout.jade',
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
      res.redirect('/admin/project-planner/view-attachmentList/' + projectId);
    });
  });
});
/***************************************************/
module.exports = router;