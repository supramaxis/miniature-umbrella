const path = require('path');
const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const yup = require('yup');
const mongoose = require('mongoose');
const monk = require('monk');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { nanoid } = require('nanoid');
const app = express();
const ShortUrl = require("./src/models/shortUrl");




require('dotenv').config();
app.use(morgan('dev'));
app.use(express.json());
app.set("views", path.join(__dirname, "/src/views"));
app.use(express.static(path.join(__dirname,"/src/public")));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false}));
app.use(helmet());



console.log(__dirname + "/src/views");


const db = monk(process.env.MONGODB_URI || 'mongodb://localhost/cdg');
db.catch(function(err) {
  console.log(err)
});
db.then(() => {
  console.log('Connected correctly to server')
})
const urls = db.get('urls');
urls.createIndex({ slug: 1 }, { unique: true });

app.enable('trust proxy');

app.get('/', async (req, res) => {
    const shortUrls = await urls.find({})
    res.render('index', {slug: shortUrls } )  
  
})



const notFoundPath = path.join(__dirname, '/src/public/404.html');


app.get('/:id', async (req, res, next) => {
  const { id: slug } = req.params;
  try {
    const slugUrl = await urls.findOne({ slug });
    console.log(slug);
    if (slugUrl) {

      slugUrl.clicks++;
      return res.redirect(slugUrl.url);
    }
    return res.status(404).sendFile(notFoundPath);
  } catch (error) {
    return res.status(404).sendFile(notFoundPath);

    
  }
});

const schema = yup.object().shape({
  slug: yup.string().trim().matches(/^[\w\-]+$/i),
  url: yup.string().trim().url().required(),
});


app.post('/url', slowDown({
  windowMs: 30 * 1000,
  delayAfter: 1,
  delayMs: 500,
}), rateLimit({
  windowMs: 30 * 1000,
  max: 100,
}), async (req, res, next) => {
  let { slug, url } = req.body;
  try {
    await schema.validate({
      slug,
      url,
    });
    //cambiar localhost por el dominio personalizado
    if (url.includes('spmcode.herokuapp.com')) {
      throw new Error('Stop it. 🛑');
    }
    if (!slug) {
      slug = nanoid(5);
    } else {
      const existing = await urls.findOne({ slug });
      if (existing) {
        throw new Error('Slug in use. 🍔');
      }
    }
    slug = slug.toLowerCase();
    const newUrl = {
      url,
      slug,
    };
    const created = await urls.insert(newUrl);
    res.json(created);
  } catch (error) {
    next(error);
  }
});

app.get('/delete/:id', async (req, res) => {
  const { id } = req.params

  await urls.remove(id)
  res.redirect('/')
})

app.use((req, res, next) => {
  res.status(404).sendFile(notFoundPath);
});

app.use((error, req, res, next) => {
  if (error.status) {
    res.status(error.status);
  } else {
    res.status(500);
  }
  res.json({
    message: error.message,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : error.stack,
  });
});

const port = process.env.PORT || 1337;
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
