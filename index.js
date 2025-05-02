require('dotenv').config();

const express = require('express');

const webApp = express();

webApp.use(express.urlencoded({ extended: true }));
webApp.use(express.json());
webApp.use((req, res, next) => {
    console.log(`Path ${req.path} with Method ${req.method}`);
    next();
});

// index.js (fragmento)
webApp.get('/healthz', (req, res) => {
    return res.status(200).send('OK');
  });

const homeRoute = require('./homeRoute');
const telegramRoute = require('./telegramRoute');
const dialogflowRoute = require('./dialogflowRoute');

webApp.use('/', homeRoute.router);
webApp.use('/telegram', telegramRoute.router);
webApp.use('/dialogflow', dialogflowRoute.router);

exports.telegramWebhook = webApp;
  

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

webApp.listen(PORT, HOST, () => {
    console.log(`Servidor escuchando en http://${HOST}:${PORT}`);
  });