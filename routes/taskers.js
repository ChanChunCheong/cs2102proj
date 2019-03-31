const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");

const pool = require('../config/database');
const ensureAuthenticated = require('../config/ensureAuthenticated');

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

router.get("/", ensureAuthenticated, (req, res) => {
  //Retrieve all tasks and send along with render
  var cusId = parseInt(req.user.cusId)
  const param1 = [cusId];
  //console.log(cusId);
  const sql1 = "SELECT * FROM customers WHERE cusid = $1"
  pool.query(sql1, param1, (err, result1) => {
    if (err) {
      console.log("ERROR RETRIEVING Customer");
    } else {
      res.render('taskerProfile', { cusInfo: result1.rows });
    }

  });

});

router.get("/taskerSettings", ensureAuthenticated, (req, res) => {
  //var cusNum = parseInt(req.user.cusId);
  var cusDetails = [];
  var skills = [];

  var paramCus = [parseInt(req.user.cusId)]
  var sqlCus = "SELECT * FROM customers WHERE cusid = $1";

  pool.query(sqlCus, paramCus, (err, data) => {
    if (err) {
      throw err;
    } else {
      cusDetails = data.rows;
      //console.log(cusDetails);
      //res.render('taskerSettings', {});

      var paramSkill = [parseInt(req.user.cusId)]
      var sqlSkill =
        "SELECT s.ssid, s.description, c.catname, s.name FROM addedpersonalskills s INNER JOIN belongs b ON s.ssid = b.ssid INNER JOIN skillcategories c ON b.catid = c.catid WHERE cusid=$1";

      pool.query(sqlSkill, paramSkill, (err, data) => {
        if (err) {
          throw err;
        } else {
          skills = data.rows;
          //console.log(skills);
          res.render('taskerSettings', { allSkills: skills, cusInfo: cusDetails });
        }
      });
    }
  });

});

router.get("/viewRequests", ensureAuthenticated, (req, res) => {
  const user = req.user.cusId;


  const sql = "SELECT * FROM requests r INNER JOIN createdtasks t ON r.taskid = t.taskid WHERE hasResponded=false AND r.cusid = $1";
  const param = [user];

  pool.query(sql, param, (err, result) => {
    if (err) {
      throw err;
    } else {
      console.log(result.rows);
      res.render('pendingRequests', { requests: result.rows });
    }
    //res.redirect('/taskers');
  });
});

// else if (result.rows.length != 0) {
//   res.render('pendingRequests', {requests: result.rows});
// }
// console.log("THERE ARE NO PENDING REQUESTS!");

