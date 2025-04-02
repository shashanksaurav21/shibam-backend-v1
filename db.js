const mysql = require("mysql2");

const pool = mysql.createPool({
  host: "srv1674.hstgr.io",
  user: "u484700053_printwerna224",
  password: "Werna@print224",
  database: "u484700053_werna_print",
  timezone: "Z",
});

module.exports = pool.promise();
