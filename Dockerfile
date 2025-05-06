# --- Etapa de construcción: instala dependencias y prepara el código ---
    FROM node:18-alpine AS build

    # Define el directorio de trabajo dentro del contenedor
    WORKDIR /app
    
    # Copia archivos de dependencias y asegura reproducibilidad
    COPY package.json package-lock.json ./
    
    # Instala únicamente dependencias de producción (mayor ligereza)
    RUN npm ci --only=production
    
    # Copia el resto del código fuente para el build final
    COPY . .
    
    # --- Etapa de ejecución: sólo lo necesario para correr la app ---
    FROM node:18-alpine AS runtime
    WORKDIR /app
    
    # Trae módulos ya instalados desde la etapa de build
    COPY --from=build /app/node_modules ./node_modules
    
    # Trae el código fuente (index.js, telegramBot.js, etc.)
    COPY --from=build /app .
    
    # Expone el puerto en el que Express escucha (3000)
    EXPOSE 8080
    
    # Arranca la aplicación (index.js inicializa Telegram y Express)
    CMD ["node", "index.js"]