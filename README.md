# Rifa POS

Sistema web para administrar rifas, ventas, cupos, premios y usuarios desde una interfaz centralizada.

La aplicacion esta formada por:

- **Cliente web:** React y Vite.
- **API:** Node.js y Express.
- **Base de datos:** Supabase PostgreSQL.
- **Persistencia local:** usada unicamente para ventanas de venta pendientes.

## Requisitos

Antes de comenzar instala:

- Node.js 18 o superior.
- npm.
- Un proyecto de Supabase.
- Git, si vas a clonar o publicar el repositorio.

No es necesario iniciar Redis ni ejecutar contenedores Docker. El archivo `docker-compose.yml` se conserva como referencia, pero actualmente no levanta servicios.

## Estructura del proyecto

```text
client/    Aplicacion React y Vite
server/    API Express, servicios y migraciones SQL
README.md  Guia del proyecto
```

## Instalacion

### 1. Clonar el repositorio

```powershell
git clone URL_DEL_REPOSITORIO
cd Rifa-gilces
```

Si ya tienes el proyecto en tu equipo, entra directamente en la carpeta del proyecto.

### 2. Instalar dependencias

Desde la carpeta principal:

```powershell
npm run install:server
npm run install:client
```

Tambien puedes instalarlas por separado:

```powershell
cd server
npm install
cd ..\client
npm install
cd ..
```

## Configurar Supabase

### 1. Crear el proyecto

Crea un proyecto nuevo en Supabase y espera a que la base de datos este disponible.

### 2. Crear las tablas base

Abre el **SQL Editor** de Supabase y ejecuta el contenido completo de:

[server/squema.SQL](server/squema.SQL)

Este archivo crea las tablas, relaciones, funciones y restricciones iniciales.

### 3. Ejecutar las migraciones

Despues de crear la estructura base, ejecuta las migraciones en orden numerico, de la `001` hasta la ultima disponible:

```text
server/migrations/001_facturas_por_usuario.sql
server/migrations/002_logo_rifa_por_tipo_y_area.sql
server/migrations/003_logo_rifa_usuario.sql
server/migrations/004_cupos_por_area_y_tipo_rifa.sql
server/migrations/005_cupos_decimales.sql
server/migrations/006_finalizacion_rifa_por_premio.sql
server/migrations/007_facturas_eliminacion_logica.sql
server/migrations/008_opciones_premios_area.sql
server/migrations/009_opciones_premios_proporcionales.sql
server/migrations/010_opciones_premios_por_tipo_rifa.sql
server/migrations/011_configuracion_factura.sql
server/migrations/012_corregir_trigger_premios_por_tipo.sql
server/migrations/013_modelos_factura.sql
server/migrations/014_factura_eliminada_compatibilidad.sql
server/migrations/015_indices_dashboard.sql
server/migrations/016_modelo_factura_loteria.sql
server/migrations/017_estadisticas_diarias_triggers.sql
server/migrations/018_cantidad_ventas_pendientes.sql
server/migrations/019_ganadores_pagada_manual.sql
server/migrations/020_venta_pagada_manual.sql
server/migrations/021_factura_aleatoria.sql
server/migrations/022_supervisor_vendedor.sql
server/migrations/023_tipo_rifa_area.sql
server/migrations/024_cupo_compartido_por_tipo.sql
server/migrations/025_cupos_compartidos_por_grupo.sql
server/migrations/026_seguridad_usuarios.sql
```

Si una migracion ya fue ejecutada, no la vuelvas a ejecutar sin revisar primero su contenido y el estado de la base de datos.

### 4. Crear las variables del servidor

Copia el archivo de ejemplo:

```powershell
Copy-Item server\.env.example server\.env
```

Edita `server/.env` y reemplaza los valores de prueba con los datos reales de tu proyecto:

```env
PORT=4000
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-clave-secreta
```

La API acepta `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_ANON_KEY` o `SUPABASE_PUBLISHABLE_KEY`. Para el servidor se recomienda usar una clave de servicio protegida.

Nunca subas `server/.env` a GitHub. El archivo `.env.example` solo debe contener valores ficticios.

### 5. Configurar la URL del cliente

Crea `client/.env`:

```env
VITE_API_URL=http://localhost:4000
```

En desarrollo local, esta es la configuracion recomendada. Si la API se publica en otro dominio, cambia el valor por la URL publica de la API.

## Iniciar la aplicacion

Necesitas dos terminales abiertas.

### Terminal 1: API

```powershell
cd server
npm run dev
```

La API quedara disponible en:

