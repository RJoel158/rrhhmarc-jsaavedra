FROM nginx:alpine

# Reemplazar configuración predeterminada de Nginx con el reverse proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar el código estático de la aplicación Web
COPY src /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
