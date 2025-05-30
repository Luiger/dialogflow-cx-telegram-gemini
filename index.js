// index.js
require('dotenv').config();

const express = require('express');
const { appendToSheet } = require('./googleSheetsService'); // Asegúrate que la ruta sea correcta

const webApp = express();

webApp.use(express.urlencoded({ extended: true }));
webApp.use(express.json()); // Importante para parsear el JSON de Dialogflow CX

webApp.use((req, res, next) => {
    console.log(`Path ${req.path} with Method ${req.method}`);
    next();
});

// Tus rutas existentes
const homeRoute = require('./homeRoute'); // Asumo que tienes este archivo
const telegramRoute = require('./telegramRoute');
const dialogflowRoute = require('./dialogflowRoute'); // Asumo que tienes este archivo y lo usas para llamar a DF desde tu backend

webApp.use('/', homeRoute.router);
webApp.use('/telegram', telegramRoute.router); // Ruta para interacciones con Telegram
webApp.use('/dialogflow', dialogflowRoute.router); // Asumo que es para que tu backend llame a DF API

// --- NUEVO ENDPOINT PARA EL WEBHOOK DE DIALOGFLOW CX (PARA LOGGING) ---
webApp.post('/cx-logger-webhook', async (req, res) => {
    console.log('Dialogflow CX Logger Webhook - Request Body:', JSON.stringify(req.body, null, 2));

    try {
        const sessionInfo = req.body.sessionInfo || {};
        const sessionPath = sessionInfo.session || 'NO_SESSION_ID';
        const sessionId = sessionPath.substring(sessionPath.lastIndexOf('/') + 1);

        // 1. userUtterance: Texto del usuario
        const userUtterance = req.body.text || req.body.transcript || 'N/A';

        // 2. agentUtterance: Respuesta(s) del bot
        const botResponseMessages = req.body.messages || [];
        let agentUtterance = botResponseMessages
            .map(msg => {
                if (msg.text && msg.text.text) return msg.text.text.join(' ');
                if (msg.payload) return '[CUSTOM PAYLOAD]'; // Representación simple de un payload
                // Añadir más lógica para otros tipos de mensajes si es necesario
                return '';
            })
            .join('\\n') // Usar '\\n' para nueva línea literal si la hoja de cálculo lo interpreta bien, o ' '
            .trim();
        if (!agentUtterance) agentUtterance = 'No direct bot response in this webhook call';

        // 3. matchType: Tipo de coincidencia
        //    (Puede estar en req.body.match.matchType o inferirse de otras partes)
        let matchType = 'N/A';
        if (req.body.match && req.body.match.matchType) {
            matchType = req.body.match.matchType;
        } else if (req.body.intentInfo && req.body.intentInfo.lastMatchedIntent) {
            matchType = 'INTENT';
        } else if (req.body.pageInfo && req.body.pageInfo.currentPage) {
            matchType = 'PAGE_TRANSITION'; // O un valor que te sirva para identificarlo
        }
        // Puedes agregar más lógica para identificar 'NO_MATCH', 'EVENT', etc.

        const detectedIntentName = (req.body.intentInfo && req.body.intentInfo.displayName) ? req.body.intentInfo.displayName : 'N/A';

        // 4. webhookTags: Tags configurados en Dialogflow CX para este webhook
        const webhookTags = (req.body.fulfillmentInfo && req.body.fulfillmentInfo.tag) ? req.body.fulfillmentInfo.tag : 'N/A';

        const parameters = sessionInfo.parameters ? JSON.stringify(sessionInfo.parameters) : '{}';
        const timestamp = new Date().toISOString();

        // Columnas para Google Sheets (asegúrate que el orden coincida con tu hoja):
        // Timestamp, SessionID, UserUtterance, AgentUtterance, DetectedIntent, MatchType, WebhookTags, Parameters
        const rowData = [
            timestamp,
            sessionId,
            userUtterance,
            agentUtterance,
            detectedIntentName, // Nombre del intent detectado
            matchType,
            webhookTags,
            parameters
        ];

        // Nombre de la hoja/pestaña en tu Google Sheet
        const sheetName = 'Conversations';
        await appendToSheet(sheetName, rowData);
        console.log(`Conversation turn logged to Google Sheets in tab: ${sheetName}`);

        // Respuesta a Dialogflow CX.
        // Si este webhook es SOLO para logging, una respuesta vacía o mínima es suficiente
        // para no interferir con el flujo normal de Dialogflow CX.
        const responseToDialogflow = {
            // Opcional: puedes pasar parámetros de sesión si necesitas modificarlos
            // session_info: {
            //   parameters: {
            //     last_logged_timestamp: timestamp
            //   }
            // }
        };
        res.status(200).json(responseToDialogflow);

    } catch (error) {
        console.error('Error in /cx-logger-webhook:', error.message);
        console.error('Error details:', JSON.stringify(error, null, 2)); // Loguea más detalles del error
        // Es importante responder a Dialogflow CX incluso si hay un error en el logging
        // para no romper el flujo de la conversación.
        res.status(500).json({ error: 'Failed to process webhook for logging' });
    }
});


const PORT = process.env.PORT || 3000;
webApp.listen(PORT, () => {
    console.log(`Server is up and running at ${PORT}`);
    console.log(`Telegram interactions are handled via routes in telegramRoute.js (mounted on /telegram)`);
    console.log(`Dialogflow CX logging webhook endpoint: POST to /cx-logger-webhook`);
    console.log('Ensure GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, and SPREADSHEET_ID are set as environment variables for Google Sheets logging.');
});

// Si estás usando esto para Google Cloud Functions o un entorno serverless similar,
// podrías necesitar exportar `webApp` de una manera específica.
// Para un servidor Node.js estándar en Render, `webApp.listen()` es lo principal.
// exports.telegramWebhook = webApp; // Esta línea puede ser necesaria o no dependiendo de cómo Render ejecute tu app.
                                  // Si Render usa un script de inicio como `npm start` que ejecuta `node index.js`, `listen` es suficiente.
                                  // Si da error, prueba comentándola.