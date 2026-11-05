# Project requirements

Google Maps is required everywhere in Bingoor: website, customer app, rider app, warehouse views and super admin. Map display, search, geocoding, routing and Street View must use Google services exclusively. Device GPS may supply coordinates. Do not add another map provider or automatic provider fallback. Missing keys and Google failures must show an error with retry.

Use the Google Maps key managed in Admin > Login & Payments, and preserve exact saved delivery coordinates. See `.cursor/rules/google-maps-only.mdc` for the persistent map rule. Follow any additional instructions in each subproject's AGENTS.md.
