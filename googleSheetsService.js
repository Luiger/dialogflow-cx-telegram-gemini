// googleSheetsService.js
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Reemplaza con la forma en que almacenas y accedes a tus credenciales de forma segura
// Podrías usar variables de entorno para cada campo del JSON o para el path al archivo.
// const KEYFILEPATH = path.join(__dirname, 'ruta-a-tu-archivo-credenciales.json'); // Ejemplo
// O, si usas variables de entorno para el contenido del JSON:

const {
    SERVICE_ACCOUNT_JSON_FILE_PATH,
    GOOGLE_CLIENT_EMAIL
} = require('./constant');

const credentialsx = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_JSON_FILE_PATH));

const credentials = {
  client_email: GOOGLE_CLIENT_EMAIL,
  credentialsx
  };

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const auth = new google.auth.GoogleAuth({
    // keyFile: KEYFILEPATH, // Descomenta si usas un archivo de claves directamente
    credentials, // Usa esto si cargas las credenciales desde variables de entorno
    scopes: SCOPES,
});

const SPREADSHEET_ID = '1etWrkZvDEkVt3Uj8iXXLN7TH4NCawNQDSuc0pDQCIsU'; // Obtén esto de la URL de tu Hoja de Cálculo

async function appendToSheet(sheetName, rowData) {
    try {
        const sheets = google.sheets({ version: 'v4', auth });
        const request = {
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1`, // Escribirá después de la última fila con datos en la hoja especificada
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [rowData],
            },
        };
        const response = await sheets.spreadsheets.values.append(request);
        console.log('Data written to sheet:', response.data);
        return response.data;
    } catch (err) {
        console.error('Error writing to Google Sheet:', err.response ? err.response.data : err.message);
        throw err; // Propaga el error para que el llamador pueda manejarlo
    }
}

module.exports = { appendToSheet };