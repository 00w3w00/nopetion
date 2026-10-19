<div align="center">
  <img src="../../apps/client/public/icons/nopetion.svg" width="72" height="72" alt="Nopetion" />
  <h1>Nopetion</h1>
  <p><strong>Notion? Nope. Your docs, your rules.</strong></p>
  <p>Tus documentos, en tu propio servidor.</p>
  <p>
    <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-43853d?style=flat-square" />
    <img alt="pnpm 11.28.2" src="https://img.shields.io/badge/pnpm-11.28.2-f69220?style=flat-square" />
    <img alt="Local storage" src="https://img.shields.io/badge/storage-local-54718c?style=flat-square" />
  </p>
</div>

[한국어](ko-KR.md) · [English](en-US.md) · [日本語](ja-JP.md) · [简体中文](zh-CN.md) · [Deutsch](de-DE.md) · [Español](es-ES.md) · [Français](fr-FR.md) · [Italiano](it-IT.md) · [Nederlands](nl-NL.md) · [Português](pt-BR.md) · [Русский](ru-RU.md) · [Українська](uk-UA.md)

---

Un espacio personal basado en Docmost, con editor por bloques, páginas anidadas, IA para documentos y archivos adjuntos locales.

## Funciones

- Escribe con bloques, tablas, código y vistas de bases de datos de la edición comunitaria.
- Organiza páginas anidadas y espacios personales independientes; recupera la papelera y el historial.
- Selector completo de emojis y 96 iconos de página sugeridos.
- Exporta la página actual y las subpáginas elegidas a un PDF con fuentes coreanas.
- Instala la PWA y activa la edición sin conexión para páginas seleccionadas; sincroniza al reconectar.
- Genera etiquetas y listas de clasificación sin mover los documentos.
- Conecta la IA por separado y consulta las tareas en el panel de IA del documento.

## Primeros pasos

Prepara Docker Compose y Node.js 24; la guía también explica cómo configurar mediante un contenedor. Genera secretos nuevos, ajusta APP_URL en .env a la dirección real y arranca la aplicación.

```sh
node scripts/init-env.mjs
# Set APP_URL in .env
docker compose up --build -d
```

En el primer inicio escribe la misma contraseña en ambos campos para crear la cuenta propietaria. Después basta con la contraseña. No se aceptan contraseñas vacías; se permite un carácter, sin un límite específico de longitud.

[Server installation guide](../server-install.md)

## Ajustes dentro de la aplicación

En Ajustes → Funciones del servidor se gestionan Draw.io, el procesamiento opcional PDF/A con Gotenberg y los sitios autorizados para mostrar Nopetion en un marco. Guardar requiere la sesión del propietario. Los adjuntos se almacenan localmente. Se han eliminado el envío de correo y la recuperación de contraseña por correo.

## Traslado a otro servidor

El paquete privado incluye código y avisos de licencia. Excluye .env reales, cuentas, documentos, adjuntos, copias de seguridad e historial Git. Genera secretos nuevos en el destino.

[Installation & transfer](../server-install.md) · [Backup & restore](../backup-restore.md)

## Desarrollo

Node.js **24** · pnpm **11.28.2** · React/Mantine · NestJS · pnpm/Nx

```sh
corepack pnpm@11.28.2 install --frozen-lockfile
pnpm build
pnpm lint
pnpm test
pnpm test:personal
```

## Licencia y estado

Derivado de Docmost 0.96.0. El núcleo usa AGPL-3.0 y conserva los avisos originales y de terceros. Las rutas Enterprise tienen condiciones distintas; las implementaciones comerciales retiradas no se activan. No consideres todo el árbol histórico como AGPL. La revisión para distribución pública sigue abierta; el paquete sirve para pruebas en un servidor personal.

[Docmost](https://github.com/docmost/docmost) · [AGPL-3.0](../../LICENSE) · [Original README](../upstream-readme.md) · [Source record](../upstream-source.json) · [Notices](../../notices)
