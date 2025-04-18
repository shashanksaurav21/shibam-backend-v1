require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
  host: "srv1674.hstgr.io",
  user: "u484700053_printwerna224",
  password: "Werna@print224",
  database: "u484700053_werna_print",
  timezone: "Z",
  // host: "localhost",
  // user: "root",
  // database: "shibam_admin",
  //   host: process.env.DB_HOST,
  //   user: process.env.DB_USER,
  //   password: process.env.DB_PASSWORD,
  //   database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("Connected to MySQL database");
  }
});

app.get("/", (req, res) => {
  res.send("Server is working!");
});

// Create a new customer
app.post("/customers/add", (req, res) => {
  const { customer_name, address, pin_code, state, country, pan_no, gst_no } =
    req.body;
  const sql = `INSERT INTO customers (customer_name, address, pin_code, state, country, pan_no, gst_no) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.query(
    sql,
    [customer_name, address, pin_code, state, country, pan_no, gst_no],
    (err, result) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({
          message: "Customer added successfully",
          id: result.insertId,
        });
      }
    }
  );
});

// Get customers (with optional search by name)
app.get("/customers/getAll", (req, res) => {
  const { search } = req.query;
  let sql = `SELECT * FROM customers`;

  if (search) {
    sql += ` WHERE customer_name LIKE ?`;
  }

  db.query(sql, search ? [`%${search}%`] : [], (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(results);
    }
  });
});

// Add price list for customers
app.post("/customers/prices/:customerId", (req, res) => {
  const customerId = req.params.customerId;
  const priceData = req.body;

  console.log(customerId, priceData, priceData.sub, "cdcdcdcdddcd");

  if (!Array.isArray(priceData)) {
    return res.status(400).json({ error: "Invalid data format" });
  }

  const insertHeaderSQL = `INSERT INTO price_headers (customer_id, header) VALUES (?, ?)`;
  const insertPriceSQL = `INSERT INTO price_list (header_id, subheader, price, weight) VALUES (?, ?, ?, ?)`;

  db.beginTransaction((err) => {
    if (err) return res.status(500).json({ error: "Transaction failed" });

    const processHeaders = priceData.map((headerItem) => {
      return new Promise((resolve, reject) => {
        db.query(
          insertHeaderSQL,
          [customerId, headerItem.header],
          (err, headerResult) => {
            if (err) return reject(err);

            console.log(headerResult, "hrhrhrhrhr");

            const headerId = headerResult.insertId;

            console.log(headerItem.sub, "sub header");
            const processSubcategories = headerItem.sub.map((sub) => {
              console.log(sub, "sub");
              return new Promise((subResolve, subReject) => {
                db.query(
                  insertPriceSQL,
                  [headerId, sub.subheader, sub.price, sub.weight],
                  (err) => {
                    if (err) return subReject(err);
                    subResolve();
                  }
                );
              });
            });

            Promise.all(processSubcategories)
              .then(() => resolve())
              .catch(reject);
          }
        );
      });
    });

    Promise.all(processHeaders)
      .then(() => {
        db.commit((err) => {
          if (err) {
            db.rollback();
            return res.status(500).json({ error: "Commit failed" });
          }
          res.json({ message: "Price list saved successfully" });
        });
      })
      .catch((err) => {
        db.rollback();
        res.status(500).json({ error: err.message });
      });
  });
});

// Get price list for customers
app.get("/customers/prices/:customerId", (req, res) => {
  const customerId = req.params.customerId;

  const getHeadersSQL = `SELECT id, header FROM price_headers WHERE customer_id = ?`;
  const getPricesSQL = `SELECT subheader, price, weight FROM price_list WHERE header_id = ?`;

  db.query(getHeadersSQL, [customerId], (err, headers) => {
    if (err) return res.status(500).json({ error: err.message });

    const processHeaders = headers.map((header) => {
      return new Promise((resolve, reject) => {
        db.query(getPricesSQL, [header.id], (err, prices) => {
          if (err) return reject(err);

          resolve({
            header: header.header,
            subcategories: prices,
          });
        });
      });
    });

    Promise.all(processHeaders)
      .then((result) => res.json(result))
      .catch((err) => res.status(500).json({ error: err.message }));
  });
});

//Delete price list for customers
app.delete("/customers/prices/:customerId", (req, res) => {
  const customerId = req.params.customerId;
  console.log(customerId, "customerIdcustomerId");

  const deleteSubheadersSQL = `DELETE FROM price_list WHERE header_id IN (SELECT id FROM price_headers WHERE customer_id = ?);`;
  const deleteHeadersSQL = `DELETE FROM price_headers WHERE customer_id = ?;`;

  db.beginTransaction((err) => {
    if (err) return res.status(500).json({ error: "Transaction failed" });

    db.query(deleteSubheadersSQL, [customerId], (err) => {
      if (err) {
        db.rollback();
        return res.status(500).json({ error: err.message });
      }

      db.query(deleteHeadersSQL, [customerId], (err) => {
        if (err) {
          db.rollback();
          return res.status(500).json({ error: err.message });
        }

        db.commit((err) => {
          if (err) {
            db.rollback();
            return res.status(500).json({ error: "Commit failed" });
          }
          res.json({
            message:
              "All headers and subheaders deleted successfully for the customer",
          });
        });
      });
    });
  });
});

// Get header by customer id
app.get("/customers/headers/:customerId", (req, res) => {
  const customerId = req.params.customerId;

  const sql = `SELECT id, header FROM price_headers WHERE customer_id = ?`;

  db.query(sql, [customerId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json(results);
  });
});

// Get sub-header by header id
app.get("/customers/subheaders/:header_id", (req, res) => {
  const header_id = req.params.header_id;

  const sql = `SELECT DISTINCT subheader FROM price_list WHERE header_id = ?`;

  db.query(sql, [header_id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json(results);
  });
});

app.get("/weight/:headerId/:subheader", (req, res) => {
  const { headerId, subheader } = req.params;

  const sql = `SELECT * FROM price_list WHERE header_id = ? AND subheader = ?`;

  db.query(sql, [headerId, subheader], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json(results);
  });
});

// Get all shipmants
app.get("/shipments/get", (req, res) => {
  const sql = "SELECT * FROM shipments";

  db.query(sql, (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(results);
    }
  });
});

//Get filtered shipments
app.get("/shipments/filter", (req, res) => {
  const { consignee, type, pickupDateFrom, pickupDateTo } = req.query;
  console.log(req.query, "queryyy");

  let sql = `SELECT * FROM shipments WHERE 1=1`;
  let values = [];

  if (consignee) {
    sql += ` AND consignee = ?`;
    values.push(consignee);
  }

  if (type) {
    sql += ` AND type = ?`;
    values.push(type);
  }

  if (pickupDateFrom && pickupDateTo) {
    // sql += ` AND pickupDate BETWEEN ? AND ?`;
    // values.push(pickupDateFrom, pickupDateTo);
    sql += ` AND pickupDate >= ? AND pickupDate <= ?`;
    values.push(pickupDateFrom, pickupDateTo);
  } else if (pickupDateFrom) {
    sql += ` AND pickupDate >= ?`;
    values.push(pickupDateFrom);
  } else if (pickupDateTo) {
    sql += ` AND pickupDate <= ?`;
    values.push(pickupDateTo);
  }

  db.query(sql, values, (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(results);
    }
  });
});

// Add shipments
app.post("/shipments/add", (req, res) => {
  const {
    awbNo,
    chargableWeight,
    codCharges,
    consignee,
    courier,
    deliveryDate,
    destination,
    fuel,
    invoiceNumber,
    location,
    pickupDate,
    priceType,
    quantity,
    remarks,
    status,
    type,
    weight,
    chargablePrice,
  } = req.body;

  const sql = `INSERT INTO shipments 
      (awbNo, chargableWeight, codCharges, consignee, courier, deliveryDate, destination, fuel, 
       invoiceNumber, location, pickupDate, priceType, quantity, remarks, status, type, weight,chargablePrice) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.query(
    sql,
    [
      awbNo,
      chargableWeight,
      codCharges,
      consignee,
      courier,
      deliveryDate,
      destination,
      fuel,
      invoiceNumber,
      location,
      pickupDate,
      priceType,
      quantity,
      remarks,
      status,
      type,
      weight,
      chargablePrice,
    ],
    (err, result) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({
          message: "Shipment added successfully",
          id: result.insertId,
        });
      }
    }
  );
});

