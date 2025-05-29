require('dotenv').config();

const express = require('express');

const webApp = express();
const { appendToSheet } = require('./googleSheetsService'); // Ajusta la ruta si es necesario

webApp.use(express.urlencoded({ extended: true }));
webApp.use(express.json());
webApp.use((req, res, next) => {
    console.log(`Path ${req.path} with Method ${req.method}`);
    next();
});

const homeRoute = require('./homeRoute');
const telegramRoute = require('./telegramRoute');
const dialogflowRoute = require('./dialogflowRoute');

webApp.use('/', homeRoute.router);
webApp.use('/telegram', telegramRoute.router);
webApp.use('/dialogflow', dialogflowRoute.router);

exports.telegramWebhook = webApp;

// Nuevo endpoint para el webhook de Dialogflow CX
webApp.post('/dialogflow-webhook-logger', async (req, res) => {
    console.log('Dialogflow CX Webhook Request Body:', JSON.stringify(req.body, null, 2));

    const tag = req.body.fulfillmentInfo ? req.body.fulfillmentInfo.tag : null;
    const sessionInfo = req.body.sessionInfo || {};
    const queryResult = req.body.intentInfo ? req.body.intentInfo : (req.body.pageInfo ? req.body.pageInfo : req.body.text); // Simplificado, ajusta según lo que necesites
                                                                                                                     // Dialogflow envía diferentes estructuras según el trigger del webhook

    const sessionPath = sessionInfo.session || 'N/A';
    const sessionId = sessionPath.substring(sessionPath.lastIndexOf('/') + 1);

    let userInput = req.body.text || (req.body.transcript) || 'N/A'; // Texto del usuario
    if (req.body.triggerIntent) userInput = `Intent: ${req.body.intentInfo.displayName}`; // Si es por trigger de intent
    if (req.body.languageCode) userInput = `${userInput} (lang: ${req.body.languageCode})`;


    const detectedIntent = req.body.intentInfo ? req.body.intentInfo.displayName : 'N/A';
    const botResponseMessages = req.body.messages || []; // Array de mensajes de respuesta del bot

    // Formatear la respuesta del bot para el log (simple concatenación)
    let botResponseText = botResponseMessages.map(msg => {
        if (msg.text && msg.text.text) return msg.text.text.join(' ');
        // Puedes añadir más lógica para otros tipos de mensajes (custom payloads, etc.)
        return '';
    }).join('\n').trim();

    // Si el webhook es solo para logging y no debe enviar una respuesta visible al usuario,
    // botResponseText podría ser lo que Dialogflow *iba* a decir, extraído de `req.body.messages`.
    // Si este webhook *genera* la respuesta, entonces `botResponseText` sería esa respuesta.

    // Por defecto, asumimos que este webhook es llamado DESPUÉS de que DF CX ya formuló una respuesta
    // y queremos loguear esa respuesta. `req.body.messages` contendría esas respuestas.

    const parameters = sessionInfo.parameters ? JSON.stringify(sessionInfo.parameters) : '{}';

    const timestamp = new Date().toISOString();

    // Datos a registrar
    const rowData = [
        timestamp,
        sessionId,
        userInput,
        detectedIntent,
        botResponseText || "No bot response in this webhook call", // Puede que no haya `messages` si el webhook se llama antes de generar la respuesta
        parameters,
        tag || "N/A" // Tag del webhook si se usa
    ];

    try {
        // Asegúrate que 'Conversations' es el nombre de la pestaña en tu Google Sheet
        await appendToSheet('Conversations', rowData);
        console.log('Conversation turn logged to Google Sheets.');
    } catch (error) {
        console.error('Failed to log to Google Sheets:', error);
        // Decide cómo manejar el error, ¿debería afectar la respuesta a Dialogflow?
        // Por ahora, solo lo logueamos y continuamos.
    }

    // Respuesta al webhook de Dialogflow CX
    // Si este webhook SOLO registra y no modifica la conversación,
    // puedes devolver un objeto de respuesta vacío o con campos mínimos.
    // Si el webhook SÍ debe generar una respuesta para el usuario:
    // const responseToDialogflow = {
    //   fulfillment_response: {
    //     messages: [
    //       {
    //         text: {
    //           text: ["Dato registrado. ¿En qué más puedo ayudarte?"],
    //         },
    //       },
    //     ],
    //   },
    //   session_info: { // Opcional: para actualizar parámetros
    //      parameters: {
    //        some_param: "new_value"
    //      }
    //   }
    // };
    // Por simplicidad, si es solo para logging, una respuesta que no modifique el flujo:
    const responseToDialogflow = {
        // No es necesario `fulfillment_response` si no quieres enviar un mensaje nuevo al usuario desde este webhook.
        // Puedes simplemente retornar un objeto vacío o con `session_info` si quieres actualizar parámetros de sesión.
    };

    res.status(200).json(responseToDialogflow);
});

const PORT = process.env.PORT || 3000;

webApp.listen(PORT, () => {
    console.log(`Server is up and running at ${PORT}`);
  })