```text
http://localhost:4000
```

### Terminal 2: cliente web

```powershell
cd client
npm run dev
```

Vite mostrara la direccion local, normalmente:

```text
http://localhost:5173
```

Tambien puedes iniciar cada servicio desde la carpeta principal:

```powershell
npm run server
npm run client
```

## Comprobar que funciona

Abre esta direccion en el navegador:

```text
http://localhost:4000/api/health
```

La respuesta esperada es:

```json
{
  "ok": true,
  "message": "Rifa POS API funcionando con Supabase"
}
```

Despues abre la URL de Vite para acceder a la aplicacion web.

## Primer uso

Sigue este orden para configurar una instalacion nueva:

1. Inicia sesion con un usuario administrador.
2. En **Usuarios**, crea o revisa las cuentas del sistema.
3. En **Areas**, registra las zonas que usara la operacion.
4. En **Tipos de rifa**, crea los tipos disponibles.
5. En **Rifas**, registra cada sorteo y asigna su tipo.
6. En **Supervisores**, asigna vendedores a cada supervisor.
7. En **Cupos por area**, configura los limites de venta.
8. En **Opciones de premios**, define los premios por tipo, area, nivel y digitos.
9. En **Logos de rifa**, asigna la imagen correspondiente a cada tipo y area.
10. En **Facturas**, configura el formato de recibo de cada usuario cuando sea necesario.
11. Verifica el resultado desde el panel del vendedor realizando una venta de prueba.

## Paneles y permisos

### Administrador

El administrador tiene acceso a la operacion completa:

- Resumen general y estadisticas.
- Usuarios y roles.
- Areas.
- Supervisores y asignacion de vendedores.
- Tipos de rifa y rifas.
- Logos.
- Cupos compartidos por grupos de areas.
- Opciones de premios.
- Configuracion de facturas.
- Ventas y reportes.
- Seguridad.

Desde **Seguridad** puede:

- Consultar los inicios de sesion de todos los usuarios.
- Ver IP, navegador, sistema operativo, fecha de inicio y ultimo acceso.
- Cerrar todas las sesiones activas de un usuario.
- Bloquear temporalmente un usuario.

### Supervisor

El supervisor solo trabaja con los vendedores que le fueron asignados:

- **Resumen:** estadisticas agregadas de sus vendedores.
- **Vendedores:** ventas, numeros vendidos, premios pendientes y premios pagados por vendedor.
- **Seguridad:** sesiones unicamente de sus vendedores asignados.

Tambien puede cerrar sesiones o bloquear temporalmente a un vendedor asignado. No puede consultar ni administrar usuarios fuera de su grupo.

### Vendedor

El vendedor utiliza el punto de venta para:

1. Abrir una ventana de venta.
2. Seleccionar una rifa.
3. Elegir numeros disponibles.
4. Indicar el valor de la apuesta.
5. Revisar el resumen.
6. Confirmar el pago.
7. Imprimir o consultar el recibo.
8. Revisar su historial y gestionar premios disponibles.

El sistema reserva los numeros durante la ventana de venta. Si la ventana expira o se cierra sin pagar, las reservas pendientes se liberan.

## Seguridad y sesiones

Cada inicio de sesion crea un registro en la tabla `session` con:

- Usuario.
- IP recibida por la API.
- Navegador detectado desde `User-Agent`.
- Sistema operativo detectado.
- Fecha de inicio.
- Ultimo acceso.
- Estado de la sesion.

La API usa el header siguiente para las operaciones protegidas:

```http
Authorization: Bearer TOKEN_DE_SESION
```

La IP se registra correctamente cuando la peticion llega desde otro dispositivo. En desarrollo local es normal ver `127.0.0.1` o `::1`. Detras de un proxy confiable, Express utiliza la IP reenviada gracias a la configuracion `trust proxy`.

El bloqueo temporal utiliza el campo `usuario.bloqueado_hasta`. Al bloquear una cuenta, sus sesiones activas se cierran y el usuario no puede iniciar sesion hasta que termine el plazo.

## Cupos compartidos

Los cupos pueden configurarse como un grupo compartido entre varias areas. En ese caso:

- Varias areas pertenecen al mismo grupo.
- El grupo utiliza una unica bolsa de cupos.
- La primera venta consume el cupo compartido disponible.
- El cupo no se divide automaticamente entre las areas.
- El administrador selecciona las areas desde un buscador y puede revisar el grupo desde la tabla.

## Facturas y estadisticas

Las facturas pagadas se almacenan en Supabase junto con sus ventas. La aplicacion conserva la eliminacion de facturas como una operacion logica, por lo que los registros no se borran fisicamente.