app.put("/shipments/update/:id", (req, res) => {
  console.log(req.params, req.body, "inside api call");
  const { id } = req.params;
  const {
    chargableWeight,
    codCharges,
    consignee,
    courier,
    deliveryDate,
    destination,
    fuel,
    invoiceNumber,
    location,
    pickupDate,
    priceType,
    quantity,
    remarks,
    status,
    type,
    weight,
    chargablePrice,
    awbNo,
  } = req.body;

  const sql = `UPDATE shipments SET 
    chargableWeight = ?, codCharges = ?, consignee = ?, courier = ?, 
    deliveryDate = ?, destination = ?, fuel = ?, invoiceNumber = ?, 
    location = ?, pickupDate = ?, priceType = ?, quantity = ?, 
    remarks = ?, status = ?, type = ?, weight = ?, chargablePrice = ?, awbNo = ? WHERE id = ?`;

  db.query(
    sql,
    [
      chargableWeight,
      codCharges,
      consignee,
      courier,
      deliveryDate,
      destination,
      fuel,
      invoiceNumber,
      location,
      pickupDate,
      priceType,
      quantity,
      remarks,
      status,
      type,
      weight,
      chargablePrice,
      awbNo,
      id,
    ],
    (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
      } else if (result.affectedRows === 0) {
        res.status(404).json({ message: "Shipment not found" });
      } else {
        res.json({ message: "Shipment updated successfully" });
      }
    }
  );
});

