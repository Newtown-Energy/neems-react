# NEEMS React Web Interface

# Description

This is the front end for an EMS for BESS systems. It is written in
typescript and uses react components.

It is organized into a series of "screens".  Each screen is a
dashboard containing groupings of controls.

Controls groups might appear on more than one screen.  That is, there
should be a screen that includes all the control groups, ordered by
priority.  If any of the control groups contains an element that is in
an alarm condition, that group should appear higher on the screen.
If, while viewing this priority screen, the relative priority of
control groups changes, the groups might reorder themselves to reflect
updated priority.

There is a way to configure which screens are available. Screens may
be picked off the menu bar across the top of the interface.

# Install

`npm install` should do it.

But also, if you want non-docker tests, `cd docker/test` and `npm
install` there too.


# Run and Deploy

NEEMS EMS has a front end (this repo) and a back end (NEEMS Core).
For convenience, you can run this front end with `npm run dev`.  That
server can redirect API calls to the NEEMS Core backend by proxying
any `/api` route.  By default, npm will redirect to
`http://127.0.0.1:8000` but you can set NEEMS_CORE_SERVER in your
environment to change that.

There are a few other ways to run:
    
 1. For dev of the /api routes, you can run the rust backend, NEEMS
    Core, from its directory.  That backend will server static files
    from its `static` directory, which you can symlink to `./dist`
    (run `dosh build` or `npm run build` to generate dist files).
	
 2. In production, maybe you can put this behind a web server that
    serves the static files, but proxies /api calls to a running NEEMS
    Core on that or another machine.  Caddy would be a good choice if
    you want tls.


# Tests

See `docker/test/README.md` for all the test details.