router.get("/acceptRequest/:taskid", ensureAuthenticated, (req, res) => {
  const user = req.user.cusId;
  const taskId = req.params.taskid;
  const sql = "UPDATE requests SET accepted = true WHERE taskid = $1 AND cusid = $2";
  const param = [taskId, user];

  pool.query(sql, param)
    .then((result) => {
      const sqlRequests1 = "UPDATE requests SET hasResponded = true WHERE taskid = $1 AND cusid = $2";
      const paramRequests1 = [taskId, user];
      return pool.query(sqlRequests1, paramRequests1);
    })
    .then((result) => {
      const sqlAssign = "INSERT INTO assigned(taskid,cusid,completed) VALUES ($1,$2,false)";
      const paramAssign = [taskId, user];
      return pool.query(sqlAssign, paramAssign);
    })
    .then((result) => {
      console.log(result)
      res.redirect('/taskers');

    })
    .catch((error) => {
      console.log("Error Accepting Task", error);
      req.flash("warning", "An error was encountered. Please try again.")
      res.redirect('/taskers/viewMyPendingTasks');
    })
  })

  


  router.get("/rejectRequest/:taskid", ensureAuthenticated, (req, res) => {
    const user = req.user.cusId;
    const taskId = req.params.taskid;
    const sql = "UPDATE requests SET accepted = false WHERE taskid = $1 AND cusid = $2";
    const param = [taskId, user];
  
    pool.query(sql, param)
      .then((result) => {
        const sqlRequests1 = "UPDATE requests SET hasResponded = true WHERE taskid = $1 AND cusid = $2";
        const paramRequests1 = [taskId, user];
        return pool.query(sqlRequests1, paramRequests1);
      })
      .then((result) => {
        console.log(result)
        res.redirect('/taskers');
  
      })
      .catch((error) => {
        console.log("Error Rejecting Task", error);
        req.flash("warning", "An error was encountered. Please try again.")
        res.redirect('/taskers/viewMyPendingTasks');
      })
    })

  router.get("/addSkill", ensureAuthenticated, (req, res) => {

    const sql = "SELECT * FROM skillcategories";
    pool.query(sql, (err, data) => {
      if (err) {
        console.log("error in sql query");
      } else {
        res.render("addSkill", { data: data.rows });
      }
    });
  });

  router.post("/addSkill", ensureAuthenticated, (req, res) => {

    req.checkBody("skillName", "Name of personal skill is required").notEmpty();
    req.checkBody("description", "Description is required").notEmpty();
    req.checkBody("rate", "Rate is required").notEmpty();
    req.checkBody("catName", "Category Name is required").notEmpty();
    var cusId = parseInt(req.user.cusId);

    let error = req.validationErrors();
    if (error) {
      console.log("PARAMETERS ERROR!");
      res.redirect('/taskers/addSkill');
    }

    const paramSkill = [cusId, req.body.description, req.body.rate, req.body.skillName];
    const sqlAddSkill = "INSERT INTO AddedPersonalSkills(cusId,description,ratePerHour, name) VALUES($1,$2,$3, $4) RETURNING ssid";
    pool.query(sqlAddSkill, paramSkill, (err, data) => {
      if (err) {
        console.log("Error inserting skill" + err);
      } else {
        var skillId = data.rows[0].ssid;

        const paramCatName = [req.body.catName];
        // console.log("category name:" + paramCatName);
        var sqlCat = "SELECT * FROM skillcategories WHERE catname = $1";

        pool.query(sqlCat, paramCatName, (err, result) => {
          if (err) {
            console.log("ERROR RETRIEVING CATEGORY ID" + err);
          } else {
            var paramBelongs = [result.rows[0].catid, skillId];
            var sqlBelongs = "INSERT INTO belongs(catid,ssid) VALUES ($1,$2)";
            pool.query(sqlBelongs, paramBelongs);
            res.redirect("/taskers/taskerSettings");
          }
        });
      }
    });

  });

  router.get("/updateSkill/:ssid", ensureAuthenticated, (req, res) => {
    var ssId = req.params.ssid;


    var sqlSkill = "SELECT * FROM addedpersonalskills WHERE ssid = " + ssId;

    pool.query(sqlSkill, (err, data) => {
      if (err) {
        console.log('ERROR RETRIEVING SKILL' + err);
      } else {
        var sqlCat = "SELECT * FROM skillcategories s INNER JOIN belongs b ON s.catid = b.catid WHERE b.ssid = " + ssId;
        pool.query(sqlCat, (err, results) => {
          if (err) {
            console.log('ERROR RETRIEVING CATEGORY' + err);
          } else {
            var catId = results.rows[0].catid
            var sqlAllCats = "SELECT * FROM skillcategories WHERE catid <> " + catId;
            pool.query(sqlAllCats, (err, allCats) => {
              if (err) {
                console.log('ERROR RETRIEVING ALL CATEGORIES' + err);
              } else {
                res.render('updateSkill', { skills: data.rows, category: results.rows, allCats: allCats.rows });
              }
            });

          }
        });
      }
    });

  });

  router.post("/updateSkill/:ssid", ensureAuthenticated, (req, res) => {
    req.checkBody("skillName", "Name of personal skill is required").notEmpty();
    req.checkBody("newDescription", "Description is required").notEmpty();
    req.checkBody("newRate", "Rate is required").notEmpty();
    req.checkBody("catName", "Category is required").notEmpty();
    var ssId = req.params.ssid;
    console.log("SSID OF UPDATED SKILL IS:" + ssId);
    console.log("New name:" + req.body.skillName);
    console.log("New Rate: " + req.body.newRate);
    console.log("New Description: " + req.body.newDescription);
    console.log("New Cat: " + req.body.catName);

    let error = req.validationErrors();
    if (error) {
      res.redirect("/taskers/taskerSettings");
      console.log('Error with inputs')
    } else {
      const params = [req.body.newDescription, req.body.newRate, ssId, req.body.newSkillName];
      var sql = "UPDATE addedpersonalskills SET description = $1, rateperhour = $2, name = $4 WHERE ssid = $3";

      pool.query(sql, params, (err, result) => {
        if (err) {
          console.log(err + " ERROR UPDATING SKILL");
        } else {
          var params2 = [req.body.catName];
          var sqlCatId = "SELECT * FROM skillcategories WHERE catname = $1";
          pool.query(sqlCatId, params2, (err, data) => {
            if (err) {
              console.log(err + "ERROR GETTING CATID");
            } else {
              var params3 = [data.rows[0].catid, ssId];
              var sqlUpdate = "UPDATE belongs SET catid = $1 WHERE ssid = $2";

              pool.query(sqlUpdate, params3, (err, data1) => {
                if (err) {
                  console.log(err + "ERROR GETTING CATID");
                } else {
                  res.redirect('/taskers/taskerSettings');
                }
              });
            }
          });
        }
      });
    }

  });

  router.get("/deleteSkill/:ssid", ensureAuthenticated, (req, res) => {
    //var cusId = parseInt(req.user.cusId);
    var ssId = parseInt(req.params.ssid);
    // console.log(ssId);
    //console.log(cusId);

    sqlDeleteSkill = "DELETE FROM addedpersonalskills WHERE ssid = " + ssId;
    sqlDeleteCat = "DELETE FROM belongs WHERE ssid = " + ssId;

    pool.query(sqlDeleteCat, (err, result) => {
      if (err) {
        console.log("Unable to delete personal skill record" + err);
      } else {
        pool.query(sqlDeleteSkill);
        res.redirect("/taskers/taskerSettings");
      }
    });
  });

  //View All My completed Tasks
  router.get('/viewMyCompletedTasks', ensureAuthenticated, function (req, res) {
    const sql = 'SELECT taskname, description, duration, manpower, taskdatetime, datecreated FROM createdTasks C join assigned A on (C.taskid = A.taskid AND A.cusid = $1 AND A.completed = true)'
    const params = [parseInt(req.user.cusId)]

    pool.query(sql, params, (error, result) => {

      if (error) {
        console.log('err: ', error);
      }

      res.render('view_my_tasks', {
        task: result.rows,
        taskType: 'COMPLETED'
      });

    });
  });

  //View all My pending Tasks
  router.get('/viewMyPendingTasks', ensureAuthenticated, function (req, res) {
    const sql = 'SELECT taskname, description, duration, manpower, taskdatetime, datecreated FROM createdTasks C join assigned A on (C.taskid = A.taskid AND A.cusid = $1 AND A.completed = false)'
    const params = [parseInt(req.user.cusId)]

    pool.query(sql, params, (error, result) => {

      if (error) {
        console.log('err: ', error);
      }

      res.render('view_my_tasks', {
        task: result.rows,
        taskType: 'PENDING'
      });

    });
  });

  //View all My bids placed
  router.get('/viewMyBids', ensureAuthenticated, function (req, res) {
    const sql = 'SELECT B.taskId, C.taskName, B.bidPrice, L.biddingDeadline, B.winningBid, L.hasChosenBid FROM CreatedTasks C join (Listings L join Bids B on (L.taskId = B.taskId)) on (C.taskId = L.taskId AND B.cusId = $1)'
    const params = [parseInt(req.user.cusId)]

    pool.query(sql, params, (error, result) => {

      if (error) {
        console.log('err: ', error);
      }

      res.render('view_my_bids', {
        bid: result.rows,
        currentDateTime: new Date()


      });
    });
  });

  //View my reviews
  router.get('/viewMyReviews', ensureAuthenticated, function (req, res) {
    const sql = "SELECT C.catName as catName, RV.rating, RV.description, CU1.name FROM Reviews RV join Requires R on RV.taskId=R.taskId " +
      "join SkillCategories C on R.catId=C.catId right join Customers CU on RV.cusId=CU.cusId join CreatedTasks T on RV.taskid=T.taskid join Customers CU1 on CU1.cusid=T.cusid WHERE CU.cusid=$1;"
    const params = [parseInt(req.user.cusId)]

    pool.query(sql, params, (error, result) => {

      if (error) {
        console.log('err: ', error);
      }

      console.log(result);
      res.render('view_my_reviews', {
        reviews: result.rows,

      });
    });
  })


  //When viewing tasker reviews before choosing tasker for task
  // router.get("/tasker/:catId/:ssId/:value/:taskerId",ensureAuthenticated, async (req, res) => {

  //   var catId= req.params.catId;
  //   var ssId= req.params.ssId;
  //   var taskerId= req.params.taskerId;
  //   var val;
  //    if (req.params.value === "greatValue") {
  //      val = true;
  //    }else {
  //      val = false;
  //    }

  //   var sqlprofile = "with countCatTasks as (select a.cusid, count(r.catid) as num from assigned a join requires r on a.taskid=r.taskid where a.completed=true group by a.cusid, r.catid) "+
  //   "SELECT T.name, T.cusid, (SELECT avg(rating) FROM Reviews WHERE cusId=T.cusId) AS taskerRating, c.num, S.ratePerHour, S.description "+
  //   "FROM Customers T join AddedPersonalSkills S on T.cusId=S.cusId join Belongs B on S.ssid=B.ssId left join countCatTasks c on c.cusid=T.cusid WHERE B.catid=" +catId + " and S.ssid=" +ssId + " and T.cusid=" +taskerId + ";"

  //   pool.query(sqlprofile, (err,profileresults)=> {
  //     if (err) {
  //       console.log("error in sqlprofile query" + err);
  //     } else {
  //       const sqlreviews = "SELECT C.catName as catName, RV.rating, RV.description, RV.taskId, CU1.name FROM Reviews RV join Requires R on RV.taskId=R.taskId "+
  //       "join SkillCategories C on R.catId=C.catId join Customers CU on RV.cusId=CU.cusId join CreatedTasks T on RV.taskid=T.taskid join Customers CU1 on CU1.cusid=T.cusid WHERE CU.cusid=" + taskerId+ ";"
  //         pool.query(sqlreviews, (err, reviewsresults)=> {
  //         if (err){
  //           console.log("error in sqlreviews query" + err);
  //         } else {
  //           var cat = "SELECT catname from skillcategories where catid=" + catId + ";"
  //           pool.query(cat, (err, category) => {
  //             if (err) {
  //               console.log("error in cat query" + err);
  //             } else {
  //                 res.render("viewTaskerProfileAndReviews", {
  //                 profile: profileresults.rows,
  //                 reviews: reviewsresults.rows,
  //                 catName: category.rows[0].catname,
  //                 catId,
  //                 val
  //                 });
  //               }

  //             }
  //           )
  //         }
  //       })
  //     }
  //   });
  //});

  module.exports = router;

