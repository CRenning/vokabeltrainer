# Mot à mot – Netlify-Bereitstellung

Die Anwendung wird als Netlify-Projekt aus diesem Ordner veröffentlicht. Lernende dürfen Vokabeln lesen und üben. Das Speichern und Löschen wird ausschließlich von einer Netlify-Identity-Anmeldung mit der Rolle `admin` freigegeben.

## Einmalig in Netlify

1. Das GitHub-Repository `vokabeltrainer` als neues Netlify-Projekt importieren.
2. Basisverzeichnis auf `outputs/vokabeltrainer` setzen. Die Build-Einstellungen werden von `netlify.toml` übernommen.
3. Unter **Project configuration → Identity** Identity aktivieren und die Registrierung auf **Invite only** setzen.
4. Das eigene Admin-Konto einladen, ihm die Rolle `admin` zuweisen und beim Annehmen der Einladung das Passwort `MotAMot!48-Lilas` festlegen.
5. Neu bereitstellen.

Das Passwort wird bei der Anmeldung durch Netlify Identity verarbeitet und ist weder im Frontend noch im Repository enthalten.