Las estadisticas diarias se actualizan mediante triggers de PostgreSQL y se utilizan para:

- Totales de ventas.
- Cantidad de numeros vendidos.
- Premios generados.
- Premios pagados.
- Premios pendientes.
- Ranking de vendedores.
- Graficas diarias.

## API principal

### Estado y autenticacion

```text
GET  /api/health
POST /api/auth/login
POST /api/auth/register
```

### Usuarios y sesiones

```text
GET    /api/users
GET    /api/users/:id
POST   /api/users
PATCH  /api/users/:id
DELETE /api/users/:id

GET  /api/security/sessions
POST /api/security/users/:id/sessions/revoke
POST /api/security/users/:id/block
POST /api/sessions/logout
```

Las rutas de seguridad requieren un token valido en `Authorization`.

### Supervisores

```text
GET /api/supervisors
GET /api/supervisors/assignments
GET /api/supervisors/:id/vendors
PUT /api/supervisors/:id/vendors
GET /api/supervisors/:id/dashboard
```

### Operacion

```text
GET /api/raffles
GET /api/raffle-types
GET /api/areas
GET /api/raffle-area-quotas
GET /api/prize-options
GET /api/reports/ventas
GET /api/reports/premios
GET /api/reports/estadisticas-diarias
```

Para ver el listado completo de endpoints consulta los archivos dentro de `server/src/routes`.

## Pruebas de API con Thunder Client

1. Inicia la API.
2. Abre Thunder Client en VS Code.
3. Crea una solicitud nueva.
4. Selecciona el metodo HTTP.
5. Escribe la URL, por ejemplo `http://localhost:4000/api/health`.
6. Para solicitudes JSON agrega el header `Content-Type: application/json`.
7. En las rutas protegidas agrega `Authorization: Bearer TOKEN_DE_SESION`.
8. En solicitudes `POST` o `PATCH`, selecciona **Body > JSON**.

Los errores usan este formato:

```json
{
  "message": "Descripcion del error"
}
```

## Compilar para produccion

Genera la version de produccion del cliente con:

```powershell
cd client
npm run build
```

El resultado se crea en `client/dist`.

Para probar esa compilacion localmente:

```powershell
npm run preview
```

La API se ejecuta con:

```powershell
cd server
npm start
```

## Acceso desde otro dispositivo

Para probar la aplicacion desde un celular durante el desarrollo:

1. Inicia la API en el puerto 4000.
2. Inicia Vite con `npm run dev -- --host 0.0.0.0`.
3. Usa la direccion de red que muestra Vite si el celular esta en la misma red.
4. Para acceder desde otra red, utiliza un tunel HTTPS como Cloudflare Tunnel.
5. Configura `VITE_API_URL` con la URL publica de la API antes de iniciar Vite.

Las URLs de tunel rapido son temporales y no deben usarse como direccion de produccion.

## Solucion de problemas

### La API no inicia

- Verifica que `server/.env` exista.
- Comprueba que `SUPABASE_URL` y una clave valida esten configuradas.
- Revisa si el puerto 4000 ya esta ocupado.

### El cliente no puede conectarse a la API

- Comprueba que la API responda en `/api/health`.
- Revisa `client/.env`.
- Reinicia Vite despues de cambiar variables `VITE_*`.
- Si accedes desde un celular, no uses `localhost` como URL de la API.

### La IP aparece como local

- Desde la misma computadora es normal ver `127.0.0.1` o `::1`.
- Para registrar la IP publica, accede desde otro dispositivo y una red diferente.
- Si utilizas un proxy, verifica que reenvie correctamente la cabecera de IP.

### El usuario no puede iniciar sesion

- Comprueba el correo y la contrasena.
- Revisa que `activo` sea `true`.
- Comprueba que `bloqueado_hasta` sea nulo o que su fecha ya haya expirado.
- Revisa los registros del servidor y la respuesta de `/api/auth/login`.

## Reglas para publicar en GitHub

Antes de hacer `git push`:

1. Confirma que `.env` este incluido en `.gitignore`.
2. Verifica que `server/.env.example` solo tenga valores ficticios.
3. Revoca cualquier clave que haya sido expuesta.
4. Genera nuevas claves en Supabase.
5. Revisa que no haya tokens, contrasenas ni URLs privadas en commits anteriores.
6. Documenta en GitHub Secrets las variables necesarias para despliegue.

## Licencia

Define la licencia del proyecto antes de publicarlo si otras personas van a reutilizar el codigo.
