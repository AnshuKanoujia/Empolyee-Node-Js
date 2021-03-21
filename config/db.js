var mysql = require('mysql');
var connection = mysql.createConnection({
    host: 'localhost',
    database:'emp_tracker',
    user: 'root',
    password: '',
    //Secret: "vcRueFMBm4Uolhf2sjYiB9r5J88WV9B7",
    
});

connection.connect();

module.exports = connection;


