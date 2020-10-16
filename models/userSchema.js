const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstname: String,
  lastname: String,
  email: String,
  username: String,
  password: String,
  userListCollection: [],
});

module.exports = new mongoose.model("customlists", userSchema);
