require('dotenv')
const express = require("express");
const routes = express.Router();
const mongoose = require("mongoose");
const bodyparser = require("body-parser");
const bcrypt = require("bcryptjs");
const user = require("./../models/userSchema");
const passport = require("passport");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const flash = require("connect-flash");
const _ = require("lodash");

// using Bodyparser for getting form data
routes.use(bodyparser.urlencoded({ extended: true }));
// using cookie-parser and session
routes.use(cookieParser("secret"));
routes.use(
    session({
        secret: process.env.SECRET,
        maxAge: 3600000,
        resave: true,
        saveUninitialized: true,
    })
);
// using passport for authentications
routes.use(passport.initialize());
routes.use(passport.session());
// using flash for flash messages
routes.use(flash());

// MIDDLEWARES
// Global variable
routes.use(function (req, res, next) {
    res.locals.success_message = req.flash("success_message");
    res.locals.error_message = req.flash("error_message");
    res.locals.error = req.flash("error");
    next();
});

const checkAuthenticated = function (req, res, next) {
    if (req.isAuthenticated()) {
        res.set(
            "Cache-Control",
            "no-cache, private, no-store, must-revalidate, post-check=0, pre-check=0"
        );
        return next();
    } else {
        res.redirect("/");
    }
};

// Connecting To Database
// using Mongo Atlas as database
mongoose
    .connect(process.env.DB_NAME, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log(`connected to mongoDB on port:27017`))
    .catch(() => console.log("db connection error"));

// ALL ROUTES
routes.get("/", (req, res) => {
    res.render("login");
});

routes.get("/register", (req, res) => {
    res.render("register");
});

routes.post("/register", (req, res) => {
    var { firstname, lastname, email, username, password } = req.body;

    if (firstname.includes(" ")) {
        var strArray = firstname.split(" ");
        var newArray = strArray.map((n) => _.upperFirst(n.toLowerCase()));
        firstname = newArray.join(" ");
        console.log(firstname);
    } else firstname = _.upperFirst(firstname.toLowerCase());

    if (lastname.includes(" ")) {
        var strArray = lastname.split(" ");
        var newArray = strArray.map((n) => _.upperFirst(n.toLowerCase()));
        lastname = newArray.join(" ");
        console.log(lastname);
    } else lastname = _.upperFirst(lastname.toLowerCase());

    email = email.toLowerCase();
    console.log(email);

    var err;
    if (typeof err == "undefined") {
        user.findOne({ $or: [{ username: username }, { email: email }] }, function (
            err,
            data
        ) {
            if (err) throw err;
            if (data) {
                if (data.email === email && data.username === username) {
                    console.log("User Exists with email & username");
                    err = "User already exists with this email & username";
                    res.render("register", { err: err });
                } else if (data.email === email) {
                    console.log("User Exists with email");
                    err = "User already exists with this email";
                    res.render("register", { err: err });
                } else if (data.username === username) {
                    console.log("User Exists with username");
                    err = "User already exists with this username";
                    res.render("register", { err: err });
                }
            } else {
                bcrypt.genSalt(10, (err, salt) => {
                    if (err) throw err;
                    bcrypt.hash(password, salt, (err, hash) => {
                        if (err) throw err;
                        password = hash;
                        user({
                            firstname,
                            lastname,
                            email,
                            username,
                            password,
                        }).save((err, data) => {
                            if (err) throw err;
                            req.flash(
                                "success_message",
                                "Registered Successfully.. Login To Continue.."
                            );
                            res.redirect("/register");
                        });
                    });
                });
            }
        });
    }
});

// Authentication Strategy
// ---------------
var localStrategy = require("passport-local").Strategy;
passport.use(
    new localStrategy((username, password, done) => {
        user.findOne({ username: username }, (err, user) => {
            if (err) throw err;
            if (!user) {
                return done(null, false, { message: "User does not exist" });
            }
            bcrypt.compare(password, user.password, (err, match) => {
                if (err) {
                    return done(null, false, { message: "Something went wrong" });
                }
                if (!match) {
                    return done(null, false, { message: "Password does not match" });
                }
                if (match) {
                    return done(null, user);
                }
            });
        });
    })
);

passport.serializeUser(function (user, cb) {
    cb(null, user.id);
});

passport.deserializeUser(function (id, cb) {
    user.findById(id, function (err, user) {
        cb(err, user);
    });
});
// ---------------
// end of autentication statregy

routes.post("/login", (req, res, next) => {
    passport.authenticate("local", {
        failureRedirect: "/",
        successRedirect: "/home",
        failureFlash: true,
    })(req, res, next);
});

