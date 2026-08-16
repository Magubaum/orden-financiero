# Orden financiero (versión Firebase)

Esta versión no necesita servidor propio: la página se conecta directo a una base de datos de Firebase desde el navegador, y se aloja gratis en GitHub Pages.

## Qué es cada archivo

- `index.html`, `style.css`, `app.js`: la app en sí.
- `firebase-config.js`: acá van los datos de tu proyecto de Firebase (hay que completarlo, ver abajo).

## Un tema de seguridad que hay que tener claro

Esta versión no tiene sistema de login. Cualquiera que entre a la URL de la app puede ver y cargar movimientos. Eso está bien para el uso que le van a dar ustedes dos, pero significa que la dirección web no debería circular públicamente (no la publiquen en redes, por ejemplo). Es el mismo nivel de privacidad que tenía la versión de Render, ni mejor ni peor.

## Paso 1: crear el proyecto en Firebase

1. Andá a https://console.firebase.google.com con tu cuenta de Google.
2. Creá un proyecto nuevo, el nombre no importa demasiado (puede ser "orden-financiero").
3. Dentro del proyecto, andá a **Firestore Database** en el menú de la izquierda y creá una base de datos. Elegí modo **producción** (no "modo de prueba", que expira solo a los 30 días).
4. Andá a **Reglas** (Rules) de esa base y reemplazá el contenido por esto, para que la app pueda leer y escribir:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

5. Publicá esas reglas.

## Paso 2: conectar la app al proyecto

1. En Firebase, andá a la configuración del proyecto (ícono de tuerca) y bajá hasta "Tus apps".
2. Creá una app web nueva (ícono `</>`).
3. Te va a mostrar un bloque de configuración con `apiKey`, `authDomain`, etc. Copiá esos valores y pegalos en el archivo `firebase-config.js`, reemplazando donde dice `PEGAR_ACA`.

## Paso 3: subir a GitHub Pages

1. En el repositorio orden-financiero que ya tenés en GitHub, borrá los archivos viejos (server.js, db.js, package.json, package-lock.json, la carpeta public) y subí estos nuevos: `index.html`, `style.css`, `app.js`, `firebase-config.js` (con tus datos ya pegados), todos sueltos en la raíz del repositorio, no dentro de ninguna carpeta.
2. Andá a **Settings** del repositorio, sección **Pages**.
3. En "Source" elegí la rama `main` y la carpeta `/ (root)`.
4. Guardá. GitHub te va a dar una URL, algo como `https://magubaum.github.io/orden-financiero/`. Puede tardar uno o dos minutos en estar activa la primera vez.

Esa URL es la app. Como corre contra Firebase, los cambios que carga uno se ven en el otro dispositivo casi al instante, sin necesidad de refrescar.
