import express from 'express';

const router = express.Router();   // ➜ use express.Router()

/* GET home page */
router.get('/', (req, res) => {
  res.render('index', { title: 'Express' });
});

export default router;