routes.get("/home", checkAuthenticated, (req, res) => {
    var listTitle = "Home";
    var defaultListItems = [
        "Click on Add Activity to add to list",
        "Checkmark the activity to delete",
    ];

    user.findOne({ username: req.user.username }, (err, found) => {
        if (err) throw err;
        else if (!found) console.log("No records found");
        else {
            if (found.userListCollection.length === 0) {
                user.updateOne(
                    { username: req.user.username },
                    {
                        $addToSet: {
                            userListCollection: {
                                listTitle: listTitle,
                                listItems: defaultListItems,
                            },
                        },
                    },
                    (err, success) => {
                        if (err) throw err;
                        else if (!success)
                            console.log("value has not been updated. check the update route");
                        else if (success) console.log("update was successful");
                    }
                );
                res.redirect("/home");
            } else {

                user.findOne({ username: req.user.username })
                    .then(found => {

                        found.userListCollection.forEach((list) => {
                            if (list.listTitle === listTitle) {

                                if (list.listItems.length === 0) {

                                    console.log('setting delfault list items');
                                    defaultListItems.forEach(item => {
                                        console.log('setting item => ', item);
                                        user.updateOne({ username: found.username, "userListCollection.listTitle": listTitle }, {
                                            $addToSet: {
                                                "userListCollection.$.listItems": item
                                            }
                                        })
                                            .then(() => console.log('updated default items'))
                                    })
                                }

                                res.render("home", {
                                    listTitle: list.listTitle,
                                    listItems: list.listItems,
                                    firstname: req.user.firstname,
                                    lastname: req.user.lastname,
                                });
                                console.log("found records on home page");
                            }
                        });
                    })
                    .catch(err => { console.log("No records found"); throw err; })
            }
        }
    });
});

routes.post("/home", checkAuthenticated, (req, res) => {
    var addItem = req.body.addItem;
    var listTitle = req.body.listTitle;

    user.findOne({ username: req.user.username }).then((found) => {

        user.updateOne(
            { username: found.username, "userListCollection.listTitle": listTitle },
            {
                $addToSet: {
                    "userListCollection.$.listItems": addItem,
                },
            }
        )
            .then(() => console.log("update successful"))
            .catch(() => console.log("update not successful"));
    });

    if (listTitle === "Home") res.redirect("/home");
    else res.redirect("/home/" + listTitle);
});

routes.get("/logout", (req, res) => {
    req.logout();
    req.flash("success_message", "You have been logged out");
    res.redirect("/");
});

routes.post("/customList", checkAuthenticated, (req, res) => {
    var customList = req.body.customListName;
    if (customList.includes(' '))
        customList = _.kebabCase(customList.toLowerCase().trim())
    else
        customList = customList.toLowerCase()
    console.log(customList);

    res.redirect("/home/" + customList);
});

routes.get("/home/:listTitle", checkAuthenticated, (req, res) => {

    var listTitle = req.params.listTitle;
    if (listTitle === "Home") res.redirect("/home");
    else {

        if (listTitle.includes('-')) {
            var splittedTitlesArray = listTitle.split('-')
            var modifiedSplittedTitlesArray = splittedTitlesArray.map(chunk => _.upperFirst(chunk))
            listTitle = modifiedSplittedTitlesArray.join(' ')
        }
        else listTitle = _.upperFirst(listTitle)

        var defaultListItems = [
            "Click on Add Activity to add to list",
            "Checkmark the activity to delete",
        ];

        user.findOne({ username: req.user.username })
            .then(found => {

                if (found.userListCollection.length === 0) {

                    user.updateOne({ username: found.username }, {
                        $addToSet: {
                            userListCollection: {
                                listTitle: listTitle,
                                listItems: defaultListItems,
                            }
                        }
                    })
                        .then(() => {
                            console.log('new list created with given list name and defalut items');
                            res.redirect('/home/' + listTitle)
                        })
                        .catch(() => console.log('problem occurred in creating new list with given list name and defalut items'))
                }
                else {

                    user.findOne({ username: req.user.username })
                        .then(found => {

                            found.userListCollection.forEach(list => {

                                var listTitlesArray = found.userListCollection.map(n => n.listTitle);

                                if (listTitlesArray.includes(listTitle)) {
                                    if (list.listTitle === listTitle) {


                                        if (list.listItems.length === 0) {

                                            for (let item of defaultListItems) {

                                                user.updateOne({ username: found.username, "userListCollection.listTitle": listTitle }, {
                                                    $addToSet: {
                                                        "userListCollection.$.listItems": item
                                                    }
                                                })
                                                    .then(() => console.log('successsssss'))

                                            }
                                        }
                                        res.render("home", {
                                            listTitle: list.listTitle,
                                            listItems: list.listItems,
                                            firstname: req.user.firstname,
                                            lastname: req.user.lastname,
                                        });
                                        console.log("found records on home page");
                                    }
                                }
                                else {
                                    user.updateOne({ username: req.user.username }, {
                                        $addToSet: {
                                            userListCollection: {
                                                listTitle: listTitle,
                                                listItems: defaultListItems,
                                            },
                                        },
                                    },
                                        (err, success) => {
                                            if (err) throw err;
                                            else if (!success)
                                                console.log("value has not been updated. check the update route");
                                            else if (success) console.log("update was successful");
                                        }
                                    );
                                    res.redirect('/home/' + listTitle)
                                }
                            })
                        })
                }
            })
    }
});

