var createError = require('http-errors');
var express = require('express');
var path = require('path');

// var expressValidator = require('express-validator');

var cookieParser = require('cookie-parser');
var logger = require('morgan');

// var favicon = require('serve-favicon');

var bodyParser = require('body-parser');
var flash = require('express-flash');
var session = require('express-session');
var fileUpload = require('express-fileupload');
// var expressValidator = require('express-validator');
var router = require('./mobile_API/index');
var router_sup = require('./mobile_API/supervisor');
var router_planner = require('./mobile_API/project-planner');
// home
var indexRouter = require('./routes/home/index');



// admin
var superAdminRouter = require('./routes/admin/super-admin');
var projectPlannerRouter = require('./routes/admin/project-planner');
var superVisorRouter = require('./routes/admin/supervisor');
// var manageJobsRouter = require('./routes/admin/manage-jobs');
// var skillManagementRouter = require('./routes/admin/skill-management');
// var jobsStatesRouter = require('./routes/admin/jobs-states');
// var managePositionRouter = require('./routes/admin/manage-position');
var hrRouter = require('./routes/admin/hr');

// user
var userTechnicianRouter = require('./routes/user/technician');
// var userJobsPositionRouter = require('./routes/user/jobs-position');
// var userManageRoleRouter = require('./routes/user/manage-role');
// var userManageProfileRouter = require('./routes/user/manage-profile');

var app = express();
app.locals.moment = require('moment');
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');


app.use(logger('dev'));
app.use(bodyParser.json({ limit: '20mb', extended: true }));
app.use(bodyParser.urlencoded({ limit: '20mb', extended: true }));

// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({
//   extended: false
// }));
app.use(express.json());
app.use(express.urlencoded({
  extended: false
}));
app.use(cookieParser());
app.use(session({
  secret: "secretpass123456",
  resave: true,
  saveUninitialized: true
}));

app.use(flash());
app.use(require('less-middleware')(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileUpload());
// app.use(expressValidator);
app.use('/mobile_API', router);
app.use('/mobile_API',router_sup);
app.use('/mobile_API', router_planner);
app.use('/', indexRouter);


// admin 
app.use('/admin/super-admin', superAdminRouter);
app.use('/admin/project-planner', projectPlannerRouter);
app.use('/admin/supervisor', superVisorRouter);
// app.use('/admin/manage-jobs', manageJobsRouter);
// app.use('/admin/skill-management', skillManagementRouter);
// app.use('/admin/jobs-states', jobsStatesRouter);
// app.use('/admin/manage-position', managePositionRouter);
app.use('/admin/hr', hrRouter);


// user
app.use('/user/technician', userTechnicianRouter);
// app.use('/user/jobs-position', userJobsPositionRouter);
// app.use('/user/manage-roles', userManageRoleRouter);
// app.use('/user/manage-profile', userManageProfileRouter);


// catch 404 and forward to error handler
// app.use(function (req, res, next) {
//   next(createError(404));
// });



app.use(function(req, res, next){
  res.status(404);

  res.format({
    html: function () {
      res.render('404', { url: req.url })
    },
    json: function () {
      res.json({ error: 'Not found' })
    },
    default: function () {
      res.type('txt').send('Not found')
    }
  })
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

/* For CORS Error*/
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
});

/* app.use(function(req, res, next) {
  res.status(404).sendFile('error.html', {root: publicPath});
}); */
module.exports = app;