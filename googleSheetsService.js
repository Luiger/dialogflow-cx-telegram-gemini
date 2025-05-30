// googleSheetsService.js
const { google } = require('googleapis');
const fs = require('fs'); // Necesitas fs para readFileSync

// Importa las constantes necesarias.
// SPREADSHEET_ID es crucial.
// SERVICE_ACCOUNT_JSON_FILE_PATH es la RUTA a tu archivo de credenciales.
// GOOGLE_CLIENT_EMAIL se vuelve redundante para la configuración de 'auth' si usas el archivo JSON completo.
const {
    SERVICE_ACCOUNT_JSON_FILE_PATH,
    // GOOGLE_CLIENT_EMAIL, // Ya no es necesario para construir 'auth' si se usa credentialsx directamente
    SPREADSHEET_ID
} = require('./constant');

// --- Logging para depuración ---
console.log('[DEBUG googleSheetsService] SPREADSHEET_ID importado:', SPREADSHEET_ID);
console.log('[DEBUG googleSheetsService] SERVICE_ACCOUNT_JSON_FILE_PATH importado:', SERVICE_ACCOUNT_JSON_FILE_PATH);

if (!SPREADSHEET_ID) {
    console.error('ERROR CRÍTICO: SPREADSHEET_ID no está definido. Verifica constant.js y las variables de entorno.');
}
if (!SERVICE_ACCOUNT_JSON_FILE_PATH) {
    console.error('ERROR CRÍTICO: SERVICE_ACCOUNT_JSON_FILE_PATH no está definido. Verifica constant.js y las variables de entorno.');
    // No se puede continuar sin la ruta al archivo de credenciales
}

let auth; // Declara auth para que esté en el scope

try {
    // Lee el archivo JSON de la cuenta de servicio y parsealo.
    // Asegúrate de que la codificación sea correcta, usualmente 'utf-8'.
    const credentialsFromFile = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_JSON_FILE_PATH, 'utf-8'));

    // Verifica que el objeto parseado contenga 'private_key' y 'client_email'
    if (!credentialsFromFile.private_key || !credentialsFromFile.client_email) {
        console.error('ERROR CRÍTICO: El archivo JSON de credenciales no contiene private_key o client_email.');
        console.error('[DEBUG googleSheetsService] Contenido parseado (parcial, sin private_key):', { project_id: credentialsFromFile.project_id, client_email: credentialsFromFile.client_email });
    } else {
        console.log('[DEBUG googleSheetsService] Archivo de credenciales cargado y parseado correctamente.');
        console.log('[DEBUG googleSheetsService] Client Email desde archivo:', credentialsFromFile.client_email);
    }

    const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

    // --- Opción de Autenticación Corregida ---
    // Pasa el objeto de credenciales parseado (credentialsFromFile) DIRECTAMENTE.
    auth = new google.auth.GoogleAuth({
        credentials: credentialsFromFile, // credentialsFromFile DEBE contener client_email y private_key
        scopes: SCOPES,
    });

    /*
    // --- Alternativa: Opción 1 (Usar keyFile) ---
    // Si prefieres usar la ruta directamente (más limpio si solo necesitas la ruta):
    auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_JSON_FILE_PATH, // La ruta al archivo JSON
        scopes: SCOPES,
    });
    */

} catch (e) {
    console.error("ERROR CRÍTICO al configurar la autenticación de Google:", e.message);
    console.error("[DEBUG googleSheetsService] Error durante la lectura/parseo del archivo JSON o configuración de GoogleAuth:", e);
}


async function appendToSheet(sheetName, rowData) {
    if (!auth) {
        console.error('Error en appendToSheet: La autenticación (auth) no está configurada debido a un error previo.');
        throw new Error('Google Auth is not configured. Check previous critical errors.');
    }
    if (!SPREADSHEET_ID) {
        console.error('Error en appendToSheet: SPREADSHEET_ID es undefined ANTES de la llamada a la API.');
        throw new Error('SPREADSHEET_ID is undefined. Cannot write to Google Sheet.');
    }

    try {
        const sheets = google.sheets({ version: 'v4', auth });
        const request = {
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [rowData],
            },
        };
        console.log(`[DEBUG appendToSheet] Intentando escribir en SPREADSHEET_ID: '${SPREADSHEET_ID}'`);
        const response = await sheets.spreadsheets.values.append(request);
        console.log('Data written to sheet:', response.data);
        return response.data;
    } catch (err) {
        console.error('Error writing to Google Sheet (catch block):', err.message);
        if (err.response && err.response.data && err.response.data.error) {
            console.error('Google API Error Details:', JSON.stringify(err.response.data.error, null, 2));
        } else if (err.errors) {
             console.error('Google API Errors Array:', JSON.stringify(err.errors, null, 2));
        }
        throw err;
    }
}

module.exports = { appendToSheet };