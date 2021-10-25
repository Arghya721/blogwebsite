require('dotenv').config()
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const FacebookStrategy = require('passport-facebook').Strategy;
const session = require('express-session');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const passport = require('passport');
const findOrCreate = require('mongoose-findorcreate');
const flash = require('connect-flash');
app.use(flash());

var message = "";

app.set('view engine', 'ejs');
app.use('/static',express.static('static'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
    secret:"Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

const url = process.env.URL;

mongoose.connect(url, {useNewUrlParser: true});

const blogschema = new mongoose.Schema({
    title:{
        type:String,
        required:true
    },

    author: {
        type:String,
        required:true},
    content: {
        type:String,
        required:true},
});

const Blog = mongoose.model("Blog", blogschema);

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    facebookId: String,
    googleId: String,
    secret: String,
    displayName: String,
    blog : [blogschema]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());


passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://blogmen.herokuapp.com/auth/google/callback",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    //console.log(profile);
    User.findOrCreate({ googleId: profile.id , username: profile.displayName }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] 
}));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/dashboard');
  });

passport.use(new FacebookStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://blogmen.herokuapp.com/auth/facebook/callback/",
    profileFields: ['id', 'displayName', 'name', 'gender', 'picture.type(large)','email']
  },
  function(accessToken, refreshToken, profile, cb) {
      //console.log(profile);
    User.findOrCreate({ facebookId: profile.id , username: profile.displayName }, function (err, user) {
      return cb(err, user);
    });
  }
));




app.get("/", (req, res) => {
    res.render("home",{logincheck:req.isAuthenticated()});
});

app.get("/login",(req,res)=>{
    if(req.isAuthenticated()){
        //console.log("logged in");
        res.redirect("/dashboard");
    }else
        res.render("login",{
            errors: req.flash("error"),
        });
});


app.get("/auth/facebook", passport.authenticate("facebook"));

app.get("/dashboard", isLoggedIn ,(req,res)=>{
    //console.log(req.user);
    res.render("dashboard",{user:req.user.username});
});

function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/login');
}


app.get("/create", isLoggedIn , (req,res)=>{
    res.render("create");
});

app.post("/create" , isLoggedIn , (req,res)=>{ 
    
    const blog = new Blog({
        title: req.body.title,
        author: req.body.author,
        content: req.body.content,
        });
        User.findOne({username: req.user.username}, function(err, user){
            if(err)
                console.log(err);
            else{
                user.blog.push(blog);
                user.save();
                res.redirect("/dashboard");
            }
        });
});

app.get("/view", isLoggedIn , (req,res)=>{
    User.findOne({username: req.user.username}, function(err, user){
        if(err)
            console.log(err);
        else
            res.render("view",{user:req.user.username , blogs:user.blog, userid:req.user._id});
    });
});



app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect("/dashboard");
  });

app.get("/signup",(req,res)=>{
    res.render("signup");
    });

  app.post("/signup",(req,res)=>{

    User.register({username: req.body.username}, req.body.password, (err, user)=>{
        if(err){
            //console.log(err);
            res.redirect("/signup");
        }else{
            passport.authenticate("local")(req,res,()=>{
                res.redirect("/dashboard");
            });
        }
    });
});

function loginalert(res){
    message = "Invalid Username or Password";
    res.redirect("/login");
}

app.post("/login",(req,res)=>{
    
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    
    req.login(user, (err)=>{
        if(err){
            console.log(err);
        }else{
            passport.authenticate("local",{
                successRedirect: "/dashboard",
                failureRedirect: "/login",
                failureFlash: true
            })(req,res,()=>{
                message="";
                res.redirect("/dashboard");
            });
        }
    });
});

app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
});

app.get('/posts/:userid/:blogid/:blogtitle', (req, res) => {
    const uid = req.params.userid;
    const bid = req.params.blogid;
   // console.log(uid);
    //const blogtitle = req.params.blogtitle;
    User.findById(uid, function(err, user){
        console.log(user);
        if(err)
            console.log(err);
            else{
                const post = user.blog.id(bid);
                //console.log(post);
                if(post===null){
                    res.render("noblog",{user:"Blog",logincheck:req.isAuthenticated()});
                }
                else
                    res.render("blog",{logincheck:req.isAuthenticated(),user:"Blog" , post:post});
                }
                });
});

app.get('/posts',(req,res)=>{
    User.find({}).then((users)=>{
        res.render("posts",{logincheck:req.isAuthenticated(),posts:users , user:"All Post"});        
    });
});

app.get("/update/:userid/:blogid/:blogtitle", isLoggedIn, (req,res)=>{
    const uid = req.params.userid;
    const bid = req.params.blogid;
    User.findById(uid, function(err, user){
        if(err)
            console.log(err);
            else{
                const post = user.blog.id(bid);
                res.render("update",{user:"Blog" , post:post , post:post , userid:uid , blogid:bid});
                }
                });
});


app.post("/update/:userid/:blogid/:blogtitle" ,isLoggedIn,(req,res)=>{
    const uid = req.params.userid;
    const bid = req.params.blogid;
    //console.log("Updated Started");
    User.findById(uid, function(err, user){
        if(err)
            console.log(err);
            else{
                const post = user.blog.id(bid);
                post.title = req.body.title;
                post.author = req.body.author;
                post.content = req.body.content;
                user.save();
                res.redirect("/view");
                }
                });
});
app.post("/delete/:userid/:blogid/:blogtitle", isLoggedIn, (req,res)=>{
    const uid = req.params.userid;
    const bid = req.params.blogid;
    User.findById(uid, function(err, user){
        if(err)
            console.log(err);
            else{
                user.blog.id(bid).remove();
                user.save();
                res.redirect("/view");
                }
                });
});

app.listen(port, () => {
    console.log('Server started on port 3000');
});