//Get Shipments by id
app.get("/shipments/get/:id", (req, res) => {
  db.query(
    "SELECT * FROM shipments WHERE id = ?",
    [req.params.id],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (results.length === 0) {
        return res.status(404).json({ error: "Print list not found" });
      }
      res.json(results[0]);
    }
  );
});

app.delete("/shipments/delete/:id", (req, res) => {
  const { id } = req.params;

  const sql = "DELETE FROM shipments WHERE id = ?";

  db.query(sql, [id], (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (result.affectedRows === 0) {
      res.status(404).json({ message: "Shipment not found" });
    } else {
      res.json({ message: "Shipment deleted successfully" });
    }
  });
});

// Save Print List
app.post("/print-list", (req, res) => {
  console.log(req.body, "bodyyyy");
  const {
    customerId,
    shipmentData,
    periodFrom = null,
    periodTo = null,
    type = null,
    customer_name,
    oda_charges,
    appointment_charges,
  } = req.body;
  console.log(req.body, "reqqqqqqqq");

  if (!customerId || !shipmentData) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const sql = `INSERT INTO printlists (customerId, shipmentData, periodFrom, periodTo, type , customer_name, oda_charges, appointment_charges) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.query(
    sql,
    [
      customerId,
      JSON.stringify(shipmentData),
      periodFrom,
      periodTo,
      type,
      customer_name,
      oda_charges,
      appointment_charges,
    ],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id: result.insertId,
        customerId,
        shipmentData,
        periodFrom,
        periodTo,
        type,
      });
    }
  );
});

// Get All Print Lists
app.get("/print-list", (req, res) => {
  db.query("SELECT * FROM printlists", (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Get Print List by ID
app.get("/print-list/:id", (req, res) => {
  db.query(
    "SELECT * FROM printlists WHERE id = ?",
    [req.params.id],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (results.length === 0) {
        return res.status(404).json({ error: "Print list not found" });
      }
      res.json(results[0]);
    }
  );
});

// Delete Print List by ID
app.delete("/print-list/:id", (req, res) => {
  db.query(
    "DELETE FROM printlists WHERE id = ?",
    [req.params.id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Print list not found" });
      }
      res.json({ message: "Print list deleted successfully" });
    }
  );
});

app.get("/print-list/shipments/:id", (req, res) => {
  const printListId = req.params.id;
  console.log(printListId, "printListIdprintListId");

  // Step 1: Fetch shipmentData from PrintLists table
  const getShipmentDataQuery = "SELECT * FROM PrintLists WHERE id = ?";
  db.query(getShipmentDataQuery, [printListId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Print list not found" });
    }

    // Parse the JSON shipmentData array
    console.log(results, "printResultsss");
    const printData = results[0];
    const shipmentData = JSON.parse(printData.shipmentData);
    console.log(shipmentData, "shipmentDatashipmentData");
    // const shipmentData = JSON.parse(results[0].shipmentData);

    if (!shipmentData || shipmentData.length === 0) {
      console.log("No shipmentData");
      return res
        .status(404)
        .json({ error: "No shipments found in this print list" });
    }

    // Step 2: Fetch matching shipments from Shipments table
    const getShipmentsQuery = `SELECT * FROM shipments WHERE id IN (${shipmentData
      .map(() => "?")
      .join(",")})`;
    db.query(getShipmentsQuery, shipmentData, (err, shipments) => {
      console.log(err);
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ shipments, printData });
    });
  });
});
// Start server
const PORT = process.env.PORT || 5000;
// const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
