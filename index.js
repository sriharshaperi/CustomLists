require('dotenv')
const express = require('express');
const app = express();
const routes = require('./routes/routes');
const path = require('path');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))
app.use(express.static("public"));
app.use(routes)

app.get('/', routes);
app.get('/register', routes);
app.post('/register', routes);
app.post('/login', routes);
app.get('/home', routes);
app.get('/logout', routes);
app.post('/home', routes)
app.post('/customList', routes)
app.get('home/:listTitle', routes)
app.post('/deleteItems', routes)
app.get('/logout', routes)
app.get('/lists', routes)
app.post('/deleteLists', routes)
app.post('/deleteAllLists', routes)
app.post('/editTitle', routes)
app.post('/clearList', routes)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`listening on port:${PORT}`));