routes.post('/deleteItems', checkAuthenticated, (req, res) => {

    var data = req.body

    for (var key in data) {
        if (key !== 'listTitle') {
            checkedItemName = key;
            user.findOne({ username: req.user.username }).then((found) => {

                user.updateOne(
                    { username: found.username, "userListCollection.listTitle": data.listTitle },
                    {
                        $pull: {
                            "userListCollection.$.listItems": data[key],
                        },
                    }
                )
                    .then(() => {
                        console.log("update successful")
                        if (data.listTitle === 'home')
                            res.redirect('/home')
                        else
                            res.redirect('/home/' + data.listTitle)
                    })
                    .catch(() => console.log("update not successful"));
            });
        }

    }

})

routes.get('/lists', checkAuthenticated, (req, res) => {

    user.findOne({ username: req.user.username })
        .then(found => {
            var listItems = found.userListCollection.map(list => list.listTitle)
            if (listItems.length !== 0)
                res.render("lists", { firstname: req.user.firstname, lastname: req.user.lastname, listItems: listItems, listTitle: 'Lists' })
            else
                res.redirect('/home')
        })
})

routes.post('/deleteList', checkAuthenticated, (req, res) => {

    const routeButton = req.body;

    user.updateOne({ username: req.user.username }, {
        $pull: {
            userListCollection: {
                listTitle: routeButton.item
            }
        }
    })
        .then(() => console.log('deleted list successfully'))
        .catch((err) => { throw err })

    if (typeof routeButton.listTitle === 'undefined')
        res.redirect('/home')
    else {
        user.findOne({ username: req.user.username })
            .then(found => found.userListCollection.length === 0 ? res.redirect('/home') : res.redirect('/lists'))
    }
})

routes.post('/deleteAllLists', checkAuthenticated, (req, res) => {

    user.updateOne({ username: req.user.username }, {
        $set: {
            userListCollection: []
        }
    })
        .then(() => console.log('deleted all lists'))
        .catch((err) => { throw err })

    res.redirect('/home')
})

routes.post('/editTitle', checkAuthenticated, (req, res) => {

    var data = req.body

    if (data.currentTitle.includes(' '))
        data.currentTitle = _.kebabCase(data.currentTitle.toLowerCase().trim())
    else
        data.currentTitle = data.currentTitle.toLowerCase()


    if (data.currentTitle.includes('-')) {
        var splittedTitlesArray = data.currentTitle.split('-')
        var modifiedSplittedTitlesArray = splittedTitlesArray.map(chunk => _.upperFirst(chunk))
        data.currentTitle = modifiedSplittedTitlesArray.join(' ')
    }
    else data.currentTitle = _.upperFirst(data.currentTitle)

    if (data.currentTitle === data.previousTitle)
        res.redirect('/home/' + data.previousTitle)
    else {
        user.findOne({ username: req.user.username })
            .then(found => user.updateOne({ username: found.username, "userListCollection.listTitle": data.previousTitle }, {
                $set: {
                    "userListCollection.$.listTitle": data.currentTitle
                }
            })
                .then(() => { console.log('update successful'); res.redirect('/home/' + data.currentTitle) })
                .catch((err) => { throw err })

            )
            .catch((err) => { throw err })
    }
})

routes.post('/clearList', checkAuthenticated, (req, res) => {

    var listTitle = req.body.item

    user.findOne({ username: req.user.username })
        .then(found => user.updateOne({ username: found.username, "userListCollection.listTitle": listTitle }, {
            $set: {
                "userListCollection.$.listItems": []
            }
        })
            .then(() => { console.log('cleared list items'); res.redirect('/home/' + listTitle); })
            .catch((err) => { throw err })
        )
        .catch((err) => { throw err })


})

module.exports = routes;
