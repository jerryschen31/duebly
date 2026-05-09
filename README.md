# duebly

Initial MVP implementation of the Duebly task app.

https://duebly.app(https://duebly.app)

Show your support! Buy me a coffee(https://buymeacoffee.com/duebly)

## Kinde auth

The frontend can enable Kinde login/logout when these client environment variables are present:

```bash
DUEBLY_KINDE_DOMAIN=https://your-domain.kinde.com
DUEBLY_KINDE_CLIENT_ID=your_spa_client_id
DUEBLY_KINDE_REDIRECT_URI=https://duebly.app
DUEBLY_KINDE_LOGOUT_URI=https://duebly.app
```

`DUEBLY_AUTH_ENABLED` is optional; if it is unset, auth turns on automatically when all Kinde variables are configured.

Guest tasks are stored separately from signed-in user tasks. Guest data uses `duebly-guest-db`, while signed-in users use distinct IndexedDB databases named `duebly-user-...-db`.
