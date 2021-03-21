var express = require('express');
var db = require('../model/db');
var router = express.Router();

/* POST data to add user. */
router.post('/add', function (req, res) {
    var data = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.password
    };
});

module.exports = router;